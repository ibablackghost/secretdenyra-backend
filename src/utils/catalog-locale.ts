type AnyRecord = Record<string, any>;

export type CatalogLocale = 'fr' | 'en';

const firstParam = (value: unknown) => (Array.isArray(value) ? value[0] : value);

/** Lit `locale` query (fr|en). Défaut: fr. Fallback FR si champ EN vide. */
export const resolveCatalogLocale = (query?: AnyRecord | null): CatalogLocale => {
  const raw = String(firstParam(query?.locale) ?? 'fr')
    .trim()
    .toLowerCase();
  return raw === 'en' || raw.startsWith('en-') ? 'en' : 'fr';
};

const filled = (value: unknown) => {
  if (value == null) return false;
  return String(value).trim().length > 0;
};

/** Si locale=en et champ *En rempli → utilise EN, sinon FR. */
export const localizedValue = <T,>(fr: T, en: T | null | undefined, locale: CatalogLocale): T => {
  if (locale === 'en' && filled(en)) return en as T;
  return fr;
};

export const applyProductLocale = (product: AnyRecord, locale: CatalogLocale): AnyRecord => {
  if (locale !== 'en' || !product) return product;

  return {
    ...product,
    name: localizedValue(product.name, product.nameEn, locale),
    ingredients: localizedValue(product.ingredients, product.ingredientsEn, locale),
    shortDescription: localizedValue(product.shortDescription, product.shortDescriptionEn, locale),
    description: localizedValue(product.description, product.descriptionEn, locale),
    dosage: localizedValue(product.dosage, product.dosageEn, locale),
    infusionTime: localizedValue(product.infusionTime, product.infusionTimeEn, locale),
    temperature: localizedValue(product.temperature, product.temperatureEn, locale),
    origin: localizedValue(product.origin, product.originEn, locale),
    metaTitle: localizedValue(product.metaTitle, product.metaTitleEn, locale),
    metaDescription: localizedValue(product.metaDescription, product.metaDescriptionEn, locale),
    category: product.category ? applyCategoryLocale(product.category, locale) : product.category,
    tags: Array.isArray(product.tags) ? product.tags.map((tag: AnyRecord) => applyTagLocale(tag, locale)) : product.tags,
    variants: Array.isArray(product.variants)
      ? product.variants.map((variant: AnyRecord) => applyVariantLocale(variant, locale))
      : product.variants,
  };
};

export const applyCategoryLocale = (category: AnyRecord, locale: CatalogLocale): AnyRecord => {
  if (locale !== 'en' || !category) return category;

  return {
    ...category,
    name: localizedValue(category.name, category.nameEn, locale),
    metaTitle: localizedValue(category.metaTitle, category.metaTitleEn, locale),
    metaDescription: localizedValue(category.metaDescription, category.metaDescriptionEn, locale),
  };
};

export const applyTagLocale = (tag: AnyRecord, locale: CatalogLocale): AnyRecord => {
  if (locale !== 'en' || !tag) return tag;

  return {
    ...tag,
    name: localizedValue(tag.name, tag.nameEn, locale),
  };
};

export const applyVariantLocale = (variant: AnyRecord, locale: CatalogLocale): AnyRecord => {
  if (locale !== 'en' || !variant) return variant;

  return {
    ...variant,
    name: localizedValue(variant.name, variant.nameEn, locale),
    format: localizedValue(variant.format, variant.formatEn, locale),
    label: localizedValue(variant.label, variant.labelEn, locale),
    size: localizedValue(variant.size, variant.sizeEn, locale),
    colorName: localizedValue(variant.colorName, variant.colorNameEn, locale),
  };
};
