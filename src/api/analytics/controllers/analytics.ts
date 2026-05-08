import { businessError, CURRENCY } from '../../../utils/commerce';

declare const strapi: any;

const events = [
  'view_item',
  'add_to_cart',
  'remove_from_cart',
  'begin_checkout',
  'cart_abandoned',
  'checkout_step_view',
  'checkout_step_complete',
  'checkout_payment_failed',
  'purchase',
];
const allowedEvents = new Set(events);
const DEFAULT_DEDUPE_WINDOW_SECONDS = 60;

const boolEnv = (name: string, fallback = false) => {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value === 'true';
};

const intEnv = (name: string, fallback: number) => {
  const parsed = Number.parseInt(String(process.env[name] ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const stableStringify = (value: any): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
};

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const firstItemId = (payload: any) => {
  const item = Array.isArray(payload.items) ? payload.items[0] : null;
  return payload.item_id ?? payload.itemId ?? item?.item_id ?? item?.id ?? null;
};

const cartHashFor = (payload: any) => {
  if (payload.cartHash || payload.cart_hash) return String(payload.cartHash ?? payload.cart_hash);
  if (!Array.isArray(payload.items)) return null;

  const normalizedItems = payload.items.map((item: any) => ({
    item_id: item.item_id ?? item.id,
    price: item.price,
    quantity: item.quantity,
  }));

  return hashString(stableStringify(normalizedItems));
};

const dedupeIdentityFor = (eventName: string, payload: any) => {
  const checkoutSessionId = payload.checkout_session_id ?? payload.checkoutSessionId ?? '';
  const itemId = firstItemId(payload) ?? '';
  const cartHash = cartHashFor(payload) ?? '';
  const step = payload.step ?? '';
  const reason = payload.reason ?? '';

  return [eventName, checkoutSessionId, itemId, cartHash, step, reason].join('|');
};

const dedupeWindowFor = (eventName: string) => {
  if (eventName === 'checkout_payment_failed') return intEnv('ANALYTICS_PAYMENT_DEDUPE_SECONDS', 30);
  return intEnv('ANALYTICS_DEDUPE_SECONDS', DEFAULT_DEDUPE_WINDOW_SECONDS);
};

const ratio = (numerator: number, denominator: number) => (denominator > 0 ? numerator / denominator : 0);

export default {
  async config(ctx: any) {
    ctx.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
    ctx.body = {
      analyticsEnabled: boolEnv('ANALYTICS_ENABLED', true),
      posthogEnabled: boolEnv('POSTHOG_ENABLED', false),
      gaMeasurementEnabled: boolEnv('GA_MEASUREMENT_ENABLED', false),
      currency: CURRENCY,
      consent: {
        required: boolEnv('ANALYTICS_CONSENT_REQUIRED', true),
        defaultGranted: boolEnv('ANALYTICS_CONSENT_DEFAULT_GRANTED', false),
      },
      dedupeWindowSeconds: intEnv('ANALYTICS_DEDUPE_SECONDS', DEFAULT_DEDUPE_WINDOW_SECONDS),
      events,
    };
  },

  async events(ctx: any) {
    const body = ctx.request.body ?? {};
    const eventName = String(body.eventName ?? body.event ?? '').trim();

    if (!allowedEvents.has(eventName)) {
      return businessError(ctx, 400, 'VALIDATION_ERROR', 'Event analytics invalide.', {
        allowedEvents: Array.from(allowedEvents),
      });
    }

    const payload = body.payload ?? body;
    const checkoutSessionId = body.checkout_session_id ?? body.checkoutSessionId ?? payload.checkout_session_id;
    const orderId = body.order_id ?? body.orderId ?? payload.order_id;
    const itemId = firstItemId(payload);
    const cartHash = cartHashFor(payload);
    const step = Number.isFinite(Number(body.step ?? payload.step)) ? Number(body.step ?? payload.step) : null;
    const reason = body.reason ?? payload.reason ?? null;
    const dedupeWindowSeconds = dedupeWindowFor(eventName);
    const dedupeBucket = Math.floor(Date.now() / (dedupeWindowSeconds * 1000));
    const dedupeIdentity = body.dedupeKey ?? body.dedupe_key ?? dedupeIdentityFor(eventName, payload);
    const dedupeKey = `${dedupeIdentity}|${dedupeBucket}`;
    const existing = await strapi.db.query('api::analytics-event.analytics-event').findOne({
      where: { dedupeKey },
    });

    if (existing) {
      ctx.status = 202;
      ctx.body = {
        accepted: true,
        deduped: true,
        eventId: String(existing.documentId ?? existing.id),
        dedupeKey,
        requestId: ctx.state?.requestId,
      };
      return;
    }

    const event = await strapi.db.query('api::analytics-event.analytics-event').create({
      data: {
        eventName,
        checkoutSessionId,
        orderId,
        itemId,
        cartHash,
        step,
        reason,
        dedupeKey,
        dedupeBucket,
        currency: body.currency ?? payload.currency ?? CURRENCY,
        value: Number.isFinite(Number(body.value ?? payload.value)) ? Number(body.value ?? payload.value) : null,
        payload,
        requestId: ctx.state?.requestId,
        userAgent: ctx.get('user-agent'),
        user: ctx.state?.user?.id,
      },
    });

    ctx.body = {
      accepted: true,
      deduped: false,
      eventId: String(event.documentId ?? event.id),
      dedupeKey,
      requestId: ctx.state?.requestId,
    };
  },

  async funnel(ctx: any) {
    const days = Number.parseInt(String(ctx.query?.days ?? '7'), 10);
    const since = new Date(Date.now() - (Number.isFinite(days) && days > 0 ? days : 7) * 24 * 60 * 60 * 1000);
    const where = { createdAt: { $gte: since } };
    const countEvent = (eventName: string, extraWhere: Record<string, any> = {}) =>
      strapi.db.query('api::analytics-event.analytics-event').count({
        where: {
          ...where,
          eventName,
          ...extraWhere,
        },
      });

    const [
      viewItem,
      addToCart,
      beginCheckout,
      cartAbandoned,
      step1View,
      step1Complete,
      step2View,
      step2Complete,
      step3View,
      paymentFailed,
      purchase,
    ] = await Promise.all([
      countEvent('view_item'),
      countEvent('add_to_cart'),
      countEvent('begin_checkout'),
      countEvent('cart_abandoned'),
      countEvent('checkout_step_view', { step: 1 }),
      countEvent('checkout_step_complete', { step: 1 }),
      countEvent('checkout_step_view', { step: 2 }),
      countEvent('checkout_step_complete', { step: 2 }),
      countEvent('checkout_step_view', { step: 3 }),
      countEvent('checkout_payment_failed'),
      countEvent('purchase'),
    ]);

    ctx.set('Cache-Control', 'private, max-age=60');
    ctx.body = {
      since: since.toISOString(),
      currency: CURRENCY,
      counts: {
        view_item: viewItem,
        add_to_cart: addToCart,
        begin_checkout: beginCheckout,
        cart_abandoned: cartAbandoned,
        checkout_step_view_1: step1View,
        checkout_step_complete_1: step1Complete,
        checkout_step_view_2: step2View,
        checkout_step_complete_2: step2Complete,
        checkout_step_view_3: step3View,
        checkout_payment_failed: paymentFailed,
        purchase,
      },
      kpis: {
        add_to_cart_rate: ratio(addToCart, viewItem),
        checkout_start_rate: ratio(beginCheckout, addToCart),
        step1_to_step2_rate: ratio(step1Complete, step1View),
        step2_to_step3_rate: ratio(step2Complete, step2View),
        payment_failure_rate: ratio(paymentFailed, step2Complete),
        cart_abandon_rate: ratio(cartAbandoned, addToCart),
        purchase_rate: ratio(purchase, beginCheckout),
      },
    };
  },
};
