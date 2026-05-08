# Jour 11 — Alignment Frontend / Backend (Analytics conversions)

## Contexte

Le frontend envoie maintenant 3 events e-commerce normalisés via un module unique:

- `view_item` (vue fiche produit)
- `add_to_cart` (ajout panier)
- `begin_checkout` (début checkout)

Objectif backend: garantir des données fiables, réconciliables et exploitables côté BI/marketing.

---

## 1) Contrat minimum attendu côté Backend

Pour fiabiliser le tracking, le backend doit exposer des données stables sur les produits retournés à l'app:

- `id` (stable, unique, non réutilisé)
- `name`
- `category.name` (ou slug catégorie exploitable)
- `price` (montant unitaire en XOF)
- `currency` implicite `XOF` (ou explicite si multi-devise)

Ces champs sont utilisés dans le payload `items[]` envoyé à GA4/PostHog.

---

## 2) Payload analytics attendu (référence)

### `view_item`

```json
{
  "currency": "XOF",
  "value": 12000,
  "items": [
    {
      "item_id": "prod_123",
      "item_name": "Infusion Sommeil",
      "item_category": "Infusions",
      "price": 12000,
      "quantity": 1
    }
  ]
}
```

### `add_to_cart`

```json
{
  "currency": "XOF",
  "value": 24000,
  "items": [
    {
      "item_id": "prod_123",
      "item_name": "Infusion Sommeil",
      "item_category": "Infusions",
      "price": 12000,
      "quantity": 2
    }
  ]
}
```

### `begin_checkout`

```json
{
  "currency": "XOF",
  "value": 45500,
  "items": [
    {
      "item_id": "prod_123",
      "item_name": "Infusion Sommeil",
      "price": 12000,
      "quantity": 2
    }
  ]
}
```

---

## 3) Points backend à implémenter / valider

1. **IDs produit stables**
   - Ne jamais renvoyer des IDs temporaires selon l’environnement.
   - Préserver la stabilité des IDs entre catalogue, panier, checkout, commande.

2. **Prix serveur de référence**
   - Le backend reste source de vérité prix.
   - À la création commande, figer les prix dans `OrderItem` (snapshot) pour cohérence analytics vs revenus.

3. **Checkout server-side robuste**
   - Au moment de `begin_checkout`, API checkout doit recalculer montant (articles + livraison + promo).
   - Retourner des erreurs structurées (`code`, `message`, `details`) en cas d’écart prix/stock.

4. **Attribution et réconciliation**
   - Prévoir un identifiant corrélation (ex: `checkout_session_id`) dans les endpoints checkout.
   - Ce même ID pourra être envoyé plus tard dans les events frontend pour relier funnel et commandes.

5. **Consentement & conformité**
   - Si CMP/consent mode en place, exposer l’état consent (ou endpoint de config) pour activer/désactiver tracking.

6. **Event serveur recommandé (phase suivante)**
   - Ajouter en backend (ou webhook Stripe) un event `purchase` fiable à confirmation de paiement.
   - Ce point complète les conversions frontend et évite les pertes dues aux bloqueurs client.

---

## 4) Endpoints backend recommandés (phase analytics avancée)

- `GET /api/analytics/config`
  - Retourne: `analyticsEnabled`, `posthogEnabled`, `gaMeasurementEnabled`, options consent.

- `POST /api/analytics/events` (optionnel, proxy first-party)
  - Permet de relayer certains events critiques côté serveur si nécessaire.

- `POST /api/checkout/init`
  - Retourne `checkout_session_id` + montants recalculés.

- `POST /api/checkout/confirm`
  - Confirme paiement/commande et fournit `order_id` final (base pour event `purchase`).

---

## 5) Checklist de validation conjointe Front/Back

- [ ] Même `item_id` entre catalogue, panier, checkout et commande.
- [ ] Même devise (`XOF`) sur tous les flux.
- [ ] `value` frontend proche/identique aux montants backend recalculés.
- [ ] Erreurs checkout structurées et lisibles côté frontend.
- [ ] Possibilité d’ajouter `checkout_session_id` dans payload analytics (prochaine itération).
- [ ] Event `purchase` prévu côté serveur/webhook pour finaliser le tunnel conversion.

---

## Résultat attendu

Un tunnel analytics cohérent de bout en bout:

- Front: `view_item` → `add_to_cart` → `begin_checkout`
- Back (prochaine étape): `purchase` fiable + IDs corrélables

Cela permet un suivi conversion robuste, exploitable en GA4/PostHog et aligné avec les données business réelles.
