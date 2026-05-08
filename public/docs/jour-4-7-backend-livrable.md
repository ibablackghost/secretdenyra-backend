# Jours 4 a 7 - Livrable Backend

## Jour 4 - Fiche produit UX complete

Le contrat produit est enrichi pour la fiche detail:

- `gallery[]` sur `Product` pour les medias additionnels.
- `variants[]` expose `label`, `size`, `colorName`, `colorHex`, `compareAtPrice`, `inStock`, `stockQty`.
- `GET /api/products/:slug` est ajoute en alias de detail produit.
- Le detail produit continue de renvoyer `similarProducts[]`.

## Jour 5 - Panier et wishlist

### Panier

Endpoints authenticated:

- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/:itemId`
- `DELETE /api/cart/items/:itemId`

`POST /api/cart/items` accepte:

```json
{
  "productId": "slug-or-documentId",
  "variantId": "sku-or-documentId",
  "quantity": 1
}
```

Si `variantId` est absent, le backend choisit la variante active par defaut, puis la premiere variante active.

Payload panier:

```json
{
  "items": [],
  "currency": "XOF",
  "subtotal": 0,
  "shipping": 0,
  "freeShippingThreshold": 45000,
  "total": 0
}
```

Regles:

- quantite par ligne: `1..20`;
- validation stock cote serveur;
- frais livraison: `2500 XOF` sous `45000 XOF`, gratuit a partir du seuil;
- erreurs metier `{ code, message }`.

### Wishlist

Endpoints authenticated:

- `GET /api/wishlist`
- `POST /api/wishlist/items`
- `DELETE /api/wishlist/items/:productId`

`productId` accepte `slug`, `documentId` ou `id` numerique.

## Jour 6 - Checkout draft

Endpoints authenticated:

- `POST /api/checkout/init`
- `PATCH /api/checkout/:checkoutId`
- `GET /api/checkout/:checkoutId`

Le checkout stocke:

- `customer`;
- `shippingAddress`;
- `billingAddress`;
- `billingSameAsShipping`;
- totaux recalcules backend;
- expiration a 6 heures.

Validations:

- email valide;
- `firstName`, `lastName`, `phone` requis;
- adresse: `line1`, `city`, `country` requis;
- panier non vide;
- stock disponible.

## Jour 7 - Paiement et commande

Endpoints authenticated:

- `POST /api/checkout/:checkoutId/payment-intent`
- `POST /api/checkout/:checkoutId/confirm`

Creation PaymentIntent:

- provider: `stripe`;
- devise supportee: `XOF`;
- montant recalcule depuis le panier backend;
- configuration requise: `STRIPE_SECRET_KEY`.

Pour le developpement local uniquement, `STRIPE_MOCK_PAYMENTS=true` permet de generer un PaymentIntent mock et de confirmer le checkout sans Stripe.

Confirmation:

- verifie `paymentIntentId`;
- recalcule le panier et detecte `CART_CHANGED`;
- verifie le statut Stripe `succeeded`;
- cree `Order` + `OrderItem` avec snapshot prix/nom/SKU;
- passe le checkout en `paid`;
- vide le panier utilisateur.

## Modeles ajoutes

- `CartItem`: user, product, variant, quantity.
- `Checkout`: checkoutId, status, customer/adresses, totaux, paymentIntentId, expiration.
- `Order`: orderNumber, checkoutId, status, payment, totaux, customer/adresses.
- `OrderItem`: snapshot commercial d'une ligne commande.

## Permissions

Le bootstrap applique au role `authenticated`:

- panier custom;
- wishlist custom;
- checkout custom;
- lecture commandes utilisateur.

Les controllers gardent un controle explicite `ctx.state.user` et filtrent par utilisateur courant.

## Codes erreurs principaux

- `UNAUTHORIZED`
- `PRODUCT_NOT_FOUND`
- `INVALID_QUANTITY`
- `OUT_OF_STOCK`
- `CART_EMPTY`
- `INVALID_CUSTOMER_INFO`
- `INVALID_SHIPPING_ADDRESS`
- `INVALID_BILLING_ADDRESS`
- `CHECKOUT_EXPIRED`
- `CART_CHANGED`
- `PAYMENT_INFO_INCOMPLETE`
- `PAYMENT_TIMEOUT`
- `PAYMENT_DECLINED`

## Limites volontairement gardees pour les prochains jours

- Decrementation atomique du stock a faire au Jour 9.
- Webhook Stripe complet a faire dans la phase paiement/webhooks dediee.
- Endpoint CRUD adresses persistantes a faire avec le compte utilisateur si le front le branche apres checkout.
