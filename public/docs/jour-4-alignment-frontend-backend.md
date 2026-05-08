# Jour 4 - Alignement backend pour fiche produit UX complete

Le frontend supporte maintenant galerie, variantes, stock et produits similaires.  
Pour un comportement 100% data-driven, backend doit exposer les champs ci-dessous.

## Champs Produit attendus

- `id`, `slug`, `name`, `ingredients`
- `price`, `compareAtPrice` (optionnel)
- `rating`, `reviews`
- `inStock`, `stockQty`
- `image` (media principal)
- `gallery[]` (liste media additionnels)
- `category { slug, name }`
- `tags[] { slug, name }`
- `variants[]`:
  - `id`
  - `label`
  - `size`
  - `colorName`
  - `colorHex`
  - `price`
  - `compareAtPrice`
  - `inStock`
  - `stockQty`

## Endpoint detail produit

`GET /api/products/:slug` (ou equivalent)

Doit permettre au front de:
- afficher galerie interactive
- filtrer variantes par taille + couleur
- recalculer prix/stock selon variante
- afficher badges promo/rupture

## Endpoint produits similaires

Option 1: endpoint dedie
- `GET /api/products/:slug/similar?limit=4`

Option 2: renvoyer recommandations dans le detail produit
- `similarProducts[]`

Criteres suggeres:
- meme categorie
- tags proches
- exclure produit courant

## Contrat de resilience media

- si media absent, renvoyer `null` (pas chaine vide)
- URLs media absolues preferees
- garantir ordre stable de `gallery[]`
