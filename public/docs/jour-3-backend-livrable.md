# Jour 3 - Livrable Backend

## Objectif

Verrouiller l'API catalogue consommee par le frontend: filtres URL-driven, tri, pagination reelle, detail par slug et produits similaires.

## Endpoints publics

Endpoint principal attendu par le frontend Jour 3:

- `GET /api/products/catalog`

Routes compatibles conservees:

- `GET /api/catalog/products`
- `GET /api/catalog/products/:slug`
- `GET /api/products/slug/:slug`

## Liste catalogue

### Query params

- `q`: recherche texte sur `name`, `ingredients`, `tags.name`, `tags.slug`.
- `category`: filtre par `Category.slug`.
- `teaTag`: filtre par `Tag.slug`.
- `sort`: `popular`, `price-low`, `price-high`, `rating`.
- `priceMax`: prix maximum XOF, applique sur `Product.price`.
- `page`: page base 1, defaut `1`.
- `pageSize`: taille page, defaut `12`, maximum `48`.

### Exemple

`GET /api/products/catalog?q=detox&category=tisanes&teaTag=infusion&sort=price-low&priceMax=20000&page=2&pageSize=12`

### Payload

```json
{
  "products": [],
  "categories": [],
  "tags": [],
  "pagination": {
    "page": 1,
    "pageSize": 12,
    "total": 0,
    "pageCount": 0
  },
  "filtersApplied": {
    "q": "",
    "category": "",
    "teaTag": "",
    "sort": "popular",
    "priceMax": null
  }
}
```

## Produit public

Chaque produit expose:

- `id`, `slug`, `name`, `ingredients`.
- `price`, `compareAtPrice`.
- `rating`, `reviews`.
- `bgClass`, `image`.
- `category { id, slug, name, image }`.
- `tags[] { id, slug, name }`.
- `variants[]`.
- `inStock`, `stockQty`.
- SEO: `metaTitle`, `metaDescription`, `canonicalUrl`, `ogImage`.

`inStock` et `stockQty` sont calcules depuis les variantes actives.

## Detail produit

Routes detail:

- `GET /api/catalog/products/:slug`
- `GET /api/products/slug/:slug`

Payload:

```json
{
  "product": {},
  "similarProducts": []
}
```

Les produits similaires sont selectionnes parmi les produits publies de meme categorie ou partageant au moins un tag, hors produit courant, tries par popularite.

## Regles de tri

- `popular`: `reviews desc`, puis `rating desc`, puis `name asc`.
- `price-low`: `price asc`, puis `name asc`.
- `price-high`: `price desc`, puis `name asc`.
- `rating`: `rating desc`, puis `reviews desc`, puis `name asc`.

## Modele mis a jour

`Product` ajoute:

- `compareAtPrice`: entier XOF optionnel, minimum `0`.

## Index

Les index PostgreSQL automatiques couvrent les colonnes catalogue utiles:

- slugs categorie/tag/produit via les colonnes `slug`.
- `price` pour `priceMax` et tri prix.
- `compare_at_price` pour badges promo futurs.
- `rating`, `reviews` pour tri metier.
- `sku`, `stock`, `position` pour variantes.

## Notes frontend

- Utiliser `GET /api/products/catalog` comme route cible.
- Le backend renvoie aussi `categories` et `tags` pour alimenter les filtres.
- `filtersApplied` permet au frontend de synchroniser l'URL et l'etat reel apres normalisation.
- Pour l'affichage prix variante: si `variant.price` est `null`, utiliser `product.price`.
