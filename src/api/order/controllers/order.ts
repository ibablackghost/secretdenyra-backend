import { factories } from '@strapi/strapi';

import { businessError, requireUser } from '../../../utils/commerce';

const publicOrder = (order: any) => ({
  id: String(order.documentId ?? order.id),
  orderNumber: order.orderNumber,
  checkoutId: order.checkoutId,
  status: order.status,
  currency: order.currency,
  subtotal: order.subtotal,
  shipping: order.shipping,
  total: order.total,
  customer: order.customer,
  shippingAddress: order.shippingAddress,
  billingAddress: order.billingAddress,
  items: (order.items ?? []).map((item: any) => ({
    id: String(item.documentId ?? item.id),
    productName: item.productName,
    productSlug: item.productSlug,
    variantLabel: item.variantLabel,
    sku: item.sku,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
    analytics: {
      item_id: item.productDocumentId ?? item.productSlug,
      item_name: item.productName,
      item_category: item.categoryName ?? null,
      price: item.unitPrice,
      quantity: item.quantity,
      currency: item.currency ?? order.currency,
    },
  })),
  createdAt: order.createdAt,
  analytics: {
    transaction_id: order.orderNumber,
    checkout_session_id: order.checkoutId,
    currency: order.currency,
    value: order.total,
    shipping: order.shipping,
    items: (order.items ?? []).map((item: any) => ({
      item_id: item.productDocumentId ?? item.productSlug,
      item_name: item.productName,
      item_category: item.categoryName ?? null,
      price: item.unitPrice,
      quantity: item.quantity,
      currency: item.currency ?? order.currency,
    })),
  },
});

export default factories.createCoreController('api::order.order' as any, ({ strapi }) => ({
  async find(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const orders = await strapi.db.query('api::order.order').findMany({
      where: { user: { id: user.id } },
      populate: { items: true },
      orderBy: [{ createdAt: 'desc' }],
    });

    ctx.body = { orders: orders.map(publicOrder) };
  },

  async findOne(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const value = String(ctx.params.id);
    const numericId = Number(value);
    const where: any = {
      user: { id: user.id },
      $or: [{ documentId: value }, { orderNumber: value }],
    };

    if (Number.isInteger(numericId) && numericId > 0) {
      where.$or.push({ id: numericId });
    }

    const order = await strapi.db.query('api::order.order').findOne({
      where,
      populate: { items: true },
    });

    if (!order) {
      return businessError(ctx, 404, 'ORDER_NOT_FOUND', 'Commande introuvable.');
    }

    ctx.body = { order: publicOrder(order) };
  },
}));
