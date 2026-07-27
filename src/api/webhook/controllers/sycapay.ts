import { finalizePaidCheckoutFromPayment } from '../../../utils/checkout-completion';
import { notifyPaymentFailed } from '../../../utils/notify-orders';
import {
  verifySycapayWebhookDetailed,
  type SycapayWebhookPayload,
} from '../../../utils/sycapay';

declare const strapi: any;

const UNPARSED_BODY = Symbol.for('unparsedBody');

const syntheticCtx = () => ({
  state: { requestId: `sycapay_wh_${Date.now()}` },
  get: () => 'Sycapay-Webhook',
});

const resolveRawBody = (ctx: any): Buffer => {
  const raw =
    ctx.state?.sycapayRawBody ??
    ctx.request?.rawBody ??
    ctx.request?.body?.[UNPARSED_BODY] ??
    (typeof ctx.request.body === 'string' ? ctx.request.body : null);

  if (raw != null) {
    return Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw));
  }

  return Buffer.from(JSON.stringify(ctx.request.body ?? {}));
};

const listSignatureHeaders = (headers: Record<string, unknown>) =>
  Object.entries(headers)
    .filter(([name]) => name.toLowerCase().includes('sign') || name.toLowerCase() === 'authorization')
    .map(([name, value]) => `${name}=${String(Array.isArray(value) ? value[0] : value).slice(0, 24)}`);

const loadPaymentByRef = async (idPartenaire: string) =>
  strapi.db.query('api::payment.payment').findOne({
    where: { refCommand: idPartenaire },
    populate: { user: true },
  });

const loadPaymentByProviderEvent = async (idPartenaireService: string) =>
  strapi.db.query('api::payment.payment').findOne({
    where: { idPartenaireService },
    populate: { user: true },
  });

const markSuccess = async (payment: any, idPartenaireService?: string) => {
  const data: Record<string, unknown> = {};

  if (payment.status !== 'SUCCESS') {
    data.status = 'SUCCESS';
    data.errorType = null;
  }

  if (idPartenaireService && payment.idPartenaireService !== idPartenaireService) {
    data.idPartenaireService = idPartenaireService;
  }

  if (Object.keys(data).length > 0) {
    await strapi.db.query('api::payment.payment').update({
      where: { id: payment.id },
      data,
    });
    Object.assign(payment, data);
  }

  await finalizePaidCheckoutFromPayment(strapi, payment, syntheticCtx());
};

export default {
  async webhook(ctx: any) {
    const rawBody = resolveRawBody(ctx);

    const verification = verifySycapayWebhookDetailed({
      rawBody,
      headers: ctx.request.headers ?? {},
    });

    if (verification.ok === false) {
      strapi.log.warn(
        `[sycapay-webhook] signature refusée (${verification.reason}) raw=${rawBody.length}b headers=${listSignatureHeaders(ctx.request.headers ?? {}).join(',') || 'none'}`,
      );
      ctx.status = 403;
      ctx.body = { ok: false, message: 'Webhook signature invalide.', reason: verification.reason };
      return;
    }

    let payload: SycapayWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as SycapayWebhookPayload;
    } catch {
      payload = (ctx.request.body ?? {}) as SycapayWebhookPayload;
    }
    const idPartenaire = String(payload.idPartenaire ?? '').trim();
    const idPartenaireService = String(payload.idPartenaireService ?? '').trim();

    if (!idPartenaire) {
      ctx.status = 400;
      ctx.body = { ok: false, message: 'idPartenaire manquant.' };
      return;
    }

    // Idempotence dédiée : même événement Sycapay déjà traité
    if (idPartenaireService) {
      const byEvent = await loadPaymentByProviderEvent(idPartenaireService);
      if (byEvent?.status === 'SUCCESS') {
        ctx.status = 200;
        ctx.body = { ok: true, duplicate: true };
        return;
      }
    }

    const payment = await loadPaymentByRef(idPartenaire);
    if (!payment) {
      // Accusé réception pour éviter les retries inutiles sur refs inconnues
      ctx.status = 200;
      ctx.body = { ok: true };
      return;
    }

    const tag = String(payload.tag ?? '').toUpperCase();

    // Doublon SUCCESS déjà finalisé — stocke l’event id s’il manquait
    if (tag === 'SUCCESS' && payment.status === 'SUCCESS') {
      if (idPartenaireService && payment.idPartenaireService !== idPartenaireService) {
        try {
          await strapi.db.query('api::payment.payment').update({
            where: { id: payment.id },
            data: { idPartenaireService },
          });
        } catch {
          // Conflit unique éventuel : l’événement est déjà rattaché ailleurs
        }
      }
      ctx.status = 200;
      ctx.body = { ok: true, duplicate: true };
      return;
    }

    if (tag === 'SUCCESS') {
      await markSuccess(payment, idPartenaireService || undefined);
    } else if (tag === 'FAILED') {
      const alreadyFailed = payment.status === 'FAILED';
      const reason = String(payload.reasonForFailure ?? 'failed').slice(0, 255);
      await strapi.db.query('api::payment.payment').update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          errorType: reason,
          ...(idPartenaireService ? { idPartenaireService } : {}),
        },
      });
      if (!alreadyFailed) {
        void notifyPaymentFailed(strapi, { payment: { ...payment, status: 'FAILED', errorType: reason }, reason });
      }
    }

    ctx.status = 200;
    ctx.body = { ok: true };
  },
};
