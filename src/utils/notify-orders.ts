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

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isEmail = (value: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());

const getNotifyEmail = (strapi: any) =>
  String(
    strapi.config.get('custom.orders.notifyEmail') ||
      process.env.ORDERS_NOTIFY_EMAIL ||
      '',
  ).trim();

const canSendMail = (strapi: any) => {
  const provider = String(process.env.EMAIL_PROVIDER ?? 'brevo').toLowerCase();
  const hasBrevo = Boolean(String(process.env.BREVO_API_KEY ?? '').trim());
  const hasSmtp =
    Boolean(String(process.env.EMAIL_SMTP_USER ?? '').trim()) &&
    Boolean(String(process.env.EMAIL_SMTP_PASS ?? '').trim());

  if (provider === 'brevo' && !hasBrevo) {
    strapi.log.warn('[nyra-mail] BREVO_API_KEY manquant — notification ignorée.');
    return false;
  }

  if (provider !== 'brevo' && !hasSmtp) {
    strapi.log.warn('[nyra-mail] SMTP incomplet — notification ignorée.');
    return false;
  }

  return true;
};

export const sendMail = async (
  strapi: any,
  params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  },
) => {
  const to = String(params.to ?? '').trim();
  if (!to || !isEmail(to)) {
    return { ok: false as const, reason: 'invalid_to' };
  }

  if (!canSendMail(strapi)) {
    return { ok: false as const, reason: 'missing_smtp' };
  }

  try {
    await strapi.plugin('email').service('email').send({
      to,
      subject: params.subject,
      text: params.text,
      html: params.html ?? `<pre style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(params.text)}</pre>`,
    });
    strapi.log.info('[nyra-mail] Mail envoyé', { to, subject: params.subject });
    return { ok: true as const };
  } catch (error: any) {
    strapi.log.error('[nyra-mail] Échec envoi', {
      to,
      message: error?.message ?? String(error),
    });
    return { ok: false as const, reason: 'send_failed' };
  }
};

/** @deprecated alias — notifs admin */
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

  return sendMail(strapi, { to, ...params });
};

const buildItemLines = (items: any[], currency: string) =>
  items.map((item: any) => {
    const name = item.product?.name ?? item.name ?? 'Article';
    const qty = item.quantity ?? 1;
    const lineTotal = item.lineTotal ?? item.total ?? 0;
    return { name, qty, lineTotal, label: `${name} × ${qty} — ${formatMoney(lineTotal, currency)}` };
  });

const customerOrderHtml = (params: {
  name: string;
  orderNumber: string;
  total: string;
  subtotal: string;
  shipping: string;
  address: string;
  phone: string;
  itemLabels: string[];
}) => {
  const rows = params.itemLabels
    .map((line) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;">${escapeHtml(line)}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f6f4f1;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f4f1;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;padding:28px 24px;">
          <tr><td style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#6b5e52;">Secrets de Nyra</td></tr>
          <tr><td style="padding-top:16px;font-size:24px;line-height:1.3;">Merci ${escapeHtml(params.name)}, votre paiement est confirmé</td></tr>
          <tr><td style="padding-top:14px;font-size:15px;line-height:1.6;color:#333;">
            Votre commande <strong>${escapeHtml(params.orderNumber)}</strong> est en cours de traitement.
            Vous serez contacté(e) dans les plus brefs délais pour procéder à la livraison.
          </td></tr>
          <tr><td style="padding-top:22px;font-size:14px;line-height:1.7;">
            <strong>Total payé :</strong> ${escapeHtml(params.total)}<br/>
            <strong>Sous-total :</strong> ${escapeHtml(params.subtotal)}<br/>
            <strong>Livraison :</strong> ${escapeHtml(params.shipping)}<br/>
            <strong>Téléphone :</strong> ${escapeHtml(params.phone)}<br/>
            <strong>Adresse :</strong> ${escapeHtml(params.address)}
          </td></tr>
          <tr><td style="padding-top:22px;font-size:14px;"><strong>Articles</strong></td></tr>
          <tr><td>
            <table role="presentation" width="100%" style="font-size:14px;line-height:1.5;">${rows || '<tr><td>—</td></tr>'}</table>
          </td></tr>
          <tr><td style="padding-top:28px;font-size:13px;color:#666;line-height:1.5;">
            Des questions ? Répondez à cet e-mail ou contactez-nous via contact@secretsdenyra.com.
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
  const builtItems = buildItemLines(items, summary.currency);
  const name = customerLabel(customer);
  const address = addressLabel(shipping);
  const phone = String(customer.phone ?? '—');
  const total = formatMoney(summary.total, summary.currency);
  const subtotal = formatMoney(summary.subtotal, summary.currency);
  const shippingFee = formatMoney(summary.shipping, summary.currency);
  const itemLabels = builtItems.map((i) => i.label);

  const adminSubject = `[Nyra] Commande payée ${order.orderNumber} — ${total}`;
  const adminText = [
    'Nouvelle commande payée',
    '',
    `N° commande : ${order.orderNumber}`,
    `Checkout    : ${checkout.checkoutId}`,
    `Total       : ${total}`,
    `Sous-total  : ${subtotal}`,
    `Livraison   : ${shippingFee}`,
    `Paiement    : ${paymentProvider}`,
    `Réf. paiement : ${paymentReference}`,
    '',
    `Client : ${name}`,
    `Tél.   : ${phone}`,
    `Email  : ${customer.email ?? '—'}`,
    `Adresse: ${address}`,
    '',
    'Articles :',
    itemLabels.join('\n') || '—',
  ].join('\n');

  const adminResult = await sendOrdersNotifyEmail(strapi, { subject: adminSubject, text: adminText });

  const customerEmail = String(customer.email ?? '').trim();
  let customerResult: { ok: boolean; reason?: string } = { ok: false, reason: 'no_customer_email' };

  if (customerEmail && isEmail(customerEmail)) {
    const customerSubject = `Secrets de Nyra — Commande ${order.orderNumber} confirmée`;
    const customerText = [
      `Bonjour ${name},`,
      '',
      'Merci pour votre confiance. Votre paiement est confirmé.',
      '',
      `Votre commande ${order.orderNumber} est en cours de traitement.`,
      'Vous serez contacté(e) dans les plus brefs délais pour procéder à la livraison.',
      '',
      `Total payé : ${total}`,
      `Sous-total : ${subtotal}`,
      `Livraison  : ${shippingFee}`,
      `Téléphone  : ${phone}`,
      `Adresse    : ${address}`,
      '',
      'Articles :',
      itemLabels.join('\n') || '—',
      '',
      '— Secrets de Nyra',
      'contact@secretsdenyra.com',
    ].join('\n');

    customerResult = await sendMail(strapi, {
      to: customerEmail,
      subject: customerSubject,
      text: customerText,
      html: customerOrderHtml({
        name,
        orderNumber: String(order.orderNumber),
        total,
        subtotal,
        shipping: shippingFee,
        address,
        phone,
        itemLabels,
      }),
    });
  } else {
    strapi.log.info('[nyra-mail] Pas d’email client — confirmation client ignorée.');
  }

  return { admin: adminResult, customer: customerResult };
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
