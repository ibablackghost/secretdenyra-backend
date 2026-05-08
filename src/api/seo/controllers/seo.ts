type SeoEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
};

declare const strapi: any;

const publishedOnly = { publishedAt: { $notNull: true } };

const publicBaseUrl = () => {
  const value = process.env.FRONTEND_URL ?? process.env.PUBLIC_URL ?? 'http://localhost:5173';
  return value.replace(/\/+$/, '');
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const normalizePath = (path: string) => {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
};

const absoluteUrl = (baseUrl: string, path: string) => `${baseUrl}${normalizePath(path)}`;

const sitemapXml = (entries: SeoEntry[]) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>${entry.lastmod ? `
    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''}${entry.changefreq ? `
    <changefreq>${escapeXml(entry.changefreq)}</changefreq>` : ''}${entry.priority ? `
    <priority>${escapeXml(entry.priority)}</priority>` : ''}
  </url>`,
  )
  .join('\n')}
</urlset>`;

export default {
  async sitemap(ctx: any) {
    const baseUrl = publicBaseUrl();
    const [products, categories] = await Promise.all([
      strapi.db.query('api::product.product').findMany({
        where: publishedOnly,
        select: ['slug', 'canonicalPath', 'updatedAt'],
        orderBy: [{ updatedAt: 'desc' }],
        limit: 1000,
      }),
      strapi.db.query('api::category.category').findMany({
        where: publishedOnly,
        select: ['slug', 'canonicalPath', 'updatedAt'],
        orderBy: [{ updatedAt: 'desc' }],
        limit: 1000,
      }),
    ]);

    const entries: SeoEntry[] = [
      { loc: absoluteUrl(baseUrl, '/'), changefreq: 'daily', priority: '1.0' },
      { loc: absoluteUrl(baseUrl, '/shop'), changefreq: 'daily', priority: '0.9' },
      ...categories.map((category: any) => ({
        loc: absoluteUrl(baseUrl, category.canonicalPath ?? `/shop/category/${category.slug}`),
        lastmod: new Date(category.updatedAt).toISOString(),
        changefreq: 'weekly',
        priority: '0.8',
      })),
      ...products.map((product: any) => ({
        loc: absoluteUrl(baseUrl, product.canonicalPath ?? `/product/${product.slug}`),
        lastmod: new Date(product.updatedAt).toISOString(),
        changefreq: 'weekly',
        priority: '0.7',
      })),
    ];

    ctx.type = 'application/xml';
    ctx.body = sitemapXml(entries);
  },

  async robots(ctx: any) {
    const baseUrl = publicBaseUrl();

    ctx.type = 'text/plain';
    ctx.body = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/api/sitemap.xml
`;
  },
};
