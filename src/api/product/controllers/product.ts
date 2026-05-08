import { factories } from '@strapi/strapi';

const SAFE_PRODUCT_FIELDS = [
  'name',
  'slug',
  'ingredients',
  'price',
  'compareAtPrice',
  'rating',
  'reviews',
  'bgClass',
  'metaTitle',
  'metaDescription',
  'canonicalUrl',
  'canonicalPath',
] as const;

const SAFE_PRODUCT_POPULATE = {
  category: { fields: ['name', 'slug', 'metaTitle', 'metaDescription', 'canonicalUrl', 'canonicalPath'] },
  image: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
  gallery: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
  ogImage: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
  tags: { fields: ['name', 'slug'] },
  variants: {
    fields: [
      'name',
      'sku',
      'format',
      'label',
      'size',
      'colorName',
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

const publicCategory = (category?: AnyRecord | null) => {
  if (!category) return null;

  return {
    id: String(category.documentId ?? category.id),
    slug: category.slug,
    name: category.name,
    image: publicMedia(category.image),
    metaTitle: category.metaTitle ?? null,
    metaDescription: category.metaDescription ?? null,
    canonicalUrl: category.canonicalUrl ?? null,
    canonicalPath: category.canonicalPath ?? null,
    ogImage: publicMedia(category.ogImage),
  };
};

const publicTag = (tag: AnyRecord) => ({
  id: String(tag.documentId ?? tag.id),
  slug: tag.slug,
  name: tag.name,
});

const publicVariant = (variant: AnyRecord) => ({
  id: String(variant.documentId ?? variant.id),
  name: variant.name,
  sku: variant.sku,
  format: variant.format,
  label: variant.label ?? variant.name,
  size: variant.size ?? variant.format,
  colorName: variant.colorName ?? null,
  colorHex: variant.colorHex ?? null,
  weightValue: variant.weightValue === null || variant.weightValue === undefined ? null : Number(variant.weightValue),
  weightUnit: variant.weightUnit ?? null,
  price: variant.price ?? null,
  compareAtPrice: variant.compareAtPrice ?? null,
  stock: variant.stock ?? 0,
  stockQty: variant.stock ?? 0,
  inStock: (variant.stock ?? 0) > 0,
  lowStockThreshold: variant.lowStockThreshold ?? 0,
  isDefault: Boolean(variant.isDefault),
  isActive: variant.isActive !== false,
  position: variant.position ?? 0,
});

const sortVariants = (variants: AnyRecord[] = []) =>
  variants
    .filter((variant) => variant.isActive !== false)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.name).localeCompare(String(b.name)));

const publicProduct = (product: AnyRecord) => {
  const variants = sortVariants(product.variants);
  const stockQty = variants.reduce((total, variant) => total + (variant.stock ?? 0), 0);
  const id = String(product.documentId ?? product.id);

  return {
    id,
    slug: product.slug,
    name: product.name,
    ingredients: product.ingredients,
    price: product.price,
    currency: 'XOF',
    compareAtPrice: product.compareAtPrice ?? null,
    rating: Number(product.rating ?? 0),
    reviews: product.reviews ?? 0,
    bgClass: product.bgClass ?? null,
    image: publicMedia(product.image),
    gallery: publicGallery(product.gallery),
    category: publicCategory(product.category),
    tags: (product.tags ?? []).map(publicTag),
    variants: variants.map(publicVariant),
    inStock: stockQty > 0,
    stockQty,
    metaTitle: product.metaTitle ?? null,
    metaDescription: product.metaDescription ?? null,
    canonicalUrl: product.canonicalUrl ?? null,
    canonicalPath: product.canonicalPath ?? null,
    ogImage: publicMedia(product.ogImage),
    analytics: {
      item_id: id,
      item_name: product.name,
      item_category: product.category?.name ?? product.category?.slug ?? null,
      price: product.price,
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

const similarProductsFor = async (strapi: any, product: AnyRecord, limit = 4) => {
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

  return products.map(publicProduct);
};

export default factories.createCoreController('api::product.product', ({ strapi }) => ({
  async catalog(ctx) {
    const query = ctx.query as AnyRecord;
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

    ctx.body = {
      products: products.map(publicProduct),
      categories: categories.map(publicCategory),
      tags: tags.map(publicTag),
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

    ctx.body = {
      product: publicProduct(product),
      similarProducts: await similarProductsFor(strapi, product),
    };
  },

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
