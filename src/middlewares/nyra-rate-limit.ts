type RateLimitRule = {
  name: string;
  pattern: RegExp;
  methods?: string[];
  windowMs: number;
  max: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const defaultRules: RateLimitRule[] = [
  {
    name: 'auth',
    pattern: /^\/api\/auth\/local(\/register)?$/,
    methods: ['POST'],
    windowMs: 15 * 60 * 1000,
    max: 10,
  },
  {
    name: 'checkout-init',
    pattern: /^\/api\/checkout\/init$/,
    methods: ['POST'],
    windowMs: 10 * 60 * 1000,
    max: 20,
  },
  {
    name: 'checkout-sycapay',
    pattern: /^\/api\/checkout\/[^/]+\/payment\/sycapay(\/confirm-otp)?$/,
    methods: ['POST'],
    windowMs: 10 * 60 * 1000,
    max: 15,
  },
  {
    name: 'checkout',
    pattern: /^\/api\/checkout(\/|$)/,
    methods: ['POST', 'PATCH'],
    windowMs: 10 * 60 * 1000,
    max: 40,
  },
  {
    name: 'commerce-mutations',
    pattern: /^\/api\/(cart|wishlist|me\/wishlist)(\/|$)/,
    methods: ['POST', 'PATCH', 'PUT', 'DELETE'],
    windowMs: 5 * 60 * 1000,
    max: 120,
  },
  {
    name: 'analytics',
    pattern: /^\/api\/analytics\/events$/,
    methods: ['POST'],
    windowMs: 60 * 1000,
    max: 120,
  },
  {
    name: 'api-global',
    pattern: /^\/api\//,
    windowMs: 60 * 1000,
    max: 600,
  },
];

const clientIp = (ctx: any) => {
  const forwardedFor = String(ctx.get('x-forwarded-for') ?? '')
    .split(',')[0]
    .trim();

  return forwardedFor || ctx.ip || 'unknown';
};

const matchingRule = (ctx: any, rules: RateLimitRule[]) =>
  rules.find((rule) => {
    if (!rule.pattern.test(ctx.path)) return false;
    if (!rule.methods) return true;
    return rule.methods.includes(String(ctx.method).toUpperCase());
  });

const cleanupExpiredBuckets = (now: number) => {
  if (buckets.size < 1000) return;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

export default (config: any = {}) => {
  const enabled = config.enabled !== false;
  const rules = config.rules ?? defaultRules;

  return async (ctx: any, next: () => Promise<void>) => {
    if (!enabled || ctx.method === 'OPTIONS') {
      await next();
      return;
    }

    const rule = matchingRule(ctx, rules);
    if (!rule) {
      await next();
      return;
    }

    const now = Date.now();
    cleanupExpiredBuckets(now);

    const key = `${rule.name}:${clientIp(ctx)}`;
    const current = buckets.get(key);
    const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + rule.windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(rule.max - bucket.count, 0);
    const resetInSeconds = Math.ceil((bucket.resetAt - now) / 1000);

    ctx.set('X-RateLimit-Limit', String(rule.max));
    ctx.set('X-RateLimit-Remaining', String(remaining));
    ctx.set('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > rule.max) {
      ctx.status = 429;
      ctx.set('Retry-After', String(resetInSeconds));
      ctx.body = {
        code: 'RATE_LIMITED',
        message: 'Trop de requêtes, réessaie plus tard.',
        requestId: ctx.state?.requestId,
      };
      return;
    }

    await next();
  };
};
