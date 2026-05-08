import { factories } from '@strapi/strapi';

import { businessError, productLookupWhere, publicCartProduct, requireUser } from '../../../utils/commerce';

const wishlistPopulate = {
  product: {
    populate: {
      image: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
      category: { fields: ['name', 'slug'] },
    },
  },
};

const publicWishlistItem = (item: any) => ({
  id: String(item.documentId ?? item.id),
  product: publicCartProduct(item.product),
});

const wishlistPayload = (items: any[]) => {
  const publicItems = items.map(publicWishlistItem);

  return {
    items: publicItems,
    products: publicItems.map((item) => item.product).filter(Boolean),
    productIds: publicItems.map((item) => item.product?.id).filter(Boolean),
    count: publicItems.length,
  };
};

export default factories.createCoreController('api::wishlist-item.wishlist-item', ({ strapi }) => ({
  async list(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const items = await strapi.db.query('api::wishlist-item.wishlist-item').findMany({
      where: { user: { id: user.id } },
      populate: wishlistPopulate,
      orderBy: [{ createdAt: 'desc' }],
    });

    ctx.body = wishlistPayload(items);
  },

  async addItem(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const product = await strapi.db.query('api::product.product').findOne({
      where: productLookupWhere(ctx.request.body?.productId),
      populate: {
        image: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
        category: { fields: ['name', 'slug'] },
      },
    });

    if (!product) {
      return businessError(ctx, 404, 'PRODUCT_NOT_FOUND', 'Produit introuvable.');
    }

    const existing = await strapi.db.query('api::wishlist-item.wishlist-item').findOne({
      where: {
        user: { id: user.id },
        product: { id: product.id },
      },
      populate: wishlistPopulate,
    });

    const item =
      existing ??
      (await strapi.db.query('api::wishlist-item.wishlist-item').create({
        data: {
          user: user.id,
          product: product.id,
        },
        populate: wishlistPopulate,
      }));

    ctx.body = {
      item: publicWishlistItem(item),
      products: [publicCartProduct(item.product)].filter(Boolean),
      productIds: [publicCartProduct(item.product)?.id].filter(Boolean),
      added: !existing,
    };
  },

  async deleteByProduct(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const product = await strapi.db.query('api::product.product').findOne({
      where: productLookupWhere(ctx.params.productId),
    });

    if (product) {
      const item = await strapi.db.query('api::wishlist-item.wishlist-item').findOne({
        where: {
          user: { id: user.id },
          product: { id: product.id },
        },
      });

      if (item) {
        await strapi.db.query('api::wishlist-item.wishlist-item').delete({ where: { id: item.id } });
      }
    }

    const items = await strapi.db.query('api::wishlist-item.wishlist-item').findMany({
      where: { user: { id: user.id } },
      populate: wishlistPopulate,
      orderBy: [{ createdAt: 'desc' }],
    });

    ctx.body = {
      removed: true,
      ...wishlistPayload(items),
    };
  },
}));
