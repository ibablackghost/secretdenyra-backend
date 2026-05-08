# Fix Frontend - Wishlist non synchronisee / non affichee dans le compte

## Probleme

La wishlist n'est pas coherente entre:

- fiche produit;
- page wishlist;
- header/compteur;
- page compte.

Symptomes possibles:

- ajout wishlist visible sur une page mais pas dans `/account`;
- compteur faux;
- produit ajoute puis perdu au refresh;
- front utilise un store local au lieu du backend;
- front melange `/api/wishlist` et `/api/me/wishlist` avec des mappings differents.

## Source de verite

La source de verite doit etre le backend Strapi.

Endpoints recommandes cote front:

```http
GET /api/me/wishlist
POST /api/me/wishlist/items
DELETE /api/me/wishlist/items/:productId
```

Tous ces endpoints demandent:

```ts
Authorization: `Bearer ${token}`
```

Les endpoints `/api/wishlist` existent aussi, mais pour eviter la confusion, le front devrait utiliser uniquement `/api/me/wishlist` dans l'espace connecte.

## Contrat backend unifie

### Lire la wishlist

```http
GET /api/me/wishlist
```

Reponse:

```json
{
  "items": [
    {
      "id": "wishlist-item-id",
      "product": {
        "id": "product-document-id",
        "slug": "infusion-sommeil",
        "name": "Infusion Sommeil",
        "price": 12000,
        "currency": "XOF",
        "compareAtPrice": null,
        "image": null,
        "category": {
          "id": "category-id",
          "slug": "infusions",
          "name": "Infusions"
        },
        "analytics": {}
      }
    }
  ],
  "products": [],
  "productIds": ["product-document-id"],
  "count": 1
}
```

### Ajouter un produit

```http
POST /api/me/wishlist/items
```

Body:

```json
{
  "productId": "infusion-sommeil"
}
```

Reponse:

```json
{
  "item": {
    "id": "wishlist-item-id",
    "product": {}
  },
  "products": [],
  "productIds": ["product-document-id"],
  "added": true
}
```

### Supprimer un produit

```http
DELETE /api/me/wishlist/items/:productId
```

Reponse:

```json
{
  "removed": true,
  "items": [],
  "products": [],
  "productIds": [],
  "count": 0
}
```

## Store wishlist recommande

Le store doit stocker:

```ts
type WishlistState = {
  items: WishlistItem[];
  productIds: string[];
  count: number;
  isLoading: boolean;
  loadWishlist: () => Promise<void>;
  addItem: (productId: string) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  toggleItem: (productId: string) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
};
```

## Mapping API correct

```ts
export async function getWishlist(token: string) {
  const response = await apiRequest<WishlistResponse>('/api/me/wishlist', {
    method: 'GET',
    token,
  });

  return {
    items: response.items ?? [],
    products: response.products ?? [],
    productIds: response.productIds ?? [],
    count: response.count ?? 0,
  };
}
```

## Toggle correct

Important: utiliser `product.id` stable backend ou `product.slug`, mais rester coherent partout.

Recommande:

- Pour les routes: `slug`.
- Pour wishlist: `product.id` si disponible, sinon `slug`.

```ts
async function toggleWishlist(product) {
  const productId = product.id ?? product.slug;

  if (wishlistStore.isWishlisted(productId)) {
    await wishlistApi.removeItem(token, productId);
  } else {
    await wishlistApi.addItem(token, productId);
  }

  await wishlistStore.loadWishlist();
}
```

## isWishlisted robuste

Le front doit verifier `id` et `slug`, parce que certaines cartes peuvent avoir un produit normalise differemment.

```ts
function isWishlisted(product: { id?: string; slug?: string }) {
  return items.some((item) => {
    return (
      item.product?.id === product.id ||
      item.product?.slug === product.slug ||
      productIds.includes(product.id ?? '') ||
      productIds.includes(product.slug ?? '')
    );
  });
}
```

## Page Account

Dans `/account`, ne pas utiliser une wishlist locale.

Faire:

```ts
const wishlistItems = wishlistResponse?.items ?? [];
const wishlistProducts = wishlistResponse?.products ?? [];
const wishlistCount = wishlistResponse?.count ?? wishlistItems.length;
```

Puis afficher:

```tsx
{wishlistProducts.map((product) => (
  <ProductCard key={product.id} product={product} />
))}
```

ou:

```tsx
{wishlistItems.map((item) => (
  <ProductCard key={item.id} product={item.product} />
))}
```

## Header compteur

Le compteur doit venir du backend apres login:

```ts
const count = wishlistStore.count;
```

Au login:

```ts
await authStore.login(email, password);
await wishlistStore.loadWishlist();
```

Au logout:

```ts
wishlistStore.clear();
```

## Apres ajout/suppression

Toujours mettre a jour le store.

Option simple:

```ts
await wishlistApi.addItem(token, productId);
await loadWishlist();
```

Option optimiste possible plus tard, mais d'abord faire simple.

## Checklist frontend

- [ ] Utiliser uniquement `/api/me/wishlist` pour l'espace connecte.
- [ ] Envoyer `Authorization: Bearer token`.
- [ ] Charger wishlist apres login.
- [ ] Recharger wishlist apres add/remove.
- [ ] Vider wishlist store au logout.
- [ ] Ne plus utiliser uniquement localStorage comme source de verite.
- [ ] Dans Account, lire `response.items` ou `response.products`, pas `response` directement.
- [ ] Dans Header, compteur = `response.count`.
- [ ] `isWishlisted` compare au moins `product.id` et `product.slug`.

## Resume

Le backend renvoie maintenant un contrat wishlist unifie sur:

- `/api/me/wishlist`
- `/api/wishlist`

Pour eviter les incoherences, le frontend doit utiliser `/api/me/wishlist` partout apres connexion et synchroniser le store apres chaque mutation.
