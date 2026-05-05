import type { Core } from '@strapi/strapi';

/** Catégories + produits catalogue Nyra ; pas de médias (à uploader dans la Media Library). */
const CATEGORIES: ReadonlyArray<{ name: string; slug: string; sortOrder: number }> = [
  { name: 'Thé noir', slug: 'the-noir', sortOrder: 1 },
  { name: 'Thé blanc', slug: 'the-blanc', sortOrder: 2 },
  { name: 'Infusion', slug: 'infusion', sortOrder: 3 },
  { name: 'Thé vert', slug: 'the-vert', sortOrder: 4 },
  { name: 'Bien-être', slug: 'bien-etre', sortOrder: 5 },
  { name: 'Tisanes', slug: 'tisanes', sortOrder: 6 },
];

const PRODUCTS: ReadonlyArray<{
  name: string;
  slug: string;
  ingredients: string;
  price: number;
  rating: number;
  reviews: number;
  bgClass: string;
  categorySlug: string;
}> = [
  {
    name: 'DIGESTION® (TISANE)',
    slug: 'digestion',
    ingredients: 'Menthe poivrée • Anis • Fenouil • Réglisse',
    price: 24999,
    rating: 4.9,
    reviews: 43,
    bgClass: 'bg-[#F2EDF3]',
    categorySlug: 'infusion',
  },
  {
    name: 'DÉTOX® (TISANE)',
    slug: 'detox',
    ingredients: 'Citron • Gingembre • Pissenlit',
    price: 22000,
    rating: 4.8,
    reviews: 120,
    bgClass: 'bg-[#FDFCE0]',
    categorySlug: 'infusion',
  },
  {
    name: 'SOMMEIL PROFOND®',
    slug: 'sommeil',
    ingredients: 'Camomille • Valériane • Passiflore',
    price: 26500,
    rating: 5.0,
    reviews: 89,
    bgClass: 'bg-[#F8E7E9]',
    categorySlug: 'tisanes',
  },
  {
    name: 'ÉNERGIE MATINALE®',
    slug: 'energie',
    ingredients: 'Thé vert • Ginseng • Guarana',
    price: 24999,
    rating: 4.7,
    reviews: 210,
    bgClass: 'bg-[#EAF3EA]',
    categorySlug: 'the-vert',
  },
];

async function grantPublicCatalogPermissions(strapi: Core.Strapi) {
  const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: 'public' },
  });
  if (!publicRole) {
    strapi.log.warn('[nyra-catalog] Rôle Public introuvable — permissions inchangées.');
    return;
  }

  const roleData = await strapi.plugin('users-permissions').service('role').findOne(publicRole.id);
  const perms = roleData.permissions as Record<string, { controllers?: Record<string, Record<string, { enabled: boolean }>> }>;

  const enable = (apiKey: string, controller: string, actions: string[]) => {
    const ctrl = perms[apiKey]?.controllers?.[controller];
    if (!ctrl) return;
    for (const action of actions) {
      if (ctrl[action]) ctrl[action].enabled = true;
    }
  };

  enable('api::category', 'category', ['find', 'findOne']);
  enable('api::product', 'product', ['find', 'findOne']);

  await strapi.plugin('users-permissions').service('role').updateRole(publicRole.id, {
    name: roleData.name,
    description: roleData.description,
    permissions: roleData.permissions,
  });

  strapi.log.info('[nyra-catalog] Rôle Public : find / findOne pour category et product.');
}

async function ensureCategory(strapi: Core.Strapi, def: (typeof CATEGORIES)[number]): Promise<string> {
  const existing = await strapi.documents('api::category.category').findFirst({
    filters: { slug: { $eq: def.slug } },
  });
  if (existing?.documentId) return existing.documentId;

  const created = await strapi.documents('api::category.category').create({
    data: {
      name: def.name,
      slug: def.slug,
      sortOrder: def.sortOrder,
    },
    status: 'published',
  });

  return created.documentId;
}

async function ensureProduct(
  strapi: Core.Strapi,
  def: (typeof PRODUCTS)[number],
  categoryIdsBySlug: Record<string, string>
): Promise<void> {
  const existing = await strapi.documents('api::product.product').findFirst({
    filters: { slug: { $eq: def.slug } },
  });
  if (existing) return;

  const categoryDocId = categoryIdsBySlug[def.categorySlug];
  if (!categoryDocId) {
    strapi.log.error(`[nyra-catalog] Catégorie manquante pour slug "${def.categorySlug}" — produit "${def.slug}" ignoré.`);
    return;
  }

  await strapi.documents('api::product.product').create({
    data: {
      name: def.name,
      slug: def.slug,
      ingredients: def.ingredients,
      price: def.price,
      rating: def.rating,
      reviews: def.reviews,
      bgClass: def.bgClass,
      category: categoryDocId,
    },
    status: 'published',
  });
}

export async function seedNyraCatalog(strapi: Core.Strapi) {
  if (process.env.NYRA_SKIP_SEED === 'true') {
    strapi.log.info('[nyra-catalog] NYRA_SKIP_SEED=true — aucun seed.');
    return;
  }

  try {
    await grantPublicCatalogPermissions(strapi);

    const categoryIdsBySlug: Record<string, string> = {};
    for (const c of CATEGORIES) {
      categoryIdsBySlug[c.slug] = await ensureCategory(strapi, c);
    }

    for (const p of PRODUCTS) {
      await ensureProduct(strapi, p, categoryIdsBySlug);
    }

    strapi.log.info('[nyra-catalog] Catalogue Nyra prêt (entrées publiées ; images à ajouter dans la Media Library).');
  } catch (err) {
    strapi.log.error('[nyra-catalog] Échec du seed — vérifie les logs.', err);
  }
}
