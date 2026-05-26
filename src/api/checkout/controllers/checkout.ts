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
  serializeLineItems,
} from '../../../utils/guest-checkout';
import {
  businessError,
  cartItemPopulate,
  cartSummary,
  CURRENCY,
  productLookupWhere,
  requireUser,
  validateQuantity,
} from '../../../utils/commerce';
import {
  buildRefCommand,
  fetchPaytechPaymentStatus,
  getPaytechConfig,
  mapPaytechRemoteStatus,
  requestPaytechPayment,
} from '../../../utils/paytech';

const CHECKOUT_TTL_MS = 6 * 60 * 60 * 1000;

const isEmail = (value: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? ''));
const filled = (value: unknown) => String(value ?? '').trim().length > 0;

const validateCustomer = (customer: any) =>
  customer &&
  filled(customer.firstName) &&
  filled(customer.lastName) &&
  isEmail(customer.email) &&
  filled(customer.phone);

const validateAddress = (address: any) =>
  address && filled(address.line1) && filled(address.city) && filled(address.country);

const loadCart = loadUserCart;

const defaultVariantFor = (product: any) => {
  const activeVariants = (product.variants ?? []).filter((variant: any) => variant.isActive !== false);
  return (
    activeVariants.find((variant: any) => variant.isDefault) ??
    activeVariants.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))[0] ??
    null
  );
};

const syncCheckoutItemsToCart = async (strapi: any, userId: number, items: any[] = []) => {
  if (!Array.isArray(items) || items.length === 0) return null;

  await strapi.db.query('api::cart-item.cart-item').deleteMany({
    where: { user: { id: userId } },
  });

  for (const item of items) {
    const quantity = validateQuantity(item.quantity);
    if (!quantity) return 'INVALID_QUANTITY';

    const product = await strapi.db.query('api::product.product').findOne({
      where: productLookupWhere(item.productId),
      populate: {
        variants: true,
        image: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
        category: { fields: ['name', 'slug'] },
      },
    });
    const variant = product ? defaultVariantFor(product) : null;

    if (!product || !variant) return 'PRODUCT_NOT_FOUND';
    if (quantity > (variant.stock ?? 0)) return 'OUT_OF_STOCK';

    await strapi.db.query('api::cart-item.cart-item').create({
      data: {
        user: userId,
        product: product.id,
        variant: variant.id,
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
      provider: 'paytech',
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

    const finalBillingAddress = billingSameAsShipping ? shippingAddress : billingAddress;
    if (!validateAddress(finalBillingAddress)) {
      return businessError(ctx, 400, 'INVALID_BILLING_ADDRESS', 'Adresse de facturation incomplète.');
    }

    let items: any[] = [];

    if (user) {
      const syncError = await syncCheckoutItemsToCart(strapi, user.id, requestedItems);
      if (syncError === 'PRODUCT_NOT_FOUND') {
        return businessError(ctx, 404, 'PRODUCT_NOT_FOUND', 'Produit ou variante introuvable.');
      }
      if (syncError === 'OUT_OF_STOCK') return businessError(ctx, 409, 'OUT_OF_STOCK', 'Stock insuffisant.');
      if (syncError) return businessError(ctx, 400, syncError, 'Panier invalide.');

      items = await loadCart(strapi, user.id);
    } else {
      const built = await buildLineItemsFromRequest(strapi, requestedItems);
      if (built.error === 'PRODUCT_NOT_FOUND') {
        return businessError(ctx, 404, 'PRODUCT_NOT_FOUND', 'Produit ou variante introuvable.');
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
        customer,
        shippingAddress,
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
    const finalBillingAddress = next.billingSameAsShipping ? next.shippingAddress : next.billingAddress;

    if (!validateCustomer(next.customer)) {
      return businessError(ctx, 400, 'INVALID_CUSTOMER_INFO', 'Informations client invalides.');
    }
    if (!validateAddress(next.shippingAddress)) {
      return businessError(ctx, 400, 'INVALID_SHIPPING_ADDRESS', 'Adresse de livraison incomplète.');
    }
    if (!validateAddress(finalBillingAddress)) {
      return businessError(ctx, 400, 'INVALID_BILLING_ADDRESS', 'Adresse de facturation incomplète.');
    }

    const updated = await strapi.db.query('api::checkout.checkout').update({
      where: { id: checkout.id },
      data: {
        customer: next.customer,
        shippingAddress: next.shippingAddress,
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

  async createPaytechPayment(ctx: any) {
    const access = await resolveCheckoutAccess(strapi, ctx, ctx.params.checkoutId);
    if (!access.ok) return;

    const { checkout, userId } = access;
    if (isExpired(checkout)) return businessError(ctx, 410, 'CHECKOUT_EXPIRED', 'Checkout expiré.');

    const paytechConfig = getPaytechConfig();
    if (!paytechConfig) {
      return businessError(ctx, 503, 'PAYMENT_INFO_INCOMPLETE', 'Configuration paiement incomplète.');
    }

    const items = await loadCheckoutLineItems(strapi, checkout, userId);
    const cartError = assertCartAvailable(items);
    if (cartError === 'CART_EMPTY') return businessError(ctx, 400, 'CART_EMPTY', 'Le panier est vide.');
    if (cartError === 'OUT_OF_STOCK') return businessError(ctx, 409, 'OUT_OF_STOCK', 'Stock insuffisant.');

    const summary = cartSummary(items);
    const refCommand = buildRefCommand(checkout.checkoutId);
    const paymentId = randomUUID();
    const commandName = `Commande Nyra ${checkout.checkoutId}`;

    const paytech = await requestPaytechPayment({
      itemName: commandName,
      itemPrice: summary.total,
      refCommand,
      commandName,
      currency: summary.currency,
      customField: {
        checkoutId: checkout.checkoutId,
        paymentId,
        ...(userId ? { userId } : {}),
        guestEmail: checkout.customer?.email ?? null,
        guestPhone: checkout.customer?.phone ?? null,
      },
    });

    if (paytech.ok === false) {
      strapi.log.warn('[paytech] Echec request-payment', {
        reason: paytech.reason,
        message: paytech.message,
        status: paytech.status,
        checkoutId: checkout.checkoutId,
        env: paytechConfig.env,
      });

      if (paytech.reason === 'missing_config') {
        return businessError(ctx, 503, 'PAYMENT_INFO_INCOMPLETE', 'Configuration paiement incomplète.');
      }

      return businessError(ctx, 503, 'PAYMENT_TIMEOUT', 'Paiement temporairement indisponible.', {
        paytechReason: paytech.reason,
        paytechMessage: paytech.message ?? null,
      });
    }

    await strapi.db.query('api::payment.payment').create({
      data: {
        paymentId,
        refCommand,
        token: paytech.token,
        status: 'PENDING',
        provider: 'paytech',
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
        paymentIntentId: paytech.token,
      },
    });

    ctx.status = 201;
    ctx.body = {
      paymentId,
      refCommand,
      token: paytech.token,
      status: 'PENDING',
      redirectUrl: paytech.redirectUrl,
    };
  },

  async confirm(ctx: any) {
    const access = await resolveCheckoutAccess(strapi, ctx, ctx.params.checkoutId);
    if (!access.ok) return;

    const { checkout, userId } = access;
    if (isExpired(checkout)) return businessError(ctx, 410, 'CHECKOUT_EXPIRED', 'Checkout expiré.');

    const paymentMethod = String(ctx.request.body?.paymentMethod ?? '').toLowerCase();
    if (paymentMethod === 'paytech') {
      const paymentId = String(ctx.request.body?.paymentId ?? '').trim();
      const payment = await loadPaymentForCheckout(checkout.checkoutId, paymentId || undefined);
      if (!payment) {
        return businessError(ctx, 400, 'PAYMENT_INFO_INCOMPLETE', 'Informations paiement incomplètes.');
      }

      let status = payment.status;
      if (status === 'PENDING' && payment.token) {
        const remote = await fetchPaytechPaymentStatus(payment.token);
        status = mapPaytechRemoteStatus(remote);
        if (status !== payment.status) {
          await strapi.db.query('api::payment.payment').update({
            where: { id: payment.id },
            data: { status },
          });
        }
      }

      if (status === 'CANCELED') {
        return businessError(ctx, 402, 'PAYMENT_DECLINED', 'Paiement annulé.');
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
        paymentProvider: 'paytech',
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
