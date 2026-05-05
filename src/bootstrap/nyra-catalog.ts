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

  enable('api::category', 'category', ['find', 'findOne']);
  enable('api::product', 'product', ['find', 'findOne']);

  await strapi.plugin('users-permissions').service('role').updateRole(publicRole.id, {
    name: roleData.name,
    description: roleData.description,
    permissions: roleData.permissions,
  });

  strapi.log.info('[nyra-catalog] Rôle Public : find / findOne pour category et product.');
}

export async function seedNyraCatalog(strapi: Core.Strapi) {
  try {
    await grantPublicCatalogPermissions(strapi);
    strapi.log.info('[nyra-catalog] Auto-permissions OK. Aucun seed de données fictives n’est injecté.');
  } catch (err) {
    strapi.log.error('[nyra-catalog] Échec configuration permissions.', err);
  }
}
