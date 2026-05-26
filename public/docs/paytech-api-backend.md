# Intégration PayTech — Backend Nyra (implémenté)

**Spec complète :** [`paytech-api-backend.md`](../../../paytech-api-backend.md) (racine)  
**Front :** [`frontend-checkout-api.md`](../../../frontend-checkout-api.md)  
**Corrections prod :** [`backend-correction-checkout-paytech.md`](../../../backend-correction-checkout-paytech.md)

## Routes exposées

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `POST` | `/api/checkout/init` | Public | Crée checkout (+ `guestToken` si invité) |
| `POST` | `/api/checkout/:checkoutId/payment/paytech` | JWT ou `X-Checkout-Token` | Initie PayTech → `redirectUrl` |
| `POST` | `/api/checkout/:checkoutId/confirm` | JWT ou `X-Checkout-Token` | `{ "paymentMethod": "paytech", "paymentId": "..." }` |
| `GET` | `/api/payments/:paymentId/status` | JWT ou `X-Checkout-Token` | Statut paiement |
| `GET` | `/api/me/payments/pending` | JWT | Paiements `PENDING` (bandeau compte) |
| `POST` | `/api/webhooks/paytech/ipn` | Public (PayTech) | Webhook IPN |

## Variables d'environnement

### Local

```env
PAYTECH_API_KEY=
PAYTECH_API_SECRET=
PAYTECH_BASE_URL=https://paytech.sn/api
PAYTECH_ENV=test
PAYTECH_IPN_URL=http://localhost:1337/api/webhooks/paytech/ipn
PAYTECH_SUCCESS_URL=http://localhost:5173/checkout/payment/return?result=success
PAYTECH_CANCEL_URL=http://localhost:5173/checkout/payment/return?result=cancel
```

### Production (Railway)

```env
PAYTECH_API_KEY=<clé PayTech prod>
PAYTECH_API_SECRET=<secret PayTech prod>
PAYTECH_BASE_URL=https://paytech.sn/api
PAYTECH_ENV=prod
PAYTECH_IPN_URL=https://secretdenyra-backend-production.up.railway.app/api/webhooks/paytech/ipn
PAYTECH_SUCCESS_URL=https://secretdenyra-frontend.vercel.app/checkout/payment/return?result=success
PAYTECH_CANCEL_URL=https://secretdenyra-frontend.vercel.app/checkout/payment/return?result=cancel
```

> `SUCCESS_URL` / `CANCEL_URL` = **frontend** (Vercel). `IPN_URL` = **backend** (Railway).

## Flux

1. Front : `POST .../checkout/init` → `checkoutId` + `guestToken` (invité).
2. Front : `POST .../payment/paytech` → `redirectUrl` + `paymentId`.
3. Client paie sur PayTech (Wave, OM, carte…).
4. PayTech → IPN `sale_complete` → commande en base (idempotent).
5. Front : page retour → poll `status` → `confirm` en secours.

## Erreurs `payment/paytech`

| `code` | Cause |
|--------|--------|
| `PAYMENT_INFO_INCOMPLETE` | `PAYTECH_*` manquantes |
| `PAYMENT_TIMEOUT` | PayTech refuse — lire `details.paytechMessage` |

Ex. compte non activé en prod : message PayTech demandant de contacter support@paytech.sn.

## Sécurité IPN

Vérification HMAC-SHA256 ou SHA256 des clés API. Réponse : `200` + `IPN OK`.
