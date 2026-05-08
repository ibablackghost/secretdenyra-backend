import { factories } from '@strapi/strapi';

type AnyRecord = Record<string, any>;

const publishedOnly = { publishedAt: { $notNull: true } };

const publicMedia = (media?: AnyRecord | null) => {
  if (!media) return null;

  return {
    url: media.url,
    alternativeText: media.alternativeText ?? null,
    width: media.width ?? null,
    height: media.height ?? null,
    formats: media.formats ?? null,
  };
};

const publicCategory = (category: AnyRecord) => ({
  id: String(category.documentId ?? category.id),
  slug: category.slug,
  name: category.name,
  image: publicMedia(category.image),
  metaTitle: category.metaTitle ?? null,
  metaDescription: category.metaDescription ?? null,
  canonicalUrl: category.canonicalUrl ?? null,
  canonicalPath: category.canonicalPath ?? null,
  ogImage: publicMedia(category.ogImage),
});

export default factories.createCoreController('api::category.category', ({ strapi }) => ({
  async findBySlug(ctx) {
    const slug = String(ctx.params.slug ?? ctx.params.id ?? '').trim();
    if (!slug) return ctx.badRequest('Le slug catégorie est requis.');

    const category = await strapi.db.query('api::category.category').findOne({
      where: { ...publishedOnly, slug },
      populate: {
        image: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
        ogImage: { fields: ['url', 'alternativeText', 'width', 'height', 'formats'] },
      },
    });

    if (!category) return ctx.notFound('Catégorie introuvable.');
    ctx.body = { category: publicCategory(category) };
  },
}));
