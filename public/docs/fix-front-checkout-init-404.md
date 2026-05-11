# Fix front - Erreur 404 sur `/api/checkout/init`

## Probleme

Le frontend affiche:

```txt
Erreur paiement
Erreur HTTP 404 sur /api/checkout/init
```

La route backend existe bien, mais elle doit etre appelee correctement.

---

## Endpoint correct

Le front doit appeler:

```http
POST /api/checkout/init
```

Pas:

```http
GET /api/checkout/init
```

---

## Headers obligatoires

L'utilisateur doit etre connecte.

```ts
Authorization: `Bearer ${token}`
Content-Type: 'application/json'
```

Sans token, le backend renverra une erreur d'authentification.

---

## Body attendu

```ts
await apiRequest('/api/checkout/init', {
  method: 'POST',
  token,
  body: JSON.stringify({
    customer: {
      firstName,
      lastName,
      email,
      phone,
    },
    shippingAddress: {
      line1,
      city,
      country,
      region,
      postalCode,
    },
    billingSameAsShipping: true,
    items: cartItems.map((item) => ({
      productId: item.product.id ?? item.product.slug,
      quantity: item.quantity,
    })),
  }),
});
```

---

## Point le plus important

Les produits envoyes dans `items` doivent venir du backend Strapi.

Ne pas envoyer:

```json
{
  "productId": "local-product-1"
}
```

Envoyer plutot:

```json
{
  "productId": "slug-produit-backend"
}
```

ou:

```json
{
  "productId": "documentId-produit-strapi"
}
```

Le backend accepte:

- `product.documentId`;
- `product.slug`;
- `id` numerique Strapi.

Mais le mieux cote frontend est:

```ts
product.id ?? product.slug
```

avec un produit charge depuis l'API catalogue.

---

## Exemple service checkout

Dans `checkoutApi.ts`:

```ts
export async function initCheckout(token: string, payload: InitCheckoutPayload) {
  return apiRequest('/api/checkout/init', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}
```

---

## Exemple d'appel depuis la page paiement

```ts
const payload = {
  customer: {
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone,
  },
  shippingAddress: {
    line1: form.address,
    city: form.city,
    country: form.country,
    region: form.region ?? '',
    postalCode: form.postalCode ?? '',
  },
  billingSameAsShipping: true,
  items: cart.items.map((item) => ({
    productId: item.product.id ?? item.product.slug,
    quantity: item.quantity,
  })),
};

const checkout = await checkoutApi.initCheckout(token, payload);
```

---

## Si l'erreur continue

Regarder le body de la reponse.

### Cas 1

```json
{
  "code": "PRODUCT_NOT_FOUND"
}
```

Cause:

- le front envoie un mauvais `productId`;
- le panier contient encore un ancien produit local;
- le produit n'existe pas sur Strapi/Railway.

Solution:

- vider l'ancien panier local;
- recharger les produits depuis `/api/catalog/products`;
- reconstruire le panier avec les vrais produits backend.

### Cas 2

```txt
Not Found
```

Cause probable:

- mauvais verbe HTTP;
- backend Railway pas redeploye avec la derniere version;
- URL API incorrecte.

Solution:

- verifier que c'est bien `POST`;
- verifier `VITE_STRAPI_URL`;
- redeployer le backend Railway.

---

## Checklist front

- [ ] `VITE_STRAPI_URL=https://secretdenyra-backend-production.up.railway.app`
- [ ] Appel en `POST /api/checkout/init`
- [ ] Token envoye dans `Authorization`
- [ ] Body JSON complet
- [ ] `items[].productId` vient du backend
- [ ] Ancien panier local nettoye
- [ ] Produits charges depuis Strapi, pas depuis un fichier local
- [ ] Apres checkout confirme, recharger panier + commandes + produits achetes
