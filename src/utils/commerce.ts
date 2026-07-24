export type AnyRecord = Record<string, any>;

export const FREE_SHIPPING_THRESHOLD = 45000;
export const SHIPPING_FEE = 0;
export const MAX_CART_QUANTITY = 20;
export const CURRENCY = 'XOF';

export const businessError = (ctx: AnyRecord, status: number, code: string, message: string, details?: AnyRecord) => {
  ctx.status = status;
  const requestId = ctx.state?.requestId;
  ctx.body = {
    code,
    message,
    ...(details ? { details } : {}),
    ...(requestId ? { requestId } : {}),
  };
};

export const requireUser = (ctx: AnyRecord) => {
  const user = ctx.state?.user;
  if (!user) {
    businessError(ctx, 401, 'UNAUTHORIZED', 'Authentification requise.');
    return null;
  }
  return user;
};

export const publicMedia = (media?: AnyRecord | null) => {
  if (!media) return null;

  return {
    url: media.url,
    alternativeText: media.alternativeText ?? null,
    width: media.width ?? null,
    height: media.height ?? null,
    formats: media.formats ?? null,
  };
};

export const productLookupWhere = (productId: unknown) => {
  const value = String(productId ?? '').trim();
  const asNumber = Number(value);
  const candidates: AnyRecord[] = [{ documentId: value }, { slug: value }];

  if (Number.isInteger(asNumber) && asNumber > 0) {
    candidates.push({ id: asNumber });
  }

  return { $or: candidates };
};

export const variantLookupWhere = (variantId: unknown) => {
  const value = String(variantId ?? '').trim();
  const asNumber = Number(value);
  const candidates: AnyRecord[] = [{ documentId: value }, { sku: value }];

  if (Number.isInteger(asNumber) && asNumber > 0) {
    candidates.push({ id: asNumber });
  }

  return { $or: candidates };
};

const activeVariantsOnProduct = (product: AnyRecord) =>
  (product.variants ?? []).filter((variant: AnyRecord) => variant.isActive !== false);

export const matchVariantOnProduct = (product: AnyRecord, variantId?: unknown) => {
  const value = String(variantId ?? '').trim();
  if (!value) return null;

  const asNumber = Number(value);
  const variants = activeVariantsOnProduct(product);

  return (
    variants.find(
      (variant: AnyRecord) =>
        String(variant.documentId ?? '') === value ||
        String(variant.id) === value ||
        String(variant.sku ?? '') === value ||
        (Number.isInteger(asNumber) && asNumber > 0 && variant.id === asNumber),
    ) ?? null
  );
};

export const defaultVariantOnProduct = (product: AnyRecord) => {
  const variants = activeVariantsOnProduct(product);
  return (
    variants.find((variant: AnyRecord) => variant.isDefault) ??
    variants.sort((a: AnyRecord, b: AnyRecord) => (a.position ?? 0) - (b.position ?? 0))[0] ??
    null
  );
};

/** Produit sans variante Strapi (ex. Secret de Nyra) — prix au niveau produit. */
export const productLevelVariant = (product: AnyRecord) => ({
  id: null,
  documentId: null,
  sku: `${product.slug}-base`,
  label: product.name,
  name: product.name,
  format: 'standard',
  price: product.price,
  stock: 9999,
  isActive: true,
  isDefault: true,
});

export const ensurePersistedVariant = async (strapi: any, product: AnyRecord, variant: AnyRecord) => {
  if (variant?.id) return variant;

  const existing = await strapi.db.query('api::variant.variant').findOne({
    where: { product: { id: product.id } },
    orderBy: [{ position: 'asc' }],
  });
  if (existing) return existing;

  return strapi.db.query('api::variant.variant').create({
    data: {
      name: product.name,
      sku: `${product.slug}-default`,
      format: 'standard',
      label: product.name,
      price: product.price,
      stock: 999,
      isDefault: true,
      isActive: true,
      position: 0,
      product: product.id,
      publishedAt: new Date(),
    },
  });
};

export const cartItemPopulate = {
  product: {
    populate: {
      image: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
      category: { fields: ['name', 'slug'] },
    },
  },
  variant: true,
};

export const publicCartProduct = (product?: AnyRecord | null) => {
  if (!product) return null;
  const id = String(product.documentId ?? product.id);

  return {
    id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    currency: CURRENCY,
    compareAtPrice: product.compareAtPrice ?? null,
    image: publicMedia(product.image),
    category: product.category
      ? {
          id: String(product.category.documentId ?? product.category.id),
          slug: product.category.slug,
          name: product.category.name,
        }
      : null,
    analytics: {
      item_id: id,
      item_name: product.name,
      item_category: product.category?.name ?? product.category?.slug ?? null,
      price: product.price,
      currency: CURRENCY,
    },
  };
};

export const publicCartVariant = (variant?: AnyRecord | null) => {
  if (!variant) return null;

  return {
    id: String(variant.documentId ?? variant.id),
    sku: variant.sku,
    label: variant.label ?? variant.name,
    size: variant.size ?? variant.format,
    colorName: variant.colorName ?? null,
    colorHex: variant.colorHex ?? null,
    price: variant.price ?? null,
    compareAtPrice: variant.compareAtPrice ?? null,
    stockQty: variant.stock ?? 0,
    inStock: (variant.stock ?? 0) > 0,
  };
};

export const cartUnitPrice = (item: AnyRecord) => item.variant?.price ?? item.product?.price ?? 0;

export const publicCartItem = (item: AnyRecord) => {
  const unitPrice = cartUnitPrice(item);
  const quantity = item.quantity ?? 0;

  return {
    id: String(item.documentId ?? item.id),
    product: publicCartProduct(item.product),
    variant: publicCartVariant(item.variant),
    quantity,
    unitPrice,
    lineTotal: unitPrice * quantity,
    analytics: {
      item_id: String(item.product?.documentId ?? item.product?.id),
      item_name: item.product?.name,
      item_category: item.product?.category?.name ?? item.product?.category?.slug ?? null,
      price: unitPrice,
      quantity,
      currency: CURRENCY,
    },
  };
};

export const cartSummary = (items: AnyRecord[]) => {
  const publicItems = items.map(publicCartItem);
  const subtotal = publicItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const productIds = publicItems.map((item) => item.product?.id).filter(Boolean);
  const itemCount = publicItems.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items: publicItems,
    count: publicItems.length,
    itemCount,
    productIds,
    currency: CURRENCY,
    subtotal,
    shipping,
    shippingFee: shipping,
    discounts: [],
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    total: subtotal + shipping,
  };
};

export const validateQuantity = (quantity: unknown) => {
  const parsed = Number(quantity);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_CART_QUANTITY) return null;
  return parsed;
};
