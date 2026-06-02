import { createHash, randomBytes } from 'crypto';

import {
  businessError,
  defaultVariantOnProduct,
  matchVariantOnProduct,
  productLevelVariant,
  productLookupWhere,
  validateQuantity,
  variantLookupWhere,
} from './commerce';

export const GUEST_TOKEN_HEADER = 'x-checkout-token';

export const hashGuestToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const generateGuestToken = () => {
  const token = `gst_${randomBytes(32).toString('hex')}`;
  return { token, hash: hashGuestToken(token) };
};

export const getGuestTokenFromRequest = (ctx: any) => {
  const raw =
    ctx.request?.header?.[GUEST_TOKEN_HEADER] ??
    ctx.request?.header?.['X-Checkout-Token'] ??
    ctx.get?.(GUEST_TOKEN_HEADER);
  const normalized = String(raw ?? '').trim();
  return normalized || null;
};

export const getOptionalUser = async (ctx: any, strapi: any) => {
  if (ctx.state?.user) return ctx.state.user;

  const authorization = String(ctx.request?.header?.authorization ?? '');
  if (!authorization.startsWith('Bearer ')) return null;

  try {
    const token = authorization.slice(7).trim();
    if (!token) return null;

    const payload = await strapi.plugin('users-permissions').service('jwt').verify(token);
    const userId = payload?.id;
    if (!userId) return null;

    return strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
    });
  } catch {
    return null;
  }
};

export type CheckoutAccessResult =
  | { ok: true; checkout: any; userId: number | null; isGuest: boolean }
  | { ok: false; handled: true };

const publishedVariantWhere = {
  publishedAt: { $notNull: true },
  $or: [{ isActive: true }, { isActive: { $null: true } }],
};

const findVariantOnProduct = async (strapi: any, product: any, variantId: unknown) => {
  const fromDb = await strapi.db.query('api::variant.variant').findOne({
    where: {
      $and: [variantLookupWhere(variantId), { product: { id: product.id } }, publishedVariantWhere],
    },
  });
  if (fromDb) return fromDb;

  return matchVariantOnProduct(product, variantId);
};

const resolveVariantForLineItem = async (
  strapi: any,
  product: any,
  variantId?: unknown,
) => {
  const variantIdProvided = String(variantId ?? '').trim().length > 0;

  if (variantIdProvided) {
    const variant = await findVariantOnProduct(strapi, product, variantId);
    if (!variant) return { error: 'VARIANT_NOT_FOUND' as const };
    return { variant };
  }

  let variant = defaultVariantOnProduct(product);

  if (!variant) {
    variant = await strapi.db.query('api::variant.variant').findOne({
      where: {
        $and: [{ product: { id: product.id } }, publishedVariantWhere],
      },
      orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
    });
  }

  if (!variant) {
    if (product.price == null) return { error: 'PRODUCT_NOT_FOUND' as const };
    return { variant: productLevelVariant(product) };
  }

  return { variant };
};

export const resolveCheckoutLineItem = async (
  strapi: any,
  rawItem: { productId?: unknown; variantId?: unknown; quantity?: unknown },
) => {
  const quantity = validateQuantity(rawItem.quantity);
  if (!quantity) return { error: 'INVALID_QUANTITY' as const };

  const product = await strapi.db.query('api::product.product').findOne({
    where: {
      $and: [productLookupWhere(rawItem.productId), { publishedAt: { $notNull: true } }],
    },
    populate: {
      variants: true,
      category: { fields: ['name', 'slug'] },
    },
  });

  if (!product) return { error: 'PRODUCT_NOT_FOUND' as const };

  const variantResult = await resolveVariantForLineItem(strapi, product, rawItem.variantId);
  if ('error' in variantResult && variantResult.error) return { error: variantResult.error };

  const { variant } = variantResult;
  if (quantity > (variant.stock ?? 0)) return { error: 'OUT_OF_STOCK' as const };

  return { product, variant, quantity };
};

export const serializeLineItems = (items: any[]) =>
  items.map((item) => ({
    quantity: item.quantity,
    product: {
      id: item.product.id,
      documentId: item.product.documentId ?? null,
      name: item.product.name,
      slug: item.product.slug,
      price: item.product.price,
      category: item.product.category
        ? {
            id: item.product.category.id,
            documentId: item.product.category.documentId ?? null,
            name: item.product.category.name,
            slug: item.product.category.slug,
          }
        : null,
    },
    variant: {
      id: item.variant.id,
      documentId: item.variant.documentId ?? null,
      sku: item.variant.sku,
      label: item.variant.label ?? null,
      name: item.variant.name ?? null,
      format: item.variant.format ?? null,
      price: item.variant.price ?? null,
      stock: item.variant.stock ?? 0,
    },
  }));

export const buildLineItemsFromRequest = async (strapi: any, requestedItems: unknown) => {
  if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
    return { error: 'CART_EMPTY' as const };
  }

  const items: any[] = [];

  for (const item of requestedItems) {
    const resolved = await resolveCheckoutLineItem(strapi, item as any);
    if (resolved.error) return { error: resolved.error };
    items.push(resolved);
  }

  return { items };
};

export const resolveCheckoutAccess = async (
  strapi: any,
  ctx: any,
  checkoutId: string,
): Promise<CheckoutAccessResult> => {
  const user = await getOptionalUser(ctx, strapi);
  const guestToken = getGuestTokenFromRequest(ctx);

  const checkout = await strapi.db.query('api::checkout.checkout').findOne({
    where: { checkoutId },
    populate: { user: true },
  });

  if (!checkout) {
    businessError(ctx, 404, 'CHECKOUT_NOT_FOUND', 'Checkout introuvable.');
    return { ok: false, handled: true };
  }

  if (checkout.user?.id) {
    if (!user || user.id !== checkout.user.id) {
      businessError(ctx, 401, 'UNAUTHORIZED', 'Authentification requise pour ce checkout.');
      return { ok: false, handled: true };
    }

    return {
      ok: true,
      checkout,
      userId: user.id,
      isGuest: false,
    };
  }

  if (!checkout.guestTokenHash) {
    businessError(ctx, 401, 'UNAUTHORIZED', 'Jeton checkout requis.');
    return { ok: false, handled: true };
  }

  if (!guestToken || hashGuestToken(guestToken) !== checkout.guestTokenHash) {
    businessError(ctx, 401, 'UNAUTHORIZED', 'Jeton checkout invalide.');
    return { ok: false, handled: true };
  }

  return {
    ok: true,
    checkout,
    userId: user?.id ?? null,
    isGuest: true,
  };
};

export const resolvePaymentAccess = async (strapi: any, ctx: any, payment: any) =>
  resolveCheckoutAccess(strapi, ctx, payment.checkoutId);
