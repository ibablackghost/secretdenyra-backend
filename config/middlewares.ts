import type { Core } from '@strapi/strapi';

/** Origines du frontend Nyra (Vite). Ajoute ton domaine HTTPS en prod. */
const corsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:', ...corsOrigins],
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            'http://localhost:1337',
            'http://127.0.0.1:1337',
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: corsOrigins,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
