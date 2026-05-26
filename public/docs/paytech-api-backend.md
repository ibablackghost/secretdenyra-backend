# Intégration PayTech — Backend Nyra (implémenté)

Voir aussi la spec projet : `paytech-api-backend.md` à la racine du monorepo.

## Routes exposées

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `POST` | `/api/checkout/:checkoutId/payment/paytech` | JWT | Initie un paiement PayTech |
| `POST` | `/api/checkout/:checkoutId/confirm` | JWT | Body `{ "paymentMethod": "paytech", "paymentId": "..." }` |
| `GET` | `/api/payments/:paymentId/status` | JWT | Statut d’un paiement |
| `GET` | `/api/me/payments/pending` | JWT | Paiements en attente (bandeau compte) |
| `POST` | `/api/webhooks/paytech/ipn` | Public | Webhook PayTech (IPN) |

## Variables d’environnement

```env
PAYTECH_API_KEY=
PAYTECH_API_SECRET=
PAYTECH_BASE_URL=https://paytech.sn/api
PAYTECH_ENV=test
PAYTECH_IPN_URL=https://api.nyra.sn/api/webhooks/paytech/ipn
PAYTECH_SUCCESS_URL=https://nyra.sn/checkout/payment/return?result=success
PAYTECH_CANCEL_URL=https://nyra.sn/checkout/payment/return?result=cancel
```

## Flux

1. Le front appelle `POST .../payment/paytech` → reçoit `redirectUrl` + `paymentId`.
2. Redirection client vers PayTech (Wave, Orange Money, carte, etc.).
3. PayTech envoie l’IPN `sale_complete` → commande créée côté backend (idempotent).
4. Le front peut appeler `confirm` avec `paymentMethod: "paytech"` en secours, ou poller `GET .../status`.

## Sécurité IPN

Vérification HMAC-SHA256 (`final_item_price|ref_command|api_key`) ou SHA256 des clés API.

Réponse attendue : `200` + corps `IPN OK`.
