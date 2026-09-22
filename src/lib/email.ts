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
  /** Données structurées (champ `d` persisté sur la ligne email de l'outbox). */
  emailData?: Record<string, string | number | null | undefined>;
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

// ---------------------------------------------------------------------------
// Rendu des emails — design épuré type Google, riche en détails par action.
// ---------------------------------------------------------------------------

type EmailData = Record<string, string | number | null | undefined>;

const esc = (v: string | number | null | undefined): string => escapeHtml(String(v ?? ''));

const money = (v: string | number | null | undefined): string => {
  const s = String(v ?? '').trim();
  if (!s) return '—';
  if (/FCFA/i.test(s)) return esc(s);
  return `${esc(s)} FCFA`;
};

const row = (label: string, value: string): string => `
  <tr>
    <td style="padding:10px 0;border-bottom:1px solid #eef1f5;color:#667085;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">${esc(label)}</td>
    <td style="padding:10px 0;border-bottom:1px solid #eef1f5;color:#101828;font-size:14px;font-weight:600;text-align:right;white-space:nowrap;">${value}</td>
  </tr>`;

const rows = (items: Array<[string, string | number | null | undefined]>): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">${items
    .filter(([, v]) => String(v ?? '').trim() !== '' && v !== null)
    .map(([l, v]) => row(l, String(v)))
    .join('')}</table>`;

const badge = (text: string, bg: string, fg: string): string => `
  <span style="display:inline-block;background:${bg};color:${fg};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;padding:5px 12px;border-radius:999px;">${esc(text)}</span>`;

const highlight = (label: string, value: string, note?: string): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f3f4;border-radius:14px;margin:0 0 22px;">
    <tr>
      <td style="padding:18px 22px;">
        <div style="color:#667085;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">${esc(label)}</div>
        <div style="color:#101828;font-size:24px;font-weight:800;letter-spacing:-0.02em;">${value}</div>
        ${note ? `<div style="color:#667085;font-size:13px;margin-top:6px;">${esc(note)}</div>` : ''}
      </td>
    </tr>
  </table>`;

const CTA = (href: string, label: string): string => `
  <p style="margin:0 0 18px;text-align:left;">
    <a href="${esc(href)}" style="display:inline-block;background:#1a73e8;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 26px;border-radius:24px;">${esc(label)}</a>
  </p>`;

const note = (text: string): string =>
  `<p style="margin:0;color:#667085;font-size:13px;line-height:1.7;">${esc(text)}</p>`;

const IMG = { wait: '⏳', ok: '✅', box: '📦', truck: '🚚', cart: '🛒', card: '💳', shop: '🏪', bell: '🔔', person: '👤', warn: '⚠️', out: '⛔', star: '⭐', party: '🎊', rocket: '🚀', ban: '⛔', chart: '📊', trend: '📈', alert: '🚨', news: '📰' };

const hero = (icon: string, title: string, chip: { text: string; bg: string; fg: string } | null, sub?: string): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
    <tr>
      <td>
        <div style="width:56px;height:56px;border-radius:50%;background:#e8f0fe;color:#1a73e8;font-size:26px;text-align:center;line-height:56px;margin-bottom:14px;">${icon}</div>
        <h1 style="margin:0 0 ${chip ? 10 : 6}px;color:#101828;font-size:20px;font-weight:800;letter-spacing:-0.02em;">${esc(title)}</h1>
        ${chip ? `<div style="margin:0 0 6px;">${badge(chip.text, chip.bg, chip.fg)}</div>` : ''}
        ${sub ? `<p style="margin:0;color:#475467;font-size:14px;line-height:1.7;">${esc(sub)}</p>` : ''}
      </td>
    </tr>
  </table>`;

const siteUrl = (): string => process.env.NEXT_PUBLIC_SITE_URL || 'https://posmarket-eight.vercel.app';

const bodyBlock = (_d: EmailData, content: string): string => content;

// Détail du paiement (partagé par les notifications de commande vendeur / préparateur)
function paymentBadge(d: EmailData): { text: string; bg: string; fg: string } {
  return String(d.payment || '').toUpperCase() === 'ESPECES'
    ? { text: 'Espèces', bg: '#fef3c7', fg: '#b45309' }
    : String(d.payment || '').toUpperCase() === 'CARTE'
      ? { text: 'Carte', bg: '#ede9fe', fg: '#6d28d9' }
      : { text: String(d.paymentLabel || 'Paiement'), bg: '#eef1f5', fg: '#475467' };
}

function stars(n: string | number | null | undefined): string {
  const v = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
  return '★'.repeat(v) + '☆'.repeat(5 - v);
}

interface EmailRenderer {
  subject?: string;
  render: (d: EmailData, input: RenderInput) => string;
}

const renderers: Record<string, EmailRenderer> = {
  // ---------------------------------------------------------------- Acheteur
  CONFIRMATION_COMMANDE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.cart, `Commande #${esc(d.order)} confirmée`, { text: 'Confirmée', bg: '#ecfdf3', fg: '#027a48' }, `Votre commande chez ${esc(d.store || 'la boutique')} a été enregistrée.`)}
        ${highlight('Montant total', money(d.total), d.paymentLabel ? `Paiement : ${esc(d.paymentLabel)}` : undefined)}
        ${rows([['Commande', `#${esc(d.order)}`], ['Boutique', esc(d.store)], ['Articles', d.items ? `${esc(d.items)} article(s)` : null], ['Paiement', esc(d.paymentLabel)]])}
        ${CTA(`${siteUrl()}/mon-compte`, 'Suivre ma commande')}
        ${note('Une question sur votre commande ? Contactez directement la boutique.')}`);
    },
  },
  COMMANDE_PRET: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.box, `Commande #${esc(d.order)} prête`, { text: 'À récupérer', bg: '#e8f0fe', fg: '#1a73e8' }, `Votre commande peut être récupérée chez ${esc(d.store || 'la boutique')}.`)}
      ${highlight('Montant total', money(d.total))}
      ${rows([['Commande', `#${esc(d.order)}`], ['Boutique', esc(d.store)]])}
      ${CTA(`${siteUrl()}/mon-compte`, 'Voir ma commande')}
      ${note('Présentez simplement votre numéro de commande lors du retrait.')}`);
    },
  },
  COMMANDE_EXPEDIEE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.truck, `Commande #${esc(d.order)} expédiée`, { text: 'En route', bg: '#ecfdf3', fg: '#027a48' }, `Votre commande ${esc(d.store ? `de ${esc(d.store)} ` : '')}vient d'être expédiée.`)}
      ${highlight('Montant total', money(d.total))}
      ${rows([['Commande', `#${esc(d.order)}`], ['Boutique', esc(d.store)]])}
      ${CTA(`${siteUrl()}/mon-compte`, 'Suivre le suivi')}
      ${note('Vous recevrez une notification dès la livraison.')}`);
    },
  },
  COMMANDE_LIVREE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.ok, `Commande #${esc(d.order)} livrée`, { text: 'Livrée', bg: '#ecfdf3', fg: '#027a48' }, `Votre commande de ${esc(d.store || 'la boutique')} a été livrée. Merci pour votre achat !`)}
      ${highlight('Montant total', money(d.total))}
      ${rows([['Commande', `#${esc(d.order)}`], ['Boutique', esc(d.store)]])}
      ${CTA(`${siteUrl()}/mon-compte`, 'Laisser un avis')}
      ${note('Une remarque sur votre commande ? Contactez la boutique. Votre avis aide les commerçants locaux.')}`);
    },
  },
  COMMANDE_ANNULEE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.ban, `Commande #${esc(d.order)} annulée`, { text: 'Annulée', bg: '#fef3f2', fg: '#b42318' }, `La commande ${esc(d.store ? `de ${esc(d.store)} ` : '')}portant le numéro \u201c#${esc(d.order)}\u201d a été annulée.`)}
      ${rows([['Commande', `#${esc(d.order)}`], ['Boutique', esc(d.store)]])}
      ${CTA(`${siteUrl()}/mon-compte`, 'Mes commandes')}
      ${note('En cas de paiement déjà effectué, le remboursement sera traité par la boutique. Contactez-la pour plus d\u2019informations.')}`);
    },
  },
  RECU_PAIEMENT: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.card, 'Paiement reçu', { text: 'Payé', bg: '#ecfdf3', fg: '#027a48' }, `Le paiement de votre commande #${esc(d.order)} a bien été reçu.`)}
      ${highlight('Montant payé', money(d.total))}
      ${rows([['Commande', `#${esc(d.order)}`], ['Statut', 'Payé']])}
      ${CTA(`${siteUrl()}/mon-compte`, 'Voir le reçu')}
      ${note('Ceci fait office de reçu de paiement pour votre commande.')}`);
    },
  },
  DEMANDE_AVIS: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.star, 'Partagez votre avis', { text: 'Merci !', bg: '#fff7ed', fg: '#c2410c' }, d.store ? `Votre commande #${esc(d.order || '')} de ${esc(d.store)} est terminée. Aidez la boutique à progresser : notez vos produits.` : 'Aidez la boutique à progresser : notez vos produits.')}
      ${rows([['Commande', d.order ? `#${esc(d.order)}` : null], ['Boutique', esc(d.store)]])}
      ${CTA(`${siteUrl()}/mon-compte`, 'Laisser un avis')}
      ${note('Votre avis prend moins d\u2019une minute et compte beaucoup pour les commerçants locaux.')}`);
    },
  },
  RELANCE_PANIER_ABANDONNE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.cart, `Bonjour ${esc(d.name || '')}`, { text: 'En attente', bg: '#fff7ed', fg: '#c2410c' }, `Vous avez laissé ${esc(d.items || 'des articles')} dans votre panier pour un total de ${money(d.total)}.`)}
      ${highlight('Montant du panier', money(d.total))}
      ${rows([['Articles', `${esc(d.items || '—')} article(s)`], ['Montant', money(d.total)]])}
      ${CTA(`${siteUrl()}/`, 'Finaliser ma commande')}
      ${note('Votre panier est conservé. Revenez quand vous voulez pour finaliser votre achat.')}`);
    },
  },
  // --------------------------------------------------------------- Vendeur
  VENTE_POS: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.shop, 'Vente enregistrée', paymentBadge(d), d.store ? `Une vente a été enregistrée en boutique (${esc(d.store)}).` : 'Une vente a été enregistrée en boutique.')}
      ${highlight('Montant de la vente', money(d.total))}
      ${rows([['Commande', `#${esc(d.order)}`], ['Boutique', esc(d.store)], ['Paiement', esc(d.paymentLabel)]])}
      ${CTA(`${siteUrl()}/pam`, 'Ouvrir le panneau')}
      ${note('Le stock a été mis à jour automatiquement.')}`);
    },
  },
  NOUVELLE_COMMANDE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.bell, `Nouvelle commande #${esc(d.order)}`, { text: 'À traiter', bg: '#fef3c7', fg: '#b45309' }, `Une commande de ${esc(d.buyer || 'un client')} est arrivée.`)}
      ${highlight('Total à encaisser', money(d.total))}
      ${rows([['Commande', `#${esc(d.order)}`], ['Client', esc(d.buyer)], ['Articles', d.items ? `${esc(d.items)} article(s)` : null], ['Paiement', esc(d.paymentLabel)]])}
      ${CTA(`${siteUrl()}/pam`, 'Préparer la commande')}
      ${note('Pensez à notifier le client dès que la commande est prête.')}`);
    },
  },
  COMMANDE_A_PREPARER: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.bell, `Commande à préparer`, { text: 'En attente', bg: '#fef3c7', fg: '#b45309' }, `La commande #${esc(d.order)} de ${esc(d.buyer || 'un client')} attend sa préparation.`)}
      ${highlight('Total à encaisser', money(d.total))}
      ${rows([['Commande', `#${esc(d.order)}`], ['Client', esc(d.buyer)], ['Articles', d.items ? `${esc(d.items)} article(s)` : null]])}
      ${CTA(`${siteUrl()}/pam`, 'Préparer le colis')}
      ${note('Marquez la commande comme prête dès que le colis est emballé.')}`);
    },
  },
  NOUVEAU_CLIENT: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.person, 'Nouveau client', null, `Un nouveau client vient de s\u2019inscrire et de passer commande.`)}
      ${rows([['Nom', esc(d.buyer)], ['Téléphone', esc(d.phone)]])}
      ${CTA(`${siteUrl()}/pam`, 'Voir le panneau')}
      ${note('Vous pourrez gérer ce client dans votre espace commerçant.')}`);
    },
  },
  RUPTURE_STOCK: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.out, 'Rupture de stock', { text: 'Rupture', bg: '#fef3f2', fg: '#b42318' }, `Le produit \u201c${esc(d.product)}\u201d n\u2019est plus disponible.`)}
      ${rows([['Produit', esc(d.product)], ['Stock restant', '0']])}
      ${CTA(`${siteUrl()}/pam`, 'Gérer le stock')}
      ${note('Les clients ne pourront plus commander ce produit tant que le stock n\u2019est pas renouvelé.')}`);
    },
  },
  ALERTE_STOCK_BAS: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.warn, 'Stock bas', { text: 'À réapprovisionner', bg: '#fef3c7', fg: '#b45309' }, `Le produit \u201c${esc(d.product)}\u201d arrive à épuisement.`)}
      ${rows([['Produit', esc(d.product)], ['Stock restant', esc(d.stock)]])}
      ${CTA(`${siteUrl()}/pam`, 'Réapprovisionner')}
      ${note(`Plus que ${esc(d.stock)} exemplaire(s) : pensez à commander de la marchandise.`)}`);
    },
  },
  NOUVEL_AVIS: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.star, 'Nouvel avis reçu', null, d.buyer ? `${esc(d.buyer)} a noté ${esc(d.product || 'un de vos produits')}.` : `Un client a noté ${esc(d.product || 'un de vos produits')}.`)}
      ${rows([['Produit', esc(d.product)], ['Client', d.buyer ? esc(d.buyer) : null], ['Note', `${stars(d.rating)} (${esc(d.rating)}/5)`], ['Total des avis', d.count ? `${esc(d.count)} avis` : null]])}
      ${CTA(`${siteUrl()}/pam`, 'Voir les avis')}
      ${note('Répondez à vos clients : leurs avis améliorent la visibilité de votre boutique.')}`);
    },
  },
  // -------------------------------------------------------------- Boutiques
  BOUTIQUE_APPROUVEE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.party, 'Votre boutique est en ligne !', { text: 'Approuvée', bg: '#ecfdf3', fg: '#027a48' }, `Félicitations, \u201c${esc(d.store)}\u201d est désormais visible sur la marketplace.`)}
      ${rows([['Boutique', esc(d.store)], ['Statut', 'En ligne']])}
      ${CTA(`${siteUrl()}/`, 'Voir la marketplace')}
      ${note('Vous pouvez maintenant gérer vos produits et recevoir des commandes. Bonne vente !')}`);
    },
  },
  BOUTIQUE_REJETEE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.ban, 'Boutique non approuvée', { text: 'Réexaminée', bg: '#fef3f2', fg: '#b42318' }, `La boutique \u201c${esc(d.store)}\u201d n\u2019a pas pu être approuvée.`)}
      ${rows([['Boutique', esc(d.store)], ['Statut', 'Rejetée']])}
      ${CTA(`${siteUrl()}/pam`, 'Retoucher ma boutique')}
      ${note('Bonifiez votre présentation (photos, descriptions, identité) puis soumettez-la à nouveau.')}`);
    },
  },
  BOUTIQUE_EN_ATTENTE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.news, 'Boutique en attente d\u2019approbation', { text: 'Action requise', bg: '#fef3c7', fg: '#b45309' }, `La boutique \u201c${esc(d.store)}\u201d attend votre validation dans le panneau d\u2019administration.`)}
      ${rows([['Boutique', esc(d.store)], ['Statut', 'En attente']])}
      ${CTA(`${siteUrl()}/pam`, 'Valider maintenant')
      }
      ${note('Diagnostiquez la présentation avant de valider la mise en ligne.')}`);
    },
  },
  // ------------------------------------------------------------ Abonnements
  ABONNEMENT_ACTIVE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.rocket, 'Abonnement activé', { text: 'Actif', bg: '#ecfdf3', fg: '#027a48' }, `Votre formule ${esc(d.tier)} est active. Bienvenue parmi les commerçants PosMarket !`)}
      ${rows([['Formule', esc(d.tier)], ['Durée', esc(d.duration)]])}
      ${CTA(`${siteUrl()}/pam`, 'Ouvrir mon compte')
      }
      ${note('Toutes les fonctionnalités de votre formule sont débloquées.')}`);
    },
  },
  ABONNEMENT_EXPIRANT: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.warn, 'Votre abonnement expire bientôt', { text: `${esc(d.days || 7)} jours restants`, bg: '#fef3c7', fg: '#b45309' }, `Votre formule ${esc(d.tier)} arrive à échéance sous ${esc(d.days || 7)} jours.`)}
      ${rows([['Formule', esc(d.tier)], ['Échéance', `${esc(d.days || 7)} jours`]])}
      ${CTA(`${siteUrl()}/subscription`, 'Renouveler mon abonnement')}
      ${note('Après expiration, votre compte passe en pause : vos commandes seront suspendues.')}`);
    },
  },
  ABONNEMENT_EXPIRE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.ban, 'Votre abonnement a expiré', { text: 'Expiré', bg: '#fef3f2', fg: '#b42318' }, `Votre formule ${esc(d.tier)} n\u2019est plus active.`)}
      ${rows([['Formule', esc(d.tier)], ['Statut', 'Expiré']])}
      ${CTA(`${siteUrl()}/subscription`, 'Réactiver mon compte')}
      ${note('Choisissez une formule pour relancer l\u2019activité de votre boutique.')}`);
    },
  },
  // ---------------------------------------------------------------- Admins
  NOUVELLE_INSCRIPTION: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.person, 'Nouvelle inscription', null, `Un nouveau commerçant vient de créer un compte.`)}
      ${rows([['Nom', esc(d.name)], ['Email', esc(d.email)]])}
      ${CTA(`${siteUrl()}/pam`, 'Voir le panneau')}
      ${note('Rappel : la boutique doit être approuvée avant de pouvoir vendre.')}`);
    },
  },
  PAIEMENT_INCIDENT: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.alert, 'Paiement en erreur', { text: 'Action requise', bg: '#fef3f2', fg: '#b42318' }, `Un paiement d\u2019abonnement a été refusé.`)}
      ${rows([['Transaction', `#${esc(d.tx)}`], ['Fournisseur', esc(d.provider)]])}
      ${CTA(`${siteUrl()}/pam`, 'Vérifier le paiement')}
      ${note('Contactez le client concerné si l\u2019incident se répète.')}`);
    },
  },
  // ------------------------------------------------- Jobs planifiés (cron)
  RECAP_VENTES_JOUR: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.chart, 'Récap des ventes du jour', null, `Voici le bilan de ${esc(d.store)} pour aujourd\u2019hui.`)}
      ${highlight('Chiffre d\u2019affaires du jour', money(d.total), `${esc(d.count || 0)} commande(s)`)}
      ${rows([['Boutique', esc(d.store)], ['Commandes', esc(d.count)], ['Chiffre d\u2019affaires', money(d.total)]])}
      ${CTA(`${siteUrl()}/pam`, 'Voir le détail')}
      ${note('Ce récap est envoyé automatiquement chaque fin de journée.')}`);
    },
  },
  RAPPORT_VENDEUR_HEBDO: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.trend, 'Votre rapport hebdomadaire', null, `La semaine dernière, ${esc(d.store)} a enregistré des performances encourageantes.`)}
      ${highlight('Chiffre d\u2019affaires (7 jours)', money(d.total), `${esc(d.count || 0)} commande(s)`)}
      ${rows([['Boutique', esc(d.store)], ['Commandes', esc(d.count)], ['Chiffre d\u2019affaires', money(d.total)]])}
      ${CTA(`${siteUrl()}/pam`, 'Analyser mes ventes')}
      ${note('Continuez sur votre lancée : pensez aux produits les plus demandés.')}`);
    },
  },
  RAPPORT_ADMIN: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.chart, 'Rapport hebdomadaire PosMarket', null, 'Situation de la marketplace sur les 7 derniers jours.')}
      ${highlight('Commandes (7 jours)', esc(d.count), `${money(d.total)} de chiffre d\u2019affaires`)}
      ${rows([['Commandes', esc(d.count)], ['Chiffre d\u2019affaires', money(d.total)], ['Boutiques actives', esc(d.stores)], ['Utilisateurs', esc(d.users)]])}
      ${CTA(`${siteUrl()}/pam`, 'Ouvrir le panneau')
      }
      ${note('Ce rapport est généré automatiquement chaque semaine.')}`);
    },
  },
  // ----------------------------------------------------------- Générique
  BIENVENUE: {
    render: (d, input) => {
      return bodyBlock(d, `${hero(IMG.party, esc(input.title || 'Bienvenue'), null, esc(input.body || 'Merci de rejoindre PosMarket.'))}
      ${CTA(`${siteUrl()}/mon-compte`, 'Explorer la marketplace')}
      ${note('Achetez local, soutenez vos commerçants de proximité.')}`);
    },
  },
  VERIFICATION_COMPTE_OK: {
    render: (d, input) => {
      return bodyBlock(d, `${hero(IMG.ok, esc(input.title || 'Compte vérifié'), { text: 'Vérifié', bg: '#ecfdf3', fg: '#027a48' }, esc(input.body || 'Votre compte a été vérifié avec succès.'))}
      ${CTA(`${siteUrl()}/mon-compte`, 'Accéder à mon compte')}
      ${note('Toutes les fonctionnalités sont maintenant disponibles.')}`);
    },
  },
  FACTURE_PAYEE: {
    render: (d, input) => {
      return bodyBlock(d, `${hero(IMG.card, esc(input.title || 'Facture payée'), { text: 'Payé', bg: '#ecfdf3', fg: '#027a48' }, esc(input.body || 'Votre facture a été réglée.'))}
      ${CTA(`${siteUrl()}/mon-compte`, 'Voir mes commandes')}
      ${note('Merci pour votre confiance.')}`);
    },
  },
  JALON_MILESTONE: {
    render: (d, input) => {
      return bodyBlock(d, `${hero('🎉', 'Félicitations !', { text: 'Mission accomplie', bg: '#fff7ed', fg: '#c2410c' }, esc(input.body || 'Vous avez franchi une étape importante.'))}
      ${CTA(`${siteUrl()}/pam`, 'Voir mes statistiques')}
      ${note('Continuez sur cette dynamique !')}`);
    },
  },
};

export async function renderEmailEvent(eventKey: string, input: RenderInput = {}): Promise<RenderedEmail> {
  const cfg = await getEmailConfig();
  const brand: Brand = {
    brandName: cfg?.brandName,
    tagline: cfg?.tagline,
    logoUrl: cfg?.logoUrl,
    footer: cfg?.footer,
  };
  const d: EmailData = input.emailData || {};
  const subject = SUBJECTS[eventKey] || input.title || `Notification ${cfg?.brandName || 'PosMarket'}`;

  const renderer = renderers[eventKey];
  let content: string;
  let finalSubject = subject;

  if (renderer) {
    content = renderer.render(d, input);
    if (renderer.subject) finalSubject = renderer.subject;
  } else {
    // Événement sans gabarit dédié (fallback) : titre + message + CTA compte.
    content = bodyBlock(
      d,
      `${hero(IMG.bell, esc(input.title || subject), null, esc(input.body || ''))}
       ${CTA(`${siteUrl()}/mon-compte`, 'Accéder à mon compte')}
       ${note('Cet email vous a été envoyé suite à une activité sur votre compte.')}`,
    );
  }

  const html = layout(content, brand);
  return { subject: finalSubject, html, text: stripHtml(html) };
}