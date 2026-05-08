# Jour 8 - Alignement Backend (Espace compte utilisateur)

Le frontend inclut maintenant un espace compte exploitable avec:
- dashboard (resume commandes, adresses, wishlist, depenses),
- historique commandes (liste + detail),
- gestion adresses CRUD avec validation,
- produits cliques recemment,
- wishlist client.

## 1) Endpoints backend attendus

### Profil
- `GET /api/me`
- `PATCH /api/me`

### Adresses (CRUD)
- `GET /api/me/addresses`
- `POST /api/me/addresses`
- `PATCH /api/me/addresses/:addressId`
- `DELETE /api/me/addresses/:addressId`
- `POST /api/me/addresses/:addressId/default`

### Commandes
- `GET /api/me/orders?page=1&pageSize=10`
- `GET /api/me/orders/:orderId`

### Wishlist
- `GET /api/me/wishlist`
- `POST /api/me/wishlist/items`
- `DELETE /api/me/wishlist/items/:productId`

### Produits consultes
- `GET /api/me/viewed-products`
- `POST /api/me/viewed-products` (body: `{ productId }`)

## 2) Contrats de donnees minimaux

### Order summary
```json
{
  "id": "ORD-123456",
  "createdAt": "2026-05-07T18:00:00.000Z",
  "status": "paid",
  "total": 25000
}
```

### Order detail
```json
{
  "id": "ORD-123456",
  "status": "paid",
  "paymentMethod": "card",
  "items": [],
  "subtotal": 0,
  "shippingFee": 0,
  "total": 0,
  "shippingAddress": {},
  "billingAddress": {}
}
```

### Address
```json
{
  "id": "addr_xxx",
  "label": "Maison",
  "line1": "Dakar Plateau...",
  "line2": "",
  "city": "Dakar",
  "region": "",
  "postalCode": "",
  "country": "Sénégal",
  "isDefault": true
}
```

## 3) Validations backend attendues (adresses)

- `label`, `line1`, `city`, `country` obligatoires
- une seule adresse par defaut par utilisateur
- blocage suppression de la seule adresse restante si regle metier imposee

## 4) Erreurs metier (format recommande)

```json
{
  "code": "ADDRESS_INVALID",
  "message": "Ville obligatoire."
}
```

Codes utiles:
- `ADDRESS_INVALID`
- `ADDRESS_NOT_FOUND`
- `ORDER_NOT_FOUND`
- `UNAUTHORIZED`
