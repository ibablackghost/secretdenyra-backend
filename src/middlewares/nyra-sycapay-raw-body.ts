/** Expose le body brut Sycapay pour vérif HMAC (après strapi::body + includeUnparsed). */
const UNPARSED_BODY = Symbol.for('unparsedBody');

const isSycapayWebhook = (ctx: any) =>
  ctx.method === 'POST' &&
  (ctx.path === '/api/webhooks/sycapay' || ctx.path === '/webhooks/sycapay');

export default () => {
  return async (ctx: any, next: () => Promise<void>) => {
    if (isSycapayWebhook(ctx)) {
      const raw = ctx.request?.body?.[UNPARSED_BODY] ?? ctx.request?.rawBody;
      if (raw != null) {
        ctx.request.rawBody = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw));
      }
    }

    await next();
  };
};
