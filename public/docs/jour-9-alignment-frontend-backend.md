# Jour 9 - Alignement backend SEO

Le frontend applique maintenant:
- meta title/description dynamiques,
- OG tags dynamiques,
- canonical dynamique,
- URL propre categorie: `/shop/category/:categorySlug`,
- URL produit propre: `/product/:slug`.

## 1) Donnees backend SEO requises

Pour `Product` et `Category`, exposer:
- `slug` (unique, stable),
- `metaTitle` (optionnel),
- `metaDescription` (optionnel),
- `ogImage` (optionnel),
- `canonicalPath` (optionnel, sinon front fallback standard).

## 2) Endpoints/contenu a garantir

- `GET /api/products/:slug` doit renvoyer champs SEO si disponibles.
- `GET /api/categories/:slug` idem.
- Slugs uniques en base avec index.

## 3) Sitemap/robots (preparation)

Le frontend a un module utilitaire:
- `src/app/utils/seoRoutes.ts`
  - `buildSitemapXml(...)`
  - `buildRobotsTxt(...)`

Backend peut s'aligner en exposant:
- `GET /sitemap.xml`
- `GET /robots.txt`

## 4) Recommandation backend immediate

1. Ajouter champs SEO dans Strapi (Product/Category).
2. Renseigner `metaTitle/metaDescription` en priorite sur categories et tops produits.
3. Exposer `ogImage` media pour partage social.
