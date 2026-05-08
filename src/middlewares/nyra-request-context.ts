import { randomUUID } from 'crypto';

declare const strapi: any;

export default () => {
  return async (ctx: any, next: () => Promise<void>) => {
    const startedAt = Date.now();
    const requestId = ctx.get('x-request-id') || randomUUID();

    ctx.state.requestId = requestId;
    ctx.set('X-Request-Id', requestId);

    try {
      await next();
    } finally {
      const durationMs = Date.now() - startedAt;
      ctx.set('X-Response-Time', `${durationMs}ms`);

      strapi.log.info('[nyra-request]', {
        requestId,
        method: ctx.method,
        path: ctx.path,
        status: ctx.status,
        durationMs,
      });
    }
  };
};
