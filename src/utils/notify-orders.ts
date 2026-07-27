type NotifyCustomer = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
};

type NotifyAddress = {
  address?: string | null;
  line1?: string | null;
  city?: string | null;
  country?: string | null;
};

const formatMoney = (amount: number, currency = 'XOF') =>
  `${Number(amount ?? 0).toLocaleString('fr-FR')} ${currency}`;

const customerLabel = (customer: NotifyCustomer = {}) => {
  const full =
    String(customer.fullName ?? '').trim() ||
    [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
  return full || 'Client';
};

const addressLabel = (address: NotifyAddress = {}) =>
  String(address.address ?? address.line1 ?? '').trim() || '—';

const getNotifyEmail = (strapi: any) =>
  String(
    strapi.config.get('custom.orders.notifyEmail') ||
      process.env.ORDERS_NOTIFY_EMAIL ||
      '',
  ).trim();

export const sendOrdersNotifyEmail = async (
  strapi: any,
  params: {
    subject: string;
    text: string;
    html?: string;
  },
) => {
  const to = getNotifyEmail(strapi);
  if (!to) {
    strapi.log.warn('[nyra-mail] ORDERS_NOTIFY_EMAIL non configuré — notification ignorée.');
    return { ok: false as const, reason: 'missing_notify_email' };
  }

  const user = String(process.env.EMAIL_SMTP_USER ?? '').trim();
  const pass = String(process.env.EMAIL_SMTP_PASS ?? '').trim();
  if (!user || !pass) {
    strapi.log.warn('[nyra-mail] SMTP Hostinger incomplet — notification ignorée.');
    return { ok: false as const, reason: 'missing_smtp' };
  }

  try {
    await strapi.plugin('email').service('email').send({
      to,
      subject: params.subject,
      text: params.text,
      html: params.html ?? `<pre style="font-family:sans-serif">${params.text}</pre>`,
    });
    strapi.log.info('[nyra-mail] Notification envoyée', { to, subject: params.subject });
    return { ok: true as const };
  } catch (error: any) {
    strapi.log.error('[nyra-mail] Échec envoi', {
      to,
      message: error?.message ?? String(error),
    });
    return { ok: false as const, reason: 'send_failed' };
  }
};

export const notifyPaidOrder = async (
  strapi: any,
  params: {
    order: any;
    checkout: any;
    summary: any;
    paymentProvider: string;
    paymentReference: string;
  },
) => {
  const { order, checkout, summary, paymentProvider, paymentReference } = params;
  const customer = (checkout.customer ?? {}) as NotifyCustomer;
  const shipping = (checkout.shippingAddress ?? {}) as NotifyAddress;
  const items = Array.isArray(summary?.items) ? summary.items : [];

  const lines = items
    .map((item: any) => {
      const name = item.product?.name ?? item.name ?? 'Article';
      const qty = item.quantity ?? 1;
      const lineTotal = item.lineTotal ?? item.total ?? 0;
      return `• ${name} × ${qty} — ${formatMoney(lineTotal, summary.currency)}`;
    })
    .join('\n');

  const subject = `[Nyra] Commande payée ${order.orderNumber} — ${formatMoney(summary.total, summary.currency)}`;
  const text = [
    'Nouvelle commande payée',
    '',
    `N° commande : ${order.orderNumber}`,
    `Checkout    : ${checkout.checkoutId}`,
    `Total       : ${formatMoney(summary.total, summary.currency)}`,
    `Sous-total  : ${formatMoney(summary.subtotal, summary.currency)}`,
    `Livraison   : ${formatMoney(summary.shipping, summary.currency)}`,
    `Paiement    : ${paymentProvider}`,
    `Réf. paiement : ${paymentReference}`,
    '',
    `Client : ${customerLabel(customer)}`,
    `Tél.   : ${customer.phone ?? '—'}`,
    `Email  : ${customer.email ?? '—'}`,
    `Adresse: ${addressLabel(shipping)}`,
    '',
    'Articles :',
    lines || '—',
  ].join('\n');

  return sendOrdersNotifyEmail(strapi, { subject, text });
};

export const notifyPaymentFailed = async (
  strapi: any,
  params: {
    payment: any;
    reason?: string | null;
  },
) => {
  const { payment, reason } = params;
  const subject = `[Nyra] Paiement échoué ${payment.refCommand ?? payment.paymentId}`;
  const text = [
    'Paiement échoué / annulé',
    '',
    `Payment ID  : ${payment.paymentId}`,
    `Ref commande: ${payment.refCommand}`,
    `Checkout    : ${payment.checkoutId}`,
    `Montant     : ${formatMoney(payment.amount, payment.currency)}`,
    `Provider    : ${payment.provider}`,
    `Raison      : ${reason ?? payment.errorType ?? '—'}`,
  ].join('\n');

  return sendOrdersNotifyEmail(strapi, { subject, text });
};
