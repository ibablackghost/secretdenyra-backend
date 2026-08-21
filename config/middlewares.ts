import type { Core } from '@strapi/strapi';

/** Origines du frontend Nyra (Vite). Ajoute ton domaine HTTPS en prod. */
const corsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://secretdenyra-frontend.vercel.app',
  'https://secretsdenyra.com',
  'https://www.secretsdenyra.com',
];

const config: Core.Config.Middlewares = [
  'global::nyra-request-context',
  'strapi::logger',
  'global::nyra-errors',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
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
      headers: [
        'Content-Type',
        'Authorization',
        'Origin',
        'Accept',
        'X-Checkout-Token',
        'X-Strapi-Service-Key',
        'X-Content-Locale',
      ],
      expose: ['X-Content-Locale'],
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'global::nyra-sycapay-raw-body-capture',
  {
    name: 'strapi::body',
    config: {
      includeUnparsed: true,
    },
  },
  'global::nyra-rate-limit',
  'global::nyra-cache-control',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
