# Nyra - Source de verite backend finale

## Objectif

Ce document fixe la regle finale entre le frontend et le backend:

- le backend Strapi est l'unique source de verite metier;
- le local frontend ne doit plus contenir de fichiers de donnees metier;
- le local frontend sert uniquement a l'etat UI temporaire, au token auth et au cache de requetes;
- apres connexion, les stores critiques doivent toujours etre rehydrates depuis le backend;
- apres chaque mutation critique, le frontend doit reprendre l'etat renvoye par le backend ou relancer un `GET`.

Ce document complete `local-vs-backend-source-of-truth.md`.

Pour la migration frontend stricte sans donnees locales, utiliser aussi:

- `guide-frontend-backend-only.md`

---

## 1) Regle d'or

Si l'utilisateur est connecte, le backend gagne toujours.

Le frontend peut faire une mise a jour optimiste pour l'experience utilisateur, mais il doit ensuite:

1. appeler l'endpoint backend;
2. lire la reponse normalisee;
3. remplacer son store local par la reponse backend;
4. afficher l'erreur backend si la mutation echoue.

Le localStorage ne doit jamais etre considere comme verite metier. Il ne doit pas stocker panier, wishlist, commandes, adresses, catalogue ou compte comme donnees finales.

---

## 2) Identifiants stables

Le frontend doit utiliser ces identifiants dans cet ordre:

1. `product.id` pour wishlist, panier, tracking, favoris;
2. `product.slug` pour navigation et fallback de mutation;
3. `item.id` pour mutation d'une ligne panier;
4. `order.id` ou `order.orderNumber` pour afficher une commande;
5. `order.technicalId` uniquement pour debug ou detail interne.

Le backend accepte deja plusieurs formats pour les produits:

- `documentId`;
- `slug`;
- `id` numerique Strapi.

Mais le frontend doit rester coherent: ne pas melanger `slug` dans un store et `documentId` dans un autre sans normalisation.

---

## 3) Auth et profil

Endpoints:

```http
POST /api/auth/local/register
POST /api/auth/local
GET /api/me
PATCH /api/me
```

Regles frontend:

- stocker le JWT seulement pour la session client;
- appeler `GET /api/me` au demarrage si token present;
- si `GET /api/me` renvoie `401`, deconnecter l'utilisateur et vider les stores prives;
- apres login/register, charger les donnees compte: profil, panier, wishlist, adresses, commandes.

---

## 4) Wishlist finale

Endpoints connectes a utiliser partout:

```http
GET /api/me/wishlist
POST /api/me/wishlist/items
DELETE /api/me/wishlist/items/:productId
```

Payload final de lecture:

```json
{
  "items": [],
  "products": [],
  "productIds": [],
  "count": 0
}
```

Payload apres ajout:

```json
{
  "item": {},
  "products": [],
  "productIds": [],
  "added": true
}
```

Payload apres suppression:

```json
{
  "removed": true,
  "items": [],
  "products": [],
  "productIds": [],
  "count": 0
}
```

Regles frontend:

- utiliser uniquement `/api/me/wishlist` quand l'utilisateur est connecte;
- charger la wishlist apres login;
- recharger ou remplacer le store apres ajout/suppression;
- vider la wishlist au logout;
- `isWishlisted` doit verifier `product.id` et `product.slug`.

---

## 5) Panier final

Endpoints:

```http
GET /api/cart
POST /api/cart/items
PATCH /api/cart/items/:itemId
DELETE /api/cart/items/:itemId
```

Payload final:

```json
{
  "items": [],
  "count": 0,
  "itemCount": 0,
  "productIds": [],
  "currency": "XOF",
  "subtotal": 0,
  "shipping": 0,
  "shippingFee": 0,
  "discounts": [],
  "freeShippingThreshold": 45000,
  "total": 0
}
```

Regles frontend:

- `items[].id` est l'identifiant a utiliser pour `PATCH` et `DELETE`;
- `itemCount` represente la somme des quantites;
- `count` represente le nombre de lignes panier;
- les montants affiches au checkout doivent venir du backend;
- si le backend renvoie `OUT_OF_STOCK`, remettre le store local sur la derniere reponse backend.

---

## 6) Adresses compte

Endpoints:

```http
GET /api/me/addresses
POST /api/me/addresses
PATCH /api/me/addresses/:addressId
PUT /api/me/addresses/:addressId
DELETE /api/me/addresses/:addressId
POST /api/me/addresses/:addressId/default
```

Payload de lecture:

```json
{
  "addresses": [],
  "items": [],
  "count": 0
}
```

Regles frontend:

- lire `addresses` en priorite;
- `items` existe comme alias stable pour eviter les crashes;
- apres create/update/delete/default, relancer `GET /api/me/addresses`;
- ne jamais calculer l'adresse par defaut uniquement cote local.

---

## 7) Commandes compte

Endpoints:

```http
GET /api/me/orders?page=1&pageSize=10
GET /api/me/orders/:orderId
GET /api/me/purchased-products
```

Payload liste:

```json
{
  "orders": [],
  "items": [],
  "count": 0,
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 0,
    "pageCount": 0
  }
}
```

Regles frontend:

- lire `orders` en priorite;
- `items` existe comme alias;
- proteger tous les `map/reduce/filter` avec `?? []`;
- ne pas creer une commande localement comme verite finale;
- une commande finale vient de `POST /api/checkout/:checkoutId/confirm`.

### Produits achetes

La page compte doit afficher les produits deja achetes depuis le backend.

Endpoint:

```http
GET /api/me/purchased-products
```

Payload:

```json
{
  "items": [
    {
      "product": {},
      "productId": "product-document-id",
      "productSlug": "infusion-sommeil",
      "productName": "Infusion Sommeil",
      "totalQuantity": 2,
      "totalSpent": 24000,
      "currency": "XOF",
      "lastPurchasedAt": "2026-05-08T10:00:00.000Z",
      "lastOrderId": "ord_xxx",
      "orderCount": 1,
      "orders": []
    }
  ],
  "products": [],
  "productIds": [],
  "count": 1
}
```

Regles frontend:

- afficher cette section depuis `/api/me/purchased-products`;
- ne pas recalculer les produits achetes depuis un fichier local;
- ne pas utiliser la wishlist ou le panier pour deduire les achats;
- afficher un empty state si `count = 0`;
- apres confirmation checkout, recharger `/api/me/orders` et `/api/me/purchased-products`.

---

## 8) Produits vus

Endpoints:

```http
GET /api/me/viewed-products
POST /api/me/viewed-products
```

Payload de lecture:

```json
{
  "items": [],
  "products": [],
  "productIds": [],
  "count": 0
}
```

Regles frontend:

- si utilisateur connecte, envoyer `POST /api/me/viewed-products`;
- afficher les produits vus depuis `products` ou `items[].product`;
- ne pas bloquer l'UX si le tracking echoue.

---

## 9) Checkout et paiement

Endpoints:

```http
POST /api/checkout/init
PATCH /api/checkout/:checkoutId
GET /api/checkout/:checkoutId/summary
POST /api/checkout/:checkoutId/payment-intent
POST /api/checkout/:checkoutId/confirm
```

Champs critiques:

```json
{
  "checkoutId": "chk_xxx",
  "checkout_session_id": "chk_xxx",
  "currency": "XOF",
  "subtotal": 0,
  "shippingFee": 0,
  "total": 0
}
```

Regles frontend:

- toujours conserver `checkout_session_id`;
- afficher les montants backend, jamais un total recalcule uniquement cote frontend;
- creer le PaymentIntent avec le total backend;
- confirmer la commande avec le `paymentIntentId`;
- apres `confirm`, vider le panier local et recharger les commandes.

Le backend cree deja l'event serveur `purchase` lors de la confirmation paiement. Pour une production Stripe complete, le webhook Stripe restera la version la plus robuste pour confirmer les paiements hors session navigateur.

---

## 10) Erreurs API

Format final:

```json
{
  "code": "OUT_OF_STOCK",
  "message": "Stock insuffisant.",
  "details": {},
  "requestId": "req_xxx"
}
```

Regles frontend:

- afficher `message`;
- utiliser `code` pour les cas metier;
- logger `requestId` pour debug;
- ne pas masquer silencieusement les erreurs critiques apres login.

Codes importants:

- `UNAUTHORIZED`: token absent ou expire;
- `PRODUCT_NOT_FOUND`: produit introuvable;
- `OUT_OF_STOCK`: stock insuffisant;
- `INVALID_QUANTITY`: quantite invalide;
- `CART_CHANGED`: panier modifie pendant le paiement;
- `CHECKOUT_EXPIRED`: checkout expire;
- `PAYMENT_DECLINED`: paiement refuse;
- `PAYMENT_TIMEOUT`: paiement temporairement indisponible.

---

## 11) Cycle de synchronisation frontend

Au demarrage:

```ts
if (token) {
  await auth.loadMe();
  await Promise.all([
    cart.loadCart(),
    wishlist.loadWishlist(),
    addresses.loadAddresses(),
    orders.loadOrders(),
    viewedProducts.loadViewedProducts(),
  ]);
}
```

Apres login/register:

```ts
await auth.login(email, password);
await bootstrapPrivateStores();
```

Apres logout:

```ts
auth.clear();
cart.clear();
wishlist.clear();
addresses.clear();
orders.clear();
viewedProducts.clear();
```

Apres mutation:

```ts
await apiMutation();
await reloadConcernedStore();
```

---

## 12) Checklist finale QA

- [ ] Login puis refresh: profil, panier, wishlist et compte restent coherents.
- [ ] Wishlist ajoutee sur fiche produit visible dans header, wishlist page et compte.
- [ ] Wishlist supprimee dans compte disparait partout apres refresh.
- [ ] Panier ajoute/supprime depuis plusieurs pages reste coherent.
- [ ] `PATCH /api/cart/items/:itemId` utilise bien `items[].id`.
- [ ] Account sans commandes ne crash pas.
- [ ] Account sans adresses ne crash pas.
- [ ] Checkout affiche les montants backend.
- [ ] Confirmation commande vide le panier et ajoute la commande dans le compte.
- [ ] Token expire provoque logout propre et nettoyage des stores prives.
- [ ] Toute erreur backend affiche un message lisible.

---

## Decision finale

Pour terminer proprement:

1. Le backend Strapi est l'unique source de verite metier.
2. Les fichiers locaux de donnees metier doivent etre retires du frontend.
3. Le local frontend sert seulement a l'UI, au token et au cache temporaire.
4. Les stores connectes doivent etre rehydrates apres login.
5. Les mutations connectees doivent etre confirmees par backend.
6. Les payloads backend contiennent maintenant des alias stables (`items`, `count`, `productIds`) pour eviter les divergences.

Avec cette regle, les problemes de wishlist non synchronisee, panier incoherent, compte vide ou `reduce undefined` doivent disparaitre si le frontend suit ces contrats.
