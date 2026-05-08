# Jour 2 - Architecture stable et conventions

## Structure cible mise en place

- `src/app/features/catalog/`
  - `types.ts` (types metier UI)
- `src/app/services/api/`
  - `httpClient.ts` (client HTTP centralise)
  - `apiError.ts` (erreurs normalisees)
  - `catalogApi.ts` (service catalogue)
- `src/app/hooks/`
  - `useAsyncResource.ts` (gestion globale loading/error)
  - `useCatalog.ts` (hook domaine)
  - `index.ts`
- `src/app/store/` (deja existant, conserve)
- `src/app/utils/`
  - `naming.ts` (conventions)

## Standardisation des etats globaux

Composants UI partages crees:
- `src/app/components/ui/AsyncState.tsx`
  - `LoadingState`
  - `ErrorState`
  - `EmptyState`

Pages branchees:
- `Home`
- `Shop`
- `Product`
- `Cart`
- `Wishlist`

## Compatibilite sans regression

- `src/app/lib/useCatalog.ts` -> re-export du nouveau hook.
- `src/app/lib/catalog.ts` -> re-export types + service.

Cela permet de migrer progressivement les imports existants sans casse.

## Conventions de nommage retenues

- **features**: logique metier par domaine.
- **services**: acces API + mapping transport.
- **hooks**: orchestration React/requetes.
- **store**: etat global persistant.
- **utils**: fonctions pures/transverses.

## Prochaine etape (Jour 3)

- Connecter filtres/tri/recherche `Shop` a une vraie pagination backend.
- Supprimer la pagination UI statique actuelle.
