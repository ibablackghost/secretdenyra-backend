import { finalizePaidCheckoutFromPayment } from '../../../utils/checkout-completion';
import { verifySycapayWebhook, type SycapayWebhookPayload } from '../../../utils/sycapay';

declare const strapi: any;

const syntheticCtx = () => ({
  state: { requestId: `sycapay_wh_${Date.now()}` },
  get: () => 'Sycapay-Webhook',
});

const loadPaymentByRef = async (idPartenaire: string) =>
  strapi.db.query('api::payment.payment').findOne({
    where: { refCommand: idPartenaire },
    populate: { user: true },
  });

const markSuccess = async (payment: any) => {
  if (payment.status !== 'SUCCESS') {
    await strapi.db.query('api::payment.payment').update({
      where: { id: payment.id },
      data: { status: 'SUCCESS', errorType: null },
    });
    payment.status = 'SUCCESS';
  }

  await finalizePaidCheckoutFromPayment(strapi, payment, syntheticCtx());
};

export default {
  async webhook(ctx: any) {
    const rawBody =
      ctx.request.rawBody ??
      (typeof ctx.request.body === 'string'
        ? ctx.request.body
        : Buffer.from(JSON.stringify(ctx.request.body ?? {})));

    if (
      !verifySycapayWebhook({
        rawBody,
        headers: ctx.request.headers ?? {},
      })
    ) {
      ctx.status = 403;
      ctx.body = { ok: false, message: 'Webhook signature invalide.' };
      return;
    }

    const payload = (ctx.request.body ?? {}) as SycapayWebhookPayload;
    const idPartenaire = String(payload.idPartenaire ?? '').trim();
    if (!idPartenaire) {
      ctx.status = 400;
      ctx.body = { ok: false, message: 'idPartenaire manquant.' };
      return;
    }

    const payment = await loadPaymentByRef(idPartenaire);
    if (!payment) {
      // Accusé réception pour éviter les retries inutiles sur refs inconnues
      ctx.status = 200;
      ctx.body = { ok: true };
      return;
    }

    const tag = String(payload.tag ?? '').toUpperCase();

    if (tag === 'SUCCESS') {
      await markSuccess(payment);
    } else if (tag === 'FAILED') {
      await strapi.db.query('api::payment.payment').update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          errorType: String(payload.reasonForFailure ?? 'failed').slice(0, 255),
        },
      });
    }

    ctx.status = 200;
    ctx.body = { ok: true };
  },
};
