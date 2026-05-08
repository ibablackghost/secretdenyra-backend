const statusToCode: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  408: 'REQUEST_TIMEOUT',
  429: 'RATE_LIMITED',
};

const shouldNormalize = (ctx: any) =>
  ctx.path.startsWith('/api/') &&
  ctx.status >= 400 &&
  ctx.body &&
  typeof ctx.body === 'object' &&
  !Array.isArray(ctx.body) &&
  !ctx.body.code;

declare const strapi: any;

export default () => {
  return async (ctx: any, next: () => Promise<void>) => {
    try {
      await next();
    } catch (error: any) {
      const status = error.status ?? 500;
      ctx.status = status;
      ctx.body = {
        code: statusToCode[status] ?? 'INTERNAL_ERROR',
        message: status >= 500 ? 'Erreur serveur.' : error.message,
        requestId: ctx.state?.requestId,
      };
      strapi.log.error('[nyra-error]', {
        requestId: ctx.state?.requestId,
        path: ctx.path,
        status,
        message: error.message,
      });
    }

    if (!shouldNormalize(ctx)) return;

    const error = ctx.body.error ?? ctx.body;
    ctx.body = {
      code: statusToCode[ctx.status] ?? 'VALIDATION_ERROR',
      message: error.message ?? 'Requête invalide.',
      requestId: ctx.state?.requestId,
    };
  };
};
