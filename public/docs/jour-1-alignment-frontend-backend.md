# Jour 1 - Alignement Frontend -> Backend

But: donner au backend une vue claire de l'existant frontend pour aligner les modeles et API sans regression.

## 1) Audit pages existantes (etat reel)

### Pages/routes detectees
- `/` -> page Home (hero, familles, grilles produits).
- `/shop` -> catalogue avec filtres, tri, recherche URL (`?q=`, `?category=`, `?teaTag=`).
- `/product/:slug` -> fiche produit detaillee (prix, quantite, format UI, avis UI, favoris).
- `/cart` -> panier (quantites, total, livraison gratuite seuil 45 000 XOF).
- `/wishlist` -> favoris persistants.
- `/account` -> compte utilisateur (infos perso) protege via `RequireAuth`.

### Constats "existant vs manquant"
- **Existant**
  - Navigation e-commerce complete cote UI.
  - Stores locaux fonctionnels: panier, favoris, auth (Zustand persist).
  - Chargement catalogue depuis Strapi via `VITE_STRAPI_URL`.
  - Etats loading/error/empty deja presentes sur pages critiques.
- **Partiel**
  - Pagination catalogue visible en UI mais pas pilotee par backend.
  - Variantes produit affichees en UI, non connectees a de vraies donnees variant.
  - Compte utilisateur local (pas encore branche a Strapi Users/Addresses/Orders).
- **Manquant**
  - Checkout multi-etapes.
  - Commandes/reels paiements.
  - Stock temps reel et reservation panier.
  - Webhooks paiement et historique commande.

## 2) Mapping composants reutilisables (pour eviter duplications)

- **Layout global**
  - `src/app/components/layout/Layout.tsx`
  - `src/app/components/layout/Header.tsx`
  - `src/app/components/layout/Footer.tsx`
- **Champs/formulaires**
  - `src/app/components/form/NyraField.tsx`
  - composants reutilisables: `NyraInput`, `NyraLabel`, `NyraButton`, `NyraFormError`, `NyraFormCard`
- **Etat metier local**
  - `src/app/store/cartStore.ts`
  - `src/app/store/wishlistStore.ts`
  - `src/app/store/authStore.ts`
- **Acces data catalogue**
  - `src/app/lib/useCatalog.ts`
  - `src/app/lib/catalog.ts`

## 3) Contrats de donnees frontend (source de verite Jour 1)

## Product (UI)
```ts
type Product = {
  id: string;           // actuellement egal au slug
  slug: string;
  name: string;
  ingredients: string;
  price: number;        // XOF
  rating: number;
  reviews: number;
  bgClass: string;      // fallback visuel
  image: string;        // URL absolue ou relative media
  category: {
    slug: string;
    name: string;
  };
  tags: Array<{
    slug: string;
    name: string;
  }>;
};
```

## Category (UI)
```ts
type Category = {
  slug: string;
  name: string;
  image: string;
};
```

## CartItem (UI)
```ts
type CartItem = {
  productId: string;    // reference Product.id (slug actuellement)
  quantity: number;
};
```

## UserSummary (UI)
```ts
type UserSummary = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
};
```

## 4) Demande d'alignement backend (a traiter maintenant)

Backend: merci d'aligner les API/collections sur ces besoins minimaux pour la suite Sprint 1.

### A. Catalogue
- Endpoint liste produits avec:
  - filtres `category`, `teaTag`, `q`
  - tri (`popular`, `price-low`, `price-high`, `rating`)
  - pagination backend reelle
- Endpoint produit par `slug`.
- Relations requises: `category`, `tags`, `image`.

### B. Identifiants et slugs
- Garder `slug` unique et stable (le front route sur `:slug`).
- Fournir aussi un `id` technique, mais ne pas casser les routes slug.

### C. Format de payload recommande
- Reponse catalogue attendue:
```json
{
  "products": [],
  "categories": [],
  "tags": [],
  "pagination": { "page": 1, "pageSize": 12, "total": 0, "pageCount": 0 }
}
```

### D. Compte utilisateur (phase suivante)
- Prevoir endpoints/me pour:
  - profil (firstName, lastName, phone)
  - adresses
  - historique commandes

## 5) Plan de refactor minimal frontend (sans casser l'existant)

1. Introduire des types centralises dans `src/app/types/`.
2. Garder les stores actuels mais preparer adaptation API (cart/wishlist server-side plus tard).
3. Remplacer pagination UI fake de `/shop` par pagination backend.
4. Connecter variantes produit reelles (au lieu des boutons statiques de format).
5. Conserver routes actuelles pour eviter regression SEO/UX.

## 6) Blocages/questions backend

- Le backend confirme-t-il que `slug` est unique pour Product et Category ?
- Quel schema variant est retenu (poids, format, prix, stock par variante) ?
- Quel contrat de recherche full-text est prevu pour `q` (name only ou name+ingredients+tags) ?
- Peut-on exposer des champs SEO produit/categorie des maintenant (metaTitle, metaDescription, ogImage) ?
