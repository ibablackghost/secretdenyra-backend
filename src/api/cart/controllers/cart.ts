import {
  businessError,
  cartItemPopulate,
  cartSummary,
  productLookupWhere,
  requireUser,
  validateQuantity,
  variantLookupWhere,
} from '../../../utils/commerce';

declare const strapi: any;

const loadCart = async (strapi: any, userId: number) =>
  strapi.db.query('api::cart-item.cart-item').findMany({
    where: { user: { id: userId } },
    populate: cartItemPopulate,
    orderBy: [{ createdAt: 'asc' }],
  });

const loadProductAndVariant = async (strapi: any, productId: unknown, variantId?: unknown) => {
  const product = await strapi.db.query('api::product.product').findOne({
    where: productLookupWhere(productId),
    populate: {
      variants: true,
      image: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
      category: { fields: ['name', 'slug'] },
    },
  });

  if (!product) return { product: null, variant: null };

  const activeVariants = (product.variants ?? []).filter((variant: any) => variant.isActive !== false);
  let variant = null;

  if (variantId) {
    variant = await strapi.db.query('api::variant.variant').findOne({
      where: {
        ...variantLookupWhere(variantId),
        product: { id: product.id },
      },
    });
  } else {
    variant =
      activeVariants.find((candidate: any) => candidate.isDefault) ??
      activeVariants.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))[0] ??
      null;
  }

  return { product, variant };
};

export default {
  async find(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    ctx.body = cartSummary(await loadCart(strapi, user.id));
  },

  async addItem(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const { productId, variantId, quantity = 1 } = ctx.request.body ?? {};
    const requestedQuantity = validateQuantity(quantity);

    if (!requestedQuantity) {
      return businessError(ctx, 400, 'INVALID_QUANTITY', 'Quantité invalide.');
    }

    const { product, variant } = await loadProductAndVariant(strapi, productId, variantId);
    if (!product || !variant) {
      return businessError(ctx, 404, 'PRODUCT_NOT_FOUND', 'Produit ou variante introuvable.');
    }

    const existing = await strapi.db.query('api::cart-item.cart-item').findOne({
      where: {
        user: { id: user.id },
        variant: { id: variant.id },
      },
    });
    const nextQuantity = (existing?.quantity ?? 0) + requestedQuantity;

    if (nextQuantity > (variant.stock ?? 0)) {
      return businessError(ctx, 409, 'OUT_OF_STOCK', 'Stock insuffisant pour cette variante.');
    }

    if (existing) {
      await strapi.db.query('api::cart-item.cart-item').update({
        where: { id: existing.id },
        data: { quantity: nextQuantity },
      });
    } else {
      await strapi.db.query('api::cart-item.cart-item').create({
        data: {
          user: user.id,
          product: product.id,
          variant: variant.id,
          quantity: requestedQuantity,
        },
      });
    }

    ctx.body = cartSummary(await loadCart(strapi, user.id));
  },

  async updateItem(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const quantity = validateQuantity(ctx.request.body?.quantity);
    if (!quantity) {
      return businessError(ctx, 400, 'INVALID_QUANTITY', 'Quantité invalide.');
    }

    const item = await strapi.db.query('api::cart-item.cart-item').findOne({
      where: {
        documentId: String(ctx.params.itemId),
        user: { id: user.id },
      },
      populate: { variant: true },
    });

    if (!item) {
      return businessError(ctx, 404, 'PRODUCT_NOT_FOUND', 'Ligne panier introuvable.');
    }

    if (quantity > (item.variant?.stock ?? 0)) {
      return businessError(ctx, 409, 'OUT_OF_STOCK', 'Stock insuffisant pour cette variante.');
    }

    await strapi.db.query('api::cart-item.cart-item').update({
      where: { id: item.id },
      data: { quantity },
    });

    ctx.body = cartSummary(await loadCart(strapi, user.id));
  },

  async deleteItem(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const item = await strapi.db.query('api::cart-item.cart-item').findOne({
      where: {
        documentId: String(ctx.params.itemId),
        user: { id: user.id },
      },
    });

    if (item) {
      await strapi.db.query('api::cart-item.cart-item').delete({ where: { id: item.id } });
    }

    ctx.body = cartSummary(await loadCart(strapi, user.id));
  },
};
