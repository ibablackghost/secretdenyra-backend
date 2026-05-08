# Jour 5 - Alignement Frontend -> Backend (Panier/Wishlist + actions critiques)

Objectif: aligner le backend avec les besoins front pour un tunnel panier/wishlist fluide et coherent.

## 1) Ce que le frontend fait deja

- Panier:
  - quantite +/-
  - suppression item
  - recalcul sous-total / livraison / total
  - seuil livraison gratuite: 45 000 XOF
- Wishlist:
  - toggle add/remove
  - compteur + etat UI synchronise
- UX:
  - toasts sur actions critiques (ajout panier, retrait panier, toggle wishlist)

## 2) Endpoints backend attendus (phase branchement API)

### Panier
- `GET /api/cart`
  - retourne les items panier utilisateur courant
- `POST /api/cart/items`
  - body: `{ productId, quantity }`
  - ajoute un item ou incremente
- `PATCH /api/cart/items/:itemId`
  - body: `{ quantity }`
  - met a jour quantite
- `DELETE /api/cart/items/:itemId`
  - supprime item

### Wishlist
- `GET /api/wishlist`
- `POST /api/wishlist/items`
  - body: `{ productId }`
- `DELETE /api/wishlist/items/:productId`

## 3) Contrat calcule panier (recommande)

Le backend devrait renvoyer les montants deja calcules pour eviter ecarts front/back:

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

## 4) Regles metier a confirmer backend

- quantite max par ligne (anti abus)
- comportement si stock insuffisant
- suppression auto si quantite passe a 0
- strategie de concurrence (2 sessions user)

## 5) Erreurs metier attendues (pour toasts front coherents)

Format recommande:

```json
{
  "code": "OUT_OF_STOCK",
  "message": "Stock insuffisant pour cette variante."
}
```

Codes minimum:
- `OUT_OF_STOCK`
- `PRODUCT_NOT_FOUND`
- `INVALID_QUANTITY`
- `UNAUTHORIZED`

## 6) Priorite backend Jour 5

1. Exposer API Wishlist CRUD.
2. Exposer API Cart CRUD + totaux calcules.
3. Garantir validation stock/quantite cote serveur.
4. Uniformiser format erreur metier (code + message).
