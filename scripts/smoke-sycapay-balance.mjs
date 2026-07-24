import https from 'https';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const body = JSON.stringify({
  loginApi: env.SYCAPAY_LOGIN_API,
  mdpApi: env.SYCAPAY_MDP_API,
});

const req = https.request(
  {
    hostname: 'ops.sycapay.com',
    path: '/coresystem/part/api/balance',
    method: 'POST',
    ca: readFileSync('./ca.crt'),
    cert: readFileSync('./client.crt'),
    key: readFileSync('./client.key'),
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  },
  (res) => {
    let d = '';
    res.on('data', (c) => (d += c));
    res.on('end', () => {
      console.log('HTTP', res.statusCode);
      try {
        const j = JSON.parse(d);
        console.log('errorCode', j.errorCode, 'comptes', Array.isArray(j.comptes) ? j.comptes.length : 'n/a');
      } catch {
        console.log(d.slice(0, 200));
      }
    });
  },
);

req.on('error', (e) => console.error('ERR', e.message));
req.write(body);
req.end();
