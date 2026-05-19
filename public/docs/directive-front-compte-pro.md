# Directive frontend — Compte professionnel

**Backend prêt** : branche à merger / déployer avec les endpoints ci-dessous.  
**Auth obligatoire** : JWT utilisateur (`Authorization: Bearer <token>`) sur toutes les routes `/api/me/*`.

---

## 1) Objectif produit

| Type de compte | Comportement attendu côté front |
|----------------|----------------------------------|
| **Visiteur** | Pas de formulaire demande pro (rediriger vers login). Catalogue herboristerie sans prix *(à brancher quand le masquage prix backend sera livré)*. |
| **Classic** (connecté) | Peut envoyer **une** demande compte pro. Voit l’état de sa demande. Pas de prix herboristerie. |
| **Professional** | Pas de formulaire demande. Accès aux **prix herboristerie** *(backend masquage à venir — prévoir le flag `isProfessional` dès maintenant)*. |

Le front **ne valide jamais** le statut pro en local : il lit toujours `GET /api/me` après login / refresh profil.

---

## 2) Contrats API

Base URL : `VITE_STRAPI_URL` (ex. `http://localhost:1337`).

### 2.1 Profil enrichi

```http
GET /api/me
Authorization: Bearer <jwt>
```

**Réponse 200** (champs nouveaux / importants) :

```ts
type AccountType = 'classic' | 'professional';
type ProRequestStatus = 'pending' | 'approved' | 'rejected';

interface ProAccountRequest {
  id: string;
  companyName: string;
  siret: string;
  companyPhone: string;
  message: string;
  status: ProRequestStatus;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MeProfile {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  accountType: AccountType;
  isProfessional: boolean;
  proApprovedAt: string | null;
  proAccountRequest: ProAccountRequest | null; // dernière demande, tous statuts
}
```

**Règle** : `isProfessional === true` ⇔ accès tarifs pro. Ne pas se baser uniquement sur `proAccountRequest.status === 'approved'` (l’admin peut activer le pro directement sur le profil).

---

### 2.2 Statut demande (optionnel, dédié)

```http
GET /api/me/pro-account-request
Authorization: Bearer <jwt>
```

**Réponse 200** :

```json
{
  "accountType": "classic",
  "isProfessional": false,
  "request": { "id": "...", "companyName": "...", "status": "pending", ... }
}
```

`request` est `null` si aucune demande n’a jamais été envoyée.

> **Recommandation** : un seul appel `GET /api/me` au chargement compte suffit en général ; garder cet endpoint si la page « Demande pro » est isolée.

---

### 2.3 Envoyer une demande (formulaire front)

```http
POST /api/me/pro-account-request
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Body** :

```ts
interface SubmitProAccountRequestBody {
  companyName: string;      // obligatoire
  siret?: string;           // optionnel, min 9 caractères si renseigné
  companyPhone?: string;
  message?: string;
}
```

**Succès 200** :

```json
{
  "request": {
    "id": "...",
    "companyName": "Herboristerie Dupont",
    "status": "pending",
    "createdAt": "..."
  }
}
```

**Erreurs** (format Nyra habituel) :

```json
{
  "code": "REQUEST_INVALID",
  "message": "Le nom de l'entreprise est obligatoire."
}
```

| `code` | HTTP | Action UI |
|--------|------|-----------|
| `UNAUTHORIZED` | 401 | Rediriger login |
| `REQUEST_INVALID` | 400 | Afficher `message` sous le formulaire |
| `REQUEST_ALREADY_PENDING` | 409 | « Demande déjà en cours » + masquer le formulaire |
| `ALREADY_PROFESSIONAL` | 409 | « Vous avez déjà un compte pro » + CTA catalogue herboristerie |

Après succès : **recharger le profil** (`GET /api/me`) ou mettre à jour le store avec `proAccountRequest.status === 'pending'`.

---

## 3) Service API suggéré

Créer ou étendre le module compte (ex. `src/services/api/accountApi.ts`) :

```ts
const API = import.meta.env.VITE_STRAPI_URL;

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchMe(token: string): Promise<MeProfile> {
  const res = await fetch(`${API}/api/me`, { headers: authHeaders(token) });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function fetchProAccountRequest(token: string) {
  const res = await fetch(`${API}/api/me/pro-account-request`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw await res.json();
  return res.json();
}

export async function submitProAccountRequest(
  token: string,
  body: SubmitProAccountRequestBody,
) {
  const res = await fetch(`${API}/api/me/pro-account-request`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}
```

---

## 4) Machine à états UI (page « Devenir professionnel »)

À calculer depuis `MeProfile` après `GET /api/me` :

```txt
!user
  → CTA « Se connecter » / « Créer un compte »

user.isProfessional
  → Message succès + lien collection herboristerie
  → Pas de formulaire

user.proAccountRequest?.status === 'pending'
  → « Demande en cours de validation »
  → Récap : companyName, date createdAt
  → Pas de formulaire

user.proAccountRequest?.status === 'rejected'
  → Message refus (ne pas afficher adminNote — interne admin)
  → Autoriser nouvelle demande (POST à nouveau)

sinon (classic, pas de demande ou ancienne approved sans isProfessional — rare)
  → Afficher formulaire
```

**Champs formulaire minimum** :

- Nom entreprise * (required)
- SIRET (optional, pattern 9–14 chiffres côté front pour UX)
- Téléphone pro (optional, pré-remplir avec `phone` du profil si dispo)
- Message (optional, textarea)

**UX** : loader sur submit, désactiver le bouton, toast succès « Demande envoyée — vous serez contacté par email ».

---

## 5) Intégration dans l’app existante

### Store / contexte auth

Étendre l’objet user / session :

```ts
accountType: 'classic' | 'professional';
isProfessional: boolean;
proAccountRequest: ProAccountRequest | null;
```

Recharger après :

- login ;
- `PATCH /api/me` (mise à jour profil) ;
- submit demande pro ;
- retour sur l’onglet compte (focus refresh optionnel).

### Navigation

- Lien compte : **« Compte professionnel »** ou **« Accès tarifs pro »**
- Route suggérée : `/compte/compte-professionnel` ou `/devenir-pro`

### Herboristerie (préparation)

Slug catégorie backend : **`herboristerie`**.

Dès maintenant :

```ts
const canSeeHerboristeriePrices = user?.isProfessional === true;
```

Affichage fiche / grille :

- si `!canSeeHerboristeriePrices` et `product.category.slug === 'herboristerie'` → masquer prix, CTA « Demander un compte pro » ;
- si `canSeeHerboristeriePrices` → afficher prix normalement.

> Le masquage serveur sur `/api/catalog/products` arrive dans un prochain ticket backend ; le front doit quand même **ne pas afficher** un prix reçu par erreur, mais la sécurité finale est côté API.

---

## 6) Ce qu’il ne faut pas faire

- Ne pas stocker `accountType` dans `localStorage` comme vérité métier.
- Ne pas permettre plusieurs POST tant que `status === 'pending'`.
- Ne pas afficher de prix herboristerie basés sur un flag local « je suis pro » sans sync `GET /api/me`.
- Ne pas appeler `POST /api/me/pro-account-request` sans être connecté.

---

## 7) Checklist d’implémentation

- [ ] Types `MeProfile`, `ProAccountRequest`, `SubmitProAccountRequestBody`
- [ ] `fetchMe` parse les nouveaux champs
- [ ] Page formulaire + états pending / approved / rejected / déjà pro
- [ ] Gestion erreurs `code` + `message`
- [ ] Lien menu compte vers la page pro
- [ ] Flag `isProfessional` prêt pour pages herboristerie
- [ ] Test manuel : inscription → demande → admin approve → refresh → `isProfessional: true`

---

## 8) Test manuel rapide (avec backend local)

1. Créer un compte classique (register Strapi).
2. `GET /api/me` → `accountType: "classic"`, `isProfessional: false`.
3. `POST /api/me/pro-account-request` avec `companyName`.
4. Vérifier email admin (si SMTP configuré).
5. Admin Strapi → **Demande compte pro** → `approved`.
6. `GET /api/me` → `isProfessional: true`, `proApprovedAt` renseigné.

---

## Référence backend

Détails admin / env : `public/docs/compte-professionnel.md`.
