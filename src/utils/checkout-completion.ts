import { randomUUID } from 'crypto';

import { cartItemPopulate, cartSummary, cartUnitPrice } from './commerce';
export const loadUserCart = async (strapi: any, userId: number) =>
  strapi.db.query('api::cart-item.cart-item').findMany({
    where: { user: { id: userId } },
    populate: cartItemPopulate,
    orderBy: [{ createdAt: 'asc' }],
  });

export const loadCheckoutLineItems = async (strapi: any, checkout: any, userId?: number | null) => {
  if (Array.isArray(checkout.itemsSnapshot) && checkout.itemsSnapshot.length > 0) {
    return checkout.itemsSnapshot;
  }

  if (userId) return loadUserCart(strapi, userId);

  return [];
};

export const createOrderFromCheckout = async (
  strapi: any,
  userId: number | null,
  checkout: any,
  items: any[],
  summary: any,
  paymentProvider: string,
  paymentReference: string,
) => {
  const existingOrder = await strapi.db.query('api::order.order').findOne({
    where: { checkoutId: checkout.checkoutId },
  });

  if (existingOrder) return existingOrder;

  const paidAt = new Date();

  const order = await strapi.db.query('api::order.order').create({
    data: {
      orderNumber: `ord_${Date.now()}_${randomUUID().slice(0, 8)}`,
      checkoutId: checkout.checkoutId,
      status: 'paid',
      paidAt,
      paymentProvider,
      paymentIntentId: paymentReference,
      currency: summary.currency,
      subtotal: summary.subtotal,
      shipping: summary.shipping,
      total: summary.total,
      customer: checkout.customer,
      shippingAddress: checkout.shippingAddress,
      billingAddress: checkout.billingAddress,
      ...(userId ? { user: userId } : {}),
    },
  });

  for (const item of items) {
    const unitPrice = cartUnitPrice(item);
    await strapi.db.query('api::order-item.order-item').create({
      data: {
        productName: item.product.name,
        productSlug: item.product.slug,
        productDocumentId: String(item.product.documentId ?? item.product.id),
        categoryName: item.product.category?.name ?? item.product.category?.slug ?? null,
        currency: summary.currency,
        variantLabel: item.variant?.label ?? item.variant?.name ?? item.variant?.format ?? null,
        sku: item.variant?.sku ?? `${item.product.slug}-base`,
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
        product: item.product.id,
        ...(item.variant?.id ? { variant: item.variant.id } : {}),
        order: order.id,
      },
    });
  }

  return order;
};

const purchaseAnalyticsPayload = (checkout: any, order: any, summary: any) => ({
  event: 'purchase',
  checkout_session_id: checkout.checkoutId,
  order_id: String(order.documentId ?? order.id),
  transaction_id: order.orderNumber,
  currency: summary.currency,
  value: summary.total,
  shipping: summary.shipping,
  items: summary.items.map((item: any) => item.analytics),
});

export const recordPurchaseEvent = async (
  strapi: any,
  ctx: any,
  userId: number | null,
  checkout: any,
  order: any,
  summary: any,
) => {
  const payload = purchaseAnalyticsPayload(checkout, order, summary);

  await strapi.db.query('api::analytics-event.analytics-event').create({
    data: {
      eventName: 'purchase',
      checkoutSessionId: checkout.checkoutId,
      orderId: String(order.documentId ?? order.id),
      currency: summary.currency,
      value: summary.total,
      payload,
      requestId: ctx.state?.requestId,
      userAgent: ctx.get('user-agent'),
      ...(userId ? { user: userId } : {}),
    },
  });

  return payload;
};

export const finalizePaidCheckout = async (
  strapi: any,
  ctx: any,
  params: {
    userId: number | null;
    checkout: any;
    paymentProvider: string;
    paymentReference: string;
  },
) => {
  const { userId, checkout, paymentProvider, paymentReference } = params;
  const items = await loadCheckoutLineItems(strapi, checkout, userId);
  const summary = cartSummary(items);

  const order = await createOrderFromCheckout(
    strapi,
    userId,
    checkout,
    items,
    summary,
    paymentProvider,
    paymentReference,
  );

  const purchaseAnalytics = await recordPurchaseEvent(strapi, ctx, userId, checkout, order, summary);

  await strapi.db.query('api::checkout.checkout').update({
    where: { id: checkout.id },
    data: { status: 'paid', paymentIntentId: paymentReference },
  });

  if (userId) {
    await strapi.db.query('api::cart-item.cart-item').deleteMany({
      where: { user: { id: userId } },
    });
  }

  return { order, purchaseAnalytics };
};

/** Crée la commande si le paiement est SUCCESS mais finalize n'a pas encore été appelé (confirm / IPN manquants). */
export const finalizePaidCheckoutFromPayment = async (strapi: any, payment: any, ctx?: any) => {
  const existingOrder = await strapi.db.query('api::order.order').findOne({
    where: { checkoutId: payment.checkoutId },
  });
  if (existingOrder) return existingOrder;

  const checkout = await strapi.db.query('api::checkout.checkout').findOne({
    where: { checkoutId: payment.checkoutId },
    populate: { user: true },
  });
  if (!checkout || checkout.status === 'paid') return existingOrder ?? null;

  const userId = checkout.user?.id ?? payment.user?.id ?? null;
  const requestCtx = ctx ?? {
    state: { requestId: `pay_finalize_${Date.now()}` },
    get: () => 'Nyra-Payment-Finalize',
  };

  const { order } = await finalizePaidCheckout(strapi, requestCtx, {
    userId,
    checkout,
    paymentProvider: payment.provider ?? 'unknown',
    paymentReference: payment.token ?? payment.refCommand ?? payment.paymentId,
  });

  return order;
};
