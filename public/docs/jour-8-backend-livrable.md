# Jour 8 - Livrable Backend

## Objectif

Brancher l'espace compte utilisateur: profil, adresses, commandes, wishlist et produits recemment consultes.

## Modeles ajoutes

### UserProfile

Profil client separe du plugin `users-permissions`:

- `firstName`
- `lastName`
- `phone`
- `user`

### Address

Adresse client persistante:

- `label`
- `line1`
- `line2`
- `city`
- `region`
- `postalCode`
- `country`
- `isDefault`
- `user`

### ViewedProduct

Historique de consultation:

- `viewedAt`
- `user`
- `product`

## Endpoints profil

- `GET /api/me`
- `PATCH /api/me`

Payload profil:

```json
{
  "email": "client@nyra.sn",
  "username": "client",
  "firstName": "Awa",
  "lastName": "Diop",
  "phone": "+221..."
}
```

## Endpoints adresses

- `GET /api/me/addresses`
- `POST /api/me/addresses`
- `PATCH /api/me/addresses/:addressId`
- `DELETE /api/me/addresses/:addressId`
- `POST /api/me/addresses/:addressId/default`

Regles:

- `label`, `line1`, `city`, `country` obligatoires.
- La premiere adresse creee devient automatiquement adresse par defaut.
- Une seule adresse par defaut par utilisateur.
- `addressId` accepte `documentId` ou `id` numerique.

Erreur adresse:

```json
{
  "code": "ADDRESS_INVALID",
  "message": "Ville obligatoire."
}
```

## Endpoints commandes

- `GET /api/me/orders?page=1&pageSize=10`
- `GET /api/me/orders/:orderId`

Liste:

```json
{
  "orders": [
    {
      "id": "ord_123",
      "technicalId": "document-id",
      "createdAt": "2026-05-07T18:00:00.000Z",
      "status": "paid",
      "total": 25000
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 1,
    "pageCount": 1
  }
}
```

Detail:

```json
{
  "order": {
    "id": "ord_123",
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

## Endpoints wishlist compte

Aliases compte:

- `GET /api/me/wishlist`
- `POST /api/me/wishlist/items`
- `DELETE /api/me/wishlist/items/:productId`

Ces routes reutilisent la meme collection `WishlistItem` que `/api/wishlist`.

## Endpoints produits consultes

- `GET /api/me/viewed-products`
- `POST /api/me/viewed-products`

`POST` accepte:

```json
{
  "productId": "slug-or-documentId"
}
```

Si le produit a deja ete consulte, `viewedAt` est mis a jour au lieu de dupliquer la ligne.

## Securite

- Tous les endpoints `/api/me/*` exigent un utilisateur authentifie.
- Chaque requete filtre par `ctx.state.user.id`.
- Les ressources d'un utilisateur ne peuvent pas etre lues/modifiees par un autre utilisateur.

## Permissions et index

Le bootstrap active les actions du controller `me` pour le role `authenticated`.

Index PostgreSQL etendus aux colonnes utiles:

- `user_id`
- `is_default`
- `viewed_at`
- `city`
- `country`
- colonnes commande deja existantes: `status`, `order_number`, `checkout_id`.

## Codes erreurs principaux

- `UNAUTHORIZED`
- `ADDRESS_INVALID`
- `ADDRESS_NOT_FOUND`
- `ORDER_NOT_FOUND`
- `PRODUCT_NOT_FOUND`
