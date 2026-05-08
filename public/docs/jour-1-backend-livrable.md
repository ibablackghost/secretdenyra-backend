# Jour 1 - Livrable Backend

## Audit de l'existant

Backend Strapi detecte dans `nyra-cms`:

- Strapi `5.44.0` avec PostgreSQL obligatoire via `config/database.ts`.
- Collections existantes: `Product`, `Category`, `Tag`, `WishlistItem`, single type `Home`.
- `Product.slug`, `Category.slug` et `Tag.slug` sont deja uniques via le type `uid`.
- Permissions publiques catalogue deja appliquees au bootstrap pour `find/findOne` sur `product`, `category`, `tag`.
- Index PostgreSQL generiques presents au bootstrap, et etendus pour les colonnes catalogue frequentes.

## Schema cible valide Sprint 1

### Product

Champs confirmes:

- `name` requis.
- `slug` unique, stable, route publique frontend.
- `ingredients` requis, inclus dans l'API catalogue.
- `price` entier XOF, minimum `0`.
- `rating`, `reviews`.
- `bgClass` fallback UI.
- `image` requis.
- `category` requis.
- `tags`.
- SEO: `metaTitle`, `metaDescription`, `canonicalUrl`, `ogImage`.

Champs a ajouter en Jour 2:

- `variants` via collection `Variant`.
- Stock et SKU au niveau variante.

### Category

Champs confirmes:

- `name` requis.
- `slug` unique, stable.
- `image`.
- SEO: `metaTitle`, `metaDescription`, `canonicalUrl`, `ogImage`.
- Relation `products`.

### Tag

Champs confirmes:

- `name` requis.
- `slug` unique, stable.
- Relation `products`.

### WishlistItem

Base existante:

- `user` requis.
- `product` requis.

A durcir en Jour 4:

- policies `authenticated`.
- restriction user: lecture/ecriture uniquement sur ses favoris.
- unicite logique `user + product`.

## Contrat API catalogue

Endpoints publics ajoutes:

- `GET /api/catalog/products`
- `GET /api/catalog/products/:slug`

Parametres supportes sur la liste:

- `q`: recherche sur `name`, `ingredients`, `tags.name`, `tags.slug`.
- `category`: filtre par `Category.slug`.
- `teaTag`: filtre par `Tag.slug`.
- `sort`: `popular`, `price-low`, `price-high`, `rating`.
- `page`: page courante, defaut `1`.
- `pageSize`: taille page, defaut `12`, maximum `48`.

Payload liste:

```json
{
  "products": [],
  "categories": [],
  "tags": [],
  "pagination": { "page": 1, "pageSize": 12, "total": 0, "pageCount": 0 }
}
```

Payload detail:

```json
{
  "product": {}
}
```

## Conventions retenues

- Les routes frontend restent basees sur `slug`.
- L'API expose aussi un `id` technique Strapi (`documentId` si disponible, sinon `id`).
- Les slugs sont stables apres publication; tout changement doit etre considere comme une redirection SEO.
- Les prix sont stockes en XOF sous forme d'entier.
- Les champs publics sont normalises pour ne pas exposer les champs internes Strapi.
- Le catalogue public ne renvoie que les contenus publies.

## Plan de migration

1. Lancer Strapi en developpement pour laisser Strapi appliquer les nouveaux champs schema.
2. Renseigner les images categories si elles existent deja cote frontend.
3. Completer les champs SEO progressivement, sans bloquer la mise en ligne catalogue.
4. Verifier les slugs existants et corriger les doublons avant import massif.
5. Connecter le frontend a `GET /api/catalog/products` pour remplacer la pagination fake.
6. En Jour 2, ajouter `Variant` avec `sku` unique, format/poids, prix optionnel et stock.
7. En Jour 4, durcir `WishlistItem` avec policies utilisateur.

## Questions fermees Jour 1

- `slug` est confirme unique pour `Product`, `Category` et `Tag`.
- Recherche `q` retenue: `name + ingredients + tags`.
- SEO produit/categorie expose des maintenant.

## Questions restantes

- Schema exact `Variant`: format texte simple ou couple `weightValue/weightUnit`.
- Stock au produit ou strictement a la variante; recommandation: stock strictement a la variante.
- Besoin de redirects SEO si un slug publie est modifie.
