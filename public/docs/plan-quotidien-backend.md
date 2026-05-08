# Plan quotidien - Backend (Strapi/PostgreSQL)

Objectif: mettre en place un backend e-commerce fiable (catalogue, commandes, paiement, stock, securite, admin).

## Semaine 1 - Modeles et API coeur

### Jour 1
- Audit de l'existant Strapi (types, policies, roles, endpoints).
- Valider schema cible des collections: Product, Category, Variant, Order, OrderItem, Coupon, Address, Wishlist, Review.
- Definir conventions slug, statuts, et index DB.
- Sortie attendue: schema de donnees valide + plan de migration.

### Jour 2
- Implementer/ajuster Product, Category, Variant, Tag.
- Relations et contraintes (prix, stock, SKU unique, slug unique).
- Ajouter champs SEO (meta title/description, OG, canonical).
- Sortie attendue: modele catalogue propre.

### Jour 3
- API catalogue: listing avec filtres, tri, pagination, recherche.
- Endpoint produit detail + produits similaires.
- Ajouter normalisation de reponse API (format stable).
- Sortie attendue: APIs consommables par le frontend.

### Jour 4
- Implementer Wishlist et Address (relations user).
- Policies d'acces: un user ne lit/edite que ses donnees.
- Validation payload backend stricte.
- Sortie attendue: base compte utilisateur backend.

### Jour 5
- Modeles Order + OrderItem.
- Snapshot prix/nom/TVA au moment de l'achat (immutabilite commerciale).
- Workflow statuts commande (pending, paid, shipped, delivered, cancelled, refunded).
- Sortie attendue: cycle commande initialise.

## Semaine 2 - Paiement + stock + securite

### Jour 6
- Integration Stripe: creation PaymentIntent cote serveur.
- Associer PaymentIntent <-> Order.
- Gerer idempotence creation commande.
- Sortie attendue: paiement initie de facon sure.

### Jour 7
- Webhooks Stripe (payment_succeeded, payment_failed, charge_refunded).
- Signature verification + retries + logs.
- Mise a jour statuts commande automatique.
- Sortie attendue: sync paiement fiable.

### Jour 8
- Gestion echec paiement: relance, expiration commande, messages exploitables.
- Endpoint remboursement (admin) + tracabilite.
- Sortie attendue: gestion incidents paiement operationnelle.

### Jour 9
- Stock: decrementation atomique a la confirmation paiement.
- Blocage rupture stock et controles de concurrence.
- Reservation temporaire panier (TTL) si possible.
- Sortie attendue: survente evitee.

### Jour 10
- Securite: rate limiting, durcissement JWT, CORS strict, sanitization.
- Permissions Strapi par role (public, authenticated, admin).
- Audit des endpoints sensibles.
- Sortie attendue: surface d'attaque reduite.

## Semaine 3 - Admin, perf, observabilite

### Jour 11
- Admin commandes: vues, filtres, changement de statuts.
- Admin stock: alertes seuil bas, ajustements manuels.
- Sortie attendue: operations quotidiennes possibles.

### Jour 12
- Coupons: regles (pourcentage/fixe, date, usage max, user max).
- Validation coupon dans pipeline commande.
- Sortie attendue: promo engine minimal.

### Jour 13
- Performance backend: cache des endpoints catalogue frequents.
- Optimiser requetes SQL/index selon cas reels.
- Sortie attendue: latence API amelioree.

### Jour 14
- Observabilite: logs structures, suivi erreurs webhooks, alertes critiques.
- Tests integration API (commandes, paiement, stock).
- Sortie attendue: backend pre-prod solide.

## Definition of Done (Backend)
- APIs catalogue/panier/commande stables et documentees.
- Paiement Stripe + webhooks verifies en environnement test.
- Statuts commande coherents de bout en bout.
- Permissions et validations backend appliquees.
- Monitoring minimum en place (logs + alertes critiques).
