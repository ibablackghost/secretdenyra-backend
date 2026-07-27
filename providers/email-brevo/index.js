'use strict';

/**
 * Provider email Strapi → Brevo API HTTPS (port 443).
 * Contourne le blocage SMTP sortant de Railway (465/587).
 *
 * Env : BREVO_API_KEY
 * Sender : settings.defaultFrom (doit être vérifié dans Brevo)
 */

const parseAddress = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const angled = raw.match(/^(.*)<([^>]+)>$/);
  if (angled) {
    const name = angled[1].trim().replace(/^["']|["']$/g, '');
    const email = angled[2].trim();
    return name ? { name, email } : { email };
  }

  return { email: raw };
};

const toRecipientList = (value) => {
  if (!value) return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  return list
    .map((entry) => parseAddress(entry))
    .filter((entry) => entry && entry.email);
};

module.exports = {
  init(providerOptions = {}, settings = {}) {
    const apiKey = String(providerOptions.apiKey || process.env.BREVO_API_KEY || '').trim();

    return {
      async send(options) {
        if (!apiKey) {
          throw new Error('BREVO_API_KEY manquant — configure la clé API Brevo.');
        }

        const sender =
          parseAddress(options.from) ||
          parseAddress(settings.defaultFrom) ||
          parseAddress(process.env.EMAIL_DEFAULT_FROM);

        if (!sender?.email) {
          throw new Error('Expéditeur email manquant (EMAIL_DEFAULT_FROM).');
        }

        const to = toRecipientList(options.to);
        if (to.length === 0) {
          throw new Error('Destinataire email manquant.');
        }

        const replyTo =
          parseAddress(options.replyTo) ||
          parseAddress(settings.defaultReplyTo) ||
          parseAddress(process.env.EMAIL_DEFAULT_REPLY_TO);

        const payload = {
          sender,
          to,
          subject: options.subject,
          textContent: options.text || undefined,
          htmlContent: options.html || options.text || undefined,
          ...(replyTo ? { replyTo } : {}),
          ...(toRecipientList(options.cc).length ? { cc: toRecipientList(options.cc) } : {}),
          ...(toRecipientList(options.bcc).length ? { bcc: toRecipientList(options.bcc) } : {}),
        };

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'api-key': apiKey,
          },
          body: JSON.stringify(payload),
        });

        const rawText = await response.text();
        let body = {};
        try {
          body = rawText ? JSON.parse(rawText) : {};
        } catch {
          body = { message: rawText };
        }

        if (!response.ok) {
          throw new Error(
            `Brevo ${response.status}: ${body.message || body.code || rawText || 'envoi refusé'}`,
          );
        }

        return body;
      },
    };
  },
};
