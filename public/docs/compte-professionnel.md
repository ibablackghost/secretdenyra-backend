# Compte professionnel — backend Nyra

## Parcours

1. L’utilisateur crée un compte **classique** (inscription standard).
2. Il envoie une **demande compte pro** depuis le frontend (`POST /api/me/pro-account-request`).
3. Un **email** est envoyé à l’adresse configurée (`PRO_ACCOUNT_REQUEST_NOTIFY_EMAIL`).
4. Un admin valide dans Strapi :
   - **Content Manager → Demandes compte pro** : passer le statut à `approved` ou `rejected`, **ou**
   - **Content Manager → User profile** : mettre `accountType` à `professional` (activation manuelle directe).

Quand une demande passe à `approved`, le profil utilisateur est mis à jour automatiquement (`accountType: professional`, `proApprovedAt`).

## Variables d’environnement

```env
PRO_ACCOUNT_REQUEST_NOTIFY_EMAIL=contact@nyra.example
STRAPI_ADMIN_URL=http://localhost:1337/admin
```

Configurer aussi le plugin **Email** dans `config/plugins.ts` (SMTP, SendGrid, etc.) pour que l’envoi fonctionne.

## API frontend (utilisateur connecté)

### Profil (inclut le type de compte)

`GET /api/me`

Réponse enrichie :

```json
{
  "email": "client@example.com",
  "accountType": "classic",
  "isProfessional": false,
  "proApprovedAt": null,
  "proAccountRequest": {
    "id": "...",
    "companyName": "Ma boutique",
    "status": "pending",
    "createdAt": "..."
  }
}
```

### Statut de la demande

`GET /api/me/pro-account-request`

### Envoyer une demande

`POST /api/me/pro-account-request`

Body :

```json
{
  "companyName": "Herboristerie Dupont",
  "siret": "12345678901234",
  "companyPhone": "+221771234567",
  "message": "Je souhaite accéder aux tarifs grossiste herboristerie."
}
```

Erreurs possibles :

| Code | HTTP | Signification |
|------|------|----------------|
| `ALREADY_PROFESSIONAL` | 409 | Compte déjà pro |
| `REQUEST_ALREADY_PENDING` | 409 | Demande déjà en attente |
| `REQUEST_INVALID` | 400 | Champs invalides |

## Admin Strapi

- **User profile** : champ `accountType` (`classic` | `professional`).
- **Demande compte pro** : liste des demandes, statut, note admin (`adminNote`).
