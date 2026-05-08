# Nyra Frontend — Backend Source de Verite

## Objectif du document

Ce document decrit la transition du frontend vers un fonctionnement ou le backend Strapi est l'unique source de verite metier.

La cible finale est detaillee dans:

- `guide-frontend-backend-only.md`
- `source-de-verite-backend-final.md`

Il sert de reference pour:

- equipe frontend (suppression des donnees locales metier, appels API, synchro);
- equipe backend (contrats API attendus);
- QA (verification coherence des donnees).

---

## 1) Regle generale

- **Source de verite metier**: backend Strapi uniquement.
- **Local frontend**: UI temporaire, token auth et cache de requetes uniquement.

En pratique:

- les fichiers locaux de produits, panier, wishlist, commandes, adresses et compte doivent etre retires;
- les pages doivent consommer les endpoints backend;
- apres login, le frontend rehydrate les stores depuis Strapi;
- apres mutation, le frontend remplace son etat par la reponse backend ou relance un `GET`.

---

## 2) Inventaire des anciens usages locaux a retirer

## 2.1 Auth (`nyra-auth`)

Peut rester local uniquement:

- `token` (JWT)
- `isLoadingMe`

Doit venir du backend:

- `user`
- profil courant
- donnees compte

Attendu backend:

- auth reelle via Strapi (`/api/auth/local`, `/api/auth/local/register`)
- profil via `/api/me`

Remarque:

- local ne doit pas etre considere source de verite profil;
- `loadMe()` au demarrage sert a revalider/rehydrater depuis backend.

---

## 2.2 Panier (`nyra-cart`)

Ancien stockage local a supprimer:

- `items[]` (`productId`, `quantity`, `itemId?`)

Comportement cible:

- mutation via backend uniquement
- store remplace par la reponse backend
- pas de panier persistant en localStorage

Attendu backend:

- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/:itemId`
- `DELETE /api/cart/items/:itemId`

Champs critiques attendus:

- `productId` stable
- `quantity`
- `itemId` (important pour update/delete)

---

## 2.3 Wishlist (`nyra-wishlist`)

Ancien stockage local a supprimer:

- `ids[]` (ids/slug wishlist connus front)
- `count`

Comportement cible:

- `toggle/remove` appellent le backend
- `loadWishlist()` recharge la verite backend
- pas de wishlist persistante en localStorage

Attendu backend (espace connecte):

- `GET /api/me/wishlist`
- `POST /api/me/wishlist/items`
- `DELETE /api/me/wishlist/items/:productId`

Formats backend supportes par le front:

- `items[]`
- `products[]`
- `productIds[]`
- `count`

Le frontend normalise en:

- `productIds` deduits de `items/products/productIds`
- `count` backend

---

## 2.4 Draft checkout (`nyra-checkout-draft`)

Peut rester local temporairement avant creation checkout:

- `customer`
- `shipping`
- `billing`
- `billingSameAsShipping`

Role autorise:

- brouillon UX multi-etapes
- pas une source metier finale
- apres `POST /api/checkout/init`, le backend devient source unique

Attendu backend (source verite checkout):

- `POST /api/checkout/init`
- `PATCH /api/checkout/:checkoutId`
- `GET /api/checkout/:checkoutId/summary`
- `POST /api/checkout/:checkoutId/payment-intent`
- `POST /api/checkout/:checkoutId/confirm`

Champs critiques:

- `checkout_session_id`
- montants recalcules serveur (`subtotal`, `shippingFee`, `total`, `currency`)

---

## 2.5 Adresses (`nyra-addresses`)

Ancien stockage local a supprimer:

- `addresses[]`

Comportement cible:

- CRUD via backend uniquement
- recharger `/api/me/addresses` apres operation

Attendu backend:

- `GET /api/me/addresses`
- `POST /api/me/addresses`
- `PATCH /api/me/addresses/:id`
- `DELETE /api/me/addresses/:id`
- `POST /api/me/addresses/:id/default`

Formats backend supportes (lecture):

- `items[]` ou `addresses[]`

---

## 2.6 Commandes (`nyra-orders`)

Ancien stockage local a supprimer:

- `orders[]`

Comportement cible:

- lecture backend via hydrate
- aucune commande creee localement

Attendu backend:

- `GET /api/me/orders?page=1&pageSize=20`
- (eventuellement `GET /api/me/orders/:id` pour detail)

Formats backend supportes (lecture):

- `items[]` ou `orders[]`

Securite front appliquee:

- normalisation defensive en tableau pour eviter crash (`reduce/map/filter` sur undefined).

---

## 2.7 Produits vus (`nyra-viewed-products`)

Ancien stockage local a supprimer:

- `ids[]` (historique recent, max 24)

Comportement cible:

- push backend si connecte
- lecture backend pour la page compte

Attendu backend:

- `GET /api/me/viewed-products`
- `POST /api/me/viewed-products`

Formats backend supportes (lecture):

- `items[]` ou `products[]`

---

## 2.8 Toast UI (`toastStore`)

Peut rester localement:

- file de notifications UI

Attendu backend:

- rien (strictement presentation UX)

---

## 3) Donnees non-stockees en local comme source metier

## Catalogue

Le catalogue est charge via API (services hooks), pas considere source metier locale.

Attendu backend:

- endpoint catalogue robuste + pagination + filtres + tri
- ids/slug produits stables

## SEO

- metas calculees front selon routes/produits
- source semantique (slug, title, etc.) attendue du backend/CMS

## Analytics

- emission events cote front (GA4/PostHog)
- backend attendu pour correlation forte (checkout_session_id, purchase serveur)

---

## 4) Ce que le frontend attend explicitement du backend (contrats)

## Auth / Profil

- `POST /api/auth/local`
- `POST /api/auth/local/register`
- `GET /api/me`
- `PATCH /api/me`

Attendus:

- JWT valide
- objet user/profil coherent
- erreurs structurees (`code`, `message`, `details`)

## Wishlist

- endpoints `/api/me/wishlist*`
- reponse contenant au moins une de ces structures:
  - `items[]` (avec `productId` ou `product.id/slug`)
  - `products[]`
  - `productIds[]`
  - `count`

## Cart

- `GET/POST/PATCH/DELETE /api/cart*`
- inclure `itemId` pour mutation fiable

## Checkout

- session checkout serveur et montants recalcules
- erreurs paiement explicites (`declined`, `timeout`, etc.)

## Account

- commandes: `items[]` ou `orders[]`
- produits achetes: `items[]`, `products[]`, `productIds[]`, `count`
- adresses: `items[]` ou `addresses[]`
- produits vus: `items[]` ou `products[]`

---

## 5) Politique backend-only finale

Quand backend indisponible / token absent / endpoint en echec:

- le front affiche un empty state, un loader ou une erreur lisible;
- le front ne cree pas de verite metier locale alternative;
- les erreurs critiques ne doivent plus etre masquees silencieusement.

Objectif: aucune divergence durable entre local et backend.

---

## 6) Risques de divergence (a connaitre)

1. Ancien code local encore utilise par erreur.
2. Formats backend variables selon endpoints/environnements.
3. Utilisation mix id/slug si contrat backend pas strict.
4. Refresh entre mutation locale et rehydrate serveur.

Mitigations deja appliquees:

- suppression des donnees locales metier;
- hydrations apres login et apres mutations critiques;
- normalisation defensive des reponses;
- `isWishlisted` robuste sur `id` et `slug`.

---

## 7) Verrouillage backend final

Le verrouillage backend est formalise dans:

- `source-de-verite-backend-final.md`

Points couverts:

1. Payloads critiques normalises avec alias stables (`items`, `count`, `productIds` selon domaine).
2. IDs stables exposes pour produits, wishlist, panier, commandes et adresses.
3. `checkout_session_id` fourni pendant tout le checkout.
4. Event serveur `purchase` cree lors de la confirmation de paiement.
5. Erreurs API homogenes avec `code`, `message`, `details` optionnel et `requestId`.

---

## 8) Recommandation finale d'architecture

- backend source de verite stricte;
- local = UI temporaire, token et cache de requetes uniquement;
- contrat API versionne et stable;
- observabilite des ecarts sync (logs/metrics).

---

## 9) Checklist QA (local vs backend)

- [ ] Login -> `loadMe` ok -> compte affiche backend
- [ ] Wishlist add/remove coherent sur Product/Shop/Wishlist/Account/Header
- [ ] Refresh page: wishlist/panier restent coherents
- [ ] Logout: donnees sensibles nettoyees
- [ ] Account sans commandes: aucun crash, `totalSpent` = 0
- [ ] Checkout utilise montants backend (quand endpoints reels branches)
- [ ] Erreurs backend affichees proprement en UI

---

## Resume executif

Le frontend utilise encore des stores locaux pour la resilience UX, mais il est maintenant structure pour se synchroniser avec le backend sur les domaines critiques (auth, wishlist, cart, account).

Pour atteindre une coherence totale, le backend doit fournir des payloads stricts et stables sur tous les endpoints metier.
