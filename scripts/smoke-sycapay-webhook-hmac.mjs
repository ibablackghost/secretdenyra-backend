import { createHmac } from 'crypto';
import { readFileSync } from 'fs';

/**
 * Test local HMAC webhook Sycapay (doc officielle).
 * Usage : node scripts/smoke-sycapay-webhook-hmac.mjs
 */
const env = Object.fromEntries(
  readFileSync('./.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const secret = env.SYCAPAY_WEBHOOK_SECRET || '';
if (!secret) {
  console.error('❌ SYCAPAY_WEBHOOK_SECRET manquant dans .env');
  process.exit(1);
}

const body = Buffer.from(
  JSON.stringify({
    idPartenaire: '1567543354332142125129',
    idPartenaireService: 'CI251122.1336.A16800',
    tag: 'SUCCESS',
    codeService: 'SN_CASHIN_YAS',
    reasonForFailure: 'Vous avez atteint votre plafond journalier',
  }),
);

const digest = createHmac('sha256', secret).update(body).digest('hex');
const header = `sha256=${digest}`;

console.log('Body (bytes):', body.length);
console.log('X-Sycapay-Signature:', header);
console.log('');
console.log('Test curl (remplace l’URL si besoin) :');
console.log(`curl -i -X POST "https://secretdenyra-backend-production.up.railway.app/api/webhooks/sycapay" \\
  -H "Content-Type: application/json" \\
  -H "X-Sycapay-Signature: ${header}" \\
  --data-raw '${body.toString()}'`);
