# Jour 10 - Alignement Backend (performance, accessibilite, responsive)

Le frontend a ete optimise pour:
- lazy loading image cote UI,
- code splitting routes lourdes (lazy + suspense),
- reduction re-renders (memo cards),
- accessibilite (skip link, focus visible, aria-live toasts),
- responsive mobile-first renforce.

Pour aligner la qualite pre-prod, backend doit supporter les points suivants.

## 1) Performance API attendue

- pagination backend stable sur catalog/orders
- tri/filtres executes cote serveur (pas cote client uniquement)
- payloads compacts (eviter champs inutiles)
- headers cache raisonnables pour ressources peu volatiles:
  - `Cache-Control` sur media/public endpoints

## 2) Images et media (impact UX/perf)

- fournir URLs media optimisees (formats adaptes)
- idealement proposer variants:
  - thumbnail / small / medium
- conserver dimensions media quand possible pour limiter layout shifts

## 3) Robustesse erreurs (pour UX visible)

Le front affiche des etats clairs. Backend doit renvoyer des erreurs structurees:

```json
{
  "code": "REQUEST_TIMEOUT",
  "message": "Le service a mis trop de temps à répondre."
}
```

Codes utiles:
- `REQUEST_TIMEOUT`
- `RATE_LIMITED`
- `OUT_OF_STOCK`
- `PAYMENT_DECLINED`
- `VALIDATION_ERROR`

## 4) Accessibilite de contenu (SEO/A11y)

Pour les produits/categories:
- champs texte propres (sans HTML casse),
- noms explicites,
- meta SEO renseignees quand disponibles.

## 5) Contrats recommandes pour pre-prod

- SLA API catalogue cible: < 500ms sur endpoints pagines
- endpoint healthcheck pour monitorings
- logs corrélables (request id) pour debug UX/perf
