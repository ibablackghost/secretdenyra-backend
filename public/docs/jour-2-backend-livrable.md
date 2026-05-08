# Jour 2 - Livrable Backend

## Objectif

Aligner le modele catalogue backend sur l'architecture frontend Jour 2 et preparer la connexion reelle des formats produit.

## Modeles finalises

### Product

Le modele `Product` conserve les champs publics poses au Jour 1:

- `name`, `slug`, `ingredients`, `price`, `rating`, `reviews`.
- `bgClass`, `image`, `category`, `tags`.
- SEO: `metaTitle`, `metaDescription`, `canonicalUrl`, `ogImage`.

Ajout Jour 2:

- relation `variants` en `oneToMany` vers `Variant`.

### Category

Le modele `Category` est confirme:

- `name`, `slug` unique.
- `image`.
- SEO: `metaTitle`, `metaDescription`, `canonicalUrl`, `ogImage`.
- relation `products`.

### Tag

Le modele `Tag` est confirme:

- `name`, `slug` unique.
- relation `products`.

### Variant

Nouvelle collection `Variant`:

- `name`: libelle admin/public.
- `sku`: identifiant stock unique obligatoire.
- `format`: libelle court affiche cote UI.
- `weightValue`: poids/volume numerique optionnel.
- `weightUnit`: `g`, `kg`, `ml`, `l`, `piece`.
- `price`: prix entier XOF optionnel; si vide, utiliser `Product.price`.
- `stock`: entier obligatoire, minimum `0`.
- `lowStockThreshold`: seuil d'alerte stock bas.
- `isDefault`: variante selectionnee par defaut cote front.
- `isActive`: permet de masquer une variante sans suppression.
- `position`: ordre d'affichage.
- `product`: relation obligatoire vers `Product`.

## Contrat API mis a jour

Les endpoints Jour 1 restent stables:

- `GET /api/catalog/products`
- `GET /api/catalog/products/:slug`

Chaque produit expose maintenant:

```json
{
  "variants": [
    {
      "id": "technical-id",
      "name": "Sachet 100g",
      "sku": "NYRA-TEA-100G",
      "format": "100g",
      "weightValue": 100,
      "weightUnit": "g",
      "price": 7500,
      "stock": 24,
      "lowStockThreshold": 5,
      "isDefault": true,
      "isActive": true,
      "position": 0
    }
  ]
}
```

Regles de payload:

- seules les variantes actives sont renvoyees dans le contrat catalogue normalise;
- tri par `position`, puis `name`;
- `Variant.price` peut etre `null`; le front doit alors utiliser `Product.price`;
- `Variant.stock` devient la source de verite pour disponibilite et futur panier.

## Contraintes et index

- `Product.slug`, `Category.slug`, `Tag.slug` restent uniques.
- `Variant.sku` est unique et obligatoire.
- `Product.price`, `Variant.price`, `Variant.stock`, `Variant.lowStockThreshold` sont bornes a `>= 0`.
- Index PostgreSQL automatiques etendus aux colonnes catalogue/stock frequentes: `sku`, `format`, `stock`, `is_active`, `position`.

## Permissions

Le bootstrap applique les permissions publiques `find/findOne` sur:

- `Product`
- `Category`
- `Tag`
- `Variant`

Les endpoints custom `/api/catalog/products` restent publics via `auth: false`.

## Migration recommandee

1. Lancer Strapi pour appliquer la nouvelle collection `Variant` et la relation `Product.variants`.
2. Pour chaque produit existant, creer au moins une variante active par defaut.
3. Copier temporairement `Product.price` vers `Variant.price` si les formats ont des prix distincts; sinon laisser `Variant.price` vide.
4. Renseigner `sku` avec une convention stable: `NYRA-{PRODUCT}-{FORMAT}`.
5. Renseigner `stock` au niveau variante; ne plus considerer le stock au niveau produit.
6. Connecter le front aux `variants` pour remplacer les boutons statiques de format.

## Decisions Jour 2

- Le stock est porte par `Variant`, pas par `Product`.
- Le prix catalogue global reste sur `Product` pour compatibilite UI et tri.
- Un prix variante optionnel permet de gerer les formats plus chers sans dupliquer les produits.
- Les slugs restent le contrat de routing public; les SKU restent le contrat stock/admin.
