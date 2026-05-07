import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Database => {
  const connectionString = env('DATABASE_URL');
  const host = env('DATABASE_HOST');
  const database = env('DATABASE_NAME');
  const user = env('DATABASE_USERNAME');
  const password = env('DATABASE_PASSWORD');

  const hasConnectionString = Boolean(connectionString);
  const hasSplitConfig = Boolean(host && database && user && password);

  if (!hasConnectionString && !hasSplitConfig) {
    throw new Error(
      'PostgreSQL requis: définis DATABASE_URL ou (DATABASE_HOST, DATABASE_NAME, DATABASE_USERNAME, DATABASE_PASSWORD).',
    );
  }

  return {
    connection: {
      client: 'postgres',
      connection: {
        connectionString,
        host: host ?? 'localhost',
        port: env.int('DATABASE_PORT', 5432),
        database: database ?? 'strapi',
        user: user ?? 'strapi',
        password: password ?? 'strapi',
        ssl: env.bool('DATABASE_SSL', false) && {
          key: env('DATABASE_SSL_KEY', undefined),
          cert: env('DATABASE_SSL_CERT', undefined),
          ca: env('DATABASE_SSL_CA', undefined),
          capath: env('DATABASE_SSL_CAPATH', undefined),
          cipher: env('DATABASE_SSL_CIPHER', undefined),
          rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', true),
        },
        schema: env('DATABASE_SCHEMA', 'public'),
      },
      pool: { min: env.int('DATABASE_POOL_MIN', 2), max: env.int('DATABASE_POOL_MAX', 10) },
      acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
    },
  };
};

export default config;
