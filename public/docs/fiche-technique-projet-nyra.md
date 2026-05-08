# Fiche Technique Complete - Projet Nyra

## 1. Vision Generale

Nyra est une plateforme e-commerce orientee catalogue, panier, checkout, paiement, compte client, SEO et analytics de conversion.

Le projet est compose de deux grands blocs:

- Frontend e-commerce: interface client, catalogue, fiche produit, panier, wishlist, checkout, compte utilisateur, SEO dynamique et analytics.
- Backend Strapi: source de verite catalogue, utilisateurs, panier, checkout, commandes, paiement, analytics, SEO, healthcheck et contrats API.

Le backend actuel est une application Strapi 5 avec PostgreSQL obligatoire. Il fournit les APIs necessaires a une Release Candidate frontend.

## 2. Stack Technique Backend

Application:

- Strapi `5.44.0`
- TypeScript
- Node.js `>=20 <=24`
- PostgreSQL via `pg`
- Plugin `users-permissions`
- Strapi Admin pour l'edition des contenus

Base de donnees:

- PostgreSQL obligatoire.
- Configuration par `DATABASE_URL` ou variables separees:
  - `DATABASE_HOST`
  - `DATABASE_NAME`
  - `DATABASE_USERNAME`
  - `DATABASE_PASSWORD`
  - `DATABASE_PORT`
  - `DATABASE_SSL`
  - `DATABASE_SCHEMA`

Scripts principaux:

- `npm run dev` ou `npm run develop`: lance Strapi en developpement.
- `npm run build`: build Strapi.
- `npm run start`: lance Strapi en mode production.
- `npm run openapi:generate`: genere le fichier OpenAPI dans `public/swagger-spec.json`.

## 3. Architecture Backend

Le backend est organise par domaines Strapi:

- `product`: catalogue produit, listing, detail, SEO, produits similaires.
- `category`: categories catalogue + detail par slug.
- `tag`: tags/familles de produits.
- `variant`: variantes vendables, stock, prix par format/couleur.
- `cart`: endpoints panier custom.
- `cart-item`: lignes panier persistantes.
- `wishlist-item`: wishlist utilisateur.
- `checkout`: checkout draft, paiement, confirmation.
- `order`: commandes utilisateur.
- `order-item`: snapshots commerciaux de commande.
- `me`: espace compte utilisateur.
- `address`: adresses persistantes.
- `user-profile`: profil client complementaire.
- `viewed-product`: produits recemment consultes.
- `analytics`: config analytics, collecte events, funnel KPIs.
- `analytics-event`: stockage des events first-party.
- `seo`: sitemap et robots.
- `health`: healthcheck.
- `home`: contenus editoriaux page accueil.

## 4. Middlewares Globaux

Middlewares Strapi natifs:

- logger
- errors
- security
- cors
- poweredBy
- query
- body
- session
- favicon
- public

Middlewares custom:

- `nyra-request-context`: ajoute `X-Request-Id`, `X-Response-Time` et logs correlables.
- `nyra-errors`: normalise les erreurs API avec `code`, `message`, `requestId`.
- `nyra-cache-control`: applique les headers cache selon les routes.

Regles cache:

- Catalogue: cache court public.
- Produit detail: cache public un peu plus long.
- Categorie detail: cache public.
- Sitemap/robots: cache public.
- Uploads: cache long immutable.
- Compte, panier, checkout: `no-store`.

## 5. Securite de Base Deja En Place

Securite actuelle:

- CORS limite aux origines frontend connues.
- CSP Strapi configuree.
- PostgreSQL obligatoire.
- Authentification via plugin `users-permissions`.
- Filtrage utilisateur explicite sur les ressources sensibles:
  - panier
  - checkout
  - commandes
  - adresses
  - wishlist
  - profil
  - produits consultes
- Erreurs metier structurees.
- Healthcheck public limite.
- Endpoints publics separes des endpoints authenticated.

## 6. Roles et Permissions

Role public:

- Catalogue public.
- Categories publiques.
- Tags publics.
- Variantes publiques.
- SEO public.
- Healthcheck public.
- Analytics config et collecte events.

Role authenticated:

- Panier.
- Wishlist.
- Checkout.
- Espace compte.
- Commandes utilisateur.
- Funnel analytics interne.

Les permissions sont appliquees automatiquement au bootstrap via `seedNyraCatalog`.

## 7. Modeles De Donnees

### Product

Produit catalogue principal.

Champs majeurs:

- `name`
- `slug` unique
- `ingredients`
- `price`
- `compareAtPrice`
- `rating`
- `reviews`
- `bgClass`
- `image`
- `gallery`
- `category`
- `tags`
- `variants`
- `metaTitle`
- `metaDescription`
- `canonicalUrl`
- `canonicalPath`
- `ogImage`

Role:

- Source catalogue.
- Source SEO.
- Source analytics `view_item`.
- Point d'entree fiche produit.

### Category

Categorie catalogue.

Champs:

- `name`
- `slug` unique
- `image`
- `metaTitle`
- `metaDescription`
- `canonicalUrl`
- `canonicalPath`
- `ogImage`
- `products`

### Tag

Tag/famille de produits.

Champs:

- `name`
- `slug` unique
- `products`

### Variant

Variante vendable.

Champs:

- `name`
- `sku` unique
- `format`
- `label`
- `size`
- `colorName`
- `colorHex`
- `weightValue`
- `weightUnit`
- `price`
- `compareAtPrice`
- `stock`
- `lowStockThreshold`
- `isDefault`
- `isActive`
- `position`
- `product`

Role:

- Source de stock.
- Source prix variante.
- Source SKU admin/logistique.

### CartItem

Ligne panier utilisateur.

Champs:

- `user`
- `product`
- `variant`
- `quantity`

### WishlistItem

Wishlist utilisateur.

Champs:

- `user`
- `product`

### Checkout

Session checkout.

Champs:

- `checkoutId`
- `status`
- `customer`
- `shippingAddress`
- `billingAddress`
- `billingSameAsShipping`
- `currency`
- `subtotal`
- `shipping`
- `total`
- `paymentIntentId`
- `clientSecret`
- `expiresAt`
- `user`

Role:

- Brouillon checkout.
- Correlation analytics via `checkout_session_id`.
- Source intermediaire avant commande.

### Order

Commande client.

Champs:

- `orderNumber`
- `checkoutId`
- `status`
- `paymentProvider`
- `paymentIntentId`
- `currency`
- `subtotal`
- `shipping`
- `total`
- `customer`
- `shippingAddress`
- `billingAddress`
- `user`
- `items`

### OrderItem

Snapshot commercial d'une ligne commande.

Champs:

- `productName`
- `productSlug`
- `productDocumentId`
- `categoryName`
- `currency`
- `variantLabel`
- `sku`
- `quantity`
- `unitPrice`
- `lineTotal`
- `product`
- `variant`
- `order`

Role:

- Figement prix/nom/SKU au moment de l'achat.
- Base analytics revenus.

### UserProfile

Profil client complementaire.

Champs:

- `firstName`
- `lastName`
- `phone`
- `user`

### Address

Adresse client.

Champs:

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

Produit consulte recemment.

Champs:

- `viewedAt`
- `user`
- `product`

### AnalyticsEvent

Event analytics first-party.

Champs:

- `eventName`
- `checkoutSessionId`
- `orderId`
- `itemId`
- `cartHash`
- `step`
- `reason`
- `dedupeKey`
- `dedupeBucket`
- `currency`
- `value`
- `payload`
- `requestId`
- `userAgent`
- `user`

## 8. Endpoints Catalogue

Endpoint principal:

- `GET /api/products/catalog`

Alias compatibles:

- `GET /api/catalog/products`

Filtres:

- `q`
- `category`
- `teaTag`
- `sort`
- `priceMax`
- `page`
- `pageSize`

Tri:

- `popular`
- `price-low`
- `price-high`
- `rating`

Reponse:

- `products`
- `categories`
- `tags`
- `pagination`
- `filtersApplied`

Pagination expose:

- `page`
- `pageSize`
- `total`
- `pageCount`
- `totalItems`
- `totalPages`

Detail produit:

- `GET /api/products/:slug`
- `GET /api/products/slug/:slug`
- `GET /api/catalog/products/:slug`

Detail categorie:

- `GET /api/categories/:slug`

## 9. Endpoints Panier

Endpoints authenticated:

- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/:itemId`
- `DELETE /api/cart/items/:itemId`

Regles:

- Quantite valide entre `1` et `20`.
- Verification stock serveur.
- Prix calcule serveur.
- Livraison gratuite a partir de `45000 XOF`.
- Frais livraison `2500 XOF` sous le seuil.

Payload panier:

- `items`
- `currency`
- `subtotal`
- `shipping`
- `shippingFee`
- `discounts`
- `freeShippingThreshold`
- `total`

## 10. Endpoints Checkout

Endpoints authenticated:

- `POST /api/checkout/init`
- `PATCH /api/checkout/:checkoutId`
- `GET /api/checkout/:checkoutId`
- `GET /api/checkout/:checkoutId/summary`
- `POST /api/checkout/:checkoutId/payment-intent`
- `POST /api/checkout/:checkoutId/confirm`

`POST /api/checkout/init` accepte:

- `customer`
- `shippingAddress`
- `billingAddress`
- `billingSameAsShipping`
- `items`

Si `items` est fourni, le backend reconstruit le panier serveur puis recalcule les montants.

Reponse checkout:

- `checkoutId`
- `checkout_session_id`
- `status`
- `expiresAt`
- `items`
- `currency`
- `subtotal`
- `shipping`
- `shippingFee`
- `discounts`
- `total`
- `analytics`

Paiement:

- Provider: Stripe via API REST.
- Dev local possible avec `STRIPE_MOCK_PAYMENTS=true`.
- Production attend `STRIPE_SECRET_KEY`.

## 11. Endpoints Compte Utilisateur

Endpoints authenticated:

- `GET /api/me`
- `PATCH /api/me`
- `GET /api/me/orders`
- `GET /api/me/orders/:orderId`
- `GET /api/me/addresses`
- `POST /api/me/addresses`
- `PATCH /api/me/addresses/:addressId`
- `PUT /api/me/addresses/:addressId`
- `DELETE /api/me/addresses/:addressId`
- `POST /api/me/addresses/:addressId/default`
- `GET /api/me/wishlist`
- `POST /api/me/wishlist/items`
- `DELETE /api/me/wishlist/items/:productId`
- `GET /api/me/viewed-products`
- `POST /api/me/viewed-products`

Garanties:

- Filtrage par utilisateur courant.
- Pas de fuite inter-compte.
- Commandes triees de la plus recente a la plus ancienne.
- Adresse par defaut unique.

## 12. Endpoints Wishlist

Endpoints authenticated:

- `GET /api/wishlist`
- `POST /api/wishlist/items`
- `DELETE /api/wishlist/items/:productId`

Aliases compte:

- `GET /api/me/wishlist`
- `POST /api/me/wishlist/items`
- `DELETE /api/me/wishlist/items/:productId`

## 13. Endpoints Analytics

Config:

- `GET /api/analytics/config`

Collecte:

- `POST /api/analytics/events`

Funnel:

- `GET /api/analytics/funnel?days=7`

Events acceptes:

- `view_item`
- `add_to_cart`
- `remove_from_cart`
- `begin_checkout`
- `checkout_step_view`
- `checkout_step_complete`
- `checkout_payment_failed`
- `cart_abandoned`
- `purchase`

Deduplication:

- Backend par `dedupeKey`.
- Fenetre configurable.
- Variables:
  - `ANALYTICS_DEDUPE_SECONDS`
  - `ANALYTICS_PAYMENT_DEDUPE_SECONDS`

Config analytics:

- `ANALYTICS_ENABLED`
- `POSTHOG_ENABLED`
- `GA_MEASUREMENT_ENABLED`
- `ANALYTICS_CONSENT_REQUIRED`
- `ANALYTICS_CONSENT_DEFAULT_GRANTED`

## 14. Endpoints SEO et Monitoring

SEO:

- `GET /api/sitemap.xml`
- `GET /api/robots.txt`

Health:

- `GET /api/health`

Healthcheck retourne:

- `status`
- `checks.api`
- `checks.database`
- `uptime`
- `responseTimeMs`
- `timestamp`
- `requestId`

## 15. Erreurs Normalisees

Format general:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Message lisible.",
  "details": {},
  "requestId": "uuid"
}
```

Codes frequents:

- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `REQUEST_TIMEOUT`
- `RATE_LIMITED`
- `PRODUCT_NOT_FOUND`
- `INVALID_QUANTITY`
- `OUT_OF_STOCK`
- `CART_EMPTY`
- `CART_CHANGED`
- `CHECKOUT_EXPIRED`
- `PAYMENT_INFO_INCOMPLETE`
- `PAYMENT_TIMEOUT`
- `PAYMENT_DECLINED`
- `ADDRESS_INVALID`
- `ADDRESS_NOT_FOUND`
- `ORDER_NOT_FOUND`

## 16. Index et Performance DB

Index automatiques PostgreSQL au bootstrap sur colonnes frequentes:

- `document_id`
- `locale`
- `published_at`
- `created_at`
- `updated_at`
- `slug`
- `canonical_path`
- `sku`
- `name`
- `price`
- `rating`
- `reviews`
- `stock`
- `status`
- `checkout_id`
- `checkout_session_id`
- `order_number`
- `payment_intent_id`
- `product_id`
- `variant_id`
- `user_id`
- colonnes analytics dedupe/funnel.

## 17. Variables D'environnement Importantes

Base de donnees:

- `DATABASE_URL`
- `DATABASE_HOST`
- `DATABASE_NAME`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`
- `DATABASE_PORT`
- `DATABASE_SSL`
- `DATABASE_SCHEMA`

Frontend / SEO:

- `FRONTEND_URL`
- `PUBLIC_URL`

Paiement:

- `STRIPE_SECRET_KEY`
- `STRIPE_MOCK_PAYMENTS`

Analytics:

- `ANALYTICS_ENABLED`
- `POSTHOG_ENABLED`
- `GA_MEASUREMENT_ENABLED`
- `ANALYTICS_CONSENT_REQUIRED`
- `ANALYTICS_CONSENT_DEFAULT_GRANTED`
- `ANALYTICS_DEDUPE_SECONDS`
- `ANALYTICS_PAYMENT_DEDUPE_SECONDS`

## 18. Etat Release Candidate

Etat actuel:

- Catalogue connectable front.
- Panier connectable front.
- Checkout connectable front.
- Compte utilisateur connectable front.
- Wishlist connectable front.
- Analytics funnel pret.
- SEO technique pret.
- Healthcheck pret.
- Contrats frontend RC valides.

Points non finalises volontairement:

- Webhooks Stripe complets.
- Decrementation atomique de stock au paiement.
- Coupons/promotions.
- Tests d'integration automatises.
- Durcissement final production.
