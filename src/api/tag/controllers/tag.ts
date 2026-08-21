import { factories } from '@strapi/strapi';

import { applyTagLocale, resolveCatalogLocale } from '../../../utils/catalog-locale';

type AnyRecord = Record<string, any>;

const localizeCoreTagPayload = (payload: AnyRecord, locale: 'fr' | 'en') => {
  if (!payload) return payload;

  const localizeEntry = (entry: AnyRecord) => {
    const source = { ...(entry.attributes ?? entry), id: entry.id, documentId: entry.documentId };
    const localized = applyTagLocale(source, locale);
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

export default factories.createCoreController('api::tag.tag', () => ({
  async find(ctx) {
    const locale = resolveCatalogLocale(ctx.query as AnyRecord);
    await super.find(ctx);
    ctx.set('X-Content-Locale', locale);
    ctx.body = localizeCoreTagPayload(ctx.body as AnyRecord, locale);
  },

  async findOne(ctx) {
    const locale = resolveCatalogLocale(ctx.query as AnyRecord);
    await super.findOne(ctx);
    ctx.set('X-Content-Locale', locale);
    ctx.body = localizeCoreTagPayload(ctx.body as AnyRecord, locale);
  },
}));
