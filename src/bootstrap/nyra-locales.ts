import type { Core } from '@strapi/strapi';

/**
 * Ensure i18n locales: fr (default) + en.
 * Must run early so catalogue content is tagged as FR, not EN (Strapi default).
 */
export async function ensureNyraLocales(strapi: Core.Strapi) {
  const localesService = strapi.plugin('i18n').service('locales');

  let fr = await localesService.findByCode('fr');
  if (!fr) {
    fr = await localesService.create({
      code: 'fr',
      name: 'French (fr)',
    });
    strapi.log.info('[nyra-i18n] Locale fr créée.');
  }

  let en = await localesService.findByCode('en');
  if (!en) {
    en = await localesService.create({
      code: 'en',
      name: 'English (en)',
    });
    strapi.log.info('[nyra-i18n] Locale en créée.');
  }

  const currentDefault = await localesService.getDefaultLocale();
  if (currentDefault !== 'fr') {
    await localesService.setDefaultLocale({ code: 'fr' });
    strapi.log.info(`[nyra-i18n] Locale par défaut: ${currentDefault ?? '(none)'} → fr`);
  } else {
    strapi.log.info('[nyra-i18n] Locales OK (default=fr, available=fr|en).');
  }
}
