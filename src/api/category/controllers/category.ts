import { factories } from '@strapi/strapi';

import { applyCategoryLocale, resolveCatalogLocale } from '../../../utils/catalog-locale';

type AnyRecord = Record<string, any>;

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

const publicCategory = (category: AnyRecord, locale: 'fr' | 'en' = 'fr') => {
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

const localizeCoreCategoryPayload = (payload: AnyRecord, locale: 'fr' | 'en') => {
  if (!payload) return payload;

  const localizeEntry = (entry: AnyRecord) => {
    const source = { ...(entry.attributes ?? entry), id: entry.id, documentId: entry.documentId };
    const localized = applyCategoryLocale(source, locale);
    if (entry.attributes) {
      return { ...entry, attributes: { ...entry.attributes, ...localized }, locale };
    }
    return { ...entry, ...localized, locale };
  };

  if (Array.isArray(payload.data)) {
    return { ...payload, data: payload.data.map(localizeEntry) };
  }
  if (payload.data) {
    return { ...payload, data: localizeEntry(payload.data) };
  }
  return payload;
};

export default factories.createCoreController('api::category.category', ({ strapi }) => ({
  async findBySlug(ctx) {
    const slug = String(ctx.params.slug ?? ctx.params.id ?? '').trim();
    const locale = resolveCatalogLocale(ctx.query as AnyRecord);
    if (!slug) return ctx.badRequest('Le slug catégorie est requis.');

    const category = await strapi.db.query('api::category.category').findOne({
      where: { ...publishedOnly, slug },
      populate: {
        image: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
        ogImage: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
      },
    });

    if (!category) return ctx.notFound('Catégorie introuvable.');
    ctx.set('X-Content-Locale', locale);
    ctx.body = { category: publicCategory(category, locale), locale };
  },

  async find(ctx) {
    const locale = resolveCatalogLocale(ctx.query as AnyRecord);
    const result = await super.find(ctx);
    const localized = localizeCoreCategoryPayload((ctx.body ?? result) as AnyRecord, locale);
    ctx.set('X-Content-Locale', locale);
    ctx.body = localized;
    return localized;
  },

  async findOne(ctx) {
    const locale = resolveCatalogLocale(ctx.query as AnyRecord);
    const result = await super.findOne(ctx);
    const localized = localizeCoreCategoryPayload((ctx.body ?? result) as AnyRecord, locale);
    ctx.set('X-Content-Locale', locale);
    ctx.body = localized;
    return localized;
  },
}));
