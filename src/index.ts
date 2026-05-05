import type { Core } from '@strapi/strapi';

import { seedNyraCatalog } from './bootstrap/nyra-catalog';

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await seedNyraCatalog(strapi);
  },
};
