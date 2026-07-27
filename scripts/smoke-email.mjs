import nodemailer from 'nodemailer';
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

const host = env.EMAIL_SMTP_HOST || 'smtp.hostinger.com';
const port = Number(env.EMAIL_SMTP_PORT || 465);
const secure = String(env.EMAIL_SMTP_SECURE ?? 'true').toLowerCase() === 'true';
const user = env.EMAIL_SMTP_USER || '';
const pass = env.EMAIL_SMTP_PASS || '';
const from = env.EMAIL_DEFAULT_FROM || user;
const to = env.ORDERS_NOTIFY_EMAIL || '';

if (!user || !pass) {
  console.error('❌ EMAIL_SMTP_USER / EMAIL_SMTP_PASS manquants dans .env');
  process.exit(1);
}
if (!to) {
  console.error('❌ ORDERS_NOTIFY_EMAIL manquant dans .env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

try {
  await transporter.verify();
  console.log('✅ SMTP connecté', { host, port, secure, user });
} catch (error) {
  console.error('❌ SMTP verify échoué:', error.message);
  process.exit(1);
}

const info = await transporter.sendMail({
  from,
  to,
  subject: '[Nyra] Test email commandes',
  text: [
    'Test envoi Nyra — si tu reçois ce mail, SMTP Hostinger OK.',
    '',
    `De   : ${from}`,
    `Vers : ${to}`,
    `Date : ${new Date().toISOString()}`,
  ].join('\n'),
});

console.log('✅ Mail envoyé', { messageId: info.messageId, to });
