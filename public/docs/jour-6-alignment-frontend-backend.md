# Jour 6 - Alignement Backend (Checkout etapes 1 et 2)

Le frontend a maintenant un checkout multi-etapes:
- Etape 1: informations client + validation
- Etape 2: adresse livraison/facturation + validation
- Persistance locale temporaire du brouillon checkout (`nyra-checkout-draft`)

## 1) Donnees que le frontend collecte

### Customer
- `firstName`
- `lastName`
- `email`
- `phone`

### Shipping address
- `line1`
- `line2` (optionnel)
- `city`
- `region` (optionnel)
- `postalCode` (optionnel)
- `country`

### Billing address
- meme schema que shipping
- flag: `billingSameAsShipping`

## 2) Endpoints backend a preparer maintenant

### Initialisation checkout
- `POST /api/checkout/init`
- Input:
```json
{
  "customer": {},
  "shippingAddress": {},
  "billingAddress": {},
  "billingSameAsShipping": true
}
```
- Output:
```json
{
  "checkoutId": "chk_xxx",
  "status": "draft",
  "expiresAt": "2026-05-08T00:00:00.000Z"
}
```

### Mise a jour brouillon checkout
- `PATCH /api/checkout/:checkoutId`
- Permet de modifier customer/shipping/billing avant paiement

### Lecture recap checkout
- `GET /api/checkout/:checkoutId`
- Doit renvoyer:
  - lignes panier,
  - sous-total,
  - frais livraison,
  - total,
  - devise.

## 3) Validations backend attendues

- email valide
- champs obligatoires non vides
- coherence billing/shipping selon `billingSameAsShipping`
- stock encore disponible au moment de l'init checkout
- quantite panier valide

## 4) Codes erreurs metier proposes

- `INVALID_CUSTOMER_INFO`
- `INVALID_SHIPPING_ADDRESS`
- `INVALID_BILLING_ADDRESS`
- `CART_EMPTY`
- `OUT_OF_STOCK`
- `CHECKOUT_EXPIRED`

Format:
```json
{
  "code": "INVALID_SHIPPING_ADDRESS",
  "message": "Adresse de livraison incomplète."
}
```

## 5) Point d'attention

Le front persiste temporairement en local pour UX, mais la source de verite finale devra etre le checkout draft backend des que disponible.
