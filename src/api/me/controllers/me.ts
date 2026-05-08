import { businessError, productLookupWhere, publicCartProduct, requireUser } from '../../../utils/commerce';

declare const strapi: any;

const filled = (value: unknown) => String(value ?? '').trim().length > 0;
const toPositiveInt = (value: unknown, fallback: number, max?: number) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return max ? Math.min(parsed, max) : parsed;
};

const profilePayload = (user: any, profile?: any | null) => ({
  email: user.email,
  username: user.username,
  firstName: profile?.firstName ?? '',
  lastName: profile?.lastName ?? '',
  phone: profile?.phone ?? '',
});

const sanitizeProfileInput = (body: any) => ({
  firstName: String(body?.firstName ?? '').trim(),
  lastName: String(body?.lastName ?? '').trim(),
  phone: String(body?.phone ?? '').trim(),
});

const addressPayload = (address: any) => ({
  id: String(address.documentId ?? address.id),
  label: address.label,
  line1: address.line1,
  line2: address.line2 ?? '',
  city: address.city,
  region: address.region ?? '',
  postalCode: address.postalCode ?? '',
  country: address.country,
  isDefault: Boolean(address.isDefault),
});

const addressesPayload = (addresses: any[]) => {
  const publicAddresses = addresses.map(addressPayload);

  return {
    addresses: publicAddresses,
    items: publicAddresses,
    count: publicAddresses.length,
  };
};

const sanitizeAddressInput = (body: any) => ({
  label: String(body?.label ?? '').trim(),
  line1: String(body?.line1 ?? '').trim(),
  line2: String(body?.line2 ?? '').trim(),
  city: String(body?.city ?? '').trim(),
  region: String(body?.region ?? '').trim(),
  postalCode: String(body?.postalCode ?? '').trim(),
  country: String(body?.country ?? '').trim(),
  isDefault: Boolean(body?.isDefault),
});

const validateAddress = (address: any) => {
  if (!filled(address.label)) return 'Libellé obligatoire.';
  if (!filled(address.line1)) return 'Adresse obligatoire.';
  if (!filled(address.city)) return 'Ville obligatoire.';
  if (!filled(address.country)) return 'Pays obligatoire.';
  return null;
};

const orderSummaryPayload = (order: any) => ({
  id: order.orderNumber,
  technicalId: String(order.documentId ?? order.id),
  orderNumber: order.orderNumber,
  createdAt: order.createdAt,
  status: order.status,
  total: order.total,
});

const orderDetailPayload = (order: any) => ({
  id: order.orderNumber,
  technicalId: String(order.documentId ?? order.id),
  createdAt: order.createdAt,
  status: order.status,
  paymentMethod: order.paymentProvider === 'stripe' ? 'card' : order.paymentProvider,
  items: (order.items ?? []).map((item: any) => ({
    id: String(item.documentId ?? item.id),
    productName: item.productName,
    productSlug: item.productSlug,
    variantLabel: item.variantLabel,
    sku: item.sku,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
    analytics: {
      item_id: item.productDocumentId ?? item.productSlug,
      item_name: item.productName,
      item_category: item.categoryName ?? null,
      price: item.unitPrice,
      quantity: item.quantity,
      currency: item.currency ?? order.currency,
    },
  })),
  subtotal: order.subtotal,
  shippingFee: order.shipping,
  total: order.total,
  shippingAddress: order.shippingAddress,
  billingAddress: order.billingAddress,
  analytics: {
    transaction_id: order.orderNumber,
    checkout_session_id: order.checkoutId,
    currency: order.currency,
    value: order.total,
    shipping: order.shipping,
  },
});

const wishlistPopulate = {
  product: {
    populate: {
      image: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
      category: { fields: ['name', 'slug'] },
    },
  },
};

const PURCHASED_ORDER_STATUSES = ['paid', 'shipped', 'delivered'];

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

const viewedProductsPayload = (items: any[]) => {
  const publicItems = items
    .map((item: any) => ({
      id: String(item.documentId ?? item.id),
      viewedAt: item.viewedAt,
      product: publicCartProduct(item.product),
    }))
    .filter((item: any) => Boolean(item.product));

  return {
    items: publicItems,
    products: publicItems.map((item: any) => item.product),
    productIds: publicItems.map((item: any) => item.product.id),
    count: publicItems.length,
  };
};

const purchasedProductFallback = (item: any) => ({
  id: item.productDocumentId ?? item.productSlug,
  slug: item.productSlug,
  name: item.productName,
  price: item.unitPrice,
  currency: item.currency,
  compareAtPrice: null,
  image: null,
  category: item.categoryName
    ? {
        id: item.categoryName,
        slug: item.categoryName,
        name: item.categoryName,
      }
    : null,
  analytics: {
    item_id: item.productDocumentId ?? item.productSlug,
    item_name: item.productName,
    item_category: item.categoryName ?? null,
    price: item.unitPrice,
    currency: item.currency,
  },
});

const purchasedProductsPayload = (items: any[]) => {
  const byProduct = new Map<string, any>();

  for (const item of items) {
    const product = publicCartProduct(item.product) ?? purchasedProductFallback(item);
    if (!product?.id) continue;

    const key = product.id;
    const order = item.order;
    const purchasedAt = order?.createdAt ?? item.createdAt;
    const existing = byProduct.get(key);

    if (!existing) {
      byProduct.set(key, {
        product,
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        totalQuantity: item.quantity ?? 0,
        totalSpent: item.lineTotal ?? 0,
        currency: item.currency ?? order?.currency,
        lastPurchasedAt: purchasedAt,
        lastOrderId: order?.orderNumber ?? String(order?.documentId ?? order?.id ?? ''),
        orderCount: order?.id ? 1 : 0,
        orders: order
          ? [
              {
                id: order.orderNumber,
                technicalId: String(order.documentId ?? order.id),
                status: order.status,
                purchasedAt,
                quantity: item.quantity ?? 0,
                lineTotal: item.lineTotal ?? 0,
              },
            ]
          : [],
      });
      continue;
    }

    existing.totalQuantity += item.quantity ?? 0;
    existing.totalSpent += item.lineTotal ?? 0;
    if (purchasedAt && new Date(purchasedAt).getTime() > new Date(existing.lastPurchasedAt ?? 0).getTime()) {
      existing.lastPurchasedAt = purchasedAt;
      existing.lastOrderId = order?.orderNumber ?? existing.lastOrderId;
    }

    const existingOrderEntry = order
      ? existing.orders.find((entry: any) => entry.technicalId === String(order.documentId ?? order.id))
      : null;

    if (existingOrderEntry) {
      existingOrderEntry.quantity += item.quantity ?? 0;
      existingOrderEntry.lineTotal += item.lineTotal ?? 0;
    } else if (order) {
      existing.orderCount += 1;
      existing.orders.push({
        id: order.orderNumber,
        technicalId: String(order.documentId ?? order.id),
        status: order.status,
        purchasedAt,
        quantity: item.quantity ?? 0,
        lineTotal: item.lineTotal ?? 0,
      });
    }
  }

  const products = Array.from(byProduct.values()).sort(
    (a, b) => new Date(b.lastPurchasedAt ?? 0).getTime() - new Date(a.lastPurchasedAt ?? 0).getTime(),
  );

  return {
    items: products,
    products: products.map((entry) => entry.product),
    productIds: products.map((entry) => entry.productId),
    count: products.length,
  };
};

const productCardPopulate = {
  image: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
  category: { fields: ['name', 'slug'] },
};

const findAddressForUser = async (strapi: any, userId: number, addressId: string) => {
  const numericId = Number(addressId);
  const orFilters: any[] = [{ documentId: addressId }];
  if (Number.isInteger(numericId) && numericId > 0) orFilters.push({ id: numericId });

  return strapi.db.query('api::address.address').findOne({
    where: {
      user: { id: userId },
      $or: orFilters,
    },
  });
};

const clearDefaultAddresses = async (strapi: any, userId: number) =>
  strapi.db.query('api::address.address').updateMany({
    where: { user: { id: userId }, isDefault: true },
    data: { isDefault: false },
  });

export default {
  async profile(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const profile = await strapi.db.query('api::user-profile.user-profile').findOne({
      where: { user: { id: user.id } },
    });

    ctx.body = profilePayload(user, profile);
  },

  async updateProfile(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const data = sanitizeProfileInput(ctx.request.body);
    const existing = await strapi.db.query('api::user-profile.user-profile').findOne({
      where: { user: { id: user.id } },
    });
    const profile = existing
      ? await strapi.db.query('api::user-profile.user-profile').update({
          where: { id: existing.id },
          data,
        })
      : await strapi.db.query('api::user-profile.user-profile').create({
          data: {
            ...data,
            user: user.id,
          },
        });

    ctx.body = profilePayload(user, profile);
  },

  async listAddresses(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const addresses = await strapi.db.query('api::address.address').findMany({
      where: { user: { id: user.id } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    ctx.body = addressesPayload(addresses);
  },

  async createAddress(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const data = sanitizeAddressInput(ctx.request.body);
    const validationError = validateAddress(data);
    if (validationError) return businessError(ctx, 400, 'ADDRESS_INVALID', validationError);

    const existingCount = await strapi.db.query('api::address.address').count({
      where: { user: { id: user.id } },
    });
    const isDefault = data.isDefault || existingCount === 0;
    if (isDefault) await clearDefaultAddresses(strapi, user.id);

    const address = await strapi.db.query('api::address.address').create({
      data: {
        ...data,
        isDefault,
        user: user.id,
      },
    });

    ctx.body = { address: addressPayload(address) };
  },

  async updateAddress(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const existing = await findAddressForUser(strapi, user.id, ctx.params.addressId);
    if (!existing) return businessError(ctx, 404, 'ADDRESS_NOT_FOUND', 'Adresse introuvable.');

    const data = sanitizeAddressInput({ ...existing, ...ctx.request.body });
    data.isDefault = ctx.request.body?.isDefault ?? existing.isDefault;
    const validationError = validateAddress(data);
    if (validationError) return businessError(ctx, 400, 'ADDRESS_INVALID', validationError);

    if (data.isDefault) await clearDefaultAddresses(strapi, user.id);

    const address = await strapi.db.query('api::address.address').update({
      where: { id: existing.id },
      data,
    });

    ctx.body = { address: addressPayload(address) };
  },

  async deleteAddress(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const existing = await findAddressForUser(strapi, user.id, ctx.params.addressId);
    if (!existing) return businessError(ctx, 404, 'ADDRESS_NOT_FOUND', 'Adresse introuvable.');

    await strapi.db.query('api::address.address').delete({ where: { id: existing.id } });
    ctx.body = { removed: true };
  },

  async setDefaultAddress(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const existing = await findAddressForUser(strapi, user.id, ctx.params.addressId);
    if (!existing) return businessError(ctx, 404, 'ADDRESS_NOT_FOUND', 'Adresse introuvable.');

    await clearDefaultAddresses(strapi, user.id);
    const address = await strapi.db.query('api::address.address').update({
      where: { id: existing.id },
      data: { isDefault: true },
    });

    ctx.body = { address: addressPayload(address) };
  },

  async orders(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const page = toPositiveInt(ctx.query?.page, 1);
    const pageSize = toPositiveInt(ctx.query?.pageSize, 10, 50);
    const where = { user: { id: user.id } };
    const [orders, total] = await Promise.all([
      strapi.db.query('api::order.order').findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        offset: (page - 1) * pageSize,
        limit: pageSize,
      }),
      strapi.db.query('api::order.order').count({ where }),
    ]);

    ctx.body = {
      orders: orders.map(orderSummaryPayload),
      items: orders.map(orderSummaryPayload),
      count: total,
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  },

  async order(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const value = String(ctx.params.orderId);
    const numericId = Number(value);
    const orFilters: any[] = [{ documentId: value }, { orderNumber: value }];
    if (Number.isInteger(numericId) && numericId > 0) orFilters.push({ id: numericId });

    const order = await strapi.db.query('api::order.order').findOne({
      where: {
        user: { id: user.id },
        $or: orFilters,
      },
      populate: { items: true },
    });

    if (!order) return businessError(ctx, 404, 'ORDER_NOT_FOUND', 'Commande introuvable.');
    ctx.body = { order: orderDetailPayload(order) };
  },

  async purchasedProducts(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const pageSize = toPositiveInt(ctx.query?.pageSize, 100, 200);
    const items = await strapi.db.query('api::order-item.order-item').findMany({
      where: {
        order: {
          user: { id: user.id },
          status: { $in: PURCHASED_ORDER_STATUSES },
        },
      },
      populate: {
        product: { populate: productCardPopulate },
        order: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      limit: pageSize,
    });

    ctx.body = purchasedProductsPayload(items);
  },

  async wishlist(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const items = await strapi.db.query('api::wishlist-item.wishlist-item').findMany({
      where: { user: { id: user.id } },
      populate: wishlistPopulate,
      orderBy: [{ createdAt: 'desc' }],
    });

    ctx.body = wishlistPayload(items);
  },

  async addWishlistItem(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const product = await strapi.db.query('api::product.product').findOne({
      where: productLookupWhere(ctx.request.body?.productId),
      populate: productCardPopulate,
    });
    if (!product) return businessError(ctx, 404, 'PRODUCT_NOT_FOUND', 'Produit introuvable.');

    const existing = await strapi.db.query('api::wishlist-item.wishlist-item').findOne({
      where: {
        user: { id: user.id },
        product: { id: product.id },
      },
    });

    const item =
      existing ??
      (await strapi.db.query('api::wishlist-item.wishlist-item').create({
        data: { user: user.id, product: product.id },
        populate: wishlistPopulate,
      }));

    ctx.body = {
      item: publicWishlistItem(existing ? { ...existing, product } : item),
      products: [publicCartProduct(product)].filter(Boolean),
      productIds: [publicCartProduct(product)?.id].filter(Boolean),
      added: !existing,
    };
  },

  async deleteWishlistItem(ctx: any) {
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
      if (item) await strapi.db.query('api::wishlist-item.wishlist-item').delete({ where: { id: item.id } });
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

  async viewedProducts(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const items = await strapi.db.query('api::viewed-product.viewed-product').findMany({
      where: { user: { id: user.id } },
      populate: { product: { populate: productCardPopulate } },
      orderBy: [{ viewedAt: 'desc' }],
      limit: 20,
    });

    ctx.body = viewedProductsPayload(items);
  },

  async addViewedProduct(ctx: any) {
    const user = requireUser(ctx);
    if (!user) return;

    const product = await strapi.db.query('api::product.product').findOne({
      where: productLookupWhere(ctx.request.body?.productId),
      populate: productCardPopulate,
    });
    if (!product) return businessError(ctx, 404, 'PRODUCT_NOT_FOUND', 'Produit introuvable.');

    const existing = await strapi.db.query('api::viewed-product.viewed-product').findOne({
      where: {
        user: { id: user.id },
        product: { id: product.id },
      },
    });

    if (existing) {
      await strapi.db.query('api::viewed-product.viewed-product').update({
        where: { id: existing.id },
        data: { viewedAt: new Date() },
      });
    } else {
      await strapi.db.query('api::viewed-product.viewed-product').create({
        data: {
          user: user.id,
          product: product.id,
          viewedAt: new Date(),
        },
      });
    }

    ctx.body = { tracked: true };
  },
};
