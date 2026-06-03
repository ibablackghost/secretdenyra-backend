import type { Core } from '@strapi/strapi';

import {
  buildWhere,
  listResponse,
  parseListQuery,
  serializeCheckout,
  serializeOrder,
  serializePayment,
  verifyServiceKey,
} from '../../../utils/internal-api';

declare const strapi: Core.Strapi;

const badRequest = (ctx: any, message: string) => {
  ctx.status = 400;
  ctx.body = { error: 'BadRequest', message };
};

export default {
  async listCheckouts(ctx: any) {
    if (!verifyServiceKey(ctx)) return;

    const parsed = parseListQuery(ctx);
    if ('error' in parsed) return badRequest(ctx, parsed.error);

    const { page, pageSize, status, updatedSince, offset } = parsed;
    const where = buildWhere({ status, updatedSince });

    const [rows, total] = await Promise.all([
      strapi.db.query('api::checkout.checkout').findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        limit: pageSize,
        offset,
      }),
      strapi.db.query('api::checkout.checkout').count({ where }),
    ]);

    const data = await Promise.all(rows.map((row: any) => serializeCheckout(strapi, row)));
    ctx.body = listResponse(data, { page, pageSize, total });
  },

  async listOrders(ctx: any) {
    if (!verifyServiceKey(ctx)) return;

    const parsed = parseListQuery(ctx);
    if ('error' in parsed) return badRequest(ctx, parsed.error);

    const { page, pageSize, status, updatedSince, offset } = parsed;
    const where = buildWhere({ status, updatedSince, defaultStatus: 'paid' });

    const [rows, total] = await Promise.all([
      strapi.db.query('api::order.order').findMany({
        where,
        populate: { items: true },
        orderBy: [{ updatedAt: 'desc' }],
        limit: pageSize,
        offset,
      }),
      strapi.db.query('api::order.order').count({ where }),
    ]);

    const data = rows.map(serializeOrder);
    ctx.body = listResponse(data, { page, pageSize, total });
  },

  async listPayments(ctx: any) {
    if (!verifyServiceKey(ctx)) return;

    const parsed = parseListQuery(ctx);
    if ('error' in parsed) return badRequest(ctx, parsed.error);

    const { page, pageSize, status, updatedSince, offset } = parsed;
    const where = buildWhere({ status, updatedSince });

    const [rows, total] = await Promise.all([
      strapi.db.query('api::payment.payment').findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        limit: pageSize,
        offset,
      }),
      strapi.db.query('api::payment.payment').count({ where }),
    ]);

    const data = rows.map(serializePayment);
    ctx.body = listResponse(data, { page, pageSize, total });
  },
};
