# Nyra Frontend - Migration Backend Only

## Objectif

Ce document donne la consigne finale pour le frontend:

**Le frontend ne doit plus utiliser de fichiers locaux comme source de donnees metier.**

Le backend Strapi devient l'unique source pour:

- catalogue;
- categories;
- produits;
- wishlist;
- panier;
- compte utilisateur;
- adresses;
- commandes;
- produits vus;
- checkout;
- paiement;
- analytics serveur.

Le frontend peut garder uniquement:

- etat UI temporaire en memoire: modales, loaders, onglets actifs, filtres en cours;
- token d'authentification;
- brouillon formulaire non critique avant envoi;
- cache de requetes si React Query/SWR est utilise.

Il ne doit plus garder en local une copie metier durable qui remplace le backend.

---

## 1) Decision finale d'architecture

Avant:

```txt
Frontend local files / localStorage / mock data
        +
Backend Strapi parfois utilise
```

Maintenant:

```txt
Backend Strapi = source de verite
Frontend = affichage + appels API + cache temporaire
```

Regle simple:

Si une donnee doit rester vraie apres refresh, apres login, sur un autre appareil ou dans le compte utilisateur, elle doit venir du backend.

---

## 2) Ce qu'il faut supprimer cote frontend

Supprimer ou neutraliser tous les fichiers de donnees locales de ce type:

```txt
src/data/products.*
src/data/categories.*
src/data/orders.*
src/data/wishlist.*
src/data/cart.*
src/data/addresses.*
src/data/mock*.*
src/mocks/**
src/fixtures/**
```

Supprimer aussi les usages metier de:

```ts
localStorage.getItem('nyra-cart')
localStorage.getItem('nyra-wishlist')
localStorage.getItem('nyra-orders')
localStorage.getItem('nyra-addresses')
localStorage.getItem('nyra-viewed-products')
```

Ces cles peuvent etre nettoyees au demarrage:

```ts
const deprecatedKeys = [
  'nyra-cart',
  'nyra-wishlist',
  'nyra-orders',
  'nyra-addresses',
  'nyra-viewed-products',
];

deprecatedKeys.forEach((key) => localStorage.removeItem(key));
```

Attention: ne pas supprimer le token auth tant que la strategie d'auth n'est pas remplacee.

---

## 3) Ce qui peut rester local

Autorise:

```txt
auth token
theme
langue
etat UI
draft formulaire checkout avant init
cache React Query/SWR en memoire
```

Interdit comme source finale:

```txt
liste produits locale
liste categories locale
panier local persistant
wishlist locale persistante
commandes locales
adresses locales
profil utilisateur local non revalide
totaux checkout calcules uniquement cote front
stock local
prix local
```

---

## 4) Services API obligatoires

Le frontend doit centraliser les appels dans des services API.

Structure recommandee:

```txt
src/services/api/httpClient.ts
src/services/api/authApi.ts
src/services/api/catalogApi.ts
src/services/api/cartApi.ts
src/services/api/wishlistApi.ts
src/services/api/accountApi.ts
src/services/api/checkoutApi.ts
src/services/api/analyticsApi.ts
```

Chaque page ou store doit passer par ces services, jamais par un fichier local.

---

## 5) Http client unique

```ts
const API_URL = import.meta.env.VITE_STRAPI_URL;

type RequestOptions = RequestInit & {
  token?: string | null;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw {
      status: response.status,
      code: payload?.code ?? 'API_ERROR',
      message: payload?.message ?? 'Erreur API.',
      details: payload?.details,
      requestId: payload?.requestId,
    };
  }

  return payload as T;
}
```

---

## 6) Catalogue backend only

Ne plus importer de produits locaux.

Remplacer:

```ts
import { products } from '@/data/products';
```

par:

```ts
const products = await catalogApi.listProducts(params);
```

Endpoints:

```http
GET /api/catalog/products
GET /api/catalog/products/:slug
GET /api/categories/:slug
```

Regles:

- prix, stock, images et variantes viennent du backend;
- le front peut filtrer l'affichage, mais les filtres principaux doivent etre envoyes au backend;
- ne jamais afficher un stock local si le backend renvoie une autre valeur.

---

## 7) Wishlist backend only

Endpoints:

```http
GET /api/me/wishlist
POST /api/me/wishlist/items
DELETE /api/me/wishlist/items/:productId
```

Store recommande:

```ts
type WishlistStore = {
  items: WishlistItem[];
  products: Product[];
  productIds: string[];
  count: number;
  load: () => Promise<void>;
  add: (productId: string) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  toggle: (product: Product) => Promise<void>;
  clear: () => void;
};
```

Implementation:

```ts
async function loadWishlist() {
  const data = await wishlistApi.getWishlist(token);

  set({
    items: data.items ?? [],
    products: data.products ?? [],
    productIds: data.productIds ?? [],
    count: data.count ?? 0,
  });
}

async function addWishlistItem(productId: string) {
  await wishlistApi.addItem(token, productId);
  await loadWishlist();
}

async function removeWishlistItem(productId: string) {
  await wishlistApi.removeItem(token, productId);
  await loadWishlist();
}
```

Interdit:

```ts
set({ productIds: [...productIds, productId] });
localStorage.setItem('nyra-wishlist', JSON.stringify(...));
```

Le front peut afficher un loader court, mais l'etat final doit venir de `GET /api/me/wishlist`.

---

## 8) Panier backend only

Endpoints:

```http
GET /api/cart
POST /api/cart/items
PATCH /api/cart/items/:itemId
DELETE /api/cart/items/:itemId
```

Le backend renvoie:

```json
{
  "items": [],
  "count": 0,
  "itemCount": 0,
  "productIds": [],
  "subtotal": 0,
  "shippingFee": 0,
  "total": 0,
  "currency": "XOF"
}
```

Regles:

- le front ne calcule pas le total final;
- `items[].id` sert a update/delete;
- apres add/update/delete, remplacer le store par la reponse backend;
- au checkout, utiliser les montants backend.

Implementation:

```ts
async function addToCart(productId: string, variantId?: string, quantity = 1) {
  const cart = await cartApi.addItem(token, { productId, variantId, quantity });
  set(cart);
}
```

---

## 9) Account backend only

Endpoints:

```http
GET /api/me
PATCH /api/me
GET /api/me/addresses
GET /api/me/orders
GET /api/me/purchased-products
GET /api/me/wishlist
GET /api/me/viewed-products
```

La page compte ne doit lire aucune donnee locale.

Au montage:

```ts
const [profile, addresses, orders, purchasedProducts, wishlist, viewedProducts] = await Promise.all([
  accountApi.getProfile(token),
  accountApi.getAddresses(token),
  accountApi.getOrders(token),
  accountApi.getPurchasedProducts(token),
  wishlistApi.getWishlist(token),
  accountApi.getViewedProducts(token),
]);
```

Regles:

- commandes = backend uniquement;
- produits achetes = backend uniquement via `/api/me/purchased-products`;
- adresses = backend uniquement;
- wishlist du compte = backend uniquement;
- produits vus = backend uniquement si connecte;
- si un tableau est vide, afficher un empty state, pas un fallback mock.

Contrat produits achetes:

```json
{
  "items": [],
  "products": [],
  "productIds": [],
  "count": 0
}
```

Utilisation recommandee:

```tsx
const purchasedItems = purchasedProducts.items ?? [];

{purchasedItems.map((entry) => (
  <ProductCard
    key={entry.productId}
    product={entry.product}
    badge={`Acheté ${entry.totalQuantity}x`}
  />
))}
```

Apres un checkout confirme:

```ts
await checkoutApi.confirm(token, checkoutId, paymentIntentId);
await Promise.all([
  cartStore.load(),
  ordersStore.load(),
  accountStore.loadPurchasedProducts(),
]);
```

---

## 10) Checkout backend only

Endpoints:

```http
POST /api/checkout/init
PATCH /api/checkout/:checkoutId
GET /api/checkout/:checkoutId/summary
POST /api/checkout/:checkoutId/payment-intent
POST /api/checkout/:checkoutId/confirm
```

Regles:

- le front peut garder le formulaire en memoire avant envoi;
- des que `checkoutId` existe, le backend devient source de verite;
- montants, livraison, devise, stock et paiement viennent du backend;
- apres confirmation, recharger panier et commandes depuis backend.

Apres paiement:

```ts
await checkoutApi.confirm(token, checkoutId, paymentIntentId);
await cartStore.load();
await ordersStore.load();
await accountStore.loadPurchasedProducts();
```

---

## 11) Auth bootstrap

Au demarrage app:

```ts
async function bootstrapApp() {
  const token = authStore.token;

  if (!token) {
    clearPrivateStores();
    return;
  }

  try {
    await authStore.loadMe();
    await Promise.all([
      cartStore.load(),
      wishlistStore.load(),
      accountStore.loadAddresses(),
      accountStore.loadOrders(),
      viewedProductsStore.load(),
    ]);
  } catch (error) {
    if (error.status === 401) {
      authStore.logout();
      clearPrivateStores();
    }
  }
}
```

Au logout:

```ts
function clearPrivateStores() {
  cartStore.clear();
  wishlistStore.clear();
  accountStore.clear();
  viewedProductsStore.clear();
}
```

---

## 12) React Query / SWR recommande

Si le front utilise React Query, preferer:

```ts
useQuery({
  queryKey: ['wishlist'],
  queryFn: () => wishlistApi.getWishlist(token),
  enabled: Boolean(token),
});
```

Apres mutation:

```ts
await mutation.mutateAsync(payload);
queryClient.invalidateQueries({ queryKey: ['wishlist'] });
```

Ce cache est accepte car il reste un cache de requete, pas une source metier locale.

---

## 13) Migration fichier par fichier

Ordre conseille:

1. Creer `httpClient.ts`.
2. Creer les services API.
3. Remplacer les imports de mock/catalogue local par `catalogApi`.
4. Remplacer `wishlistStore` local par `wishlistApi`.
5. Remplacer `cartStore` local par `cartApi`.
6. Remplacer la page Account par `accountApi`.
7. Remplacer checkout local par `checkoutApi`.
8. Supprimer les fichiers `data`, `mocks`, `fixtures`.
9. Nettoyer les anciennes cles localStorage.
10. Tester refresh, logout, login et multi-pages.

---

## 14) Checklist de fin

- [ ] Aucun import depuis `src/data/products`.
- [ ] Aucun import depuis `src/mocks`.
- [ ] Aucun import depuis `src/fixtures`.
- [ ] Aucun panier persistant en localStorage.
- [ ] Aucune wishlist persistante en localStorage.
- [ ] Aucune commande creee localement.
- [ ] La page compte charge tout depuis `/api/me/*`.
- [ ] Le header wishlist/cart vient du backend apres login.
- [ ] Le checkout affiche uniquement les montants backend.
- [ ] Refresh apres login garde les donnees coherentes.
- [ ] Logout vide tous les stores prives.
- [ ] Token expire provoque un logout propre.

---

## 15) Resume pour le front

Le front doit devenir un client API pur.

Il affiche les donnees du backend, envoie les actions utilisateur au backend, puis remplace son etat par la reponse backend.

Il ne doit plus utiliser de fichiers locaux pour simuler les produits, le panier, la wishlist, les commandes ou le compte.
