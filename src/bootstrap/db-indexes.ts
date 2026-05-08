import type { Core } from '@strapi/strapi';

const INDEX_SQL = `
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Index simples sur les colonnes fréquemment utilisées par Strapi Admin.
  FOR rec IN
    SELECT c.table_schema, c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name IN (
        'document_id',
        'locale',
        'published_at',
        'created_at',
        'updated_at',
        'slug',
        'canonical_path',
        'sku',
        'name',
        'format',
        'label',
        'city',
        'country',
        'price',
        'compare_at_price',
        'rating',
        'reviews',
        'stock',
        'is_active',
        'position',
        'quantity',
        'status',
        'is_default',
        'viewed_at',
        'event_name',
        'checkout_session_id',
        'item_id',
        'cart_hash',
        'step',
        'reason',
        'dedupe_key',
        'dedupe_bucket',
        'checkout_id',
        'order_id',
        'order_number',
        'payment_intent_id',
        'expires_at',
        'category_id',
        'product_id',
        'variant_id',
        'user_id'
      )
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%I)',
      'idx_' || rec.table_name || '_' || rec.column_name,
      rec.table_schema,
      rec.table_name,
      rec.column_name
    );
  END LOOP;

  -- Index composite utile pour les requêtes document+locale.
  FOR rec IN
    SELECT c1.table_schema, c1.table_name
    FROM information_schema.columns c1
    JOIN information_schema.columns c2
      ON c2.table_schema = c1.table_schema
     AND c2.table_name = c1.table_name
    JOIN information_schema.tables t
      ON t.table_schema = c1.table_schema
     AND t.table_name = c1.table_name
    WHERE c1.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c1.column_name = 'document_id'
      AND c2.column_name = 'locale'
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%I, %I)',
      'idx_' || rec.table_name || '_document_locale',
      rec.table_schema,
      rec.table_name,
      'document_id',
      'locale'
    );
  END LOOP;
END $$;
`;

export async function ensureNyraDbIndexes(strapi: Core.Strapi) {
  const client = strapi.config.get('database.connection.client');
  if (client !== 'postgres') {
    strapi.log.info('[nyra-db-indexes] Skip: client non-PostgreSQL.');
    return;
  }

  try {
    await strapi.db.connection.raw(INDEX_SQL);
    strapi.log.info('[nyra-db-indexes] Index PostgreSQL vérifiés/appliqués.');
  } catch (err) {
    strapi.log.error('[nyra-db-indexes] Erreur lors de la création des index.', err);
  }
}
