import type { Core } from '@strapi/strapi';

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

  enable('api::analytics', 'analytics', ['config', 'events']);
  enable('api::category', 'category', ['find', 'findOne', 'findBySlug']);
  enable('api::health', 'health', ['check']);
  enable('api::product', 'product', ['find', 'findOne']);
  enable('api::seo', 'seo', ['sitemap', 'robots']);
  enable('api::tag', 'tag', ['find', 'findOne']);
  enable('api::variant', 'variant', ['find', 'findOne']);

  await strapi.plugin('users-permissions').service('role').updateRole(publicRole.id, {
    name: roleData.name,
    description: roleData.description,
    permissions: roleData.permissions,
  });

  strapi.log.info('[nyra-catalog] Role Public: find/findOne sur product, category, tag et variant.');
}

async function grantAuthenticatedCommercePermissions(strapi: Core.Strapi) {
  const authenticatedRole = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: 'authenticated' },
  });
  if (!authenticatedRole) {
    strapi.log.warn('[nyra-catalog] Rôle Authenticated introuvable — permissions commerce inchangées.');
    return;
  }

  const roleData = await strapi.plugin('users-permissions').service('role').findOne(authenticatedRole.id);
  const perms = roleData.permissions as Record<string, { controllers?: Record<string, Record<string, { enabled: boolean }>> }>;

  const enable = (apiKey: string, controller: string, actions: string[]) => {
    const ctrl = perms[apiKey]?.controllers?.[controller];
    if (!ctrl) return;
    for (const action of actions) {
      if (ctrl[action]) ctrl[action].enabled = true;
    }
  };

  enable('api::cart', 'cart', ['find', 'addItem', 'updateItem', 'deleteItem']);
  enable('api::checkout', 'checkout', ['init', 'updateDraft', 'findDraft', 'createPaymentIntent', 'confirm']);
  enable('api::analytics', 'analytics', ['funnel']);
  enable('api::me', 'me', [
    'profile',
    'updateProfile',
    'proAccountRequest',
    'submitProAccountRequest',
    'listAddresses',
    'createAddress',
    'updateAddress',
    'deleteAddress',
    'setDefaultAddress',
    'orders',
    'order',
    'purchasedProducts',
    'wishlist',
    'addWishlistItem',
    'deleteWishlistItem',
    'viewedProducts',
    'addViewedProduct',
  ]);
  enable('api::wishlist-item', 'wishlist-item', ['list', 'addItem', 'deleteByProduct']);
  enable('api::order', 'order', ['find', 'findOne']);

  await strapi.plugin('users-permissions').service('role').updateRole(authenticatedRole.id, {
    name: roleData.name,
    description: roleData.description,
    permissions: roleData.permissions,
  });

  strapi.log.info('[nyra-catalog] Role Authenticated: permissions compte, panier, wishlist, checkout et commandes.');
}

export async function seedNyraCatalog(strapi: Core.Strapi) {
  try {
    await grantPublicCatalogPermissions(strapi);
    await grantAuthenticatedCommercePermissions(strapi);
    strapi.log.info('[nyra-catalog] Permissions publiques appliquées. Aucun seed automatique (catégories/tags/produits/variantes).');
  } catch (err) {
    strapi.log.error('[nyra-catalog] Échec de la configuration des permissions catalogue.', err);
  }
}
