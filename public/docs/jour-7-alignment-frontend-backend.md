# Jour 7 - Alignement Backend (Checkout etape 3 + paiement)

Le frontend dispose maintenant d'une etape 3:
- recap commande,
- choix methode paiement (UI pre-Stripe),
- affichage explicite des erreurs paiement (refuse, timeout, infos incompletes).

## 1) Ce que le frontend attend du backend a l'etape paiement

### Endpoint creation paiement
- `POST /api/checkout/:checkoutId/payment-intent`
- Input:
```json
{
  "paymentMethod": "card",
  "currency": "XOF"
}
```
- Output:
```json
{
  "provider": "stripe",
  "paymentIntentId": "pi_xxx",
  "clientSecret": "pi_xxx_secret_xxx",
  "status": "requires_payment_method"
}
```

### Endpoint confirmation paiement
- `POST /api/checkout/:checkoutId/confirm`
- Input:
```json
{
  "paymentIntentId": "pi_xxx"
}
```
- Output:
```json
{
  "orderId": "ord_xxx",
  "status": "paid"
}
```

## 2) Contrat d'erreurs metier (obligatoire pour UX)

Format:
```json
{
  "code": "PAYMENT_DECLINED",
  "message": "Paiement refusé."
}
```

Codes minimum a gerer:
- `PAYMENT_DECLINED`
- `PAYMENT_TIMEOUT`
- `PAYMENT_INFO_INCOMPLETE`
- `CHECKOUT_EXPIRED`
- `CART_CHANGED`
- `OUT_OF_STOCK`

## 3) Cohérence montant et securite

Le backend doit recalculer avant confirmation:
- sous-total,
- frais livraison,
- total final.

Le frontend affiche un recap, mais le backend reste source de verite.

## 4) Webhooks (prochaine etape backend)

Prevoir webhook provider paiement:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

Mise a jour commande:
- `pending` -> `paid` / `failed` / `refunded`.
