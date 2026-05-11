# Update frontend - Catalogue importé Strapi

## Objectif

Le backend peut maintenant importer des produits depuis un CSV via l'admin Strapi.

Ce n'est pas uniquement pour les **Tisanes**. Le systeme doit rester compatible avec toutes les categories qui seront importees plus tard:

- tisanes;
- huiles;
- cosmetiques;
- accessoires;
- packs;
- autres categories catalogue.

Le frontend doit donc adapter l'affichage produit de maniere generique pour exploiter:

- variantes de poids;
- variantes de format;
- prix par variante;
- stock par variante;
- informations infusion;
- informations specifiques produit;
- SEO;
- tags.

---

## Categories

Chaque produit vient avec une categorie backend.

Exemple actuel:

```txt
tisanes
```

Mais le front ne doit pas coder uniquement `tisanes`.

Pour filtrer une categorie:

```http
GET /api/catalog/products?category=:categorySlug
```

Exemples:

```http
GET /api/catalog/products?category=tisanes
GET /api/catalog/products?category=huiles
GET /api/catalog/products?category=cosmetiques
```

Pour une page categorie:

```http
GET /api/categories/:slug
```

---

## Nouveaux champs produit

Les produits peuvent maintenant renvoyer:

```ts
type Product = {
  id: string;
  slug: string;
  name: string;
  ingredients: string;
  shortDescription?: string | null;
  description?: string | null;
  dosage?: string | null;
  infusionTime?: string | null;
  temperature?: string | null;
  origin?: string | null;
  botanicalName?: string | null;
  sourceUrl?: string | null;
  price: number;
  currency: 'XOF';
  image: Media | null;
  gallery: Media[];
  category: Category | null;
  tags: Tag[];
  variants: Variant[];
  inStock: boolean;
  stockQty: number;
  metaTitle?: string | null;
  metaDescription?: string | null;
};
```

---

## Variantes / prix / stock

Les produits importes peuvent avoir des variantes.

Exemple actuel pour les tisanes:

- `250g`
- `50g`

Mais demain une autre categorie peut avoir:

- `100ml`;
- `250ml`;
- `S`, `M`, `L`;
- `Pack x3`;
- `Format voyage`;
- autre format.

Exemple:

```ts
type Variant = {
  id: string;
  name: string;
  sku: string;
  format: string;
  label: string;
  size: string;
  weightValue: number | null;
  weightUnit: 'g' | 'kg' | 'ml' | 'l' | 'piece' | null;
  price: number;
  stock: number;
  stockQty: number;
  inStock: boolean;
  isDefault: boolean;
};
```

Regle importante:

- `product.price` = prix d'appel, souvent le prix minimum ou "a partir de";
- `selectedVariant.price` = vrai prix a utiliser pour l'affichage et l'achat;
- `selectedVariant.stock` = vrai stock vendable;
- `variantId` doit etre envoye au panier si le produit a des variantes.

Le front ne doit pas utiliser seulement `product.price` pour l'ajout panier si des variantes existent.

Il doit laisser l'utilisateur choisir une variante, puis envoyer:

```ts
{
  productId: product.id,
  variantId: selectedVariant.id,
  quantity: 1
}
```

Endpoint:

```http
POST /api/cart/items
```

---

## Affichage recommande fiche produit

Sur la fiche produit, afficher de maniere generique:

- nom produit;
- image;
- galerie;
- description courte;
- description complete;
- choix de variante si `variants.length > 0`;
- prix de la variante selectionnee;
- stock de la variante selectionnee;
- informations specifiques si disponibles;
- tags.

Pour les tisanes, afficher aussi si present:

- dosage;
- temps d'infusion;
- temperature;
- nom botanique;
- origine.

Exemple:

```tsx
const defaultVariant =
  product.variants.find((variant) => variant.isDefault) ??
  product.variants[0];

const [selectedVariant, setSelectedVariant] = useState(defaultVariant);

const displayPrice = selectedVariant?.price ?? product.price;
const inStock = selectedVariant?.inStock ?? product.inStock;
```

---

## Selecteur de variantes

```tsx
{product.variants.map((variant) => (
  <button
    key={variant.id}
    disabled={!variant.inStock}
    onClick={() => setSelectedVariant(variant)}
  >
    {variant.label ?? variant.format} - {variant.price.toLocaleString('fr-FR')} XOF
  </button>
))}
```

---

## Ajout panier

```ts
await cartApi.addItem(token, {
  productId: product.id,
  variantId: selectedVariant.id,
  quantity,
});
```

Important:

- utiliser `variantId` si le produit a des variantes;
- ne pas envoyer uniquement le produit parent;
- ne pas recalculer le prix cote front;
- le backend verifie le stock.

---

## Cards catalogue

Sur les cards produit:

- afficher `product.price` comme prix "a partir de";
- afficher `stockQty`;
- afficher les tags principaux;
- afficher `category.name`.

Exemple texte:

```tsx
À partir de {product.price.toLocaleString('fr-FR')} XOF
```

---

## SEO

Utiliser:

```ts
product.metaTitle
product.metaDescription
product.image
product.slug
```

Fallback:

```ts
title = product.metaTitle ?? product.name;
description = product.metaDescription ?? product.shortDescription ?? product.ingredients;
```

---

## Checklist front

- [ ] Les pages categories utilisent `category.slug`, pas une liste locale.
- [ ] Page categorie `tisanes` branchee sur `/api/catalog/products?category=tisanes`.
- [ ] Les futures categories importees fonctionneront avec le meme composant.
- [ ] ProductCard affiche "A partir de" `product.price`.
- [ ] ProductDetail affiche les variantes.
- [ ] Add to cart envoie `productId` + `variantId`.
- [ ] Le prix affiché change selon la variante.
- [ ] Le bouton achat est desactive si `selectedVariant.inStock === false`.
- [ ] Les infos specifiques produit sont affichees si presentes.
- [ ] Les infos infusion sont affichees si presentes pour les tisanes.
- [ ] Les metas SEO utilisent `metaTitle` et `metaDescription`.
- [ ] Aucun produit catalogue ne vient d'un fichier local.

---

## Message important pour le front

Le front doit traiter les produits importes comme des produits backend generiques.

Ne pas faire un composant special uniquement pour les tisanes.

La bonne logique est:

```ts
const hasVariants = product.variants?.length > 0;
const defaultVariant =
  product.variants?.find((variant) => variant.isDefault) ??
  product.variants?.[0] ??
  null;

const activePrice = defaultVariant?.price ?? product.price;
const activeStock = defaultVariant?.stockQty ?? product.stockQty;
```

Puis, au panier:

```ts
await cartApi.addItem(token, {
  productId: product.id,
  variantId: selectedVariant?.id,
  quantity,
});
```

Cette logique marchera pour les tisanes maintenant et pour les autres categories plus tard.
