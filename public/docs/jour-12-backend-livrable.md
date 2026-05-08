# Jour 12 - Livrable Backend Funnel & Abandon Panier

## Objectif

Rendre le funnel conversion exploitable cote BI/marketing:

- abandon panier;
- vues/completions des etapes checkout;
- echecs paiement;
- dedoublonnage backend;
- KPIs de funnel.

## Events acceptes

`POST /api/analytics/events` accepte maintenant:

- `view_item`
- `add_to_cart`
- `begin_checkout`
- `cart_abandoned`
- `checkout_step_view`
- `checkout_step_complete`
- `checkout_payment_failed`
- `purchase`

## Champs AnalyticsEvent ajoutes

- `itemId`
- `cartHash`
- `step`
- `reason`
- `dedupeKey`
- `dedupeBucket`

Ces champs permettent d'expliquer les pertes:

- produit concerne;
- panier concerne;
- etape checkout;
- raison d'echec;
- protection anti double comptage.

## Deduplication backend

Le backend construit une cle:

```txt
event_name + checkout_session_id + item_id + cart_hash + step + reason + dedupe_bucket
```

La fenetre par defaut est `60s`.

Variables env:

- `ANALYTICS_DEDUPE_SECONDS`
- `ANALYTICS_PAYMENT_DEDUPE_SECONDS`

Si un doublon arrive dans la meme fenetre:

```json
{
  "accepted": true,
  "deduped": true,
  "eventId": "document-id",
  "dedupeKey": "key",
  "requestId": "uuid"
}
```

Sinon:

```json
{
  "accepted": true,
  "deduped": false,
  "eventId": "document-id",
  "dedupeKey": "key",
  "requestId": "uuid"
}
```

Le front peut aussi fournir `dedupeKey` ou `dedupe_key` si besoin.

## Funnel KPIs

Endpoint authenticated:

- `GET /api/analytics/funnel?days=7`

Payload:

```json
{
  "since": "2026-05-01T00:00:00.000Z",
  "currency": "XOF",
  "counts": {
    "view_item": 0,
    "add_to_cart": 0,
    "begin_checkout": 0,
    "cart_abandoned": 0,
    "checkout_step_view_1": 0,
    "checkout_step_complete_1": 0,
    "checkout_step_view_2": 0,
    "checkout_step_complete_2": 0,
    "checkout_step_view_3": 0,
    "checkout_payment_failed": 0,
    "purchase": 0
  },
  "kpis": {
    "add_to_cart_rate": 0,
    "checkout_start_rate": 0,
    "step1_to_step2_rate": 0,
    "step2_to_step3_rate": 0,
    "payment_failure_rate": 0,
    "cart_abandon_rate": 0,
    "purchase_rate": 0
  }
}
```

## Permissions

- `analytics.config` et `analytics.events`: publics.
- `analytics.funnel`: authenticated.

## Index

Index PostgreSQL etendus:

- `event_name`
- `checkout_session_id`
- `item_id`
- `cart_hash`
- `step`
- `reason`
- `dedupe_key`
- `dedupe_bucket`

## Notes d'integration frontend

- Continuer a envoyer `checkout_session_id` des que disponible.
- Pour `cart_abandoned`, envoyer `items[]` afin que le backend calcule `cartHash`.
- Pour les etapes checkout, envoyer `step: 1 | 2 | 3`.
- Pour les echecs paiement, envoyer `reason: "declined" | "timeout" | "incomplete"`.
