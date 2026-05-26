import { finalizePaidCheckout } from '../../../utils/checkout-completion';
import { verifyPaytechIpn, type PaytechIpnPayload } from '../../../utils/paytech';

declare const strapi: any;

const syntheticCtx = () => ({
  state: { requestId: `ipn_${Date.now()}` },
  get: () => 'PayTech-IPN',
});

const loadPaymentByRef = async (refCommand: string) =>
  strapi.db.query('api::payment.payment').findOne({
    where: { refCommand },
    populate: { user: true },
  });

const loadCheckoutById = async (checkoutId: string) =>
  strapi.db.query('api::checkout.checkout').findOne({
    where: { checkoutId },
    populate: { user: true },
  });

const completePaytechPayment = async (payment: any, token?: string) => {
  if (payment.status === 'SUCCESS') return;

  await strapi.db.query('api::payment.payment').update({
    where: { id: payment.id },
    data: {
      status: 'SUCCESS',
      errorType: null,
      ...(token ? { token } : {}),
    },
  });

  const checkout = await loadCheckoutById(payment.checkoutId);
  if (!checkout || checkout.status === 'paid') return;

  const userId = checkout.user?.id ?? payment.user?.id ?? null;

  await finalizePaidCheckout(strapi, syntheticCtx(), {
    userId,
    checkout,
    paymentProvider: 'paytech',
    paymentReference: token ?? payment.token ?? payment.refCommand,
  });
};

export default {
  async ipn(ctx: any) {
    const payload = (ctx.request.body ?? {}) as PaytechIpnPayload;

    if (!verifyPaytechIpn(payload)) {
      ctx.status = 403;
      ctx.body = 'IPN KO';
      return;
    }

    const refCommand = String(payload.ref_command ?? '').trim();
    if (!refCommand) {
      ctx.status = 400;
      ctx.body = 'IPN KO';
      return;
    }

    const payment = await loadPaymentByRef(refCommand);
    if (!payment) {
      ctx.status = 200;
      ctx.body = 'IPN OK';
      return;
    }

    const typeEvent = String(payload.type_event ?? '').trim();

    if (typeEvent === 'sale_complete') {
      await completePaytechPayment(payment, String(payload.token ?? payment.token ?? ''));
    } else if (typeEvent === 'sale_canceled') {
      await strapi.db.query('api::payment.payment').update({
        where: { id: payment.id },
        data: { status: 'CANCELED', errorType: 'canceled' },
      });
    }

    ctx.status = 200;
    ctx.body = 'IPN OK';
  },
};
