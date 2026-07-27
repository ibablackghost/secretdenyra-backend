import type { Core } from '@strapi/strapi';

/**
 * Envoi via SMTP Hostinger (ou autre).
 * Vars : EMAIL_SMTP_* + EMAIL_DEFAULT_FROM (= ton adresse @domaine Hostinger).
 */
const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('EMAIL_SMTP_HOST', 'smtp.hostinger.com'),
        port: env.int('EMAIL_SMTP_PORT', 465),
        secure: env.bool('EMAIL_SMTP_SECURE', true), // true = 465 SSL ; false = 587 STARTTLS
        // Railway : pas d'IPv6 sortant → sinon ENETUNREACH vers smtp.hostinger.com
        family: 4,
        auth: {
          user: env('EMAIL_SMTP_USER', ''),
          pass: env('EMAIL_SMTP_PASS', ''),
        },
      },
      settings: {
        defaultFrom: env('EMAIL_DEFAULT_FROM', 'noreply@example.com'),
        defaultReplyTo: env('EMAIL_DEFAULT_REPLY_TO', env('EMAIL_DEFAULT_FROM', 'noreply@example.com')),
      },
    },
  },
});

export default config;
