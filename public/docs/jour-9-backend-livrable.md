# Jour 9 - Livrable Backend SEO

## Objectif

Aligner le backend avec le SEO dynamique du frontend: meta dynamiques, OG image, canonical et routes propres produit/categorie.

## Champs SEO

`Product` expose maintenant:

- `slug`
- `metaTitle`
- `metaDescription`
- `ogImage`
- `canonicalUrl`
- `canonicalPath`

`Category` expose maintenant:

- `slug`
- `metaTitle`
- `metaDescription`
- `ogImage`
- `canonicalUrl`
- `canonicalPath`

`canonicalPath` est optionnel. Fallback attendu cote front:

- produit: `/product/:slug`
- categorie: `/shop/category/:categorySlug`

## Endpoints garantis

Produit:

- `GET /api/products/:slug`
- `GET /api/products/slug/:slug`
- `GET /api/catalog/products/:slug`

Categorie:

- `GET /api/categories/:slug`

Le payload categorie:

```json
{
  "category": {
    "id": "document-id",
    "slug": "tisanes",
    "name": "Tisanes",
    "image": null,
    "metaTitle": null,
    "metaDescription": null,
    "canonicalUrl": null,
    "canonicalPath": null,
    "ogImage": null
  }
}
```

## Sitemap et robots

Endpoints publics ajoutes:

- `GET /api/sitemap.xml`
- `GET /api/robots.txt`

Le sitemap inclut:

- `/`
- `/shop`
- les categories publiees via `canonicalPath` ou `/shop/category/:slug`
- les produits publies via `canonicalPath` ou `/product/:slug`

La base URL vient de:

1. `FRONTEND_URL`
2. `PUBLIC_URL`
3. fallback `http://localhost:5173`

## Permissions et index

Le bootstrap public active:

- `category.findBySlug`
- `seo.sitemap`
- `seo.robots`

Les index PostgreSQL couvrent aussi `canonical_path` en plus de `slug`.

## Notes d'integration frontend

- Le frontend peut continuer a utiliser `/product/:slug` et `/shop/category/:categorySlug`.
- Pour la generation SEO front, preferer `canonicalPath` si renseigne.
- `ogImage` renvoie un media Strapi normalise; si absent, fallback image produit/categorie cote front.
