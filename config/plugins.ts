import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  email: {
    config: {
      provider: env('EMAIL_PROVIDER', 'sendmail'),
      providerOptions: {},
      settings: {
        defaultFrom: env('EMAIL_DEFAULT_FROM', 'noreply@nyra.local'),
        defaultReplyTo: env('EMAIL_DEFAULT_REPLY_TO', 'noreply@nyra.local'),
      },
    },
  },
});

export default config;
