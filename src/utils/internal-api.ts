import type { Core } from '@strapi/strapi';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

export const verifyServiceKey = (ctx: any): boolean => {
  const expected = String(process.env.BACKOFFICE_SERVICE_KEY ?? '').trim();
  const provided = String(ctx.request.get('X-Strapi-Service-Key') ?? '').trim();

  if (!expected) {
    ctx.status = 503;
    ctx.body = {
      error: 'ServiceUnavailable',
      message: 'BACKOFFICE_SERVICE_KEY non configurée sur Strapi.',
    };
    return false;
  }

  if (!provided || provided !== expected) {
    ctx.status = 401;
    ctx.body = {
      error: 'Unauthorized',
      message: 'Clé de service invalide ou absente (X-Strapi-Service-Key).',
    };
    return false;
  }

  return true;
};

export const parseListQuery = (ctx: any) => {
  const page = Math.max(1, Number.parseInt(String(ctx.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(String(ctx.query.pageSize ?? DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
  );
  const status = String(ctx.query.status ?? '').trim() || undefined;
  const updatedSinceRaw = String(ctx.query.updated_since ?? '').trim();
  const updatedSince = updatedSinceRaw ? new Date(updatedSinceRaw) : undefined;

  if (updatedSinceRaw && Number.isNaN(updatedSince!.getTime())) {
    return { error: 'updated_since invalide (ISO 8601 attendu).' };
  }

  return { page, pageSize, status, updatedSince, offset: (page - 1) * pageSize };
};

export const buildWhere = (params: {
  status?: string;
  updatedSince?: Date;
  defaultStatus?: string;
}) => {
  const where: Record<string, unknown> = {};

  const status = params.status ?? params.defaultStatus;
  if (status) where.status = status;

  if (params.updatedSince) {
    where.updatedAt = { $gt: params.updatedSince };
  }

  return where;
};

export const toDocumentPayload = (row: any, attributes: Record<string, unknown>) => ({
  id: row.id,
  documentId: String(row.documentId ?? row.checkoutId ?? row.paymentId ?? row.orderNumber ?? row.id),
  attributes,
});

export const listResponse = (rows: any[], meta: { page: number; pageSize: number; total: number }) => ({
  data: rows,
  meta,
});

export const loadLatestPaymentIdForCheckout = async (strapi: Core.Strapi, checkoutId: string) => {
  const payments = await strapi.db.query('api::payment.payment').findMany({
    where: { checkoutId },
    orderBy: [{ createdAt: 'desc' }],
    limit: 1,
  });
  return payments[0]?.paymentId ?? null;
};

export const serializeCheckout = async (strapi: Core.Strapi, checkout: any) => {
  const paymentId = await loadLatestPaymentIdForCheckout(strapi, checkout.checkoutId);

  return toDocumentPayload(checkout, {
    checkoutId: checkout.checkoutId,
    status: checkout.status,
    total: checkout.total,
    currency: checkout.currency ?? 'XOF',
    subtotal: checkout.subtotal,
    shipping: checkout.shipping,
    customer: checkout.customer ?? null,
    paymentId,
    paymentIntentId: checkout.paymentIntentId ?? null,
    updatedAt: checkout.updatedAt,
    createdAt: checkout.createdAt,
    expiresAt: checkout.expiresAt,
  });
};

export const serializeOrderItem = (item: any) => ({
  label: item.productName,
  name: item.productName,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  lineTotal: item.lineTotal,
  productSlug: item.productSlug,
  strapiProductId: item.productDocumentId ?? null,
  variantLabel: item.variantLabel ?? null,
  sku: item.sku ?? null,
});

export const serializeOrder = (order: any) => {
  const customer = order.customer ?? {};
  const customerEmail =
    customer.email ?? customer.Email ?? customer.mail ?? null;

  return toDocumentPayload(order, {
    orderNumber: order.orderNumber,
    status: order.status,
    total: order.total,
    currency: order.currency ?? 'XOF',
    subtotal: order.subtotal,
    shipping: order.shipping,
    paidAt: order.paidAt ?? order.createdAt,
    checkoutId: order.checkoutId,
    customerEmail,
    customer,
    paymentProvider: order.paymentProvider ?? null,
    paymentIntentId: order.paymentIntentId ?? null,
    items: (order.items ?? []).map(serializeOrderItem),
    updatedAt: order.updatedAt,
    createdAt: order.createdAt,
  });
};

export const serializePayment = (payment: any) =>
  toDocumentPayload(payment, {
    paymentId: payment.paymentId,
    refCommand: payment.refCommand,
    status: payment.status,
    amount: payment.amount,
    total: payment.amount,
    currency: payment.currency ?? 'XOF',
    checkoutId: payment.checkoutId,
    provider: payment.provider ?? null,
    errorType: payment.errorType ?? null,
    updatedAt: payment.updatedAt,
    createdAt: payment.createdAt,
  });
