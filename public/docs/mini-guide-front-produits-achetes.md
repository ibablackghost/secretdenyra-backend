# Mini guide front - Produits achetes dans le compte

## Objectif

Afficher dans le compte utilisateur une section **Produits achetes**.

La source de verite est uniquement le backend Strapi.

Ne pas utiliser:

- fichier local;
- mock;
- localStorage;
- panier;
- wishlist.

---

## Endpoint a utiliser

```http
GET /api/me/purchased-products
```

Headers:

```ts
Authorization: `Bearer ${token}`
```

---

## Reponse attendue

```json
{
  "items": [],
  "products": [],
  "productIds": [],
  "count": 0
}
```

Chaque element de `items` contient:

```ts
{
  product: Product;
  productId: string;
  productSlug: string;
  productName: string;
  totalQuantity: number;
  totalSpent: number;
  currency: string;
  lastPurchasedAt: string;
  lastOrderId: string;
  orderCount: number;
  orders: [];
}
```

---

## Service API

Ajouter dans `accountApi.ts`:

```ts
export async function getPurchasedProducts(token: string) {
  return apiRequest('/api/me/purchased-products', {
    method: 'GET',
    token,
  });
}
```

---

## Chargement dans Account

```ts
const purchasedProducts = await accountApi.getPurchasedProducts(token);

const purchasedItems = purchasedProducts.items ?? [];
```

Ou avec les autres donnees du compte:

```ts
const [profile, orders, purchasedProducts, wishlist] = await Promise.all([
  accountApi.getProfile(token),
  accountApi.getOrders(token),
  accountApi.getPurchasedProducts(token),
  wishlistApi.getWishlist(token),
]);
```

---

## Affichage simple

```tsx
{purchasedItems.length === 0 ? (
  <EmptyState title="Aucun produit achete pour le moment" />
) : (
  purchasedItems.map((entry) => (
    <ProductCard
      key={entry.productId}
      product={entry.product}
      badge={`Achete ${entry.totalQuantity}x`}
    />
  ))
)}
```

---

## Apres paiement confirme

Apres confirmation checkout, recharger les produits achetes:

```ts
await checkoutApi.confirm(token, checkoutId, paymentIntentId);

await Promise.all([
  cartStore.load(),
  ordersStore.load(),
  accountStore.loadPurchasedProducts(),
]);
```

---

## Regles importantes

- Les produits achetes viennent uniquement de `/api/me/purchased-products`.
- Ne pas recalculer depuis les commandes cote front.
- Ne pas utiliser les donnees locales.
- Si `count = 0`, afficher un empty state.
- Apres achat, recharger commandes + produits achetes.
