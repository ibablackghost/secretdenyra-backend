# Jour 3 - Alignement Backend (catalogue URL-driven + pagination)

Ce document decrit ce que le frontend attend desormais pour que la page catalogue soit 100% alignee backend.

## 1) Query params utilises par le frontend

Le frontend pilote le catalogue via URL:

- `q` : recherche texte
- `category` : slug categorie
- `teaTag` : slug tag/famille
- `sort` : `popular | price-low | price-high | rating`
- `priceMax` : nombre (XOF)
- `page` : numero de page (base 1)
- `pageSize` : taille de page

Exemple:

`/shop?q=detox&category=tisanes&teaTag=infusion&sort=price-low&priceMax=20000&page=2&pageSize=12`

## 2) Contrat backend recommande (liste produits)

Endpoint cible:

`GET /api/products/catalog`

Payload reponse:

```json
{
  "products": [],
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
    "priceMax": 50000
  }
}
```

## 3) Champs produits attendus (minimum)

- `id`
- `slug`
- `name`
- `ingredients`
- `price`
- `compareAtPrice` (optionnel, pour badge promo + prix barre)
- `rating`
- `reviews`
- `image`
- `category { slug, name }`
- `tags[] { slug, name }`
- `inStock` (optionnel, bool)
- `stockQty` (optionnel, number)

## 4) Regles de tri a garantir cote backend

- `popular`: ordre metier (ex ventes/score interne)
- `price-low`: prix ascendant
- `price-high`: prix descendant
- `rating`: note descendante

## 5) Regles de filtre a garantir cote backend

- `q`: recherche sur `name`, `ingredients`, `tags.name` (minimum)
- `category`: match par `category.slug`
- `teaTag`: match par `tags.slug`
- `priceMax`: `price <= priceMax`

## 6) Pourquoi c'est critique

- Le frontend rend maintenant des URLs partageables et restaurables.
- Pour eviter ecarts front/back, le backend doit renvoyer la meme logique de filtre/tri/pagination.
- La pagination UI est deja compatible backend (`page`, `pageSize`, `total`, `pageCount`).

## 7) Actions backend Jour 3

1. Exposer un endpoint catalogue pagine selon les query params ci-dessus.
2. Retourner `pagination.total` et `pagination.pageCount`.
3. Verifier que les slugs `category` et `tags` sont indexes.
4. Ajouter `compareAtPrice`, `inStock`, `stockQty` dans le modele Product si manquants.
5. Documenter le contrat API final pour verrouiller le Sprint 1.
