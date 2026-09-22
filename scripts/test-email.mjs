import { neon } from '@neondatabase/serverless';
import nodemailer from 'nodemailer';
import { config } from 'dotenv';

// Charge la même config que l'app (/pam/settings -> system_settings, repli env)
config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

const mask = (s = '') => (s.length <= 4 ? '****' : `${s.slice(0, 2)}****${s.slice(-2)}`);

const rows = await sql`SELECT key, value FROM system_settings WHERE key IN ('smtp_host','smtp_port','smtp_user','smtp_pass','smtp_from','smtp_from_name','admin_emails')`;

const map = {};
for (const r of rows) map[r.key] = r.value;

const host = map.smtp_host || process.env.SMTP_HOST || 'smtp.gmail.com';
const port = Number(map.smtp_port || process.env.SMTP_PORT || 465);
const user = map.smtp_user || process.env.SMTP_USER || '';
const pass = map.smtp_pass || process.env.SMTP_PASS || '';
const from = map.smtp_from || process.env.MAIL_FROM || user || 'notifications@posmarket.app';
const fromName = map.smtp_from_name || process.env.MAIL_FROM_NAME || '';
const admins = (map.admin_emails || process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const sender = fromName && !from.includes('<') ? `"${fromName}" <${from}>` : from;

console.log('=== Config SMTP lue depuis la base ===');
console.log(`host : ${host}:${port}`);
console.log(`user : ${user}`);
console.log(`pass : ${pass ? mask(pass) + ' (renseigné)' : 'NON renseigné !'}`);
console.log(`expéditeur : ${sender}`);
console.log(`admins renseignés : ${admins.length ? admins.join(', ') : 'aucun'}`);

if (!host || !user || !pass) {
  console.error('\n❌ SMTP incomplet en base (host/user/pass requis). Renseignez /pam/settings.');
  process.exit(1);
}

const recipients = [...new Set([user, ...admins].filter((e) => e && e.includes('@')))];
if (recipients.length === 0) {
  console.error('\n❌ Aucun destinataire (utilisateur SMTP vide).');
  process.exit(1);
}

const tx = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 30000,
});

const html = `
<table role="presentation" width="100%" style="background:#F8FAFC;padding:24px 12px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:20px;border:1px solid #eef1f5;margin:0 auto;">
    <tr><td style="background:#f56b2a;padding:22px 28px;color:#fff;font-size:22px;font-weight:800;">${fromName || 'PosMarket'}</td></tr>
    <tr><td style="padding:28px;">
      <h2 style="margin:0 0 12px;color:#0f172a;font-size:18px;">Test d'envoi d'email réussi ✅</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0;">Votre configuration SMTP fonctionne. Ce message arrive de ${sender}.</p>
    </td></tr>
  </table>
</table>`;

console.log(`\nEnvoi du test à : ${recipients.join(', ')} ...`);

for (const to of recipients) {
  try {
    const info = await tx.sendMail({
      from: sender,
      to,
      subject: `Test ${fromName || 'PosMarket'} — Configuration email OK`,
      html,
    });
    console.log(`  ✅ ${to} -> messageId ${info.messageId}`);
  } catch (err) {
    console.error(`  ❌ ${to} -> ${err?.message || err}`);
  }
}

console.log('\nTerminé.');