# Jour 10 - Livrable Backend Qualite Pre-prod

## Objectif

Aligner le backend avec les optimisations frontend: performance percue, payloads stables, erreurs exploitables, monitoring et logs correlables.

## Headers performance

Middlewares globaux ajoutes:

- `nyra-request-context`
- `nyra-cache-control`
- `nyra-errors`

Headers ajoutes:

- `X-Request-Id`: id de correlation par requete.
- `X-Response-Time`: duree de traitement backend.
- `Cache-Control`: selon type de route.

Regles cache:

- catalogue pagine: `public, max-age=60, stale-while-revalidate=300`
- detail produit: `public, max-age=120, stale-while-revalidate=600`
- detail categorie: `public, max-age=300, stale-while-revalidate=900`
- sitemap/robots: `public, max-age=3600, stale-while-revalidate=86400`
- uploads media: `public, max-age=31536000, immutable`
- compte/panier/checkout: `no-store`

## Erreurs structurees

Les erreurs API Strapi sont normalisees autant que possible vers:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Requete invalide.",
  "requestId": "uuid"
}
```

Codes couverts:

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `REQUEST_TIMEOUT`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

Les erreurs metier deja existantes (`OUT_OF_STOCK`, `PAYMENT_DECLINED`, etc.) conservent leur format `{ code, message }`.

## Healthcheck

Endpoint public ajoute:

- `GET /api/health`

Payload:

```json
{
  "status": "ok",
  "checks": {
    "api": "ok",
    "database": "ok"
  },
  "uptime": 123,
  "responseTimeMs": 4,
  "timestamp": "2026-05-08T00:00:00.000Z",
  "requestId": "uuid"
}
```

Si la DB ne repond pas, l'endpoint renvoie `503` avec `status: "degraded"`.

## Media et payloads

Les payloads media publics exposent deja:

- `url`
- `alternativeText`
- `width`
- `height`
- `formats`

Cela permet au front d'utiliser `thumbnail`, `small`, `medium` si Strapi les genere et de limiter les layout shifts.

## Logs

Chaque requete logge:

- `requestId`
- methode
- path
- status
- duree en ms

Objectif: faciliter le debug des lenteurs UX et la correlation front/back.

## Permissions

Le bootstrap public active:

- `health.check`

L'endpoint garde aussi `auth: false` dans sa route.
