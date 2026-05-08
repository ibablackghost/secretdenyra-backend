# Reste A Faire - Projet Nyra

## Objectif

Ce document liste ce qui reste a faire pour passer du backend Release Candidate a une pre-production solide, puis a une production exploitable.

## Etat Actuel

Le backend est fonctionnel pour une RC frontend:

- Catalogue.
- Fiche produit.
- Categories.
- Variantes.
- Panier.
- Wishlist.
- Checkout.
- Paiement init/confirm.
- Commandes.
- Compte utilisateur.
- Adresses.
- Produits consultes.
- Analytics funnel.
- SEO.
- Healthcheck.
- Erreurs structurees.
- Cache headers.

Le frontend peut maintenant brancher les flux principaux.

## Priorite P0 - Bloquants Avant Production

### 1. Webhooks Stripe complets

Objectif:

- Recevoir les evenements Stripe comme source de verite paiement.

A implementer:

- `POST /api/webhooks/stripe`
- Verification signature Stripe.
- Gestion `payment_intent.succeeded`.
- Gestion `payment_intent.payment_failed`.
- Gestion `charge.refunded`.
- Idempotence par `event.id`.
- Logs dedies webhooks.
- Mise a jour automatique de `Checkout` et `Order`.

Pourquoi c'est critique:

- La confirmation frontend peut etre bloquee par un navigateur ferme, un timeout ou un bloqueur.
- Le webhook doit etre la source fiable du statut paiement.

### 2. Decrementation atomique du stock

Objectif:

- Eviter la survente.

A implementer:

- Decrementation stock dans une transaction DB.
- Verrouillage ou update conditionnel `stock >= quantity`.
- Reverification stock juste avant commande payee.
- Stock decrement uniquement au paiement confirme.
- Rollback si une ligne echoue.

Regle cible:

- Le stock vit sur `Variant.stock`.
- Le produit ne porte pas le stock global.

### 3. Idempotence checkout / commande

Objectif:

- Eviter commandes doubles.

A implementer:

- Cle idempotence sur `checkoutId`.
- Cle idempotence sur `paymentIntentId`.
- Ne jamais recreer une commande si une commande existe deja pour le checkout.
- Retourner la commande existante en cas de retry.

Partiellement fait:

- `Order.checkoutId` est unique.
- `createOrderFromCheckout` verifie deja une commande existante.

A durcir:

- Couvrir aussi les webhooks.
- Couvrir les retries API.

### 4. Secrets et environnements

A definir clairement:

- `.env.development`
- `.env.staging`
- `.env.production`

Variables critiques:

- `DATABASE_URL`
- `APP_KEYS`
- `API_TOKEN_SALT`
- `ADMIN_JWT_SECRET`
- `TRANSFER_TOKEN_SALT`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FRONTEND_URL`

Verification:

- Aucun secret commit.
- Secrets definis dans la plateforme de deploiement.

### 5. Tests integration critiques

A couvrir:

- Listing catalogue.
- Detail produit.
- Ajout panier.
- Validation stock panier.
- Init checkout.
- Payment intent.
- Confirm checkout.
- Creation commande.
- Permissions `/api/me`.
- Analytics dedupe.

## Priorite P1 - Pre-prod Solide

### 1. Coupons et promotions

Objectif:

- Ajouter un moteur promo minimal.

Modele `Coupon` recommande:

- `code`
- `type`: `percent` ou `fixed`
- `value`
- `startsAt`
- `expiresAt`
- `maxUses`
- `usedCount`
- `maxUsesPerUser`
- `minimumSubtotal`
- `isActive`

Endpoints:

- `POST /api/checkout/:checkoutId/coupon`
- `DELETE /api/checkout/:checkoutId/coupon`

Regles:

- Calcul remise serveur.
- Snapshot remise sur commande.
- Code normalise uppercase.

### 2. Remboursements admin

Objectif:

- Permettre un refund propre.

A implementer:

- Endpoint admin remboursement.
- Verification role admin.
- Appel Stripe refund.
- Trace `refundId`.
- Passage commande `refunded`.
- Event analytics/ops.

### 3. Expiration checkout

Objectif:

- Nettoyer les checkouts abandonnes.

A implementer:

- Job cron Strapi.
- Passage `draft/payment_pending` expire en `expired`.
- Event analytics optionnel `checkout_expired`.
- Nettoyage panier selon regle metier.

### 4. Emails transactionnels

Emails minimum:

- Confirmation commande.
- Paiement echoue.
- Commande expediee.
- Mot de passe / compte si necessaire.

Service possible:

- Brevo.
- Mailgun.
- Resend.
- Sendgrid.

### 5. Admin operations

A ameliorer:

- Vue commandes filtree.
- Changement statut commande.
- Vue stock bas.
- Ajustement manuel stock.
- Historique ajustements stock.

### 6. OpenAPI final

Objectif:

- Fournir un contrat partage front/back.

A faire:

- Generer `public/swagger-spec.json`.
- Documenter les endpoints custom.
- Verifier les payloads reels.

## Priorite P2 - Ameliorations Produit

### 1. Avis produits

Modele `Review`:

- user
- product
- rating
- title
- body
- status moderation

Endpoints:

- `GET /api/products/:slug/reviews`
- `POST /api/products/:slug/reviews`

### 2. Recommandations avancees

Actuel:

- Produits similaires via categorie/tags.

Ameliorations:

- Produits achetes ensemble.
- Top ventes.
- Personnalisation via viewed-products.

### 3. Recherche avancee

Actuel:

- Recherche simple `containsi`.

Ameliorations:

- Full text PostgreSQL.
- Synonymes.
- Tolerance typo.
- Ranking.

### 4. Multi-devise / multi-pays

Actuel:

- `XOF` seulement.

Possible plus tard:

- EUR.
- USD.
- Pays livraison.
- Frais livraison par zone.

### 5. Gestion contenu Home

Actuel:

- `Home` single type simple.

Ameliorations:

- Sections configurables.
- Produits mis en avant.
- Banners promotionnels.
- Collections editorialisees.

## Priorite P3 - BI et Growth

### 1. Dashboard analytics interne

Utiliser `AnalyticsEvent` pour:

- taux ajout panier;
- taux checkout;
- abandon panier;
- echecs paiement;
- taux purchase;
- chiffre d'affaires;
- top produits.

### 2. Export BI

Options:

- Export CSV admin.
- Pipeline vers BigQuery.
- Pipeline vers PostgreSQL read replica.
- Webhooks vers outil BI.

### 3. Attribution marketing

Ajouter aux events:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `referrer`
- `landingPage`

## Dettes Techniques Actuelles

### 1. Factories Strapi casteees en `as any`

Pourquoi:

- Les nouveaux content-types ne sont pas encore connus du typage Strapi genere.

A faire:

- Regenerer types Strapi.
- Remplacer les casts si possible.

### 2. Paiement Stripe via REST directe

Pourquoi:

- Eviter dependance additionnelle.

A evaluer:

- Installer SDK Stripe officiel pour webhooks/refunds.

### 3. Permissions auto-bootstrap

Actuel:

- Permissions appliquees au bootstrap.

A securiser:

- Verifier que cela ne surprend pas en production.
- Documenter les roles attendus.
- Eventuellement figer via migration/admin.

### 4. Manque de tests automatises

Priorite:

- Critique avant production.

## Checklist Pre-prod

- [ ] Variables production definies.
- [ ] Base PostgreSQL provisionnee.
- [ ] Migrations Strapi appliquees.
- [ ] Admin Strapi protege.
- [ ] Roles public/authenticated verifies.
- [ ] Stripe test configure.
- [ ] Webhook Stripe configure.
- [ ] Emails transactionnels configures.
- [ ] Tests checkout complets.
- [ ] Tests paiement refuse.
- [ ] Tests stock insuffisant.
- [ ] Tests analytics dedupe.
- [ ] Healthcheck monitoré.
- [ ] Logs accessibles.
- [ ] Sauvegardes DB configurees.

## Checklist Production

- [ ] Domaine backend final.
- [ ] CORS strict domaine production.
- [ ] HTTPS obligatoire.
- [ ] Secrets production rotatifs.
- [ ] Stripe live active.
- [ ] Webhook live active.
- [ ] Monitoring uptime.
- [ ] Alerting erreurs 5xx.
- [ ] Alerting webhooks echoues.
- [ ] Alerting stock bas.
- [ ] Backup/restore teste.
- [ ] Politique RGPD/cookies validee.
- [ ] Conditions generales / politique livraison / retours disponibles.

## Ordre De Travail Recommande

1. Webhooks Stripe.
2. Stock atomique.
3. Tests integration checkout.
4. Emails transactionnels.
5. Coupons.
6. Admin operations.
7. Monitoring/alerting.
8. Optimisations SQL/cache.
9. BI dashboard.
10. Production hardening.
