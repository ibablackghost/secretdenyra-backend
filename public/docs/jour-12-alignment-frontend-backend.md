# Jour 12 — Alignment Frontend / Backend (Abandon panier + entonnoir checkout)

## Objectif business

Donner une visibilité claire sur les pertes de conversion:

- où les utilisateurs quittent le tunnel
- pourquoi ils quittent (erreurs paiement, abandon panier)
- quels paniers/segments performent moins bien

---

## 1) Nouveaux events front implémentés

- `cart_abandoned`
  - déclenché à la sortie page panier (onglet fermé / changement de route) si panier non vide et checkout non démarré
- `checkout_step_view`
  - vue d’une étape checkout (1 infos client, 2 adresses, 3 paiement)
- `checkout_step_complete`
  - validation d’une étape checkout
- `checkout_payment_failed`
  - échec de paiement simulé (`declined`, `timeout`, `incomplete`)

Le frontend continue aussi d’émettre:

- `view_item`
- `add_to_cart`
- `begin_checkout`

---

## 2) Exigences backend pour lecture funnel fiable

1. **Référentiel produit stable**
   - `item_id` stable entre catalogue, panier, checkout, commande.

2. **Référentiel montants**
   - Recalcul serveur des montants à l’init checkout et confirmation paiement.
   - Montants frontend utilisés comme indicateurs UX, backend = vérité business.

3. **Erreurs normalisées**
   - Retourner des erreurs paiement structurées (`code`, `message`, `details`) pour mapper des raisons standard.

4. **Corrélation sessions**
   - Retourner un `checkout_session_id` à `POST /api/checkout/init`.
   - Permettre l’injection de cet ID dans tous les events funnel pour analyses précises.

---

## 3) Déduplication des events (important)

Le frontend applique une déduplication temporelle (TTL) sur les events sensibles:

- `view_item`
- `begin_checkout`
- `cart_abandoned`
- `checkout_step_view`
- `checkout_step_complete`

### Côté backend / BI, garder aussi une protection:

- Clé de dédup recommandée:  
  `event_name + checkout_session_id + item_id/hash panier + timestamp bucket`
- Fenêtre de dédup recommandée: 30s à 5min selon event.

But: éviter les doubles comptages dus aux refreshs, transitions route et callbacks navigateur.

---

## 4) KPIs business à suivre dès maintenant

- `add_to_cart_rate` = add_to_cart / view_item
- `checkout_start_rate` = begin_checkout / add_to_cart
- `step1_to_step2_rate` = checkout_step_complete(step1) / checkout_step_view(step1)
- `step2_to_step3_rate` = checkout_step_complete(step2) / checkout_step_view(step2)
- `payment_failure_rate` = checkout_payment_failed / checkout_step_complete(step2)
- `cart_abandon_rate` = cart_abandoned / add_to_cart

---

## 5) API / data à prévoir côté backend (prochaine itération)

- `POST /api/checkout/init` → renvoie `checkout_session_id`, montants recalculés
- `POST /api/checkout/confirm` → renvoie `order_id`, statut final paiement
- webhook paiement (Stripe/PSP) → source de vérité event `purchase`

---

## Résultat attendu

Un funnel conversion lisible et exploitable:

- Perte panier détectée (`cart_abandoned`)
- Friction checkout localisée (étape + raison)
- Données mieux nettoyées grâce au dédoublonnage

=> meilleure visibilité business sur les pertes de conversion et priorisation produit/ops plus rapide.
