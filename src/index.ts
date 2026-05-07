import type { Core } from '@strapi/strapi';

import { ensureNyraDbIndexes } from './bootstrap/db-indexes';
import { seedNyraCatalog } from './bootstrap/nyra-catalog';

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureNyraDbIndexes(strapi);
    await seedNyraCatalog(strapi);
  },
};
