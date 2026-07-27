/**
 * Nettoie les paiements / checkouts de test (PENDING, PayTech legacy).
 *
 * Usage :
 *   node scripts/cleanup-pending-payments.mjs
 *   node scripts/cleanup-pending-payments.mjs --dry-run
 *
 * Lit DATABASE_URL depuis .env (Railway OK).
 */
import { readFileSync } from 'fs';
import pg from 'pg';

const dryRun = process.argv.includes('--dry-run');

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

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const count = async (sql, params = []) => {
  const { rows } = await client.query(sql, params);
  return Number(rows[0]?.c ?? 0);
};

const pendingPayments = await count(
  `SELECT COUNT(*)::int AS c FROM payments WHERE status = 'PENDING'`,
);
const paytechPayments = await count(
  `SELECT COUNT(*)::int AS c FROM payments WHERE LOWER(provider) = 'paytech'`,
);
const pendingCheckouts = await count(
  `SELECT COUNT(*)::int AS c FROM checkouts WHERE status IN ('payment_pending', 'draft')`,
);

console.log('Avant :');
console.log('  payments PENDING :', pendingPayments);
console.log('  payments paytech :', paytechPayments);
console.log('  checkouts draft/payment_pending :', pendingCheckouts);

if (dryRun) {
  console.log('\n--dry-run : aucune suppression.');
  await client.end();
  process.exit(0);
}

const delPending = await client.query(`DELETE FROM payments WHERE status = 'PENDING' RETURNING id`);
const delPaytech = await client.query(
  `DELETE FROM payments WHERE LOWER(provider) = 'paytech' RETURNING id`,
);
const delCheckouts = await client.query(
  `DELETE FROM checkouts WHERE status IN ('payment_pending', 'draft') RETURNING id`,
);

console.log('\nSupprimé :');
console.log('  payments PENDING :', delPending.rowCount);
console.log('  payments paytech :', delPaytech.rowCount);
console.log('  checkouts draft/payment_pending :', delCheckouts.rowCount);
console.log('\n✅ Cleanup terminé. Les commandes SUCCESS / paid sont intactes.');

await client.end();
