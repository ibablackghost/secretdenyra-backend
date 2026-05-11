import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type AnyRecord = Record<string, any>;

type ImportOptions = {
  dryRun?: boolean;
  importImages?: boolean;
};

type ImportReport = {
  dryRun: boolean;
  totalRows: number;
  productsFound: number;
  variantsFound: number;
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  tagsCreated: number;
  tagsUpdated: number;
  imagesImported: number;
  errors: Array<{ scope: string; message: string }>;
};

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
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

  return rows.filter((candidate) => candidate.some((cell) => String(cell).trim()));
};

const rowsToRecords = (rows: string[][]) => {
  const headers = rows[0].map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, '') : header));
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
};

const stripAccents = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const slugify = (value: string) =>
  stripAccents(String(value ?? '').toLowerCase())
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const parsePrice = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseWeight = (value: unknown) => {
  const match = String(value ?? '').match(/(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)/i);
  if (!match) return { value: null, unit: 'g' };

  return {
    value: Number.parseFloat(match[1].replace(',', '.')),
    unit: match[2].toLowerCase(),
  };
};

const publishedAtFor = (status: unknown) => (String(status).toLowerCase() === 'published' ? new Date().toISOString() : null);

const relationId = (entity: AnyRecord | null | undefined) => entity?.id ?? entity?.documentId;

const createReport = (dryRun: boolean): ImportReport => ({
  dryRun,
  totalRows: 0,
  productsFound: 0,
  variantsFound: 0,
  productsCreated: 0,
  productsUpdated: 0,
  variantsCreated: 0,
  variantsUpdated: 0,
  tagsCreated: 0,
  tagsUpdated: 0,
  imagesImported: 0,
  errors: [],
});

const findOne = async (strapi: any, uid: string, where: AnyRecord, populate?: AnyRecord) =>
  strapi.db.query(uid).findOne({
    where,
    ...(populate ? { populate } : {}),
  });

const upsert = async (
  strapi: any,
  report: ImportReport,
  uid: string,
  where: AnyRecord,
  data: AnyRecord,
  counters: { created: keyof ImportReport; updated: keyof ImportReport },
  populate?: AnyRecord,
) => {
  const existing = await findOne(strapi, uid, where, populate);

  if (report.dryRun) {
    if (existing) {
      (report[counters.updated] as number) += 1;
      return existing;
    }

    (report[counters.created] as number) += 1;
    return { id: `${uid}:${Object.values(where).join(':')}`, ...data };
  }

  if (existing) {
    (report[counters.updated] as number) += 1;
    return strapi.db.query(uid).update({
      where: { id: existing.id },
      data,
      ...(populate ? { populate } : {}),
    });
  }

  (report[counters.created] as number) += 1;
  return strapi.db.query(uid).create({
    data,
    ...(populate ? { populate } : {}),
  });
};

const mediaTypeFor = (fileName: string, fallback?: string | null) => {
  if (fallback) return fallback;
  if (fileName.endsWith('.png')) return 'image/png';
  if (fileName.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

const uploadImage = async (strapi: any, report: ImportReport, cache: Map<string, number>, url: string, alt: string) => {
  if (!url || report.dryRun) return null;
  if (cache.has(url)) return cache.get(url) ?? null;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      report.errors.push({ scope: 'image', message: `Image ignoree (${response.status}): ${url}` });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const urlPath = new URL(url).pathname;
    const fileName = path.basename(urlPath) || `tisane-${Date.now()}.jpg`;
    const tempPath = path.join(os.tmpdir(), `${Date.now()}-${fileName}`);
    fs.writeFileSync(tempPath, buffer);

    const uploaded = await strapi.plugin('upload').service('upload').upload({
      data: {
        fileInfo: {
          alternativeText: alt,
          caption: alt,
        },
      },
      files: {
        path: tempPath,
        name: fileName,
        type: mediaTypeFor(fileName, response.headers.get('content-type')),
        size: buffer.length,
      },
    });

    fs.unlinkSync(tempPath);

    const media = Array.isArray(uploaded) ? uploaded[0] : uploaded;
    if (media?.id) {
      cache.set(url, media.id);
      report.imagesImported += 1;
      return media.id;
    }
  } catch (error: any) {
    report.errors.push({ scope: 'image', message: `${url}: ${error.message}` });
  }

  return null;
};

const ensureTag = async (strapi: any, report: ImportReport, cache: Map<string, AnyRecord>, tagName: string) => {
  const slug = slugify(tagName);
  if (cache.has(slug)) return cache.get(slug);

  const tag = await upsert(
    strapi,
    report,
    'api::tag.tag',
    { slug },
    {
      name: tagName,
      slug,
      publishedAt: new Date().toISOString(),
    },
    { created: 'tagsCreated', updated: 'tagsUpdated' },
  );

  cache.set(slug, tag);
  return tag;
};

export const importTisanesCsv = async (strapi: any, csvContent: string, options: ImportOptions = {}) => {
  const report = createReport(Boolean(options.dryRun));
  const importImages = options.importImages !== false;
  const rows = parseCsv(csvContent);
  const records = rowsToRecords(rows);
  const parents = records.filter((record) => record.Type === 'variable');
  const variations = records.filter((record) => record.Type === 'variation');
  const variationsByParent = new Map<string, AnyRecord[]>();
  const tagCache = new Map<string, AnyRecord>();
  const imageCache = new Map<string, number>();

  report.totalRows = records.length;
  report.productsFound = parents.length;
  report.variantsFound = variations.length;

  for (const variation of variations) {
    const list = variationsByParent.get(variation.Parent) ?? [];
    list.push(variation);
    variationsByParent.set(variation.Parent, list);
  }

  const category = await upsert(
    strapi,
    report,
    'api::category.category',
    { slug: 'tisanes' },
    {
      name: 'Tisanes',
      slug: 'tisanes',
      metaTitle: 'Tisanes bio | Nyra',
      metaDescription: 'Découvrez les tisanes bio Nyra en vrac, disponibles en plusieurs formats.',
      canonicalPath: '/collections/tisanes',
      publishedAt: new Date().toISOString(),
    },
    { created: 'productsCreated', updated: 'productsUpdated' },
  );

  for (const parent of parents) {
    try {
      const productVariations = variationsByParent.get(parent.SKU) ?? [];
      const prices = productVariations.map((variation) => parsePrice(variation['Regular price'])).filter((price) => price > 0);
      const productPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const existingProduct = await findOne(strapi, 'api::product.product', { slug: parent.Slug }, { image: true });
      const imageId =
        existingProduct?.image?.id ??
        (importImages ? await uploadImage(strapi, report, imageCache, parent.Images, parent['Image alt text']) : null);
      const tags = [];

      for (const tagName of String(parent.Tags ?? '')
        .split('|')
        .map((tag) => tag.trim())
        .filter(Boolean)) {
        const tag = await ensureTag(strapi, report, tagCache, tagName);
        tags.push(relationId(tag));
      }

      const product = await upsert(
        strapi,
        report,
        'api::product.product',
        { slug: parent.Slug },
        {
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
          ...(imageId ? { image: imageId, gallery: [imageId], ogImage: imageId } : {}),
          category: relationId(category),
          tags,
          publishedAt: publishedAtFor(parent.Status),
        },
        { created: 'productsCreated', updated: 'productsUpdated' },
      );

      for (const [index, variation] of productVariations.entries()) {
        const weight = parseWeight(variation['Attribute 1 value(s)']);

        await upsert(
          strapi,
          report,
          'api::variant.variant',
          { sku: variation.SKU },
          {
            name: variation.Name,
            sku: variation.SKU,
            format: variation['Attribute 1 value(s)'],
            label: variation['Attribute 1 value(s)'],
            size: variation['Attribute 1 value(s)'],
            weightValue: weight.value,
            weightUnit: weight.unit,
            price: parsePrice(variation['Regular price']),
            compareAtPrice: parsePrice(variation['Compare at price']) || null,
            stock: parsePrice(variation.Stock) || 0,
            lowStockThreshold: 5,
            isDefault: variation['Attribute 1 value(s)'] === parent['Attribute 1 default'],
            isActive: true,
            position: index,
            product: relationId(product),
            publishedAt: publishedAtFor(variation.Status),
          },
          { created: 'variantsCreated', updated: 'variantsUpdated' },
        );
      }
    } catch (error: any) {
      report.errors.push({ scope: parent.SKU || parent.Name, message: error.message });
    }
  }

  return report;
};
