# Recommandations Ultimes - Securite et Performance Nyra

## Objectif

Ce document donne une checklist avancee pour durcir Nyra avant pre-production et production.

Il couvre:

- securite applicative;
- securite Strapi;
- securite paiement;
- securite base de donnees;
- performance API;
- performance PostgreSQL;
- cache;
- observabilite;
- exploitation production.

## 1. Principes Directeurs

Priorites:

- Le backend reste source de verite prix, stock et paiement.
- Le frontend ne doit jamais etre considere fiable pour les montants.
- Toute ressource utilisateur doit etre filtree par `ctx.state.user.id`.
- Les endpoints publics doivent rester minimaux.
- Les erreurs doivent etre lisibles sans exposer de details internes.
- Les logs doivent permettre de deboguer sans fuite de donnees sensibles.

## 2. Securite Authentification

### JWT

A verifier:

- `JWT_SECRET` fort et unique par environnement.
- Rotation possible en cas de fuite.
- Duree de vie token raisonnable.
- Refresh strategy si necessaire cote front.

Recommandations:

- Ne jamais stocker de donnees sensibles dans le JWT.
- Utiliser HTTPS obligatoire.
- Eviter les tokens longue duree en production.

### Users Permissions

A faire:

- Auditer le role `public`.
- Auditer le role `authenticated`.
- Verifier que les APIs CRUD natives sensibles ne sont pas ouvertes.
- Garder les endpoints custom comme surface principale.

Surveiller:

- `order`
- `order-item`
- `checkout`
- `cart-item`
- `address`
- `user-profile`
- `analytics-event`

Ces collections ne doivent pas etre librement modifiables par le public.

## 3. Securite Autorisation

Regle absolue:

- Toute ressource utilisateur doit avoir une clause `user: { id: ctx.state.user.id }`.

Deja applique:

- `/api/me/*`
- `/api/cart/*`
- `/api/checkout/*`
- `/api/wishlist/*`
- commandes utilisateur

A renforcer:

- Ajouter tests d'autorisation croisee:
  - User A ne peut pas lire commande User B.
  - User A ne peut pas modifier adresse User B.
  - User A ne peut pas confirmer checkout User B.

## 4. Securite Paiement

### Stripe

Avant production:

- Ajouter `STRIPE_SECRET_KEY` live.
- Ajouter `STRIPE_WEBHOOK_SECRET`.
- Implementer webhook Stripe.
- Verifier la signature webhook.
- Refuser les webhooks non signes.
- Logger les webhooks echoues.
- Stocker `stripeEventId` pour idempotence.

Evenements minimum:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

### Confirmation paiement

Regles:

- Ne jamais faire confiance au front pour `paid`.
- Verifier Stripe cote serveur.
- Recalculer total avant confirmation.
- Verifier que le PaymentIntent correspond au checkout.
- Verifier que le montant Stripe correspond au total backend.

### Remboursement

Recommandations:

- Endpoint admin uniquement.
- Tracer raison remboursement.
- Tracer admin qui rembourse.
- Tracer `refundId`.
- Passer commande `refunded`.

## 5. Securite Stock

Risque:

- Survente si plusieurs clients paient la meme variante en meme temps.

Solution recommandee:

- Transaction PostgreSQL.
- Update conditionnel:
  - `UPDATE variants SET stock = stock - qty WHERE id = variant_id AND stock >= qty`
- Verifier le nombre de lignes mises a jour.
- Si 0 ligne, retourner `OUT_OF_STOCK`.

Moment:

- Decrementer au paiement confirme.
- Pas a l'ajout panier.

Option avancee:

- Reservation temporaire panier avec TTL.
- Table `stock_reservations`.
- Expiration automatique.

## 6. Securite Donnees Personnelles

Donnees sensibles:

- email
- phone
- adresses
- historique commande
- customer JSON
- billing/shipping addresses

Recommandations:

- Ne jamais logger les payloads complets checkout.
- Masquer email/telephone dans logs.
- Limiter les exports admin.
- Prevoir suppression/anonymisation client si demande RGPD.
- Definir une duree de conservation analytics.

## 7. Securite CORS et CSP

Actuel:

- CORS limite a localhost et domaine frontend Vercel.
- CSP configuree.

Avant production:

- Remplacer domaines temporaires par domaines finaux.
- Supprimer origines inutiles.
- Verifier `connect-src`.
- Verifier `img-src` pour CDN medias.
- Eviter `unsafe-inline` si possible sur le long terme.

## 8. Rate Limiting

A ajouter avant production:

- Rate limit IP global.
- Rate limit auth/login.
- Rate limit checkout.
- Rate limit analytics events.
- Rate limit wishlist/panier.

Exemples:

- Login: strict.
- Checkout/payment: moyen.
- Analytics events: volume autorise mais plafonne.
- Catalogue: plus permissif avec cache.

Reponse:

```json
{
  "code": "RATE_LIMITED",
  "message": "Trop de requêtes, réessaie plus tard."
}
```

## 9. Validation et Sanitization

Renforcer:

- Validations schema Strapi.
- Validations controllers custom.
- Longueurs max champs texte.
- Normalisation email.
- Normalisation phone.
- Normalisation coupon code.
- Refus HTML dans champs clients.

Champs a surveiller:

- `customer`
- `shippingAddress`
- `billingAddress`
- `Address`
- `AnalyticsEvent.payload`

## 10. Securite Admin Strapi

Recommandations:

- Admin accessible uniquement en HTTPS.
- Mot de passe fort.
- MFA si disponible.
- Limiter les comptes admin.
- Ne jamais partager compte admin.
- Desactiver creation admin publique apres setup.
- Restreindre IP admin si plateforme le permet.

## 11. Secrets

Ne jamais commit:

- `.env`
- credentials
- tokens Stripe
- secrets JWT
- dump DB

Secrets obligatoires production:

- `APP_KEYS`
- `API_TOKEN_SALT`
- `ADMIN_JWT_SECRET`
- `TRANSFER_TOKEN_SALT`
- `JWT_SECRET`
- `DATABASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Recommandations:

- Secrets differents par environnement.
- Rotation planifiee.
- Acces limite aux secrets.

## 12. Performance API Catalogue

Deja en place:

- Pagination serveur.
- Filtres serveur.
- Tri serveur.
- Payloads normalises.
- Champs media limites.
- Cache-Control.
- Index DB generiques.

Ameliorations:

- Ajouter ETag.
- Ajouter cache applicatif court sur catalogue.
- Pre-calculer agregats stock si besoin.
- Eviter les populate lourds.
- Limiter `pageSize` strictement.

SLA cible:

- Catalogue page standard: moins de `500ms`.
- Detail produit: moins de `300ms`.
- Checkout: moins de `800ms` hors Stripe.

## 13. Performance Images

Actuel:

- Payload media expose `formats`, `width`, `height`.

Recommandations frontend/backend:

- Utiliser `thumbnail`, `small`, `medium` selon contexte.
- Eviter image originale en grille catalogue.
- CDN pour `/uploads`.
- Cache long sur media.
- `alt` via `alternativeText`.

## 14. Performance PostgreSQL

Index deja couverts:

- slug
- price
- rating
- reviews
- stock
- status
- user_id
- product_id
- variant_id
- checkout_id
- order_id
- analytics dedupe/funnel

Optimisations recommandees:

- Mesurer les requetes lentes.
- Ajouter index composites selon usage reel:
  - product published + category
  - product published + price
  - order user + created_at
  - analytics event_name + created_at
  - analytics checkout_session_id + event_name
- VACUUM/ANALYZE regulier.
- Pool DB ajuste.

## 15. Performance Checkout

Regles:

- Charger seulement panier utilisateur.
- Eviter recalculs multiples inutiles.
- Recalcul obligatoire avant paiement.
- Eviter appels Stripe avant validation locale.

Optimisations:

- Memoiser summary pendant checkout court si besoin.
- Stocker snapshot checkout.
- Detecter `CART_CHANGED`.

## 16. Performance Analytics

Risques:

- Volume important d'events.
- Duplications.
- Table qui grossit vite.

Deja en place:

- Dedup backend.
- Dedupe key unique.
- Funnel endpoint.

Recommandations:

- Retention analytics brute.
- Export vers BI.
- Agregats journaliers.
- Partitionnement eventuel par date.
- Rate limit events.

## 17. Observabilite

Deja en place:

- `X-Request-Id`.
- `X-Response-Time`.
- Logs request.
- Healthcheck DB.

A ajouter:

- Monitoring uptime.
- Alertes 5xx.
- Alertes webhook Stripe.
- Alertes checkout failed.
- Alertes stock bas.
- Dashboard latence API.

Outils possibles:

- Sentry.
- Datadog.
- Better Stack.
- Grafana/Prometheus.
- Logs plateforme cloud.

## 18. Backups et Disaster Recovery

Obligatoire production:

- Backup PostgreSQL quotidien.
- Retention minimum 7 a 30 jours.
- Test restore.
- Backup media uploads.
- Documentation procedure restore.

Verifier:

- RPO cible.
- RTO cible.
- Acces aux backups.

## 19. CI/CD

Pipeline recommande:

- Install deps.
- Typecheck `npx tsc --noEmit`.
- Build Strapi.
- Tests integration.
- Audit dependencies.
- Deploy staging.
- Smoke tests.
- Deploy production manuel ou approuve.

Smoke tests:

- `/api/health`
- `/api/products/catalog`
- `/api/analytics/config`
- login test si possible

## 20. Tests Recommandes

### Tests catalogue

- Listing avec pagination.
- Filtres categorie/tag.
- Recherche `q`.
- Prix max.
- Detail produit.
- Detail categorie.

### Tests panier

- Ajout produit.
- Quantite invalide.
- Stock insuffisant.
- Mise a jour.
- Suppression.

### Tests checkout

- Init avec panier.
- Init avec `items[]`.
- Adresse invalide.
- Panier vide.
- Payment intent.
- Confirm success mock.
- Confirm cart changed.
- Confirm payment declined.

### Tests compte

- Profil.
- Adresses CRUD.
- Commandes d'un user.
- Interdiction acces commande autre user.

### Tests analytics

- Event accepte.
- Event invalide refuse.
- Dedup fonctionne.
- Funnel retourne KPIs.

## 21. Cache Strategy

Public cache:

- Catalogue.
- Detail produit.
- Detail categorie.
- Sitemap.
- Robots.
- Uploads.

No-store:

- Me.
- Cart.
- Checkout.
- Orders.
- Payment.

A ajouter:

- ETag catalogue.
- CDN uploads.
- CDN sitemap si besoin.

## 22. Go-Live Security Checklist

- [ ] HTTPS partout.
- [ ] CORS production strict.
- [ ] Secrets production definis.
- [ ] Admin Strapi protege.
- [ ] Roles audites.
- [ ] Webhook Stripe signe.
- [ ] Rate limiting actif.
- [ ] Logs sans donnees sensibles.
- [ ] Backups actifs.
- [ ] Restore teste.
- [ ] Monitoring actif.
- [ ] Alertes 5xx.
- [ ] Alertes paiement.
- [ ] Tests checkout OK.
- [ ] Tests stock OK.

## 23. Go-Live Performance Checklist

- [ ] Catalogue moins de 500ms.
- [ ] Detail produit moins de 300ms.
- [ ] Checkout init moins de 800ms hors Stripe.
- [ ] Index SQL verifies.
- [ ] Requetes lentes inspectees.
- [ ] Media optimises.
- [ ] CDN configure.
- [ ] Cache headers verifies.
- [ ] Healthcheck monitoré.
- [ ] Pool DB ajuste.

## 24. Recommandation Finale

Avant production, traiter dans cet ordre:

1. Webhooks Stripe signes.
2. Stock atomique.
3. Tests integration checkout/paiement.
4. Rate limiting.
5. Backups et restore.
6. Monitoring et alerting.
7. Audit permissions Strapi.
8. CDN media.
9. ETag/cache avance.
10. Dashboard BI/ops.

Nyra est maintenant bien avance techniquement. Les prochains efforts doivent surtout viser la fiabilite paiement/stock, la securite production et la capacite a observer les incidents rapidement.
