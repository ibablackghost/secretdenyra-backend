import { factories } from '@strapi/strapi';

import {
  applyCategoryLocale,
  applyProductLocale,
  applyTagLocale,
  applyVariantLocale,
  resolveCatalogLocale,
  type CatalogLocale,
} from '../../../utils/catalog-locale';

const SAFE_PRODUCT_FIELDS = [
  'name',
  'nameEn',
  'slug',
  'ingredients',
  'ingredientsEn',
  'shortDescription',
  'shortDescriptionEn',
  'description',
  'descriptionEn',
  'dosage',
  'dosageEn',
  'infusionTime',
  'infusionTimeEn',
  'temperature',
  'temperatureEn',
  'origin',
  'originEn',
  'botanicalName',
  'sourceUrl',
  'price',
  'compareAtPrice',
  'rating',
  'reviews',
  'bgClass',
  'metaTitle',
  'metaTitleEn',
  'metaDescription',
  'metaDescriptionEn',
  'canonicalUrl',
  'canonicalPath',
  'imageUrl',
] as const;

const SAFE_PRODUCT_POPULATE = {
  category: {
    fields: [
      'name',
      'nameEn',
      'slug',
      'metaTitle',
      'metaTitleEn',
      'metaDescription',
      'metaDescriptionEn',
      'canonicalUrl',
      'canonicalPath',
    ],
  },
  image: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
  gallery: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
  ogImage: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
  tags: { fields: ['name', 'nameEn', 'slug'] },
  variants: {
    fields: [
      'name',
      'nameEn',
      'sku',
      'format',
      'formatEn',
      'label',
      'labelEn',
      'size',
      'sizeEn',
      'colorName',
      'colorNameEn',
      'colorHex',
      'weightValue',
      'weightUnit',
      'price',
      'compareAtPrice',
      'stock',
      'lowStockThreshold',
      'isDefault',
      'isActive',
      'position',
    ],
  },
};

type AnyRecord = Record<string, any>;

const firstParam = (value: unknown) => {
  if (Array.isArray(value)) return value[0];
  return value;
};

const toPositiveInt = (value: unknown, fallback: number, max?: number) => {
  const parsed = Number.parseInt(String(firstParam(value) ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return max ? Math.min(parsed, max) : parsed;
};

const toPositiveNumber = (value: unknown) => {
  const parsed = Number(firstParam(value));
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
};

const publishedOnly = { publishedAt: { $notNull: true } };

const publicMedia = (media?: AnyRecord | null) => {
  if (!media) return null;

  return {
    url: media.url,
    alternativeText: media.alternativeText ?? null,
    width: media.width ?? null,
    height: media.height ?? null,
    formats: media.formats ?? null,
  };
};

const publicGallery = (gallery?: AnyRecord[] | null) => {
  if (!Array.isArray(gallery)) return [];
  return gallery.map(publicMedia).filter(Boolean);
};

const publicCategory = (category?: AnyRecord | null, locale: CatalogLocale = 'fr') => {
  if (!category) return null;
  const localized = applyCategoryLocale(category, locale);

  return {
    id: String(localized.documentId ?? localized.id),
    slug: localized.slug,
    name: localized.name,
    image: publicMedia(localized.image),
    metaTitle: localized.metaTitle ?? null,
    metaDescription: localized.metaDescription ?? null,
    canonicalUrl: localized.canonicalUrl ?? null,
    canonicalPath: localized.canonicalPath ?? null,
    ogImage: publicMedia(localized.ogImage),
    locale,
  };
};

const publicTag = (tag: AnyRecord, locale: CatalogLocale = 'fr') => {
  const localized = applyTagLocale(tag, locale);
  return {
    id: String(localized.documentId ?? localized.id),
    slug: localized.slug,
    name: localized.name,
    locale,
  };
};

const publicVariant = (variant: AnyRecord, locale: CatalogLocale = 'fr') => {
  const localized = applyVariantLocale(variant, locale);
  return {
    id: String(localized.documentId ?? localized.id),
    name: localized.name,
    sku: localized.sku,
    format: localized.format,
    label: localized.label ?? localized.name,
    size: localized.size ?? localized.format,
    colorName: localized.colorName ?? null,
    colorHex: localized.colorHex ?? null,
    weightValue:
      localized.weightValue === null || localized.weightValue === undefined
        ? null
        : Number(localized.weightValue),
    weightUnit: localized.weightUnit ?? null,
    price: localized.price ?? null,
    compareAtPrice: localized.compareAtPrice ?? null,
    stock: localized.stock ?? 0,
    stockQty: localized.stock ?? 0,
    inStock: (localized.stock ?? 0) > 0,
    lowStockThreshold: localized.lowStockThreshold ?? 0,
    isDefault: Boolean(localized.isDefault),
    isActive: localized.isActive !== false,
    position: localized.position ?? 0,
    locale,
  };
};

const sortVariants = (variants: AnyRecord[] = []) =>
  variants
    .filter((variant) => variant.isActive !== false)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.name).localeCompare(String(b.name)));

const publicProduct = (product: AnyRecord, locale: CatalogLocale = 'fr') => {
  const localized = applyProductLocale(product, locale);
  const variants = sortVariants(localized.variants);
  const stockQty = variants.reduce((total, variant) => total + (variant.stock ?? 0), 0);
  const id = String(localized.documentId ?? localized.id);

  return {
    id,
    slug: localized.slug,
    name: localized.name,
    ingredients: localized.ingredients,
    shortDescription: localized.shortDescription ?? null,
    description: localized.description ?? null,
    dosage: localized.dosage ?? null,
    infusionTime: localized.infusionTime ?? null,
    temperature: localized.temperature ?? null,
    origin: localized.origin ?? null,
    botanicalName: localized.botanicalName ?? null,
    sourceUrl: localized.sourceUrl ?? null,
    price: localized.price,
    currency: 'XOF',
    compareAtPrice: localized.compareAtPrice ?? null,
    rating: Number(localized.rating ?? 0),
    reviews: localized.reviews ?? 0,
    bgClass: localized.bgClass ?? null,
    imageUrl: String(localized.imageUrl ?? '').trim() || null,
    image: publicMedia(localized.image),
    gallery: publicGallery(localized.gallery),
    category: publicCategory(localized.category, locale),
    tags: (localized.tags ?? []).map((tag: AnyRecord) => publicTag(tag, locale)),
    variants: variants.map((variant) => publicVariant(variant, locale)),
    inStock: stockQty > 0,
    stockQty,
    metaTitle: localized.metaTitle ?? null,
    metaDescription: localized.metaDescription ?? null,
    canonicalUrl: localized.canonicalUrl ?? null,
    canonicalPath: localized.canonicalPath ?? null,
    ogImage: publicMedia(localized.ogImage),
    locale,
    analytics: {
      item_id: id,
      item_name: localized.name,
      item_category: localized.category?.name ?? localized.category?.slug ?? null,
      price: localized.price,
      currency: 'XOF',
    },
  };
};

const normalizeFilters = (query: AnyRecord) => {
  const sortValues = ['popular', 'price-low', 'price-high', 'rating'];
  const sort = String(firstParam(query.sort) ?? 'popular');

  return {
    q: String(firstParam(query.q) ?? '').trim(),
    category: String(firstParam(query.category) ?? '').trim(),
    teaTag: String(firstParam(query.teaTag) ?? '').trim(),
    sort: sortValues.includes(sort) ? sort : 'popular',
    priceMax: toPositiveNumber(query.priceMax),
  };
};

const buildProductWhere = (query: AnyRecord) => {
  const filters = normalizeFilters(query);
  const where: AnyRecord = { ...publishedOnly };

  if (filters.category) {
    where.category = { slug: filters.category };
  }

  if (filters.teaTag) {
    where.tags = { slug: filters.teaTag };
  }

  if (filters.priceMax !== undefined) {
    where.price = { $lte: filters.priceMax };
  }

  if (filters.q) {
    where.$or = [
      { name: { $containsi: filters.q } },
      { ingredients: { $containsi: filters.q } },
      { shortDescription: { $containsi: filters.q } },
      { description: { $containsi: filters.q } },
      { botanicalName: { $containsi: filters.q } },
      { tags: { name: { $containsi: filters.q } } },
      { tags: { slug: { $containsi: filters.q } } },
    ];
  }

  return where;
};

const buildProductOrderBy = (sort: unknown) => {
  switch (firstParam(sort)) {
    case 'price-low':
      return [{ price: 'asc' }, { name: 'asc' }];
    case 'price-high':
      return [{ price: 'desc' }, { name: 'asc' }];
    case 'rating':
      return [{ rating: 'desc' }, { reviews: 'desc' }, { name: 'asc' }];
    case 'popular':
      return [{ reviews: 'desc' }, { rating: 'desc' }, { name: 'asc' }];
    default:
      return [{ createdAt: 'desc' }];
  }
};

const similarProductsFor = async (strapi: any, product: AnyRecord, locale: CatalogLocale, limit = 4) => {
  const tagSlugs = (product.tags ?? []).map((tag: AnyRecord) => tag.slug).filter(Boolean);
  const categorySlug = product.category?.slug;
  const orFilters: AnyRecord[] = [];

  if (categorySlug) {
    orFilters.push({ category: { slug: categorySlug } });
  }

  if (tagSlugs.length > 0) {
    orFilters.push({ tags: { slug: { $in: tagSlugs } } });
  }

  if (orFilters.length === 0) return [];

  const products = await strapi.db.query('api::product.product').findMany({
    where: {
      ...publishedOnly,
      slug: { $ne: product.slug },
      $or: orFilters,
    },
    populate: SAFE_PRODUCT_POPULATE,
    orderBy: [{ reviews: 'desc' }, { rating: 'desc' }, { name: 'asc' }],
    limit,
  });

  return products.map((item: AnyRecord) => publicProduct(item, locale));
};

const localizeCoreProductPayload = (payload: AnyRecord, locale: CatalogLocale) => {
  if (!payload) return payload;

  if (Array.isArray(payload.data)) {
    return {
      ...payload,
      data: payload.data.map((entry: AnyRecord) => {
        const localized = applyProductLocale(
          {
            ...(entry.attributes ?? entry),
            id: entry.id,
            documentId: entry.documentId,
          },
          locale,
        );
        if (entry.attributes) {
          return { ...entry, attributes: { ...entry.attributes, ...localized }, locale };
        }
        return { ...entry, ...localized, locale };
      }),
    };
  }

  if (payload.data) {
    const entry = payload.data;
    const localized = applyProductLocale(
      {
        ...(entry.attributes ?? entry),
        id: entry.id,
        documentId: entry.documentId,
      },
      locale,
    );
    if (entry.attributes) {
      return { ...payload, data: { ...entry, attributes: { ...entry.attributes, ...localized }, locale } };
    }
    return { ...payload, data: { ...entry, ...localized, locale } };
  }

  return payload;
};

export default factories.createCoreController('api::product.product', ({ strapi }) => ({
  async catalog(ctx) {
    const query = ctx.query as AnyRecord;
    const locale = resolveCatalogLocale(query);
    const page = toPositiveInt(query.page, 1);
    const pageSize = toPositiveInt(query.pageSize, 12, 48);
    const filters = normalizeFilters(query);
    const where = buildProductWhere(query);
    const productQuery = strapi.db.query('api::product.product');

    const [products, total, categories, tags] = await Promise.all([
      productQuery.findMany({
        where,
        populate: SAFE_PRODUCT_POPULATE,
        orderBy: buildProductOrderBy(filters.sort),
        offset: (page - 1) * pageSize,
        limit: pageSize,
      }),
      productQuery.count({ where }),
      strapi.db.query('api::category.category').findMany({
        where: publishedOnly,
        populate: {
          image: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
          ogImage: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
        },
        orderBy: [{ name: 'asc' }],
      }),
      strapi.db.query('api::tag.tag').findMany({
        where: publishedOnly,
        orderBy: [{ name: 'asc' }],
      }),
    ]);
    const pageCount = Math.ceil(total / pageSize);

    ctx.set('X-Content-Locale', locale);
    ctx.body = {
      products: products.map((product: AnyRecord) => publicProduct(product, locale)),
      categories: categories.map((category: AnyRecord) => publicCategory(category, locale)),
      tags: tags.map((tag: AnyRecord) => publicTag(tag, locale)),
      locale,
      pagination: {
        page,
        pageSize,
        total,
        pageCount,
        totalItems: total,
        totalPages: pageCount,
      },
      filtersApplied: {
        ...filters,
        priceMax: filters.priceMax ?? null,
      },
    };
  },

  async findBySlug(ctx) {
    const slug = String(ctx.params.slug ?? '').trim();
    const locale = resolveCatalogLocale(ctx.query as AnyRecord);

    if (!slug) {
      return ctx.badRequest('Le slug produit est requis.');
    }

    const product = await strapi.db.query('api::product.product').findOne({
      where: { ...publishedOnly, slug },
      populate: SAFE_PRODUCT_POPULATE,
    });

    if (!product) {
      return ctx.notFound('Produit introuvable.');
    }

    ctx.set('X-Content-Locale', locale);
    ctx.body = {
      product: publicProduct(product, locale),
      similarProducts: await similarProductsFor(strapi, product, locale),
      locale,
    };
  },

  async find(ctx) {
    const locale = resolveCatalogLocale(ctx.query as AnyRecord);

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

    await super.find(ctx);
    ctx.set('X-Content-Locale', locale);
    ctx.body = localizeCoreProductPayload(ctx.body as AnyRecord, locale);
  },

  async findOne(ctx) {
    const locale = resolveCatalogLocale(ctx.query as AnyRecord);

    if (ctx.query.populate) {
      ctx.query.populate = SAFE_PRODUCT_POPULATE;
    }

    if (!ctx.query.fields) {
      ctx.query.fields = [...SAFE_PRODUCT_FIELDS];
    }

    await super.findOne(ctx);
    ctx.set('X-Content-Locale', locale);
    ctx.body = localizeCoreProductPayload(ctx.body as AnyRecord, locale);
  },
}));
