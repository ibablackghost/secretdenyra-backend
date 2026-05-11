# Import CSV Tisanes vers Strapi

## Objectif

Importer automatiquement les produits du fichier:

```txt
produits_tisanes_enrichi.csv
```

Dans Strapi, l'import cree:

- la categorie `Tisanes`;
- les tags (`bio`, `vrac`, `detox`, etc.);
- les produits parents;
- les variantes de poids `250g` et `50g`;
- les prix par variante;
- les stocks;
- les images dans la Media Library;
- les champs SEO et fiche produit.

---

## Fichiers crees

CSV enrichi:

```txt
../produits_tisanes_enrichi.csv
```

Script d'enrichissement:

```txt
../enrich-tisanes-csv.mjs
```

Script d'import Strapi CLI:

```txt
scripts/import-tisanes.mjs
```

Import depuis l'admin Strapi:

```txt
Menu admin Strapi > Import Tisanes
```

Endpoint backend utilise par l'admin:

```http
POST /api/admin/import/tisanes
```

Cette route est reservee aux utilisateurs admin Strapi connectes.

---

## Colonnes ajoutees

Le CSV original a ete enrichi avec:

- `Strapi category`
- `Stock`
- `Slug`
- `Meta title`
- `Meta description`
- `Status`
- `Compare at price`
- `Tags`
- `Dosage`
- `Temps infusion`
- `Température`
- `Origine`
- `Nom botanique`
- `Image alt text`
- `Gallery images`

---

## Champs Strapi ajoutes au produit

Le modele `Product` accepte maintenant:

- `shortDescription`
- `description`
- `dosage`
- `infusionTime`
- `temperature`
- `origin`
- `botanicalName`
- `sourceUrl`

Ces champs sont exposes dans l'API catalogue pour que le front puisse les afficher sur la fiche produit.

---

## Test sans ecriture

### Depuis l'admin Strapi

1. Ouvrir l'admin Strapi.
2. Aller dans le menu `Import Tisanes`.
3. Choisir `produits_tisanes_enrichi.csv`.
4. Cocher `Test à blanc sans écriture`.
5. Cliquer sur `Lancer l'import`.
6. Lire le rapport.

### Depuis la ligne de commande

Depuis `nyra-cms`:

```powershell
npm run import:tisanes:dry
```

Ce mode verifie le parsing sans ecrire dans Strapi.

---

## Import reel

### Depuis l'admin Strapi

1. Ouvrir l'admin Strapi.
2. Aller dans le menu `Import Tisanes`.
3. Choisir `produits_tisanes_enrichi.csv`.
4. Laisser `Importer les images externes` coche.
5. Decocher `Test à blanc sans écriture`.
6. Cliquer sur `Lancer l'import`.
7. Attendre le rapport final.

Le rapport affiche:

- lignes lues;
- produits trouves;
- variantes trouvees;
- produits crees;
- produits mis a jour;
- variantes creees;
- variantes mises a jour;
- images importees;
- erreurs eventuelles.

### Depuis la ligne de commande

Il faut d'abord creer un token API Strapi avec les droits necessaires:

- category;
- tag;
- product;
- variant;
- upload.

Puis lancer:

```powershell
$env:STRAPI_URL="http://localhost:1337"
$env:STRAPI_IMPORT_TOKEN="TON_TOKEN_STRAPI"
$env:TISANES_CSV_PATH="../produits_tisanes_enrichi.csv"
npm run import:tisanes
```

Sur serveur:

```powershell
$env:STRAPI_URL="https://ton-backend.com"
$env:STRAPI_IMPORT_TOKEN="TON_TOKEN_STRAPI"
$env:TISANES_CSV_PATH="../produits_tisanes_enrichi.csv"
npm run import:tisanes
```

---

## Mapping utilise

Produit parent WooCommerce `variable` devient `Product`.

Variation WooCommerce devient `Variant`.

Mapping principal:

- `Name` -> `Product.name`
- `Slug` -> `Product.slug`
- `Description` -> `Product.description`
- `Short description` -> `Product.shortDescription`
- `Images` -> `Product.image`
- `Strapi category` -> `Category Tisanes`
- `Tags` -> `Product.tags`
- `Regular price` des variations -> `Variant.price`
- `Stock` -> `Variant.stock`
- `Attribute 1 value(s)` -> `Variant.format`, `Variant.label`, `Variant.size`
- `Nom botanique` -> `Product.botanicalName`
- `Dosage` -> `Product.dosage`
- `Temps infusion` -> `Product.infusionTime`
- `Température` -> `Product.temperature`
- `Origine` -> `Product.origin`
- `Link` -> `Product.sourceUrl`

---

## Resultat attendu

Apres import:

- 20 produits dans la categorie `Tisanes`;
- 40 variantes;
- chaque produit a deux formats: `250g` et `50g`;
- les prix viennent des variations;
- les produits sont publies;
- les images sont importees dans Strapi;
- les fiches produits peuvent afficher les infos infusion.

---

## Important

Le stock genere est une base de depart:

- `250g` -> stock `25`;
- `50g` -> stock `50`.

Tu peux modifier ces valeurs dans `produits_tisanes_enrichi.csv` avant l'import reel si besoin.
