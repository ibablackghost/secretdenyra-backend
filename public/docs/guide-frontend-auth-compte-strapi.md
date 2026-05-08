# Guide Frontend - Brancher Auth et Compte User avec Strapi

## Objectif

Ce document explique exactement comment brancher le frontend Nyra sur le vrai backend Strapi pour:

- inscription utilisateur;
- connexion utilisateur;
- session JWT;
- profil `/api/me`;
- adresses;
- wishlist;
- panier;
- checkout;
- commandes.

Le frontend ne doit plus utiliser un faux compte local pour l'auth. Le store local peut garder le token, mais la source de verite doit etre Strapi.

## 1. Variable d'environnement

Dans le frontend:

```env
VITE_STRAPI_URL=https://ton-backend-railway.up.railway.app
```

En local:

```env
VITE_STRAPI_URL=http://localhost:1337
```

Helper recommande:

```ts
export const STRAPI_URL = import.meta.env.VITE_STRAPI_URL;
```

Ne jamais hardcoder l'URL Railway dans les composants.

## 2. Important: ancien mode demo a retirer

Si la page login affiche encore:

```txt
Aucun compte avec cet e-mail.
```

sans appeler Strapi, alors le frontend utilise encore l'ancien `authStore` local.

Il faut remplacer cette logique par:

- `POST /api/auth/local/register` pour creer un compte;
- `POST /api/auth/local` pour se connecter;
- `GET /api/me` pour charger le profil applicatif Nyra.

## 3. Endpoints Strapi Auth

### Inscription

Endpoint:

```http
POST /api/auth/local/register
```

Body:

```json
{
  "username": "papibrahimdiagne2001",
  "email": "papibrahimdiagne2001@gmail.com",
  "password": "motdepasse"
}
```

Reponse Strapi:

```json
{
  "jwt": "token",
  "user": {
    "id": 1,
    "username": "papibrahimdiagne2001",
    "email": "papibrahimdiagne2001@gmail.com"
  }
}
```

Apres inscription:

1. stocker `jwt`;
2. stocker `user`;
3. appeler `PATCH /api/me` pour creer/completer le profil Nyra;
4. rediriger vers `/account` ou la page precedente.

### Connexion

Endpoint:

```http
POST /api/auth/local
```

Body:

```json
{
  "identifier": "papibrahimdiagne2001@gmail.com",
  "password": "motdepasse"
}
```

Reponse Strapi:

```json
{
  "jwt": "token",
  "user": {
    "id": 1,
    "username": "papibrahimdiagne2001",
    "email": "papibrahimdiagne2001@gmail.com"
  }
}
```

Apres connexion:

1. stocker `jwt`;
2. stocker `user`;
3. appeler `GET /api/me`;
4. stocker `profile`;
5. rediriger.

## 4. Headers pour endpoints prives

Tous les endpoints prives doivent envoyer:

```ts
headers: {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

Endpoints prives:

- `/api/me`
- `/api/me/addresses`
- `/api/me/orders`
- `/api/me/wishlist`
- `/api/cart`
- `/api/checkout`
- `/api/wishlist`

## 5. Client HTTP recommande

Créer ou adapter `src/app/services/api/httpClient.ts`.

```ts
const STRAPI_URL = import.meta.env.VITE_STRAPI_URL;

type RequestOptions = RequestInit & {
  token?: string | null;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, ...rest } = options;

  const response = await fetch(`${STRAPI_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw {
      status: response.status,
      code: data?.code ?? data?.error?.name ?? 'API_ERROR',
      message: data?.message ?? data?.error?.message ?? 'Erreur API.',
      details: data?.details ?? data?.error?.details,
    };
  }

  return data as T;
}
```

## 6. Auth API frontend

Créer ou adapter `src/app/services/api/authApi.ts`.

```ts
import { apiRequest } from './httpClient';

export type StrapiAuthResponse = {
  jwt: string;
  user: {
    id: number;
    username: string;
    email: string;
  };
};

export type MeProfile = {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export async function login(identifier: string, password: string) {
  return apiRequest<StrapiAuthResponse>('/api/auth/local', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
}

export async function register(input: {
  username: string;
  email: string;
  password: string;
}) {
  return apiRequest<StrapiAuthResponse>('/api/auth/local/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getMe(token: string) {
  return apiRequest<MeProfile>('/api/me', {
    method: 'GET',
    token,
  });
}

export async function updateMe(
  token: string,
  input: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  },
) {
  return apiRequest<MeProfile>('/api/me', {
    method: 'PATCH',
    token,
    body: JSON.stringify(input),
  });
}
```

## 7. Store auth attendu

Le store frontend doit contenir au minimum:

```ts
type AuthState = {
  token: string | null;
  user: {
    id: number;
    username: string;
    email: string;
  } | null;
  profile: {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    phone: string;
  } | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    username: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) => Promise<void>;
  loadMe: () => Promise<void>;
  logout: () => void;
};
```

Regles:

- `isAuthenticated = Boolean(token)`.
- Le token peut etre persiste via Zustand persist/localStorage.
- `logout()` doit supprimer token, user, profile.
- Si `GET /api/me` renvoie `401`, faire logout.

## 8. Exemple logique login

```ts
async function loginAction(email: string, password: string) {
  const auth = await authApi.login(email, password);

  set({
    token: auth.jwt,
    user: auth.user,
    isAuthenticated: true,
  });

  const profile = await authApi.getMe(auth.jwt);

  set({
    profile,
  });
}
```

## 9. Exemple logique register

```ts
async function registerAction(input) {
  const auth = await authApi.register({
    username: input.email.split('@')[0],
    email: input.email,
    password: input.password,
  });

  set({
    token: auth.jwt,
    user: auth.user,
    isAuthenticated: true,
  });

  const profile = await authApi.updateMe(auth.jwt, {
    firstName: input.firstName ?? '',
    lastName: input.lastName ?? '',
    phone: input.phone ?? '',
  });

  set({
    profile,
  });
}
```

## 10. UI Login

La page login doit:

1. prendre email/password;
2. appeler `authStore.login(email, password)`;
3. afficher les erreurs backend;
4. rediriger si success.

Mapping erreur:

- `400`: identifiants invalides ou validation.
- `ApplicationError`: souvent mauvais identifiants Strapi.
- `UNAUTHORIZED`: token absent ou invalide.

Message UX conseille:

```txt
Email ou mot de passe incorrect.
```

Ne plus afficher:

```txt
Aucun compte avec cet e-mail.
```

sauf si cette erreur vient vraiment du backend.

## 11. UI Register

La page register doit:

1. prendre email/password + infos profil si disponibles;
2. appeler `authStore.register(...)`;
3. stocker JWT;
4. appeler `PATCH /api/me`;
5. rediriger vers `/account`.

Attention:

- Strapi exige `username`, `email`, `password`.
- Si le frontend n'a pas de champ username, generer `username` depuis l'email.

## 12. Protection des routes

`RequireAuth` doit verifier:

```ts
if (!authStore.token) {
  return <Navigate to="/login" replace />;
}
```

Option recommande:

- Au chargement app, appeler `loadMe()` si token existe.
- Si token expire ou invalide, logout.

## 13. Endpoints Compte

### Profil

```http
GET /api/me
PATCH /api/me
```

### Adresses

```http
GET /api/me/addresses
POST /api/me/addresses
PUT /api/me/addresses/:addressId
PATCH /api/me/addresses/:addressId
DELETE /api/me/addresses/:addressId
POST /api/me/addresses/:addressId/default
```

Address body:

```json
{
  "label": "Maison",
  "line1": "Dakar Plateau",
  "line2": "",
  "city": "Dakar",
  "region": "",
  "postalCode": "",
  "country": "Sénégal",
  "isDefault": true
}
```

### Commandes

```http
GET /api/me/orders?page=1&pageSize=10
GET /api/me/orders/:orderId
```

### Wishlist

```http
GET /api/me/wishlist
POST /api/me/wishlist/items
DELETE /api/me/wishlist/items/:productId
```

Body ajout wishlist:

```json
{
  "productId": "slug-ou-documentId"
}
```

### Produits consultes

```http
GET /api/me/viewed-products
POST /api/me/viewed-products
```

Body:

```json
{
  "productId": "slug-ou-documentId"
}
```

## 14. Panier avec utilisateur connecte

Endpoints:

```http
GET /api/cart
POST /api/cart/items
PATCH /api/cart/items/:itemId
DELETE /api/cart/items/:itemId
```

Body ajout:

```json
{
  "productId": "slug-ou-documentId",
  "variantId": "sku-ou-documentId",
  "quantity": 1
}
```

Important:

- Le backend verifie le stock.
- Le backend calcule le prix.
- Le front ne doit pas calculer le total final comme source de verite.

## 15. Checkout avec utilisateur connecte

Endpoints:

```http
POST /api/checkout/init
PATCH /api/checkout/:checkoutId
GET /api/checkout/:checkoutId/summary
POST /api/checkout/:checkoutId/payment-intent
POST /api/checkout/:checkoutId/confirm
```

`POST /api/checkout/init` peut recevoir:

```json
{
  "customer": {
    "firstName": "Pape",
    "lastName": "Diagne",
    "email": "papibrahimdiagne2001@gmail.com",
    "phone": "+221..."
  },
  "shippingAddress": {
    "line1": "Dakar",
    "line2": "",
    "city": "Dakar",
    "region": "",
    "postalCode": "",
    "country": "Sénégal"
  },
  "billingAddress": {
    "line1": "Dakar",
    "line2": "",
    "city": "Dakar",
    "region": "",
    "postalCode": "",
    "country": "Sénégal"
  },
  "billingSameAsShipping": true,
  "items": [
    {
      "productId": "infusion-sommeil",
      "quantity": 1
    }
  ]
}
```

Reponse:

```json
{
  "checkoutId": "chk_xxx",
  "checkout_session_id": "chk_xxx",
  "items": [],
  "subtotal": 0,
  "shippingFee": 0,
  "discounts": [],
  "total": 0,
  "currency": "XOF",
  "status": "draft"
}
```

## 16. Tests rapides a faire cote front

### Test 1: inscription

1. Aller sur creer un compte.
2. Creer compte.
3. Verifier dans Strapi Admin > Users.
4. Verifier que le front stocke un JWT.
5. Verifier que `/account` charge.

### Test 2: connexion

1. Se deconnecter.
2. Se reconnecter.
3. Verifier `GET /api/me`.

### Test 3: wishlist

1. Aller fiche produit.
2. Ajouter wishlist.
3. Aller `/wishlist`.
4. Refresh page.
5. Verifier persistence backend.

### Test 4: panier

1. Ajouter produit au panier.
2. Changer quantite.
3. Refresh.
4. Verifier persistence backend.

### Test 5: checkout

1. Init checkout.
2. Verifier `checkout_session_id`.
3. Verifier `total` backend.

## 17. Erreurs courantes

### 403 Forbidden

Ca veut dire:

- role Strapi pas encore mis a jour;
- backend pas redemarre apres bootstrap;
- route pas autorisee.

Solution:

- redemarrer Strapi;
- verifier Users & Permissions dans Strapi Admin;
- verifier role `Authenticated`.

### 401 Unauthorized

Ca veut dire:

- token absent;
- token invalide;
- mauvais header Authorization.

Verifier:

```ts
Authorization: `Bearer ${token}`
```

### Aucun compte avec cet e-mail

Si ce message vient instantanement sans requete reseau:

- c'est encore l'ancien store local.

Solution:

- remplacer login local par `POST /api/auth/local`.

### Produit introuvable dans panier

Ca veut dire:

- `productId` incorrect;
- produit non publie;
- pas de variante active.

Verifier dans Strapi:

- produit publie;
- slug correct;
- au moins une variante active;
- variante avec `sku`;
- stock > 0.

## 18. Donnees obligatoires dans Strapi pour tester

Pour chaque produit:

- `name`
- `slug`
- `ingredients`
- `price`
- `image`
- `category`
- au moins une `Variant`

Pour chaque variant:

- `name`
- `sku`
- `format`
- `stock`
- `isActive = true`
- `isDefault = true` recommande

Pour chaque category:

- `name`
- `slug`

## 19. Checklist integration front

- [ ] `VITE_STRAPI_URL` configure.
- [ ] Login utilise `POST /api/auth/local`.
- [ ] Register utilise `POST /api/auth/local/register`.
- [ ] Token JWT stocke.
- [ ] `GET /api/me` appele apres login.
- [ ] `PATCH /api/me` appele apres register si infos profil.
- [ ] `Authorization: Bearer token` envoye sur endpoints prives.
- [ ] Ancienne logique demo/local retiree.
- [ ] `RequireAuth` base sur token.
- [ ] Panier branche sur `/api/cart`.
- [ ] Wishlist branchee sur `/api/me/wishlist` ou `/api/wishlist`.
- [ ] Checkout branche sur `/api/checkout/init`.
- [ ] Gestion erreurs backend affichee en toast/form.

## 20. Ordre de branchement conseille

1. Auth login/register.
2. `GET /api/me`.
3. Page account.
4. Adresses.
5. Wishlist.
6. Panier.
7. Checkout init.
8. Payment intent mock.
9. Confirm checkout.

Quand les points 1 a 3 marchent, le reste devient beaucoup plus simple.
