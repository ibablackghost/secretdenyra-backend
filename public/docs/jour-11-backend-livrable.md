# Jour 11 - Livrable Backend Analytics Conversions

## Objectif

Garantir un tunnel analytics coherent entre catalogue, panier, checkout et commande:

- `view_item`
- `add_to_cart`
- `begin_checkout`
- `purchase`

## IDs et prix stables

Les payloads produit exposent maintenant:

- `id`: `documentId` Strapi si disponible, fallback `id`.
- `currency`: `XOF`.
- `analytics.item_id`: meme valeur que `id`.
- `analytics.item_name`.
- `analytics.item_category`.
- `analytics.price`.

Le panier expose aussi un bloc `analytics` par ligne avec:

- `item_id`
- `item_name`
- `item_category`
- `price`
- `quantity`
- `currency`

Le prix reste calcule cote serveur:

- `variant.price` si renseigne.
- sinon `product.price`.

## Checkout analytics

`POST /api/checkout/init` renvoie maintenant:

- `checkoutId`
- `checkout_session_id`
- les totaux recalcules (`subtotal`, `shipping`, `total`, `currency`)
- `analytics.checkout_session_id`
- `analytics.value`
- `analytics.items[]`

Les payloads `GET/PATCH /api/checkout/:checkoutId` exposent le meme contrat via `checkoutPayload`.

En cas d'ecart panier au paiement, `CART_CHANGED` renvoie maintenant:

```json
{
  "code": "CART_CHANGED",
  "message": "Le panier a changé depuis le paiement.",
  "details": {
    "expectedTotal": 45500,
    "currentTotal": 43000,
    "currency": "XOF"
  }
}
```

## Purchase serveur

`POST /api/checkout/:checkoutId/confirm` prepare et enregistre un event serveur `purchase` dans `AnalyticsEvent`.

La reponse contient:

```json
{
  "orderId": "document-id",
  "order_id": "document-id",
  "checkout_session_id": "chk_xxx",
  "status": "paid",
  "analytics": {
    "event": "purchase",
    "transaction_id": "ord_xxx",
    "currency": "XOF",
    "value": 45500,
    "shipping": 2500,
    "items": []
  }
}
```

## Analytics config

Endpoint public:

- `GET /api/analytics/config`

Payload:

```json
{
  "analyticsEnabled": true,
  "posthogEnabled": false,
  "gaMeasurementEnabled": false,
  "currency": "XOF",
  "consent": {
    "required": true,
    "defaultGranted": false
  },
  "events": ["view_item", "add_to_cart", "begin_checkout", "purchase"]
}
```

Variables env supportees:

- `ANALYTICS_ENABLED`
- `POSTHOG_ENABLED`
- `GA_MEASUREMENT_ENABLED`
- `ANALYTICS_CONSENT_REQUIRED`
- `ANALYTICS_CONSENT_DEFAULT_GRANTED`

## Proxy first-party

Endpoint public:

- `POST /api/analytics/events`

Events acceptes:

- `view_item`
- `add_to_cart`
- `begin_checkout`
- `purchase`

L'event est persiste en `AnalyticsEvent` avec:

- `eventName`
- `checkoutSessionId`
- `orderId`
- `currency`
- `value`
- `payload`
- `requestId`
- `userAgent`
- `user` si authentifie

## Commandes

`OrderItem` snapshot maintenant:

- `productDocumentId`
- `categoryName`
- `currency`

Les endpoints commandes utilisateur exposent un bloc `analytics` pour faciliter la reconciliation revenus/BI.

## Permissions et index

Le bootstrap public active:

- `analytics.config`
- `analytics.events`

Index PostgreSQL ajoutes pour:

- `event_name`
- `checkout_session_id`
- `order_id`
