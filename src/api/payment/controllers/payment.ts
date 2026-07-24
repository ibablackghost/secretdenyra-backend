import { businessError } from '../../../utils/commerce';
import { finalizePaidCheckoutFromPayment } from '../../../utils/checkout-completion';
import { resolvePaymentAccess } from '../../../utils/guest-checkout';
import {
  fetchSycapayPaymentStatus,
  getSycapayConfig,
  mapSycapayRemoteStatus,
} from '../../../utils/sycapay';

declare const strapi: any;

const paymentStatusPayload = (payment: any) => ({
  paymentId: payment.paymentId,
  status: payment.status,
  refCommand: payment.refCommand,
  errorType: payment.errorType ?? null,
});

export default {
  async status(ctx: any) {
    const payment = await strapi.db.query('api::payment.payment').findOne({
      where: { paymentId: ctx.params.paymentId },
    });
    if (!payment) return businessError(ctx, 404, 'PAYMENT_NOT_FOUND', 'Paiement introuvable.');

    const access = await resolvePaymentAccess(strapi, ctx, payment);
    if (!access.ok) return;

    if (payment.status === 'PENDING' && payment.provider === 'sycapay' && payment.refCommand) {
      const config = getSycapayConfig();
      if (config) {
        const remote = await fetchSycapayPaymentStatus(payment.refCommand);
        const mapped = mapSycapayRemoteStatus(remote);

        if (mapped !== 'PENDING' && mapped !== payment.status) {
          await strapi.db.query('api::payment.payment').update({
            where: { id: payment.id },
            data: {
              status: mapped,
              ...(mapped === 'CANCELED' ? { errorType: 'canceled' } : {}),
              ...(mapped === 'FAILED' ? { errorType: 'failed' } : {}),
            },
          });
          payment.status = mapped;
        }
      }
    }

    if (payment.status === 'SUCCESS') {
      try {
        await finalizePaidCheckoutFromPayment(strapi, payment, ctx);
      } catch (error) {
        strapi.log.error('[payment] Impossible de créer la commande après SUCCESS', {
          paymentId: payment.paymentId,
          checkoutId: payment.checkoutId,
          error,
        });
      }
    }

    ctx.body = paymentStatusPayload(payment);
  },
};
