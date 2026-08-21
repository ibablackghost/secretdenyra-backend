/**
 * Remplit les champs *En via PostgreSQL (sans charger Strapi ESM).
 *
 * Usage :
 *   node scripts/fill-catalog-en-fields.mjs --dry-run
 *   node scripts/fill-catalog-en-fields.mjs
 *   node scripts/fill-catalog-en-fields.mjs --only=categories,tags
 */
import { readFileSync } from 'fs';
import pg from 'pg';

const dryRun = process.argv.includes('--dry-run');
const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const ONLY = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim())) : null;
const shouldRun = (section) => !ONLY || ONLY.has(section);

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
  console.error('❌ DATABASE_URL manquant dans .env');
  process.exit(1);
}

const CATEGORY_EN = {
  tisanes: {
    name_en: 'Herbal teas',
    meta_title_en: 'Organic herbal teas | Nyra',
    meta_description_en: 'Discover Nyra organic herbal teas.',
  },
  'thes-bio': {
    name_en: 'Organic teas',
    meta_title_en: 'Organic teas | Nyra',
    meta_description_en: 'Discover Nyra organic teas.',
  },
  thes: {
    name_en: 'Organic teas',
    meta_title_en: 'Organic teas | Nyra',
    meta_description_en: 'Discover Nyra organic teas.',
  },
  cafes: {
    name_en: 'Coffees',
    meta_title_en: 'Organic coffees | Nyra',
    meta_description_en: 'Discover Nyra organic coffees.',
  },
  herboristerie: {
    name_en: 'Herbal shop',
    meta_title_en: 'Herbal shop | Nyra',
    meta_description_en: 'Herbs and botanicals from Nyra.',
  },
  accessoires: {
    name_en: 'Accessories',
    meta_title_en: 'Tea accessories | Nyra',
    meta_description_en: 'Teapots, filters and accessories.',
  },
  mode: {
    name_en: 'Fashion',
    meta_title_en: 'Fashion | Nyra',
    meta_description_en: 'Nyra fashion collection.',
  },
};

const TAG_EN = {
  tisane: 'herbal tea',
  bio: 'organic',
  vrac: 'loose leaf',
  digestion: 'digestion',
  detente: 'relax',
  'détente': 'relax',
  sommeil: 'sleep',
  energie: 'energy',
  'énergie': 'energy',
  the: 'tea',
  'thé': 'tea',
  cafe: 'coffee',
  'café': 'coffee',
  accessoire: 'accessory',
  mode: 'fashion',
  fulani: 'fulani',
};

const PHRASE_REPLACEMENTS = [
  [/en vrac/gi, 'loose leaf'],
  [/tisane/gi, 'herbal tea'],
  [/thés?\s+bio/gi, 'organic tea'],
  [/thé\s+noir/gi, 'black tea'],
  [/thé\s+vert/gi, 'green tea'],
  [/thé\s+blanc/gi, 'white tea'],
  [/infusion/gi, 'brew'],
  [/sachet/gi, 'bag'],
  [/ingrédients?/gi, 'ingredients'],
  [/herboristerie/gi, 'herbal shop'],
  [/bio\b/gi, 'organic'],
  [/nature\b/gi, 'plain'],
  [/ensemble\b/gi, 'set'],
];

const translateText = (value) => {
  if (value == null || value === '') return value;
  let out = String(value);
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) out = out.replace(pattern, replacement);
  return out;
};

const filled = (v) => v != null && String(v).trim() !== '';

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const tableColumns = async (table) => {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
    [table],
  );
  return new Set(rows.map((r) => r.column_name));
};

const ensureColumns = async (table, columns) => {
  const existing = await tableColumns(table);
  for (const [name, sqlType] of Object.entries(columns)) {
    if (existing.has(name)) continue;
    const ddl = `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${name}" ${sqlType}`;
    console.log(`${dryRun ? '[DRY] ' : ''}${ddl}`);
    if (!dryRun) await client.query(ddl);
  }
  return tableColumns(table);
};

const stats = { categories: 0, tags: 0, products: 0, variants: 0, skipped: 0 };

try {
  if (shouldRun('categories')) {
    const cols = await ensureColumns('categories', {
      name_en: 'varchar(255)',
      meta_title_en: 'varchar(255)',
      meta_description_en: 'text',
    });
    const selectNameEn = cols.has('name_en') ? 'name_en' : 'NULL::text AS name_en';
    const { rows } = await client.query(
      `SELECT id, slug, name, meta_title, meta_description, ${selectNameEn} FROM categories`,
    );
    for (const row of rows) {
      if (filled(row.name_en)) {
        stats.skipped += 1;
        continue;
      }
      const mapped = CATEGORY_EN[row.slug] ?? {
        name_en: translateText(row.name),
        meta_title_en: translateText(row.meta_title) || null,
        meta_description_en: translateText(row.meta_description) || null,
      };
      console.log(`${dryRun ? '[DRY] ' : ''}category ${row.slug} → ${mapped.name_en}`);
      if (!dryRun) {
        await client.query(
          `UPDATE categories SET name_en=$1, meta_title_en=$2, meta_description_en=$3 WHERE id=$4`,
          [mapped.name_en, mapped.meta_title_en ?? null, mapped.meta_description_en ?? null, row.id],
        );
      }
      stats.categories += 1;
    }
  }

  if (shouldRun('tags')) {
    const cols = await ensureColumns('tags', { name_en: 'varchar(255)' });
    const selectNameEn = cols.has('name_en') ? 'name_en' : 'NULL::text AS name_en';
    const { rows } = await client.query(`SELECT id, slug, name, ${selectNameEn} FROM tags`);
    for (const row of rows) {
      if (filled(row.name_en)) {
        stats.skipped += 1;
        continue;
      }
      const nameEn = TAG_EN[String(row.name).trim().toLowerCase()] ?? translateText(row.name);
      console.log(`${dryRun ? '[DRY] ' : ''}tag ${row.slug} → ${nameEn}`);
      if (!dryRun) {
        await client.query(`UPDATE tags SET name_en=$1 WHERE id=$2`, [nameEn, row.id]);
      }
      stats.tags += 1;
    }
  }

  if (shouldRun('products')) {
    const cols = await ensureColumns('products', {
      name_en: 'varchar(255)',
      ingredients_en: 'text',
      short_description_en: 'text',
      description_en: 'text',
      dosage_en: 'varchar(255)',
      infusion_time_en: 'varchar(255)',
      temperature_en: 'varchar(255)',
      origin_en: 'varchar(255)',
      meta_title_en: 'varchar(255)',
      meta_description_en: 'text',
    });
    const selectNameEn = cols.has('name_en') ? 'name_en' : 'NULL::text AS name_en';
    const { rows } = await client.query(
      `SELECT id, slug, name, ingredients, short_description, description, dosage, infusion_time, temperature, origin, meta_title, meta_description, ${selectNameEn} FROM products`,
    );
    for (const row of rows) {
      if (filled(row.name_en)) {
        stats.skipped += 1;
        continue;
      }
      const data = {
        name_en: translateText(row.name),
        ingredients_en: translateText(row.ingredients) || row.ingredients,
        short_description_en: translateText(row.short_description) || null,
        description_en: translateText(row.description) || null,
        dosage_en: translateText(row.dosage) || null,
        infusion_time_en: translateText(row.infusion_time) || null,
        temperature_en: translateText(row.temperature) || null,
        origin_en: translateText(row.origin) || null,
        meta_title_en: translateText(row.meta_title) || null,
        meta_description_en: translateText(row.meta_description) || null,
      };
      console.log(`${dryRun ? '[DRY] ' : ''}product ${row.slug} → ${data.name_en}`);
      if (!dryRun) {
        await client.query(
          `UPDATE products SET
            name_en=$1, ingredients_en=$2, short_description_en=$3, description_en=$4,
            dosage_en=$5, infusion_time_en=$6, temperature_en=$7, origin_en=$8,
            meta_title_en=$9, meta_description_en=$10
           WHERE id=$11`,
          [
            data.name_en,
            data.ingredients_en,
            data.short_description_en,
            data.description_en,
            data.dosage_en,
            data.infusion_time_en,
            data.temperature_en,
            data.origin_en,
            data.meta_title_en,
            data.meta_description_en,
            row.id,
          ],
        );
      }
      stats.products += 1;
    }
  }

  if (shouldRun('variants')) {
    const cols = await ensureColumns('variants', {
      name_en: 'varchar(255)',
      format_en: 'varchar(255)',
      label_en: 'varchar(255)',
      size_en: 'varchar(255)',
      color_name_en: 'varchar(255)',
    });
    const selectNameEn = cols.has('name_en') ? 'name_en' : 'NULL::text AS name_en';
    const { rows } = await client.query(
      `SELECT id, sku, name, format, label, size, color_name, ${selectNameEn} FROM variants`,
    );
    for (const row of rows) {
      if (filled(row.name_en)) {
        stats.skipped += 1;
        continue;
      }
      const data = {
        name_en: translateText(row.name),
        format_en: translateText(row.format) || row.format,
        label_en: translateText(row.label) || null,
        size_en: translateText(row.size) || null,
        color_name_en: translateText(row.color_name) || null,
      };
      console.log(`${dryRun ? '[DRY] ' : ''}variant ${row.sku}`);
      if (!dryRun) {
        await client.query(
          `UPDATE variants SET name_en=$1, format_en=$2, label_en=$3, size_en=$4, color_name_en=$5 WHERE id=$6`,
          [data.name_en, data.format_en, data.label_en, data.size_en, data.color_name_en, row.id],
        );
      }
      stats.variants += 1;
    }
  }

  console.log('\nRésumé', { dryRun, ...stats });
} finally {
  await client.end();
}
