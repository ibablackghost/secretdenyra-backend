import fs from 'node:fs';
import path from 'node:path';

const STRAPI_URL = process.env.STRAPI_URL ?? 'http://localhost:1337';
const TOKEN = process.env.STRAPI_IMPORT_TOKEN;
const CSV_PATH = path.resolve(process.env.TISANES_CSV_PATH ?? '../produits_tisanes_enrichi.csv');
const DRY_RUN = process.env.DRY_RUN === 'true';

if (!TOKEN && !DRY_RUN) {
  console.error('STRAPI_IMPORT_TOKEN est obligatoire pour importer dans Strapi.');
  process.exit(1);
}

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }

    if (char === ',') {
      row.push(value);
      value = '';
      continue;
    }

    if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }

    if (char !== '\r') value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows;
};

const rowsToRecords = (rows) => {
  const headers = rows[0].map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, '') : header));
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
};

const api = async (path, options = {}) => {
  if (DRY_RUN && options.method && options.method !== 'GET') {
    return { data: { documentId: `dry_${Date.now()}`, id: Date.now() } };
  }

  const response = await fetch(`${STRAPI_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} -> ${response.status}: ${JSON.stringify(payload)}`);
  }

  return payload;
};

const relationId = (entity) => entity?.documentId ?? entity?.id;

const firstData = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data[0] ?? null;
  return payload?.data ?? null;
};

const findOne = async (collection, field, value) => {
  const payload = await api(`/api/${collection}?filters[${field}][$eq]=${encodeURIComponent(value)}&pagination[pageSize]=1`);
  return firstData(payload);
};

const createOrUpdate = async (collection, field, value, data) => {
  if (DRY_RUN) {
    console.log(`[DRY_RUN] ${collection}: ${value}`);
    return {
      id: `${collection}_${value}`,
      documentId: `${collection}_${value}`,
      ...data,
    };
  }

  const existing = await findOne(collection, field, value);
  if (existing) {
    const id = existing.documentId ?? existing.id;
    console.log(`MAJ ${collection}: ${value}`);
    return firstData(
      await api(`/api/${collection}/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ data }),
      }),
    );
  }

  console.log(`Creation ${collection}: ${value}`);
  return firstData(
    await api(`/api/${collection}`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    }),
  );
};

const uploadCache = new Map();

const uploadImage = async (url, alt) => {
  if (!url) return null;
  if (uploadCache.has(url)) return uploadCache.get(url);
  if (DRY_RUN) return null;

  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`Image ignoree (${response.status}): ${url}`);
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  const fileName = path.basename(new URL(url).pathname) || 'image.jpg';
  const form = new FormData();
  form.append('files', new Blob([arrayBuffer]), fileName);
  form.append('fileInfo', JSON.stringify({ alternativeText: alt, caption: alt }));

  const uploaded = await api('/api/upload', {
    method: 'POST',
    body: form,
  });

  const media = Array.isArray(uploaded) ? uploaded[0] : null;
  const id = media?.id ?? null;
  uploadCache.set(url, id);
  return id;
};

const parsePrice = (value) => {
  const parsed = Number.parseInt(String(value ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseWeight = (value) => {
  const match = String(value ?? '').match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)/i);
  if (!match) return { value: null, unit: 'g' };
  const amount = Number.parseFloat(match[1].replace(',', '.'));
  return { value: amount, unit: match[2].toLowerCase() };
};

const publishedAtFor = (status) => (String(status).toLowerCase() === 'published' ? new Date().toISOString() : null);

const csvRows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8')).filter((row) => row.some((value) => String(value).trim()));
const records = rowsToRecords(csvRows);
const parents = records.filter((record) => record.Type === 'variable');
const variations = records.filter((record) => record.Type === 'variation');
const variationsByParent = new Map();

for (const variation of variations) {
  const list = variationsByParent.get(variation.Parent) ?? [];
  list.push(variation);
  variationsByParent.set(variation.Parent, list);
}

console.log(`Import tisanes: ${parents.length} produits, ${variations.length} variations.`);
if (DRY_RUN) console.log('Mode DRY_RUN actif: aucune ecriture reelle.');

const category = await createOrUpdate('categories', 'slug', 'tisanes', {
  name: 'Tisanes',
  slug: 'tisanes',
  metaTitle: 'Tisanes bio | Nyra',
  metaDescription: 'Découvrez les tisanes bio Nyra en vrac, disponibles en plusieurs formats.',
  canonicalPath: '/collections/tisanes',
  publishedAt: new Date().toISOString(),
});

const tagCache = new Map();
const ensureTag = async (tagName) => {
  const slug = tagName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (tagCache.has(slug)) return tagCache.get(slug);

  const tag = await createOrUpdate('tags', 'slug', slug, {
    name: tagName,
    slug,
    publishedAt: new Date().toISOString(),
  });
  tagCache.set(slug, tag);
  return tag;
};

for (const parent of parents) {
  const productVariations = variationsByParent.get(parent.SKU) ?? [];
  const prices = productVariations.map((variation) => parsePrice(variation['Regular price'])).filter((price) => price > 0);
  const productPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const imageId = await uploadImage(parent.Images, parent['Image alt text']);
  const tags = [];

  for (const tagName of String(parent.Tags ?? '')
    .split('|')
    .map((tag) => tag.trim())
    .filter(Boolean)) {
    tags.push(relationId(await ensureTag(tagName)));
  }

  const product = await createOrUpdate('products', 'slug', parent.Slug, {
    name: parent.Name,
    slug: parent.Slug,
    ingredients: parent.Description || parent['Short description'] || parent.Name,
    shortDescription: parent['Short description'],
    description: parent.Description,
    dosage: parent.Dosage,
    infusionTime: parent['Temps infusion'],
    temperature: parent.Température,
    origin: parent.Origine,
    botanicalName: parent['Nom botanique'],
    sourceUrl: parent.Link,
    price: productPrice,
    compareAtPrice: parsePrice(parent['Compare at price']) || null,
    rating: 0,
    reviews: 0,
    metaTitle: parent['Meta title'],
    metaDescription: parent['Meta description'],
    canonicalPath: `/produits/${parent.Slug}`,
    image: imageId,
    gallery: imageId ? [imageId] : [],
    ogImage: imageId,
    category: relationId(category),
    tags,
    publishedAt: publishedAtFor(parent.Status),
  });

  for (const [index, variation] of productVariations.entries()) {
    const weight = parseWeight(variation['Attribute 1 value(s)']);
    const price = parsePrice(variation['Regular price']);

    await createOrUpdate('variants', 'sku', variation.SKU, {
      name: variation.Name,
      sku: variation.SKU,
      format: variation['Attribute 1 value(s)'],
      label: variation['Attribute 1 value(s)'],
      size: variation['Attribute 1 value(s)'],
      weightValue: weight.value,
      weightUnit: weight.unit,
      price,
      compareAtPrice: parsePrice(variation['Compare at price']) || null,
      stock: parsePrice(variation.Stock) || 0,
      lowStockThreshold: 5,
      isDefault: variation['Attribute 1 value(s)'] === parent['Attribute 1 default'],
      isActive: true,
      position: index,
      product: relationId(product),
      publishedAt: publishedAtFor(variation.Status),
    });
  }
}

console.log('Import tisanes termine.');
