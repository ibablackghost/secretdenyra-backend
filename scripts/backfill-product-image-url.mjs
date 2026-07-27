/**
 * Remplit product.imageUrl depuis TOUS les CSV enrichis.
 *
 * Usage :
 *   node scripts/backfill-product-image-url.mjs --from-csv --dry-run
 *   node scripts/backfill-product-image-url.mjs --from-csv
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import pg from 'pg';

const dryRun = process.argv.includes('--dry-run');
const fromCsv = process.argv.includes('--from-csv') || true;

const env = Object.fromEntries(
  readFileSync('./.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const databaseUrl = env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL manquant');
  process.exit(1);
}

const CSV_FILES = [
  '../produits_tisanes_enrichi.csv',
  '../produits_cafes_enrichi.csv',
  '../produits_the_bio_enrichi.csv',
  '../produits_herboristerie_enrichi.csv',
  '../produits_accessoires_enrichi.csv',
];

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const n = text[i + 1];
    if (quoted) {
      if (c === '"' && n === '"') {
        value += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else value += c;
      continue;
    }
    if (c === '"') {
      quoted = true;
      continue;
    }
    if (c === ',') {
      row.push(value);
      value = '';
      continue;
    }
    if (c === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }
    if (c !== '\r') value += c;
  }
  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
};

const firstImageUrl = (raw) => {
  const value = String(raw ?? '')
    .split(/[|,;\s]+/)
    .map((s) => s.trim())
    .find((s) => /^https?:\/\//i.test(s));
  return value || null;
};

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

try {
  await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url varchar(255)`);
} catch (e) {
  console.warn('ALTER image_url:', e.message);
}

let updated = 0;
let skipped = 0;

for (const relative of CSV_FILES) {
  const csvPath = path.resolve(relative);
  if (!existsSync(csvPath)) {
    console.warn(`⏭️  Absent : ${relative}`);
    continue;
  }

  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  if (rows.length < 2) continue;

  const headers = rows[0].map((h, i) => (i === 0 ? h.replace(/^\uFEFF/, '') : h));
  const records = rows.slice(1).map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])));

  // variable (parent) + simple (cafés / accessoires) — ignore variations enfants
  const products = records.filter((r) => {
    const type = String(r.Type ?? '').toLowerCase();
    return type === 'variable' || type === 'simple' || (!type && r.Slug && r.Images);
  });

  console.log(`\n📁 ${path.basename(csvPath)} — ${products.length} produit(s)`);

  for (const product of products) {
    const slug = String(product.Slug ?? '').trim();
    const imageUrl = firstImageUrl(product.Images);
    if (!slug || !imageUrl) {
      skipped += 1;
      continue;
    }

    // Colonne Strapi souvent 255 chars — tronquer proprement si besoin
    const safeUrl = imageUrl.length > 255 ? imageUrl.slice(0, 255) : imageUrl;

    if (dryRun) {
      console.log(`  [dry] ${slug}`);
      updated += 1;
      continue;
    }

    const res = await client.query(`UPDATE products SET image_url = $1 WHERE slug = $2`, [safeUrl, slug]);
    if (res.rowCount) {
      updated += res.rowCount;
      console.log(`  OK ${slug}`);
    } else {
      skipped += 1;
      console.log(`  — slug inconnu en DB : ${slug}`);
    }
  }
}

console.log(`\n${dryRun ? 'Dry-run' : 'Mis à jour'} : ${updated} | ignorés/absents : ${skipped}`);
await client.end();
