# Securite production appliquee

## Objectif

Ce document resume les protections appliquees dans le backend Strapi Nyra.

Ces changements visent a durcir l'API avant une mise en production Railway.

---

## 1) CORS strict

Le backend n'accepte plus des origines codees en dur uniquement dans le code.

Les origines autorisees doivent etre configurees par variable d'environnement:

```env
CORS_ALLOWED_ORIGINS=https://ton-front.vercel.app,https://ton-domaine.com
```

En local:

```env
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Important:

- ne pas mettre `*` en production;
- ajouter uniquement les domaines frontend officiels;
- verifier que Railway utilise bien cette variable.

---

## 2) CSP et headers de securite

La configuration `strapi::security` est durcie:

- CSP active;
- `frame-ancestors 'self'`;
- HSTS active en production;
- images limitees a `self`, `data`, `blob`, domaines frontend et medias autorises.

Si un CDN image externe est utilise, l'ajouter ici:

```env
MEDIA_ALLOWED_ORIGINS=https://cdn.exemple.com
```

---

## 3) Rate limiting

Un middleware `nyra-rate-limit` a ete ajoute.

Il limite les appels par IP:

- auth/login/register;
- checkout;
- panier/wishlist;
- analytics;
- API globale.

Reponse en cas d'abus:

```json
{
  "code": "RATE_LIMITED",
  "message": "Trop de requêtes, réessaie plus tard.",
  "requestId": "..."
}
```

Variable:

```env
RATE_LIMIT_ENABLED=true
```

---

## 4) Limites de taille des requetes

Les payloads entrants sont limites:

```env
BODY_JSON_LIMIT=1mb
BODY_FORM_LIMIT=1mb
BODY_TEXT_LIMIT=256kb
```

Objectif:

- eviter les payloads trop gros;
- reduire les risques d'abus;
- garder les endpoints checkout/account plus stables.

---

## 5) JWT

La duree de vie JWT est configurable:

```env
JWT_EXPIRES_IN=7d
```

Recommandation production:

- garder une duree raisonnable;
- ne jamais exposer `JWT_SECRET`;
- regenerer les secrets si fuite.

---

## 6) Railway / proxy

Le backend est configure pour fonctionner derriere Railway:

```env
TRUST_PROXY=true
```

Cela aide pour:

- IP client;
- rate limiting;
- headers proxy;
- detection HTTPS.

---

## 7) Variables a verifier sur Railway

Minimum:

```env
APP_KEYS=...
API_TOKEN_SALT=...
ADMIN_JWT_SECRET=...
TRANSFER_TOKEN_SALT=...
JWT_SECRET=...
ENCRYPTION_KEY=...
DATABASE_CLIENT=postgres
DATABASE_URL=...
CORS_ALLOWED_ORIGINS=https://ton-front.vercel.app
RATE_LIMIT_ENABLED=true
JWT_EXPIRES_IN=7d
TRUST_PROXY=true
```

Paiement:

```env
STRIPE_SECRET_KEY=...
STRIPE_MOCK_PAYMENTS=false
```

---

## 8) Points encore recommandes avant production finale

Il reste des chantiers de securite avancee:

- webhook Stripe signe;
- idempotence paiement;
- decrement stock transactionnel;
- tests automatises d'autorisation croisee;
- politique RGPD suppression/anonymisation client;
- monitoring erreurs et alertes production.

Ces points ne bloquent pas les tests frontend, mais sont recommandes avant une vraie production publique.
