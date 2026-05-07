import { factories } from '@strapi/strapi';

const SAFE_PRODUCT_FIELDS = ['name', 'slug', 'price', 'rating', 'reviews', 'bgClass'] as const;

const SAFE_PRODUCT_POPULATE = {
  category: { fields: ['name', 'slug'] },
  image: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
  tags: { fields: ['name', 'slug'] },
};

export default factories.createCoreController('api::product.product', () => ({
  async find(ctx) {
    // Quand le client envoie populate=true partout, on force une version plus légère.
    if (ctx.query.populate) {
      ctx.query.populate = SAFE_PRODUCT_POPULATE;
    }

    if (!ctx.query.fields) {
      ctx.query.fields = [...SAFE_PRODUCT_FIELDS];
    }

    if (!ctx.query.pagination) {
      ctx.query.pagination = { page: 1, pageSize: 24 };
    }

    return await super.find(ctx);
  },

  async findOne(ctx) {
    if (ctx.query.populate) {
      ctx.query.populate = SAFE_PRODUCT_POPULATE;
    }

    if (!ctx.query.fields) {
      ctx.query.fields = [...SAFE_PRODUCT_FIELDS];
    }

    return await super.findOne(ctx);
  },
}));
