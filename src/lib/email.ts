import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';

// ---------------------------------------------------------------------------
// Configuration (paramètres admin /pam/settings -> system_settings, repli env)
// ---------------------------------------------------------------------------

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  fromName?: string;
  replyTo?: string;
  brandName?: string;
  tagline?: string;
  logoUrl?: string;
  footer?: string;
}

let cachedConfig: EmailConfig | null | undefined;

export async function getEmailConfig(): Promise<EmailConfig | null> {
  if (cachedConfig !== undefined) return cachedConfig;

  const keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'smtp_from_name', 'mail_reply_to', 'mail_brand_name', 'mail_tagline', 'mail_logo_url', 'mail_footer'];
  const rows = await db
    .select({ key: systemSettings.key, value: systemSettings.value })
    .from(systemSettings)
    .where(inArray(systemSettings.key, keys))
    .catch(() => []);

  const map: Record<string, string> = {};
  (rows || []).forEach((r) => (map[r.key] = r.value));

  const host = map.smtp_host || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(map.smtp_port || process.env.SMTP_PORT || 465);
  const user = map.smtp_user || process.env.SMTP_USER || '';
  const pass = map.smtp_pass || process.env.SMTP_PASS || '';
  const from = map.smtp_from || process.env.MAIL_FROM || 'notifications@posmarket.app';
  const fromName = map.smtp_from_name || process.env.MAIL_FROM_NAME || '';
  const replyTo = map.mail_reply_to || process.env.MAIL_REPLY_TO || '';
  const brandName = map.mail_brand_name || process.env.MAIL_BRAND_NAME || 'PosMarket';
  const tagline = map.mail_tagline !== undefined ? map.mail_tagline : (process.env.MAIL_TAGLINE || '');
  const logoUrl = map.mail_logo_url || process.env.MAIL_LOGO_URL || '';
  const footer = map.mail_footer !== undefined ? map.mail_footer : (process.env.MAIL_FOOTER || '');

  const configured = !!(host && user && pass);
  cachedConfig = configured
    ? {
        host,
        port,
        user,
        pass,
        from,
        fromName: fromName || undefined,
        replyTo: replyTo || undefined,
        brandName,
        tagline: tagline || undefined,
        logoUrl: logoUrl || undefined,
        footer: footer || undefined,
      }
    : null;
  return cachedConfig;
}

export function invalidateEmailConfigCache(): void {
  cachedConfig = undefined;
}

export async function isEmailConfigured(): Promise<boolean> {
  return !!(await getEmailConfig());
}

// ---------------------------------------------------------------------------
// Transporteur (recherché en cache, créé à la demande)
// ---------------------------------------------------------------------------

let transporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter | null> {
  const cfg = await getEmailConfig();
  if (!cfg) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });

  return transporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ filename?: string; content?: Buffer | string; path?: string; contentType?: string }>;
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ messageId?: string; error?: string }> {
  const cfg = await getEmailConfig();
  const tx = await getTransporter();
  if (!cfg || !tx) {
    return { error: 'SMTP non configuré (paramètres admin > Email)' };
  }
  const to = String(opts.to || '').trim();
  if (!to || !to.includes('@')) {
    return { error: `Adresse email invalide : "${opts.to}"` };
  }

  try {
    const from =
      cfg.fromName && !cfg.from.includes('<')
        ? `"${cfg.fromName.replace(/"/g, '')}" <${cfg.from}>`
        : cfg.from;
    const info = await tx.sendMail({
      from,
      to,
      replyTo: cfg.replyTo || undefined,
      subject: opts.subject,
      html: opts.html,
      text: opts.text || stripHtml(opts.html),
      attachments: opts.attachments && opts.attachments.length > 0 ? opts.attachments : undefined,
    });
    return { messageId: String(info.messageId || '') };
  } catch (err) {
    return { error: `SMTP ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ---------------------------------------------------------------------------
// Templating (HTML inline, responsive)
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(html: string): string {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface RenderInput {
  title?: string;
  body?: string;
  /** [eventType] params ordonnés (ex. n° commande, nom boutique, montant...) */
  params?: string[];
  storeName?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface Brand {
  brandName?: string;
  tagline?: string;
  logoUrl?: string;
  footer?: string;
}

const layout = (content: string, brand: Brand = {}): string => {
  const name = escapeHtml(brand.brandName || 'PosMarket');
  const tagline = brand.tagline ? escapeHtml(brand.tagline) : '';
  const logoUrl = brand.logoUrl ? escapeHtml(brand.logoUrl) : '';
  const footer = brand.footer
    ? escapeHtml(brand.footer).replace(/\n/g, '<br/>')
    : `© ${new Date().getFullYear()} ${name} — Bénin / Côte d'Ivoire<br/>Cet email vous est envoyé suite à une activité sur votre compte.`;

  const header = logoUrl
    ? `<img src="${logoUrl}" alt="${name}" width="150" style="max-width:150px;height:auto;display:block;" />`
    : `<div style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">${name}</div>`;
  const tag = tagline ? `<div style="color:#ffe6d8;font-size:12px;font-weight:600;margin-top:2px;">${tagline}</div>` : '';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${name}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #eef1f5;box-shadow:0 8px 30px rgba(0,0,0,0.05);">
          <tr>
            <td style="background:#f56b2a;padding:22px 28px;">
              ${header}
              ${tag}
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:16px 28px;border-top:1px solid #eef1f5;">
              <div style="color:#94a3b8;font-size:11px;line-height:1.6;text-align:center;">
                ${footer}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

const SUBJECTS: Record<string, string> = {
  CONFIRMATION_COMMANDE: 'Confirmation de commande',
  COMMANDE_PRET: 'Votre commande est prête',
  COMMANDE_EXPEDIEE: 'Votre commande a été expédiée',
  COMMANDE_LIVREE: 'Votre commande a été livrée',
  COMMANDE_ANNULEE: 'Votre commande a été annulée',
  RECU_PAIEMENT: 'Reçu de paiement',
  RELANCE_PANIER_ABANDONNE: 'Votre panier vous attend',
  NOUVELLE_COMMANDE: 'Nouvelle commande reçue',
  NOUVEAU_CLIENT: 'Nouveau client enregistré',
  ALERTE_STOCK_BAS: 'Alerte stock bas',
  RUPTURE_STOCK: 'Rupture de stock',
  VENTE_POS: 'Vente en boutique',
  FACTURE_PAYEE: 'Facture payée',
  JALON_MILESTONE: 'Félicitations !',
  BIENVENUE: 'Bienvenue sur PosMarket',
  ABONNEMENT_ACTIVE: 'Abonnement activé',
  ABONNEMENT_EXPIRANT: 'Votre abonnement expire bientôt',
  ABONNEMENT_EXPIRE: 'Votre abonnement a expiré',
  BOUTIQUE_APPROUVEE: 'Votre boutique est en ligne !',
  BOUTIQUE_REJETEE: 'Boutique non approuvée',
  VERIFICATION_COMPTE_OK: 'Compte vérifié',
  NOUVELLE_INSCRIPTION: 'Nouvelle inscription',
  COMMANDE_A_PREPARER: 'Nouvelle commande à préparer',
  DEMANDE_AVIS: 'Donnez votre avis',
  NOUVEL_AVIS: 'Nouvel avis reçu',
  BOUTIQUE_EN_ATTENTE: 'Boutique en attente d\'approbation',
  RAPPORT_VENDEUR_HEBDO: 'Votre rapport hebdomadaire',
  RAPPORT_ADMIN: 'Rapport hebdomadaire PosMarket',
  RECAP_VENTES_JOUR: 'Récap des ventes du jour',
  ALERTE_TECHNIQUE: 'Alerte technique PosMarket',
  PAIEMENT_INCIDENT: 'Paiement en erreur',
};

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;color:#475569;font-size:15px;line-height:1.6;">${escapeHtml(text)}</p>`;
}

export async function renderEmailEvent(eventKey: string, input: RenderInput = {}): Promise<RenderedEmail> {
  const cfg = await getEmailConfig();
  const brand: Brand = {
    brandName: cfg?.brandName,
    tagline: cfg?.tagline,
    logoUrl: cfg?.logoUrl,
    footer: cfg?.footer,
  };
  const body = String(input.body || '');
  const params = Array.isArray(input.params) ? input.params : [];
  const storeName = input.storeName ? ` chez ${input.storeName}` : '';
  const subject = SUBJECTS[eventKey] || input.title || `Notification ${cfg?.brandName || 'PosMarket'}`;

  let content = '';
  if (eventKey === 'CONFIRMATION_COMMANDE' && params.length >= 3) {
    content = `
      ${paragraph(`Bonjour, votre commande <b>#${escapeHtml(params[0])}</b>${storeName} est confirmée.`)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7f0;border:1px solid #fde3d2;border-radius:14px;margin:0 0 14px;">
        <tr><td style="padding:16px 20px;color:#9a3412;font-size:14px;font-weight:700;">Total : ${escapeHtml(params[2])} FCFA</td></tr>
      </table>`;
  } else if (eventKey === 'RECU_PAIEMENT' && params.length >= 2) {
    content = `
      ${paragraph(`Votre paiement de <b>${escapeHtml(params[0])} FCFA</b> a été reçu pour la commande <b>#${escapeHtml(params[1])}</b>.`)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:14px;margin:0 0 14px;">
        <tr><td style="padding:16px 20px;color:#065f46;font-size:14px;font-weight:700;">✓ Paiement confirmé</td></tr>
      </table>`;
  } else {
    const enriched = body
      .replace(/%STORE%/g, storeName)
      .replace(/pas(?:sé|té|is)/gi, '')
      .trim();
    content = paragraph(enriched || (input.title || subject));
  }

  const html = layout(content, brand);
  return { subject, html, text: stripHtml(html) };
}