# Fix Frontend - Erreur Account `reduce` sur undefined

## Probleme observe

Erreur en production frontend:

```txt
Unexpected Application Error!
Cannot read properties of undefined (reading 'reduce')
```

Stack:

```txt
Account-lhwxBnQH.js
Cannot read properties of undefined (reading 'reduce')
```

Cela veut dire que la page `Account` fait probablement:

```ts
orders.reduce(...)
```

alors que `orders` vaut `undefined`.

## Cause probable

Le backend ne renvoie pas directement un tableau sur les endpoints compte.

Exemple:

```http
GET /api/me/orders
```

Renvoie:

```json
{
  "orders": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 0,
    "pageCount": 0
  }
}
```

Donc le frontend ne doit pas faire:

```ts
const orders = await api.get('/api/me/orders');
orders.reduce(...)
```

Il doit faire:

```ts
const response = await api.get('/api/me/orders');
const orders = response.orders ?? [];
orders.reduce(...)
```

## Formats backend a respecter

### Profil

```http
GET /api/me
```

Reponse:

```json
{
  "email": "user@email.com",
  "username": "user",
  "firstName": "",
  "lastName": "",
  "phone": ""
}
```

### Commandes

```http
GET /api/me/orders?page=1&pageSize=10
```

Reponse:

```json
{
  "orders": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 0,
    "pageCount": 0
  }
}
```

### Detail commande

```http
GET /api/me/orders/:orderId
```

Reponse:

```json
{
  "order": {
    "id": "ord_xxx",
    "status": "paid",
    "paymentMethod": "card",
    "items": [],
    "subtotal": 0,
    "shippingFee": 0,
    "total": 0,
    "shippingAddress": {},
    "billingAddress": {}
  }
}
```

### Adresses

```http
GET /api/me/addresses
```

Reponse:

```json
{
  "addresses": []
}
```

### Wishlist

```http
GET /api/me/wishlist
```

Reponse:

```json
{
  "items": [],
  "count": 0
}
```

### Produits consultes

```http
GET /api/me/viewed-products
```

Reponse:

```json
{
  "products": []
}
```

## Patch recommande dans `Account.tsx`

Toujours normaliser les donnees avant `map`, `filter`, `reduce`.

```ts
const profile = profileResponse ?? null;
const orders = ordersResponse?.orders ?? [];
const addresses = addressesResponse?.addresses ?? [];
const wishlistItems = wishlistResponse?.items ?? [];
const viewedProducts = viewedProductsResponse?.products ?? [];
```

Ensuite seulement:

```ts
const totalSpent = orders.reduce((sum, order) => {
  return sum + (order.total ?? 0);
}, 0);
```

## Patch encore plus defensif

Si le service API peut retourner `undefined` pendant le chargement:

```ts
const orders = Array.isArray(ordersResponse?.orders)
  ? ordersResponse.orders
  : [];
```

Pour toutes les listes:

```ts
const safeArray = <T>(value: T[] | undefined | null): T[] => {
  return Array.isArray(value) ? value : [];
};

const orders = safeArray(ordersResponse?.orders);
const addresses = safeArray(addressesResponse?.addresses);
const wishlistItems = safeArray(wishlistResponse?.items);
const viewedProducts = safeArray(viewedProductsResponse?.products);
```

## A corriger dans les services API

### Mauvais mapping

```ts
export async function getOrders() {
  return apiRequest<Order[]>('/api/me/orders');
}
```

### Bon mapping

```ts
type OrdersResponse = {
  orders: Order[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
};

export async function getOrders() {
  const response = await apiRequest<OrdersResponse>('/api/me/orders');
  return {
    orders: response.orders ?? [],
    pagination: response.pagination,
  };
}
```

## A corriger dans le dashboard Account

Eviter:

```ts
const totalOrders = orders.length;
const totalSpent = orders.reduce(...);
```

si `orders` vient directement d'un hook async.

Faire:

```ts
const accountOrders = ordersResponse?.orders ?? [];

const stats = useMemo(() => {
  return {
    totalOrders: accountOrders.length,
    totalSpent: accountOrders.reduce((sum, order) => sum + (order.total ?? 0), 0),
  };
}, [accountOrders]);
```

## Ajouter un ErrorBoundary

React Router recommande d'ajouter un `errorElement` ou une ErrorBoundary pour eviter l'ecran blanc.

Exemple:

```tsx
function RouteErrorBoundary() {
  return (
    <div className="mx-auto max-w-xl p-6">
      <h1>Une erreur est survenue</h1>
      <p>Veuillez rafraichir la page ou reessayer plus tard.</p>
    </div>
  );
}
```

Dans les routes:

```tsx
{
  path: '/account',
  element: <Account />,
  errorElement: <RouteErrorBoundary />,
}
```

## Checklist de verification

- [ ] `GET /api/me/orders` est mappe via `response.orders`.
- [ ] `GET /api/me/addresses` est mappe via `response.addresses`.
- [ ] `GET /api/me/wishlist` est mappe via `response.items`.
- [ ] `GET /api/me/viewed-products` est mappe via `response.products`.
- [ ] Aucun `.reduce` appele sur une valeur potentiellement undefined.
- [ ] Aucun `.map` appele sur une valeur potentiellement undefined.
- [ ] Aucun `.filter` appele sur une valeur potentiellement undefined.
- [ ] Account affiche un empty state si aucune commande.
- [ ] ErrorBoundary ajoutee sur `/account`.

## Resume

Le backend est correct. L'erreur vient du mapping frontend.

Il faut traiter les reponses backend comme des objets:

- `ordersResponse.orders`
- `addressesResponse.addresses`
- `wishlistResponse.items`
- `viewedProductsResponse.products`

Et toujours mettre `?? []` avant `reduce`, `map` ou `filter`.
