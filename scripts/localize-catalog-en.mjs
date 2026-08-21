/**
 * Crée les localisations EN du catalogue (categories, tags, products, variants).
 *
 * Prérequis : Strapi démarrable (schemas i18n + locales fr/en).
 *
 * Usage :
 *   node scripts/localize-catalog-en.mjs --dry-run
 *   node scripts/localize-catalog-en.mjs
 *   node scripts/localize-catalog-en.mjs --only=categories,tags
 *   node scripts/localize-catalog-en.mjs --only=products --limit=20
 *
 * Stratégie EN :
 * - catégories / tags : dictionnaire FR→EN
 * - produits / variantes : glossaire lexical (best-effort) — revue humaine recommandée
 */
import { createStrapi } from '@strapi/strapi';

const dryRun = process.argv.includes('--dry-run');
const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const limitArg = process.argv.find((a) => a.startsWith('--limit='))?.slice(8);
const ONLY = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim())) : null;
const LIMIT = limitArg ? Number.parseInt(limitArg, 10) : null;

const CATEGORY_EN = {
  tisanes: {
    name: 'Herbal teas',
    metaTitle: 'Organic herbal teas | Nyra',
    metaDescription: 'Discover Nyra organic herbal teas, available in several formats.',
  },
  'thes-bio': {
    name: 'Organic teas',
    metaTitle: 'Organic teas | Nyra',
    metaDescription: 'Discover Nyra organic teas, loose leaf and more.',
  },
  thes: {
    name: 'Organic teas',
    metaTitle: 'Organic teas | Nyra',
    metaDescription: 'Discover Nyra organic teas, loose leaf and more.',
  },
  cafes: {
    name: 'Coffees',
    metaTitle: 'Organic coffees | Nyra',
    metaDescription: 'Discover Nyra organic coffees.',
  },
  herboristerie: {
    name: 'Herbal shop',
    metaTitle: 'Herbal shop | Nyra',
    metaDescription: 'Herbs and botanicals from the Nyra herbal shop.',
  },
  accessoires: {
    name: 'Accessories',
    metaTitle: 'Tea accessories | Nyra',
    metaDescription: 'Teapots, filters and tea accessories.',
  },
  mode: {
    name: 'Fashion',
    metaTitle: 'Fashion | Nyra',
    metaDescription: 'Nyra fashion collection.',
  },
};

const TAG_EN = {
  tisane: 'herbal tea',
  bio: 'organic',
  vrac: 'loose leaf',
  digestion: 'digestion',
  detente: 'relax',
  'détente': 'relax',
  sommeil: 'sleep',
  energie: 'energy',
  'énergie': 'energy',
  the: 'tea',
  'thé': 'tea',
  cafe: 'coffee',
  'café': 'coffee',
  accessoire: 'accessory',
  mode: 'fashion',
  fulani: 'fulani',
};

const PHRASE_REPLACEMENTS = [
  [/en vrac/gi, 'loose leaf'],
  [/tisane/gi, 'herbal tea'],
  [/thés?\s+bio/gi, 'organic tea'],
  [/thé\s+noir/gi, 'black tea'],
  [/thé\s+vert/gi, 'green tea'],
  [/thé\s+blanc/gi, 'white tea'],
  [/infusion/gi, 'brew'],
  [/sachet/gi, 'bag'],
  [/ingrédients?/gi, 'ingredients'],
  [/conditionnement/gi, 'packaging'],
  [/nom botanique/gi, 'botanical name'],
  [/origine/gi, 'origin'],
  [/température/gi, 'temperature'],
  [/temps d['']infusion/gi, 'steeping time'],
  [/dosage/gi, 'dosage'],
  [/herboristerie/gi, 'herbal shop'],
  [/bio\b/gi, 'organic'],
  [/nature\b/gi, 'plain'],
  [/décaféiné/gi, 'decaf'],
  [/ensemble\b/gi, 'set'],
];

const translateText = (value) => {
  if (value == null || value === '') return value;
  let out = String(value);
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
};

const translateTagName = (name) => {
  const key = String(name ?? '')
    .trim()
    .toLowerCase();
  if (TAG_EN[key]) return TAG_EN[key];
  return translateText(name);
};

const shouldRun = (section) => !ONLY || ONLY.has(section);

const hasLocale = async (uid, documentId, locale) => {
  const entry = await strapi.documents(uid).findOne({
    documentId,
    locale,
    status: 'draft',
  });
  return Boolean(entry);
};

const strapi = await createStrapi().load();

try {
  const localesService = strapi.plugin('i18n').service('locales');
  if (!(await localesService.findByCode('fr'))) {
    await localesService.create({ code: 'fr', name: 'French (fr)' });
  }
  if (!(await localesService.findByCode('en'))) {
    await localesService.create({ code: 'en', name: 'English (en)' });
  }
  if ((await localesService.getDefaultLocale()) !== 'fr') {
    await localesService.setDefaultLocale({ code: 'fr' });
  }

  let created = { categories: 0, tags: 0, products: 0, variants: 0 };
  let skipped = { categories: 0, tags: 0, products: 0, variants: 0 };

  if (shouldRun('categories')) {
    const categories = await strapi.documents('api::category.category').findMany({
      locale: 'fr',
      status: 'published',
      limit: 100,
    });

    for (const category of categories) {
      if (await hasLocale('api::category.category', category.documentId, 'en')) {
        skipped.categories += 1;
        continue;
      }

      const mapped = CATEGORY_EN[category.slug] ?? {
        name: translateText(category.name),
        metaTitle: translateText(category.metaTitle) || undefined,
        metaDescription: translateText(category.metaDescription) || undefined,
      };

      console.log(`${dryRun ? '[DRY] ' : ''}category EN ← ${category.slug}: ${mapped.name}`);
      if (!dryRun) {
        await strapi.documents('api::category.category').update({
          documentId: category.documentId,
          locale: 'en',
          status: 'published',
          data: {
            name: mapped.name,
            metaTitle: mapped.metaTitle ?? null,
            metaDescription: mapped.metaDescription ?? null,
          },
        });
      }
      created.categories += 1;
    }
  }

  if (shouldRun('tags')) {
    const tags = await strapi.documents('api::tag.tag').findMany({
      locale: 'fr',
      status: 'published',
      limit: 500,
    });

    for (const tag of tags) {
      if (await hasLocale('api::tag.tag', tag.documentId, 'en')) {
        skipped.tags += 1;
        continue;
      }

      const nameEn = translateTagName(tag.name);
      console.log(`${dryRun ? '[DRY] ' : ''}tag EN ← ${tag.slug}: ${nameEn}`);
      if (!dryRun) {
        await strapi.documents('api::tag.tag').update({
          documentId: tag.documentId,
          locale: 'en',
          status: 'published',
          data: { name: nameEn },
        });
      }
      created.tags += 1;
    }
  }

  if (shouldRun('products')) {
    const products = await strapi.documents('api::product.product').findMany({
      locale: 'fr',
      status: 'published',
      limit: LIMIT && Number.isFinite(LIMIT) ? LIMIT : 500,
      populate: {
        category: true,
        tags: true,
        variants: true,
      },
    });

    for (const product of products) {
      if (await hasLocale('api::product.product', product.documentId, 'en')) {
        skipped.products += 1;
        continue;
      }

      const categoryDocId = product.category?.documentId ?? product.category?.id ?? null;
      const tagDocIds = (product.tags ?? [])
        .map((tag) => tag.documentId ?? tag.id)
        .filter(Boolean);

      const data = {
        name: translateText(product.name),
        ingredients: translateText(product.ingredients) || product.ingredients,
        shortDescription: translateText(product.shortDescription) || null,
        description: translateText(product.description) || null,
        dosage: translateText(product.dosage) || null,
        infusionTime: translateText(product.infusionTime) || null,
        temperature: translateText(product.temperature) || null,
        origin: translateText(product.origin) || null,
        metaTitle: translateText(product.metaTitle) || null,
        metaDescription: translateText(product.metaDescription) || null,
        ...(categoryDocId ? { category: categoryDocId } : {}),
        ...(tagDocIds.length ? { tags: tagDocIds } : {}),
      };

      console.log(`${dryRun ? '[DRY] ' : ''}product EN ← ${product.slug}: ${data.name}`);
      if (!dryRun) {
        await strapi.documents('api::product.product').update({
          documentId: product.documentId,
          locale: 'en',
          status: 'published',
          data,
        });
      }
      created.products += 1;

      if (shouldRun('variants') || !ONLY) {
        for (const variant of product.variants ?? []) {
          const variantDocumentId = variant.documentId ?? variant.id;
          if (!variantDocumentId) continue;
          if (await hasLocale('api::variant.variant', variantDocumentId, 'en')) {
            skipped.variants += 1;
            continue;
          }

          const variantData = {
            name: translateText(variant.name),
            format: translateText(variant.format) || variant.format,
            label: translateText(variant.label) || null,
            size: translateText(variant.size) || null,
            colorName: translateText(variant.colorName) || null,
            product: product.documentId,
          };

          console.log(`${dryRun ? '[DRY] ' : ''}variant EN ← ${variant.sku}`);
          if (!dryRun) {
            await strapi.documents('api::variant.variant').update({
              documentId: variantDocumentId,
              locale: 'en',
              status: 'published',
              data: variantData,
            });
          }
          created.variants += 1;
        }
      }
    }
  }

  console.log('\nRésumé', { dryRun, created, skipped });
  console.log(
    'Note: les textes produit EN sont glossaire best-effort — revue humaine avant prod complète.',
  );
} finally {
  await strapi.destroy();
}
