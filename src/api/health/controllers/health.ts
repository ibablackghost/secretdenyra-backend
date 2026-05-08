declare const strapi: any;

export default {
  async check(ctx: any) {
    const startedAt = Date.now();
    const checks = {
      api: 'ok',
      database: 'unknown',
    };

    try {
      await strapi.db.connection.raw('select 1');
      checks.database = 'ok';
    } catch (error) {
      checks.database = 'error';
      ctx.status = 503;
    }

    ctx.set('Cache-Control', 'no-store');
    ctx.body = {
      status: checks.database === 'ok' ? 'ok' : 'degraded',
      checks,
      uptime: Math.round(process.uptime()),
      responseTimeMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
      requestId: ctx.state?.requestId,
    };
  },
};
