import path from 'path';
import type { Core } from '@strapi/strapi';

/**
 * Email :
 * - Par défaut Brevo API HTTPS (marche sur Railway — SMTP Hostinger souvent bloqué)
 * - Fallback nodemailer si EMAIL_PROVIDER=nodemailer (local / hors Railway)
 */
const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => {
  const providerName = env('EMAIL_PROVIDER', 'brevo').toLowerCase();
  const useBrevo = providerName === 'brevo';

  return {
    email: {
      config: {
        provider: useBrevo
          ? path.join(process.cwd(), 'providers', 'email-brevo')
          : 'nodemailer',
        providerOptions: useBrevo
          ? {
              apiKey: env('BREVO_API_KEY', ''),
            }
          : {
              host: env('EMAIL_SMTP_HOST', 'smtp.hostinger.com'),
              port: env.int('EMAIL_SMTP_PORT', 587),
              secure: env.bool('EMAIL_SMTP_SECURE', false),
              requireTLS: env.bool('EMAIL_SMTP_REQUIRE_TLS', true),
              family: 4,
              connectionTimeout: 20_000,
              greetingTimeout: 20_000,
              socketTimeout: 30_000,
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
  };
};

export default config;
