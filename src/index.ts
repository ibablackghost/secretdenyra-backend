import type { Core } from '@strapi/strapi';

import importController from './api/product/controllers/import';
import { ensureNyraDbIndexes } from './bootstrap/db-indexes';
import { seedNyraCatalog } from './bootstrap/nyra-catalog';

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    strapi.server.routes({
      type: 'admin',
      prefix: '/admin',
      routes: [
        {
          method: 'POST',
          path: '/import/tisanes',
          handler: importController.importTisanes,
          config: {
            policies: ['admin::isAuthenticatedAdmin'],
          },
        },
      ],
    } as any);
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureNyraDbIndexes(strapi);
    await seedNyraCatalog(strapi);
  },
};
