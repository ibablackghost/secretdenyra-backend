const PUBLIC_CACHE_RULES = [
  { pattern: /^\/api\/products\/catalog$/, value: 'public, max-age=60, stale-while-revalidate=300' },
  { pattern: /^\/api\/catalog\/products$/, value: 'public, max-age=60, stale-while-revalidate=300' },
  { pattern: /^\/api\/products\/[^/]+$/, value: 'public, max-age=120, stale-while-revalidate=600' },
  { pattern: /^\/api\/categories\/[^/]+$/, value: 'public, max-age=300, stale-while-revalidate=900' },
  { pattern: /^\/api\/sitemap\.xml$/, value: 'public, max-age=3600, stale-while-revalidate=86400' },
  { pattern: /^\/api\/robots\.txt$/, value: 'public, max-age=3600, stale-while-revalidate=86400' },
  { pattern: /^\/uploads\//, value: 'public, max-age=31536000, immutable' },
];

export default () => {
  return async (ctx: any, next: () => Promise<void>) => {
    await next();

    if (ctx.response.get('Cache-Control')) return;

    const rule = PUBLIC_CACHE_RULES.find((candidate) => candidate.pattern.test(ctx.path));
    if (rule && ctx.status >= 200 && ctx.status < 400) {
      ctx.set('Cache-Control', rule.value);
      return;
    }

    if (ctx.path.startsWith('/api/me') || ctx.path.startsWith('/api/cart') || ctx.path.startsWith('/api/checkout')) {
      ctx.set('Cache-Control', 'no-store');
    }
  };
};
