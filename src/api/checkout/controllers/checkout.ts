import { factories } from '@strapi/strapi';
import { randomUUID } from 'crypto';

import {
  createOrderFromCheckout,
  finalizePaidCheckout,
  loadCheckoutLineItems,
  loadUserCart,
  recordPurchaseEvent,
} from '../../../utils/checkout-completion';
import {
  buildLineItemsFromRequest,
  generateGuestToken,
  getOptionalUser,
  resolveCheckoutAccess,
  resolveCheckoutLineItem,
  serializeLineItems,
} from '../../../utils/guest-checkout';
import {
  businessError,
  cartItemPopulate,
  cartSummary,
  CURRENCY,
  ensurePersistedVariant,
  requireUser,
  validateQuantity,
} from '../../../utils/commerce';
import {
  buildIdPartenaire,
  confirmSycapayOtp,
  fetchSycapayPaymentStatus,
  getSycapayConfig,
  initiateSycapayPayment,
  isSycapayPmService,
  mapSycapayRemoteStatus,
  normalizePhone,
} from '../../../utils/sycapay';

const CHECKOUT_TTL_MS = 6 * 60 * 60 * 1000;

const isEmail = (value: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? ''));
const filled = (value: unknown) => String(value ?? '').trim().length > 0;

/** Nom complet + téléphone obligatoires ; email facultatif. */
const normalizeCustomer = (customer: any) => {
  if (!customer || typeof customer !== 'object') return null;

  const fullName = String(customer.fullName ?? '').trim();
  let firstName = String(customer.firstName ?? '').trim();
  let lastName = String(customer.lastName ?? '').trim();

  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    firstName = parts[0] ?? '';
    lastName = parts.slice(1).join(' ');
  }

  const phone = String(customer.phone ?? '').trim();
  const emailRaw = String(customer.email ?? '').trim();

  return {
    fullName: fullName || [firstName, lastName].filter(Boolean).join(' ').trim(),
    firstName,
    lastName,
    phone,
    email: emailRaw || null,
  };
};

const validateCustomer = (customer: any) => {
  const normalized = normalizeCustomer(customer);
  if (!normalized) return false;

  const hasName = filled(normalized.fullName) || filled(normalized.firstName);
  if (!hasName) return false;
  if (!filled(normalized.phone)) return false;
  if (normalized.email && !isEmail(normalized.email)) return false;

  return true;
};

/** Une seule adresse texte — pas de code postal / ville / pays obligatoires. */
const normalizeAddress = (address: any) => {
  if (typeof address === 'string') {
    const text = address.trim();
    return text ? { address: text } : null;
  }
  if (!address || typeof address !== 'object') return null;

  const text = String(address.address ?? address.line1 ?? '').trim();
  if (!text) return null;

  return { address: text };
};

const validateAddress = (address: any) => Boolean(normalizeAddress(address));

const loadCart = loadUserCart;

const syncCheckoutItemsToCart = async (strapi: any, userId: number, items: any[] = []) => {
  if (!Array.isArray(items) || items.length === 0) return null;

  await strapi.db.query('api::cart-item.cart-item').deleteMany({
    where: { user: { id: userId } },
  });

  for (const item of items) {
    const resolved = await resolveCheckoutLineItem(strapi, item);
    if (resolved.error) return resolved.error;

    const { product, variant, quantity } = resolved;
    const persistedVariant = await ensurePersistedVariant(strapi, product, variant);

    await strapi.db.query('api::cart-item.cart-item').create({
      data: {
        user: userId,
        product: product.id,
        variant: persistedVariant.id,
        quantity,
      },
    });
  }

  return null;
};

const assertCartAvailable = (items: any[]) => {
  if (items.length === 0) return 'CART_EMPTY';

  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) return 'INVALID_QUANTITY';
    if (item.quantity > (item.variant?.stock ?? 0)) return 'OUT_OF_STOCK';
  }

  return null;
};

const checkoutPayload = (checkout: any, summary: any) => ({
  checkoutId: checkout.checkoutId,
  checkout_session_id: checkout.checkoutId,
  status: checkout.status,
  expiresAt: checkout.expiresAt,
  customer: checkout.customer,
  shippingAddress: checkout.shippingAddress,
  billingAddress: checkout.billingAddress,
  billingSameAsShipping: checkout.billingSameAsShipping,
  ...summary,
  analytics: {
    checkout_session_id: checkout.checkoutId,
    currency: summary.currency,
    value: summary.total,
    items: summary.items.map((item: any) => item.analytics),
  },
});

const loadCheckout = async (strapi: any, userId: number, checkoutId: string) =>
  strapi.db.query('api::checkout.checkout').findOne({
    where: {
      checkoutId,
      user: { id: userId },
    },
  });

const isExpired = (checkout: any) => new Date(checkout.expiresAt).getTime() <= Date.now();

const createStripePaymentIntent = async (amount: number, currency: string, checkoutId: string) => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const mockPayments = process.env.STRIPE_MOCK_PAYMENTS === 'true';

  if (!secretKey && mockPayments) {
    const id = `pi_mock_${randomUUID().replace(/-/g, '')}`;
    return {
      id,
      client_secret: `${id}_secret_mock`,
      status: 'requires_payment_method',
    };
  }

  if (!secretKey) return null;

  const body = new URLSearchParams({
    amount: String(amount),
    currency: currency.toLowerCase(),
    'metadata[checkoutId]': checkoutId,
  });

  const response = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) return null;
  return (await response.json()) as any;
};

const retrieveStripePaymentIntent = async (paymentIntentId: string) => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const mockPayments = process.env.STRIPE_MOCK_PAYMENTS === 'true';

  if (!secretKey && mockPayments && paymentIntentId.startsWith('pi_mock_')) {
    return { id: paymentIntentId, status: 'succeeded' };
  }

  if (!secretKey) return null;

  const response = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  if (!response.ok) return null;
  return (await response.json()) as any;
};

export default factories.createCoreController('api::checkout.checkout' as any, ({ strapi }) => {
  const loadPaymentForCheckout = async (checkoutId: string, paymentId?: string) => {
    const where: Record<string, unknown> = {
      checkoutId,
      provider: 'sycapay',
    };
    if (paymentId) where.paymentId = paymentId;

    const payments = await strapi.db.query('api::payment.payment').findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      limit: 1,
    });

    return payments[0] ?? null;
  };

  return {
  async init(ctx: any) {
    const user = await getOptionalUser(ctx, strapi);
    const { customer, shippingAddress, billingAddress, billingSameAsShipping = true, items: requestedItems } =
      ctx.request.body ?? {};

    if (!validateCustomer(customer)) {
      return businessError(ctx, 400, 'INVALID_CUSTOMER_INFO', 'Informations client invalides.');
    }

    if (!validateAddress(shippingAddress)) {
      return businessError(ctx, 400, 'INVALID_SHIPPING_ADDRESS', 'Adresse de livraison incomplète.');
    }

    const normalizedCustomer = normalizeCustomer(customer);
    const normalizedShipping = normalizeAddress(shippingAddress);
    const finalBillingAddress = billingSameAsShipping
      ? normalizedShipping
      : normalizeAddress(billingAddress) ?? normalizedShipping;

    if (!finalBillingAddress) {
      return businessError(ctx, 400, 'INVALID_BILLING_ADDRESS', 'Adresse de facturation incomplète.');
    }

    let items: any[] = [];

    if (user) {
      const syncError = await syncCheckoutItemsToCart(strapi, user.id, requestedItems);
      if (syncError === 'PRODUCT_NOT_FOUND') {
        return businessError(ctx, 404, 'PRODUCT_NOT_FOUND', 'Produit ou variante introuvable.');
      }
      if (syncError === 'VARIANT_NOT_FOUND') {
        return businessError(ctx, 400, 'VARIANT_NOT_FOUND', 'Variante introuvable pour ce produit.');
      }
      if (syncError === 'OUT_OF_STOCK') return businessError(ctx, 409, 'OUT_OF_STOCK', 'Stock insuffisant.');
      if (syncError) return businessError(ctx, 400, syncError, 'Panier invalide.');

      items = await loadCart(strapi, user.id);
    } else {
      const built = await buildLineItemsFromRequest(strapi, requestedItems);
      if (built.error === 'PRODUCT_NOT_FOUND') {
        return businessError(ctx, 404, 'PRODUCT_NOT_FOUND', 'Produit ou variante introuvable.');
      }
      if (built.error === 'VARIANT_NOT_FOUND') {
        return businessError(ctx, 400, 'VARIANT_NOT_FOUND', 'Variante introuvable pour ce produit.');
      }
      if (built.error === 'OUT_OF_STOCK') return businessError(ctx, 409, 'OUT_OF_STOCK', 'Stock insuffisant.');
      if (built.error === 'CART_EMPTY') return businessError(ctx, 400, 'CART_EMPTY', 'Le panier est vide.');
      if (built.error) return businessError(ctx, 400, built.error, 'Panier invalide.');
      items = built.items;
    }

    const cartError = assertCartAvailable(items);
    if (cartError === 'CART_EMPTY') return businessError(ctx, 400, 'CART_EMPTY', 'Le panier est vide.');
    if (cartError === 'OUT_OF_STOCK') return businessError(ctx, 409, 'OUT_OF_STOCK', 'Stock insuffisant.');
    if (cartError) return businessError(ctx, 400, cartError, 'Panier invalide.');

    const summary = cartSummary(items);
    const guestCredentials = user ? null : generateGuestToken();

    const checkout = await strapi.db.query('api::checkout.checkout').create({
      data: {
        checkoutId: `chk_${randomUUID().replace(/-/g, '')}`,
        status: 'draft',
        customer: normalizedCustomer,
        shippingAddress: normalizedShipping,
        billingAddress: finalBillingAddress,
        billingSameAsShipping,
        currency: summary.currency,
        subtotal: summary.subtotal,
        shipping: summary.shipping,
        total: summary.total,
        expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
        ...(user ? { user: user.id } : {}),
        ...(guestCredentials
          ? {
              guestTokenHash: guestCredentials.hash,
              itemsSnapshot: serializeLineItems(items),
            }
          : {}),
      },
    });

    ctx.body = {
      checkoutId: checkout.checkoutId,
      checkout_session_id: checkout.checkoutId,
      status: checkout.status,
      expiresAt: checkout.expiresAt,
      ...(guestCredentials ? { guestToken: guestCredentials.token } : {}),
      ...summary,
      analytics: {
        checkout_session_id: checkout.checkoutId,
        currency: summary.currency,
        value: summary.total,
        items: summary.items.map((item: any) => item.analytics),
      },
    };
  },

  async updateDraft(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const checkout = await loadCheckout(strapi, user.id, ctx.params.checkoutId);
    if (!checkout) return businessError(ctx, 404, 'CHECKOUT_NOT_FOUND', 'Checkout introuvable.');
    if (isExpired(checkout)) return businessError(ctx, 410, 'CHECKOUT_EXPIRED', 'Checkout expiré.');

    const next = {
      customer: ctx.request.body?.customer ?? checkout.customer,
      shippingAddress: ctx.request.body?.shippingAddress ?? checkout.shippingAddress,
      billingSameAsShipping: ctx.request.body?.billingSameAsShipping ?? checkout.billingSameAsShipping,
      billingAddress: ctx.request.body?.billingAddress ?? checkout.billingAddress,
    };

    if (!validateCustomer(next.customer)) {
      return businessError(ctx, 400, 'INVALID_CUSTOMER_INFO', 'Informations client invalides.');
    }
    if (!validateAddress(next.shippingAddress)) {
      return businessError(ctx, 400, 'INVALID_SHIPPING_ADDRESS', 'Adresse de livraison incomplète.');
    }

    const normalizedCustomer = normalizeCustomer(next.customer);
    const normalizedShipping = normalizeAddress(next.shippingAddress);
    const finalBillingAddress = next.billingSameAsShipping
      ? normalizedShipping
      : normalizeAddress(next.billingAddress) ?? normalizedShipping;

    if (!finalBillingAddress) {
      return businessError(ctx, 400, 'INVALID_BILLING_ADDRESS', 'Adresse de facturation incomplète.');
    }

    const updated = await strapi.db.query('api::checkout.checkout').update({
      where: { id: checkout.id },
      data: {
        customer: normalizedCustomer,
        shippingAddress: normalizedShipping,
        billingAddress: finalBillingAddress,
        billingSameAsShipping: next.billingSameAsShipping,
      },
    });

    ctx.body = checkoutPayload(updated, cartSummary(await loadCart(strapi, user.id)));
  },

  async findDraft(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const checkout = await loadCheckout(strapi, user.id, ctx.params.checkoutId);
    if (!checkout) return businessError(ctx, 404, 'CHECKOUT_NOT_FOUND', 'Checkout introuvable.');
    if (isExpired(checkout)) return businessError(ctx, 410, 'CHECKOUT_EXPIRED', 'Checkout expiré.');

    ctx.body = checkoutPayload(checkout, cartSummary(await loadCart(strapi, user.id)));
  },

  async createPaymentIntent(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const checkout = await loadCheckout(strapi, user.id, ctx.params.checkoutId);
    if (!checkout) return businessError(ctx, 404, 'CHECKOUT_NOT_FOUND', 'Checkout introuvable.');
    if (isExpired(checkout)) return businessError(ctx, 410, 'CHECKOUT_EXPIRED', 'Checkout expiré.');

    const items = await loadCart(strapi, user.id);
    const cartError = assertCartAvailable(items);
    if (cartError === 'CART_EMPTY') return businessError(ctx, 400, 'CART_EMPTY', 'Le panier est vide.');
    if (cartError === 'OUT_OF_STOCK') return businessError(ctx, 409, 'OUT_OF_STOCK', 'Stock insuffisant.');

    const summary = cartSummary(items);
    const currency = String(ctx.request.body?.currency ?? summary.currency).toUpperCase();
    if (currency !== CURRENCY) {
      return businessError(ctx, 400, 'PAYMENT_INFO_INCOMPLETE', 'Devise non supportée.');
    }

    const paymentIntent = await createStripePaymentIntent(summary.total, currency, checkout.checkoutId);
    if (!paymentIntent) {
      return businessError(ctx, 503, 'PAYMENT_INFO_INCOMPLETE', 'Configuration paiement incomplète.');
    }

    await strapi.db.query('api::checkout.checkout').update({
      where: { id: checkout.id },
      data: {
        status: 'payment_pending',
        subtotal: summary.subtotal,
        shipping: summary.shipping,
        total: summary.total,
        currency,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
      },
    });

    ctx.body = {
      checkoutId: checkout.checkoutId,
      checkout_session_id: checkout.checkoutId,
      provider: 'stripe',
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
      amount: summary.total,
      currency,
    };
  },

  async createSycapayPayment(ctx: any) {
    const access = await resolveCheckoutAccess(strapi, ctx, ctx.params.checkoutId);
    if (!access.ok) return;

    const { checkout, userId } = access;
    if (isExpired(checkout)) return businessError(ctx, 410, 'CHECKOUT_EXPIRED', 'Checkout expiré.');

    if (!getSycapayConfig()) {
      return businessError(ctx, 503, 'PAYMENT_INFO_INCOMPLETE', 'Configuration paiement incomplète.');
    }

    const codeServiceRaw = String(ctx.request.body?.codeService ?? '').trim();
    const numeroBeneficiaire = normalizePhone(
      ctx.request.body?.numeroBeneficiaire ?? checkout.customer?.phone,
    );

    if (!isSycapayPmService(codeServiceRaw)) {
      return businessError(
        ctx,
        400,
        'PAYMENT_INFO_INCOMPLETE',
        'codeService invalide (SN_PM_WAVE, SN_PM_OM, SN_PM_YAS, SN_PM_WIZALL).',
      );
    }

    if (numeroBeneficiaire.length < 8) {
      return businessError(ctx, 400, 'PAYMENT_INFO_INCOMPLETE', 'Numéro de téléphone invalide.');
    }

    const items = await loadCheckoutLineItems(strapi, checkout, userId);
    const cartError = assertCartAvailable(items);
    if (cartError === 'CART_EMPTY') return businessError(ctx, 400, 'CART_EMPTY', 'Le panier est vide.');
    if (cartError === 'OUT_OF_STOCK') return businessError(ctx, 409, 'OUT_OF_STOCK', 'Stock insuffisant.');

    const summary = cartSummary(items);
    const idPartenaire = buildIdPartenaire(checkout.checkoutId);
    const paymentId = randomUUID();
    const codeService = codeServiceRaw.toUpperCase() as
      | 'SN_PM_WAVE'
      | 'SN_PM_OM'
      | 'SN_PM_YAS'
      | 'SN_PM_WIZALL';

    const sycapay = await initiateSycapayPayment({
      montant: summary.total,
      codeService,
      numeroBeneficiaire,
      idPartenaire,
      nomMarchand: 'Nyra',
    });

    if (sycapay.ok === false) {
      strapi.log.warn('[sycapay] Echec initiationTransactionV1', {
        reason: sycapay.reason,
        message: sycapay.message,
        status: sycapay.status,
        checkoutId: checkout.checkoutId,
        codeService,
      });

      if (sycapay.reason === 'missing_config') {
        return businessError(ctx, 503, 'PAYMENT_INFO_INCOMPLETE', 'Configuration paiement incomplète.');
      }

      return businessError(ctx, 503, 'PAYMENT_TIMEOUT', 'Paiement temporairement indisponible.', {
        sycapayReason: sycapay.reason,
        sycapayMessage: sycapay.message ?? null,
        sycapayCode: sycapay.code ?? null,
      });
    }

    await strapi.db.query('api::payment.payment').create({
      data: {
        paymentId,
        refCommand: idPartenaire,
        token: sycapay.tokenTX,
        status: 'PENDING',
        provider: 'sycapay',
        checkoutId: checkout.checkoutId,
        amount: summary.total,
        currency: summary.currency,
        ...(userId ? { user: userId } : {}),
      },
    });

    await strapi.db.query('api::checkout.checkout').update({
      where: { id: checkout.id },
      data: {
        status: 'payment_pending',
        subtotal: summary.subtotal,
        shipping: summary.shipping,
        total: summary.total,
        currency: summary.currency,
        paymentIntentId: sycapay.tokenTX || idPartenaire,
      },
    });

    ctx.status = 201;
    ctx.body = {
      paymentId,
      idPartenaire,
      tokenTX: sycapay.tokenTX,
      status: 'PENDING',
      codeService,
      redirectUrl: sycapay.redirectUrl,
      deeplink: sycapay.deeplink,
      qrCode: sycapay.qrCode,
      otpRequired: sycapay.otpRequired,
    };
  },

  async confirmSycapayOtp(ctx: any) {
    const access = await resolveCheckoutAccess(strapi, ctx, ctx.params.checkoutId);
    if (!access.ok) return;

    const { checkout } = access;
    if (isExpired(checkout)) return businessError(ctx, 410, 'CHECKOUT_EXPIRED', 'Checkout expiré.');

    const paymentId = String(ctx.request.body?.paymentId ?? '').trim();
    const otp = String(ctx.request.body?.otp ?? '').trim();
    if (!otp) return businessError(ctx, 400, 'PAYMENT_INFO_INCOMPLETE', 'OTP requis.');

    const payment = await loadPaymentForCheckout(checkout.checkoutId, paymentId || undefined);
    if (!payment?.token) {
      return businessError(ctx, 400, 'PAYMENT_INFO_INCOMPLETE', 'Paiement Sycapay introuvable.');
    }

    const result = await confirmSycapayOtp(payment.token, otp);
    if (!result.ok) {
      return businessError(ctx, 402, 'PAYMENT_DECLINED', result.message ?? 'OTP refusé.', {
        sycapayReason: result.reason,
      });
    }

    if (result.status === 'SUCCESS') {
      await strapi.db.query('api::payment.payment').update({
        where: { id: payment.id },
        data: { status: 'SUCCESS', errorType: null },
      });
    }

    ctx.body = {
      paymentId: payment.paymentId,
      status: result.status,
    };
  },

  async confirm(ctx: any) {
    const access = await resolveCheckoutAccess(strapi, ctx, ctx.params.checkoutId);
    if (!access.ok) return;

    const { checkout, userId } = access;
    if (isExpired(checkout)) return businessError(ctx, 410, 'CHECKOUT_EXPIRED', 'Checkout expiré.');

    const paymentMethod = String(ctx.request.body?.paymentMethod ?? '').toLowerCase();

    if (paymentMethod === 'sycapay') {
      const paymentId = String(ctx.request.body?.paymentId ?? '').trim();
      const payment = await loadPaymentForCheckout(checkout.checkoutId, paymentId || undefined);
      if (!payment) {
        return businessError(ctx, 400, 'PAYMENT_INFO_INCOMPLETE', 'Informations paiement incomplètes.');
      }

      let status = payment.status;
      if (status === 'PENDING' && payment.refCommand) {
        const remote = await fetchSycapayPaymentStatus(payment.refCommand);
        status = mapSycapayRemoteStatus(remote);
        if (status !== payment.status) {
          await strapi.db.query('api::payment.payment').update({
            where: { id: payment.id },
            data: {
              status,
              ...(status === 'FAILED' ? { errorType: 'failed' } : {}),
              ...(status === 'CANCELED' ? { errorType: 'canceled' } : {}),
            },
          });
        }
      }

      if (status === 'CANCELED' || status === 'FAILED') {
        return businessError(ctx, 402, 'PAYMENT_DECLINED', 'Paiement refusé ou annulé.');
      }
      if (status !== 'SUCCESS') {
        return businessError(ctx, 409, 'PAYMENT_INFO_INCOMPLETE', 'Paiement non confirmé.');
      }

      const existingOrder = await strapi.db.query('api::order.order').findOne({
        where: { checkoutId: checkout.checkoutId },
      });

      if (existingOrder) {
        ctx.body = {
          orderId: String(existingOrder.documentId ?? existingOrder.id),
          order_id: String(existingOrder.documentId ?? existingOrder.id),
          checkout_session_id: checkout.checkoutId,
          status: 'paid',
        };
        return;
      }

      const { order, purchaseAnalytics } = await finalizePaidCheckout(strapi, ctx, {
        userId,
        checkout,
        paymentProvider: 'sycapay',
        paymentReference: payment.token ?? payment.refCommand,
      });

      ctx.body = {
        orderId: String(order.documentId ?? order.id),
        order_id: String(order.documentId ?? order.id),
        checkout_session_id: checkout.checkoutId,
        status: 'paid',
        analytics: purchaseAnalytics,
      };
      return;
    }

    if (paymentMethod && paymentMethod !== 'stripe' && paymentMethod !== 'card') {
      return businessError(
        ctx,
        400,
        'PAYMENT_METHOD_UNSUPPORTED',
        'Mode de paiement non supporté.',
      );
    }

    if (!userId) {
      return businessError(ctx, 401, 'UNAUTHORIZED', 'Authentification requise pour ce mode de paiement.');
    }

    const paymentIntentId = String(ctx.request.body?.paymentIntentId ?? '');
    if (!paymentIntentId || paymentIntentId !== checkout.paymentIntentId) {
      return businessError(ctx, 400, 'PAYMENT_INFO_INCOMPLETE', 'Informations paiement incomplètes.');
    }

    const items = await loadCart(strapi, userId);
    const summary = cartSummary(items);
    if (summary.total !== checkout.total) {
      return businessError(ctx, 409, 'CART_CHANGED', 'Le panier a changé depuis le paiement.', {
        expectedTotal: checkout.total,
        currentTotal: summary.total,
        currency: summary.currency,
      });
    }

    const paymentIntent = await retrieveStripePaymentIntent(paymentIntentId);
    if (!paymentIntent) return businessError(ctx, 503, 'PAYMENT_TIMEOUT', 'Paiement temporairement indisponible.');
    if (paymentIntent.status === 'requires_payment_method') {
      return businessError(ctx, 402, 'PAYMENT_DECLINED', 'Paiement refusé.');
    }
    if (paymentIntent.status !== 'succeeded') {
      return businessError(ctx, 409, 'PAYMENT_INFO_INCOMPLETE', 'Paiement non confirmé.');
    }

    const order = await createOrderFromCheckout(
      strapi,
      userId,
      checkout,
      items,
      summary,
      'stripe',
      paymentIntentId,
    );
    const purchaseAnalytics = await recordPurchaseEvent(strapi, ctx, userId, checkout, order, summary);
    await strapi.db.query('api::checkout.checkout').update({
      where: { id: checkout.id },
      data: { status: 'paid' },
    });
    await strapi.db.query('api::cart-item.cart-item').deleteMany({
      where: { user: { id: userId } },
    });

    ctx.body = {
      orderId: String(order.documentId ?? order.id),
      order_id: String(order.documentId ?? order.id),
      checkout_session_id: checkout.checkoutId,
      status: 'paid',
      analytics: purchaseAnalytics,
    };
  },
  };
});
