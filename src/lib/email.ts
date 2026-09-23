import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { inArray, eq } from 'drizzle-orm';
import { db } from '@/db';
import { orderItems, products, systemSettings } from '@/db/schema';
import { generateProductSlug } from '@/utils/slug';

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

export interface ProductEmailItem {
  name: string;
  /** slug de la page produit publique (/product/{slug}) */
  slug?: string;
  image?: string;
  /** prix unitaire formaté (nombre, sans "FCFA") */
  price?: string;
  qty?: number;
  unit?: string;
  /** détail court : variante, options, format... */
  detail?: string;
  /** prix de gros formaté (nombre, sans "FCFA") */
  wholesale?: string;
  /** quantité minimale pour le prix de gros */
  wholesaleQty?: number;
}

export interface RenderInput {
  title?: string;
  body?: string;
  /** Données structurées (champ `d` persisté sur la ligne email de l'outbox). */
  emailData?: Record<string, string | number | null | undefined | ProductEmailItem[]>;
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
    : `© ${new Date().getFullYear()} ${name} — Bénin / Côte d'Ivoire<br/>Vous recevez cet email suite à une activité sur votre compte.`;

  const header = logoUrl
    ? `<img src="${logoUrl}" alt="${name}" width="150" style="max-width:150px;height:auto;display:block;" />`
    : `<div style="color:#202124;font-size:20px;font-weight:700;letter-spacing:-0.01em;">${name}</div>`;
  const tag = tagline ? `<div style="color:#5F6368;font-size:12px;font-weight:400;margin-top:3px;">${tagline}</div>` : '';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${name}</title>
<style>
  .pm-wrap { padding:20px 16px 40px; }
  .pm-shell { width:100%; max-width:640px; border:1px solid #E8EAED; border-radius:16px; overflow:hidden; }
  @media only screen and (max-width:640px) {
    .pm-wrap { padding:0 !important; }
    .pm-shell { width:100% !important; max-width:100% !important; border:0 !important; border-radius:0 !important; }
    .pm-sec { padding-left:20px !important; padding-right:20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;">
    <tr>
      <td align="center" class="pm-wrap" style="padding:20px 16px 40px;">
        <table role="presentation" class="pm-shell" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#FFFFFF;border:1px solid #E8EAED;border-radius:16px;overflow:hidden;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <tr>
            <td class="pm-sec" style="padding:26px 32px 22px;border-bottom:1px solid #E8EAED;">
              ${header}
              ${tag}
            </td>
          </tr>
          <tr>
            <td class="pm-sec" style="padding:28px 32px 12px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td class="pm-sec" style="padding:22px 32px;border-top:1px solid #E8EAED;background:#FAFAFA;">
              <div style="color:#9AA0A6;font-size:12px;line-height:1.7;text-align:left;">
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

type EmailData = Record<string, string | number | null | undefined | ProductEmailItem[]>;

type Val = string | number | ProductEmailItem[] | null | undefined;

const esc = (v: Val): string => escapeHtml(Array.isArray(v) ? JSON.stringify(v) : String(v ?? ''));

const money = (v: Val): string => {
  const s = String(v ?? '').trim();
  if (!s) return '—';
  if (/FCFA/i.test(s)) return s;
  return `${s} FCFA`;
};

const row = (label: string, value: string): string => `
  <tr>
    <td style="padding:13px 0;border-bottom:1px solid #E8EAED;color:#5F6368;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">${esc(label)}</td>
    <td style="padding:13px 0;border-bottom:1px solid #E8EAED;color:#202124;font-size:14px;font-weight:600;text-align:right;white-space:nowrap;padding-left:16px;">${value}</td>
  </tr>`;

const rows = (items: Array<[string, Val]>): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">${items
    .filter(([, v]) => String(v ?? '').trim() !== '' && v !== null)
    .map(([l, v]) => row(l, String(v)))
    .join('')}</table>`;

const badge = (text: string, bg = '#F1F3F4', fg = '#5F6368'): string => `
  <span style="display:inline-block;background:${bg};color:${fg};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;padding:5px 12px;border-radius:999px;">${esc(text)}</span>`;

const summaryLine = (label: string, value: Val, note?: string): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 18px;">
    <tr>
      <td style="border-top:1px solid #E8EAED;padding:16px 0 0;color:#5F6368;font-size:13px;font-weight:600;line-height:1.5;">${esc(label)}</td>
      <td align="right" style="border-top:1px solid #E8EAED;padding:16px 0 0;color:#202124;font-size:22px;font-weight:800;letter-spacing:-0.01em;white-space:nowrap;padding-left:16px;line-height:1.3;">
        ${esc(value)}
        ${note ? `<div style="color:#5F6368;font-size:12px;font-weight:400;margin-top:2px;">${esc(note)}</div>` : ''}
      </td>
    </tr>
  </table>`;

const CTA = (href: string, label: string): string => `
  <p style="margin:0 0 8px;">
    <a href="${esc(href)}" style="display:block;background:#1A73E8;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;text-align:center;padding:13px 20px;border-radius:8px;">${esc(label)}</a>
  </p>`;

const note = (text: string): string =>
  `<p style="margin:0;color:#5F6368;font-size:12px;line-height:1.7;">${esc(text)}</p>`;

const IMG = { wait: '⏳', ok: '✅', box: '📦', truck: '🚚', cart: '🛒', card: '💳', shop: '🏪', bell: '🔔', person: '👤', warn: '⚠️', out: '⛔', star: '⭐', party: '🎊', rocket: '🚀', ban: '⛔', chart: '📊', trend: '📈', alert: '🚨', news: '📰' };

const hero = (icon: string, title: string, chip: { text: string; bg: string; fg: string } | null, sub?: string): string => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
    <tr>
      <td>
        <div style="width:52px;height:52px;border-radius:50%;background:#F1F3F4;color:#202124;font-size:26px;text-align:center;line-height:52px;margin-bottom:16px;">${icon}</div>
        <h1 style="margin:0 0 ${chip ? 10 : 6}px;color:#202124;font-size:22px;font-weight:800;letter-spacing:-0.02em;">${esc(title)}</h1>
        ${chip ? `<div style="margin:0 0 8px;">${badge(chip.text)}</div>` : ''}
        ${sub ? `<p style="margin:0;color:#3C4043;font-size:14px;line-height:1.65;">${esc(sub)}</p>` : ''}
      </td>
    </tr>
  </table>`;

const siteUrl = (): string => process.env.NEXT_PUBLIC_SITE_URL || 'https://posmarket-eight.vercel.app';

const path = (p: string): string => `${siteUrl()}${p}`;

const account = (): string => path('/mon-compte');

const storePage = (d: EmailData): string => {
  const slug = String(d.storeSlug || '').trim();
  return slug ? path(`/store/${encodeURIComponent(slug)}`) : '';
};

const imgUrl = (v?: string | null): string => {
  if (!v) return '';
  const s = String(v).trim();
  if (!s || s.startsWith('data:')) return '';
  return /^https?:\/\//i.test(s) ? s : path(s.startsWith('/') ? s : `/${s}`);
};

const productRow = (it: ProductEmailItem, last: boolean): string => {
  const href = it.slug ? path(`/product/${encodeURIComponent(it.slug)}`) : '';
  const img = it.image ? imgUrl(it.image) : '';
  const price = it.price ? `${esc(it.price)} FCFA` : '—';
  const nameCell = href
    ? `<a href="${href}" style="display:block;color:#202124;text-decoration:none;line-height:1.35;max-height:2.75em;overflow:hidden;word-break:break-word;">${esc(it.name)}</a>`
    : `<div style="display:block;line-height:1.35;max-height:2.75em;overflow:hidden;word-break:break-word;">${esc(it.name)}</div>`;
  const imgCell = img
    ? `<img src="${img}" width="48" height="48" alt="${esc(it.name)}" style="display:block;width:48px;height:48px;border-radius:10px;object-fit:cover;border:1px solid #E8EAED;" />`
    : `<div style="display:block;width:48px;height:48px;line-height:48px;text-align:center;border-radius:10px;background:#F1F3F4;color:#9AA0A6;font-size:18px;font-weight:700;border:1px solid #E8EAED;">${esc((it.name || '?').charAt(0).toUpperCase())}</div>`;
  return `
    <tr>
      <td style="padding:14px 16px;${last ? '' : 'border-bottom:1px solid #E8EAED;'}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="56" valign="middle" style="padding-right:12px;">${imgCell}</td>
            <td valign="middle" style="overflow:hidden;padding:0 12px 0 0;color:#202124;font-size:14px;font-weight:600;line-height:1.4;">
              ${nameCell}
              ${it.detail ? `<div style="color:#5F6368;font-size:12px;font-weight:400;margin-top:3px;word-break:break-word;">${esc(it.detail)}</div>` : ''}
              ${it.wholesale ? `<div style="color:#5F6368;font-size:12px;font-weight:400;margin-top:2px;">Prix de gros : ${esc(it.wholesale)} FCFA${it.wholesaleQty ? ` dès ${esc(String(it.wholesaleQty))}` : ''}</div>` : ''}
              ${href ? `<div style="margin-top:6px;"><a href="${href}" style="color:#1A73E8;font-size:12px;font-weight:600;text-decoration:none;white-space:nowrap;">Voir →</a></div>` : ''}
            </td>
            <td valign="top" align="right" style="color:#202124;font-size:14px;font-weight:700;white-space:nowrap;line-height:1.4;padding-left:8px;padding-top:2px;">
              ${price}
              <div style="color:#5F6368;font-size:12px;font-weight:400;text-align:right;white-space:nowrap;">Quantité : ${esc(String(it.qty || 1))}${it.unit ? ` ${esc(it.unit)}` : ''}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
};

const productList = (items?: Val): string => {
  const list = Array.isArray(items) ? (items as ProductEmailItem[]).filter((it) => !!it && typeof it === 'object' && !!it.name) : [];
  if (list.length === 0) return '';
  return `
  <div style="margin:0 0 22px;">
    <div style="color:#5F6368;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 10px;">Produits de la commande</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8EAED;border-radius:12px;overflow:hidden;">
      ${list.map((it, i) => productRow(it, i === list.length - 1)).join('')}
    </table>
  </div>`;
};

/** Charge les produits d'une commande (nom, lien, image, prix, variante, prix de gros) pour le rendu email. */
export async function orderEmailProducts(orderId: string): Promise<ProductEmailItem[]> {
  try {
    const rows = await db
      .select({
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        name: products.name,
        image: products.image,
        unit: products.unit,
        options: products.options,
        variants: products.variants,
        wholesalePrice: products.wholesalePrice,
        wholesaleMinQty: products.wholesaleMinQty,
        wholesaleTiers: products.wholesaleTiers,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, orderId));
    const fmt = (n: string | number | null | undefined): string => new Intl.NumberFormat('fr-FR').format(Number(n) || 0);
    const out = rows.map((r) => {
      const tiers = Array.isArray(r.wholesaleTiers) ? (r.wholesaleTiers as Array<{ minQty?: number; price?: number }>) : [];
      const firstTier = tiers.find((t) => t && typeof t === 'object');
      const wholesalePrice = Number(r.wholesalePrice || firstTier?.price || 0);
      const wholesaleMin = Number(r.wholesaleMinQty || firstTier?.minQty || 0);
      const name = r.name || 'Article supprimé';
      const variants = Array.isArray(r.variants) ? (r.variants as Array<{ name?: string }>) : [];
      const detailBits: string[] = [];
      if (variants.length > 0) {
        detailBits.push(`Variante : ${variants.slice(0, 3).map((v) => v.name || '').filter(Boolean).join(' / ')}`);
      }
      if (Array.isArray(r.options) && (r.options as Array<{ name?: string; values?: string[] }>).length > 0) {
        const opts = (r.options as Array<{ name?: string; values?: string[] }>).slice(0, 2);
        detailBits.push(opts.map((o) => `${o.name || ''} (${(o.values || []).join(', ')})`).join(' · '));
      }
      if (r.unit) detailBits.push(`Unité : ${r.unit}`);
      return {
        name,
        slug: r.productId ? generateProductSlug({ id: r.productId, name }) : '',
        image: r.image || undefined,
        price: fmt(r.unitPrice),
        qty: Number(r.quantity) || 1,
        unit: r.unit || undefined,
        detail: detailBits.filter(Boolean).join(' · ') || undefined,
        wholesale: wholesalePrice > 0 ? fmt(wholesalePrice) : undefined,
        wholesaleQty: wholesaleMin > 0 ? wholesaleMin : undefined,
      };
    });
    // Fusionne les lignes pour un même produit (même commande, produit répété) :
    // on additionne les quantités pour éviter toute doublure dans l'email.
    const merged = new Map<string, ProductEmailItem>();
    for (const it of out) {
      const key = it.slug || it.name;
      const prev = merged.get(key);
      if (prev) {
        prev.qty = (prev.qty || 0) + (it.qty || 0);
      } else {
        merged.set(key, { ...it });
      }
    }
    return Array.from(merged.values());
  } catch {
    return [];
  }
}

const bodyBlock = (_d: EmailData, content: string): string => content;

// Détail du paiement (partagé par les notifications de commande vendeur / préparateur)
function paymentBadge(d: EmailData): { text: string; bg: string; fg: string } {
  return String(d.payment || '').toUpperCase() === 'ESPECES'
    ? { text: 'Espèces', bg: '#fef3c7', fg: '#b45309' }
    : String(d.payment || '').toUpperCase() === 'CARTE'
      ? { text: 'Carte', bg: '#ede9fe', fg: '#6d28d9' }
      : { text: String(d.paymentLabel || 'Paiement'), bg: '#eef1f5', fg: '#475467' };
}

function stars(n: Val): string {
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
      return bodyBlock(d, `${hero(IMG.cart, `Commande #${d.order} confirmée`, { text: 'Confirmée', bg: '#ecfdf3', fg: '#027a48' }, `Votre commande chez ${d.store || 'la boutique'} a été enregistrée.`)}
${productList(d.products)}
      ${rows([['Commande', `#${d.order}`], ['Boutique', d.store], ['Paiement', d.paymentLabel]])}
      ${summaryLine('Total', money(d.total))}
      ${CTA(account(), 'Suivre ma commande')}
      ${note('Une question sur votre commande ? Contactez directement la boutique.')}`);
    },
  },
  COMMANDE_PRET: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.box, `Commande #${d.order} prête`, { text: 'À récupérer', bg: '#e8f0fe', fg: '#1a73e8' }, `Votre commande peut être récupérée chez ${d.store || 'la boutique'}.`)}
      ${productList(d.products)}
      ${rows([['Commande', `#${d.order}`], ['Boutique', d.store]])}
      ${summaryLine('Total', money(d.total))}
      ${CTA(account(), 'Voir ma commande')}
      ${note('Présentez simplement votre numéro de commande lors du retrait.')}`);
    },
  },
  COMMANDE_EXPEDIEE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.truck, `Commande #${d.order} expédiée`, { text: 'En route', bg: '#ecfdf3', fg: '#027a48' }, `Votre commande ${d.store ? `de ${d.store} ` : ''}vient d'être expédiée.`)}
      ${productList(d.products)}
      ${rows([['Commande', `#${d.order}`], ['Boutique', d.store]])}
      ${summaryLine('Total', money(d.total))}
      ${CTA(account(), 'Suivre le suivi')}
      ${note('Vous recevrez une notification dès la livraison.')}`);
    },
  },
  COMMANDE_LIVREE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.ok, `Commande #${d.order} livrée`, { text: 'Livrée', bg: '#ecfdf3', fg: '#027a48' }, `Votre commande de ${d.store || 'la boutique'} a été livrée. Merci pour votre achat !`)}
      ${productList(d.products)}
      ${rows([['Commande', `#${d.order}`], ['Boutique', d.store]])}
      ${summaryLine('Total', money(d.total))}
      ${CTA(account(), 'Laisser un avis')}
      ${note('Une remarque sur votre commande ? Contactez la boutique. Votre avis aide les commerçants locaux.')}`);
    },
  },
  COMMANDE_ANNULEE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.ban, `Commande #${d.order} annulée`, { text: 'Annulée', bg: '#fef3f2', fg: '#b42318' }, `La commande ${d.store ? `de ${d.store} ` : ''}portant le numéro \u201c#${d.order}\u201d a été annulée.`)}
      ${productList(d.products)}
      ${rows([['Commande', `#${d.order}`], ['Boutique', d.store]])}
      ${CTA(account(), 'Mes commandes')}
      ${note('En cas de paiement déjà effectué, le remboursement sera traité par la boutique. Contactez-la pour plus d\u2019informations.')}`);
    },
  },
  RECU_PAIEMENT: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.card, 'Paiement reçu', { text: 'Payé', bg: '#ecfdf3', fg: '#027a48' }, `Le paiement de votre commande #${d.order} a bien été reçu.`)}
      ${productList(d.products)}
      ${rows([['Commande', `#${d.order}`], ['Statut', 'Payé']])}
      ${summaryLine('Total payé', money(d.total))}
      ${CTA(account(), 'Voir le reçu')}
      ${note('Ceci fait office de reçu de paiement pour votre commande.')}`);
    },
  },
  DEMANDE_AVIS: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.star, 'Partagez votre avis', { text: 'Merci !', bg: '#fff7ed', fg: '#c2410c' }, d.store ? `Votre commande #${d.order || ''} de ${d.store} est terminée. Aidez la boutique à progresser : notez vos produits.` : 'Aidez la boutique à progresser : notez vos produits.')}
      ${productList(d.products)}
      ${rows([['Commande', d.order ? `#${d.order}` : null], ['Boutique', d.store]])}
      ${CTA(account(), 'Laisser un avis')}
      ${note('Votre avis prend moins d\u2019une minute et compte beaucoup pour les commerçants locaux.')}`);
    },
  },
  RELANCE_PANIER_ABANDONNE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.cart, `Bonjour ${d.name || ''}`, { text: 'En attente', bg: '#fff7ed', fg: '#c2410c' }, `Vous avez laissé ${d.items || 'des articles'} dans votre panier pour un total de ${money(d.total)}.`)}
      ${rows([['Articles', `${d.items || '—'} article(s)`]])}
      ${summaryLine('Montant du panier', money(d.total))}
      ${CTA(storePage(d) || `${siteUrl()}/`, 'Finaliser ma commande')}
      ${note('Votre panier est conservé. Revenez quand vous voulez pour finaliser votre achat.')}`);
    },
  },
  // --------------------------------------------------------------- Vendeur
  VENTE_POS: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.shop, 'Vente enregistrée', paymentBadge(d), d.store ? `Une vente a été enregistrée en boutique (${d.store}).` : 'Une vente a été enregistrée en boutique.')}
      ${productList(d.products)}
      ${rows([['Commande', `#${d.order}`], ['Boutique', d.store], ['Paiement', d.paymentLabel]])}
      ${summaryLine('Total de la vente', money(d.total))}
      ${CTA(`${siteUrl()}/dashboard`, 'Voir le tableau de bord')}
      ${note('Le stock a été mis à jour automatiquement.')}`);
    },
  },
  NOUVELLE_COMMANDE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.bell, `Nouvelle commande #${d.order}`, { text: 'À traiter', bg: '#fef3c7', fg: '#b45309' }, `Une commande de ${d.buyer || 'un client'} est arrivée.`)}
      ${productList(d.products)}
      ${rows([['Commande', `#${d.order}`], ['Client', d.buyer], ['Paiement', d.paymentLabel]])}
      ${summaryLine('Total à encaisser', money(d.total))}
      ${CTA(`${siteUrl()}/orders`, 'Préparer la commande')}
      ${note('Pensez à notifier le client dès que la commande est prête.')}`);
    },
  },
  COMMANDE_A_PREPARER: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.bell, `Commande à préparer`, { text: 'En attente', bg: '#fef3c7', fg: '#b45309' }, `La commande #${d.order} de ${d.buyer || 'un client'} attend sa préparation.`)}
      ${productList(d.products)}
      ${rows([['Commande', `#${d.order}`], ['Client', d.buyer]])}
      ${summaryLine('Total à encaisser', money(d.total))}
      ${CTA(`${siteUrl()}/orders`, 'Préparer le colis')}
      ${note('Marquez la commande comme prête dès que le colis est emballé.')}`);
    },
  },
  NOUVEAU_CLIENT: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.person, 'Nouveau client', null, `Un nouveau client vient de s\u2019inscrire et de passer commande.`)}
      ${rows([['Nom', d.buyer], ['Téléphone', d.phone]])}
      ${CTA(`${siteUrl()}/customers`, 'Gérer mes clients')}
      ${note('Vous pourrez gérer ce client dans votre espace commerçant.')}`);
    },
  },
  RUPTURE_STOCK: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.out, 'Rupture de stock', { text: 'Rupture', bg: '#fef3f2', fg: '#b42318' }, `Le produit \u201c${d.product}\u201d n\u2019est plus disponible.`)}
      ${rows([['Produit', d.product], ['Stock restant', '0']])}
      ${CTA(`${siteUrl()}/inventory`, 'Gérer le stock')}
      ${note('Les clients ne pourront plus commander ce produit tant que le stock n\u2019est pas renouvelé.')}`);
    },
  },
  ALERTE_STOCK_BAS: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.warn, 'Stock bas', { text: 'À réapprovisionner', bg: '#fef3c7', fg: '#b45309' }, `Le produit \u201c${d.product}\u201d arrive à épuisement.`)}
      ${rows([['Produit', d.product], ['Stock restant', d.stock]])}
      ${CTA(`${siteUrl()}/inventory`, 'Réapprovisionner')}
      ${note(`Plus que ${d.stock} exemplaire(s) : pensez à commander de la marchandise.`)}`);
    },
  },
  NOUVEL_AVIS: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.star, 'Nouvel avis reçu', null, d.buyer ? `${d.buyer} a noté ${d.product || 'un de vos produits'}.` : `Un client a noté ${d.product || 'un de vos produits'}.`)}
      ${rows([['Produit', d.product], ['Client', d.buyer], ['Note', `${stars(d.rating)} (${d.rating}/5)`], ['Total des avis', d.count ? `${d.count} avis` : null]])}
      ${CTA(`${siteUrl()}/reports`, 'Voir les avis')}
      ${note('Répondez à vos clients : leurs avis améliorent la visibilité de votre boutique.')}`);
    },
  },
  // -------------------------------------------------------------- Boutiques
  BOUTIQUE_APPROUVEE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.party, 'Votre boutique est en ligne !', { text: 'Approuvée', bg: '#ecfdf3', fg: '#027a48' }, `Félicitations, \u201c${d.store}\u201d est désormais visible sur la marketplace.`)}
      ${rows([['Boutique', d.store], ['Statut', 'En ligne']])}
      ${CTA(storePage(d) || `${siteUrl()}/`, 'Voir ma boutique en ligne')}
      ${note('Vous pouvez maintenant gérer vos produits et recevoir des commandes. Bonne vente !')}`);
    },
  },
  BOUTIQUE_REJETEE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.ban, 'Boutique non approuvée', { text: 'Réexaminée', bg: '#fef3f2', fg: '#b42318' }, `La boutique \u201c${d.store}\u201d n\u2019a pas pu être approuvée.`)}
      ${rows([['Boutique', d.store], ['Statut', 'Rejetée']])}
      ${CTA(`${siteUrl()}/settings`, 'Retoucher ma boutique')}
      ${note('Bonifiez votre présentation (photos, descriptions, identité) puis soumettez-la à nouveau.')}`);
    },
  },
  BOUTIQUE_EN_ATTENTE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.news, 'Boutique en attente d\u2019approbation', { text: 'Action requise', bg: '#fef3c7', fg: '#b45309' }, `La boutique \u201c${d.store}\u201d attend votre validation dans le panneau d\u2019administration.`)}
      ${rows([['Boutique', d.store], ['Statut', 'En attente']])}
      ${CTA(`${siteUrl()}/pam/stores`, 'Valider maintenant')}
      ${note('Diagnostiquez la présentation avant de valider la mise en ligne.')}`);
    },
  },
  // ------------------------------------------------------------ Abonnements
  ABONNEMENT_ACTIVE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.rocket, 'Abonnement activé', { text: 'Actif', bg: '#ecfdf3', fg: '#027a48' }, `Votre formule ${d.tier} est active. Bienvenue parmi les commerçants PosMarket !`)}
      ${rows([['Formule', d.tier], ['Durée', d.duration]])}
      ${CTA(`${siteUrl()}/dashboard`, 'Ouvrir mon espace')}
      ${note('Toutes les fonctionnalités de votre formule sont débloquées.')}`);
    },
  },
  ABONNEMENT_EXPIRANT: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.warn, 'Votre abonnement expire bientôt', { text: `${d.days || 7} jours restants`, bg: '#fef3c7', fg: '#b45309' }, `Votre formule ${d.tier} arrive à échéance sous ${d.days || 7} jours.`)}
      ${rows([['Formule', d.tier], ['Échéance', `${d.days || 7} jours`]])}
      ${CTA(`${siteUrl()}/subscription`, 'Renouveler mon abonnement')}
      ${note('Après expiration, votre compte passe en pause : vos commandes seront suspendues.')}`);
    },
  },
  ABONNEMENT_EXPIRE: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.ban, 'Votre abonnement a expiré', { text: 'Expiré', bg: '#fef3f2', fg: '#b42318' }, `Votre formule ${d.tier} n\u2019est plus active.`)}
      ${rows([['Formule', d.tier], ['Statut', 'Expiré']])}
      ${CTA(`${siteUrl()}/subscription`, 'Réactiver mon compte')}
      ${note('Choisissez une formule pour relancer l\u2019activité de votre boutique.')}`);
    },
  },
  // ---------------------------------------------------------------- Admins
  NOUVELLE_INSCRIPTION: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.person, 'Nouvelle inscription', null, `Un nouveau commerçant vient de créer un compte.`)}
      ${rows([['Nom', d.name], ['Email', d.email]])}
      ${CTA(`${siteUrl()}/pam/users`, 'Voir les commerçants')}
      ${note('Rappel : la boutique doit être approuvée avant de pouvoir vendre.')}`);
    },
  },
  PAIEMENT_INCIDENT: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.alert, 'Paiement en erreur', { text: 'Action requise', bg: '#fef3f2', fg: '#b42318' }, `Un paiement d\u2019abonnement a été refusé.`)}
      ${rows([['Transaction', `#${d.tx}`], ['Fournisseur', d.provider]])}
      ${CTA(`${siteUrl()}/pam/invoices`, 'Vérifier le paiement')}
      ${note('Contactez le client concerné si l\u2019incident se répète.')}`);
    },
  },
  // ------------------------------------------------- Jobs planifiés (cron)
  RECAP_VENTES_JOUR: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.chart, 'Récap des ventes du jour', null, `Voici le bilan de ${d.store} pour aujourd\u2019hui.`)}
      ${rows([['Boutique', d.store]])}
      ${summaryLine('Chiffre d\u2019affaires du jour', money(d.total), `${d.count || 0} commande(s)`)}
      ${CTA(`${siteUrl()}/dashboard`, 'Voir le détail')}
      ${note('Ce récap est envoyé automatiquement chaque fin de journée.')}`);
    },
  },
  RAPPORT_VENDEUR_HEBDO: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.trend, 'Votre rapport hebdomadaire', null, `La semaine dernière, ${d.store} a enregistré des performances encourageantes.`)}
      ${rows([['Boutique', d.store]])}
      ${summaryLine('Chiffre d\u2019affaires (7 jours)', money(d.total), `${d.count || 0} commande(s)`)}
      ${CTA(`${siteUrl()}/dashboard`, 'Analyser mes ventes')}
      ${note('Continuez sur votre lancée : pensez aux produits les plus demandés.')}`);
    },
  },
  RAPPORT_ADMIN: {
    render: (d) => {
      return bodyBlock(d, `${hero(IMG.chart, 'Rapport hebdomadaire PosMarket', null, 'Situation de la marketplace sur les 7 derniers jours.')}
      ${rows([['Boutiques actives', d.stores], ['Utilisateurs', d.users]])}
      ${summaryLine('Commandes (7 jours)', d.count, `${money(d.total)} de chiffre d\u2019affaires`)}
      ${CTA(`${siteUrl()}/pam`, 'Ouvrir le panneau')
      }
      ${note('Ce rapport est généré automatiquement chaque semaine.')}`);
    },
  },
  // ----------------------------------------------------------- Générique
  BIENVENUE: {
    render: (d, input) => {
      return bodyBlock(d, `${hero(IMG.party, input.title || 'Bienvenue', null, input.body || 'Merci de rejoindre PosMarket.')}
      ${CTA(storePage(d) || `${siteUrl()}/`, 'Explorer la marketplace')}
      ${note('Achetez local, soutenez vos commerçants de proximité.')}`);
    },
  },
  VERIFICATION_COMPTE_OK: {
    render: (d, input) => {
      return bodyBlock(d, `${hero(IMG.ok, input.title || 'Compte vérifié', { text: 'Vérifié', bg: '#ecfdf3', fg: '#027a48' }, input.body || 'Votre compte a été vérifié avec succès.')}
      ${CTA(`${siteUrl()}/mon-compte`, 'Accéder à mon compte')}
      ${note('Toutes les fonctionnalités sont maintenant disponibles.')}`);
    },
  },
  FACTURE_PAYEE: {
    render: (d, input) => {
      return bodyBlock(d, `${hero(IMG.card, input.title || 'Facture payée', { text: 'Payé', bg: '#ecfdf3', fg: '#027a48' }, input.body || 'Votre facture a été réglée.')}
      ${CTA(`${siteUrl()}/mon-compte`, 'Voir mes commandes')}
      ${note('Merci pour votre confiance.')}`);
    },
  },
  JALON_MILESTONE: {
    render: (d, input) => {
      return bodyBlock(d, `${hero('🎉', 'Félicitations !', { text: 'Mission accomplie', bg: '#fff7ed', fg: '#c2410c' }, input.body || 'Vous avez franchi une étape importante.')}
      ${CTA(`${siteUrl()}/dashboard`, 'Voir mes statistiques')}
      ${note('Continuez sur cette dynamique !')}`);
    },
  },
};

// ---------------------------------------------------------------------------
// Catalogue de test — un échantillon réaliste par action (tests d'emails admin).
// ---------------------------------------------------------------------------

export interface EmailTestEvent {
  key: string;
  label: string;
  audience: string;
  sample: () => RenderInput;
}

const EMAIL_TEST_EVENTS: EmailTestEvent[] = [
  { key: 'CONFIRMATION_COMMANDE', label: 'Confirmation de commande', audience: 'Acheteur', sample: () => ({ emailData: { order: '1042', store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique', total: '12000', payment: 'CARTE', paymentLabel: 'Carte', items: 2, products: [{ name: 'Huile d\'arachide 1L', slug: 'huile-d-arachide-1l-1a2b3c', image: 'https://placehold.co/96x96/E8EAED/5F6368?text=H', price: '2 500', qty: 2, unit: 'bouteille', detail: 'Variante : 1L', wholesale: '2 300', wholesaleQty: 10 }, { name: 'Riz parfumé 5kg', slug: 'riz-parfume-5kg-4d5e6f', image: 'https://placehold.co/96x96/E8EAED/5F6368?text=R', price: '7 000', qty: 1, unit: 'sac', detail: 'Unité : sac' }] } }) },
  { key: 'COMMANDE_PRET', label: 'Commande prête à récupérer', audience: 'Acheteur', sample: () => ({ emailData: { order: '1042', store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique', total: '12000', items: 2, products: [{ name: 'Huile d\'arachide 1L', slug: 'huile-d-arachide-1l-1a2b3c', price: '2 500', qty: 2, detail: 'Variante : 1L' }, { name: 'Riz parfumé 5kg', slug: 'riz-parfume-5kg-4d5e6f', price: '7 000', qty: 1 }] } }) },
  { key: 'COMMANDE_EXPEDIEE', label: 'Commande expédiée', audience: 'Acheteur', sample: () => ({ emailData: { order: '1042', store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique', total: '12000', items: 2, products: [{ name: 'Huile d\'arachide 1L', slug: 'huile-d-arachide-1l-1a2b3c', price: '2 500', qty: 2, detail: 'Variante : 1L' }, { name: 'Riz parfumé 5kg', slug: 'riz-parfume-5kg-4d5e6f', price: '7 000', qty: 1 }] } }) },
  { key: 'COMMANDE_LIVREE', label: 'Commande livrée', audience: 'Acheteur', sample: () => ({ emailData: { order: '1042', store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique', total: '12000', items: 2, products: [{ name: 'Huile d\'arachide 1L', slug: 'huile-d-arachide-1l-1a2b3c', image: 'https://placehold.co/96x96/E8EAED/5F6368?text=H', price: '2 500', qty: 2, wholesale: '2 300', wholesaleQty: 10 }, { name: 'Riz parfumé 5kg', slug: 'riz-parfume-5kg-4d5e6f', image: 'https://placehold.co/96x96/E8EAED/5F6368?text=R', price: '7 000', qty: 1 }] } }) },
  { key: 'COMMANDE_ANNULEE', label: 'Commande annulée', audience: 'Acheteur', sample: () => ({ emailData: { order: '1042', store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique', items: 2, products: [{ name: 'Huile d\'arachide 1L', slug: 'huile-d-arachide-1l-1a2b3c', price: '2 500', qty: 2 }, { name: 'Riz parfumé 5kg', slug: 'riz-parfume-5kg-4d5e6f', price: '7 000', qty: 1 }] } }) },
  { key: 'RECU_PAIEMENT', label: 'Reçu de paiement', audience: 'Acheteur', sample: () => ({ emailData: { order: '1042', total: '12000' } }) },
  { key: 'DEMANDE_AVIS', label: 'Demande d\'avis', audience: 'Acheteur', sample: () => ({ emailData: { order: '1042', store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique', items: 2, products: [{ name: 'Huile d\'arachide 1L', slug: 'huile-d-arachide-1l-1a2b3c', price: '2 500', qty: 2 }, { name: 'Riz parfumé 5kg', slug: 'riz-parfume-5kg-4d5e6f', price: '7 000', qty: 1 }] } }) },
  { key: 'RELANCE_PANIER_ABANDONNE', label: 'Panier abandonné', audience: 'Acheteur', sample: () => ({ emailData: { name: 'Awa', items: 2, total: '7500', store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique' } }) },
  { key: 'NOUVELLE_COMMANDE', label: 'Nouvelle commande reçue', audience: 'Vendeur', sample: () => ({ emailData: { order: '1042', buyer: 'Awa', store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique', total: '12000', items: 2, payment: 'CARTE', paymentLabel: 'Carte', products: [{ name: 'Huile d\'arachide 1L', slug: 'huile-d-arachide-1l-1a2b3c', price: '2 500', qty: 2, detail: 'Variante : 1L', wholesale: '2 300', wholesaleQty: 10 }, { name: 'Riz parfumé 5kg', slug: 'riz-parfume-5kg-4d5e6f', price: '7 000', qty: 1 }] } }) },
  { key: 'COMMANDE_A_PREPARER', label: 'Commande à préparer', audience: 'Vendeur', sample: () => ({ emailData: { order: '1042', buyer: 'Awa', store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique', total: '12000', items: 2, products: [{ name: 'Huile d\'arachide 1L', slug: 'huile-d-arachide-1l-1a2b3c', price: '2 500', qty: 2 }, { name: 'Riz parfumé 5kg', slug: 'riz-parfume-5kg-4d5e6f', price: '7 000', qty: 1 }] } }) },
  { key: 'VENTE_POS', label: 'Vente en boutique (POS)', audience: 'Vendeur', sample: () => ({ emailData: { order: '1043', store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique', total: '2500', payment: 'ESPECES', paymentLabel: 'Espèces', items: 1, products: [{ name: 'Gâteau 100 F', slug: 'gateau-100-f-9f0e1d', price: '100', qty: 25, unit: 'piece', detail: 'Variante : Petite taille' }] } }) },
  { key: 'NOUVEAU_CLIENT', label: 'Nouveau client', audience: 'Vendeur', sample: () => ({ emailData: { buyer: 'Awa', phone: '+229 01 23 45 67', store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique' } }) },
  { key: 'RUPTURE_STOCK', label: 'Rupture de stock', audience: 'Vendeur', sample: () => ({ emailData: { product: 'Huile d\'arachide 1L', productSlug: 'huile-d-arachide-1l-1a2b3c', store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique' } }) },
  { key: 'ALERTE_STOCK_BAS', label: 'Stock bas', audience: 'Vendeur', sample: () => ({ emailData: { product: 'Sucre 1kg', productSlug: 'sucre-1kg-4d5e6f', stock: 3, store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique' } }) },
  { key: 'NOUVEL_AVIS', label: 'Nouvel avis reçu', audience: 'Vendeur', sample: () => ({ emailData: { product: 'Huile d\'arachide 1L', productSlug: 'huile-d-arachide-1l-1a2b3c', buyer: 'Awa', rating: 5, count: 12, store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique' } }) },
  { key: 'BOUTIQUE_APPROUVEE', label: 'Boutique approuvée', audience: 'Boutique', sample: () => ({ emailData: { store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique' } }) },
  { key: 'BOUTIQUE_REJETEE', label: 'Boutique rejetée', audience: 'Boutique', sample: () => ({ emailData: { store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique' } }) },
  { key: 'BOUTIQUE_EN_ATTENTE', label: 'Boutique en attente d\'approbation', audience: 'Administration', sample: () => ({ emailData: { store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique' } }) },
  { key: 'ABONNEMENT_ACTIVE', label: 'Abonnement activé', audience: 'Abonnement', sample: () => ({ emailData: { tier: 'Premium', duration: '30 jours' } }) },
  { key: 'ABONNEMENT_EXPIRANT', label: 'Abonnement qui expire', audience: 'Abonnement', sample: () => ({ emailData: { tier: 'Premium', days: 5 } }) },
  { key: 'ABONNEMENT_EXPIRE', label: 'Abonnement expiré', audience: 'Abonnement', sample: () => ({ emailData: { tier: 'Premium' } }) },
  { key: 'NOUVELLE_INSCRIPTION', label: 'Nouvelle inscription', audience: 'Administration', sample: () => ({ emailData: { name: 'Jean K.', email: 'jean@exemple.com' } }) },
  { key: 'PAIEMENT_INCIDENT', label: 'Paiement en erreur', audience: 'Administration', sample: () => ({ emailData: { tx: 'KK-88-2013', provider: 'Kkiapay' } }) },
  { key: 'RECAP_VENTES_JOUR', label: 'Récap des ventes du jour', audience: 'Vendeur', sample: () => ({ emailData: { store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique', count: 14, total: '185000' } }) },
  { key: 'RAPPORT_VENDEUR_HEBDO', label: 'Rapport hebdomadaire vendeur', audience: 'Vendeur', sample: () => ({ emailData: { store: 'Ma Belle Boutique', storeSlug: 'ma-belle-boutique', count: 92, total: '1230000' } }) },
  { key: 'RAPPORT_ADMIN', label: 'Rapport hebdomadaire plateforme', audience: 'Administration', sample: () => ({ emailData: { count: 812, total: '9875000', stores: 47, users: 1520 } }) },
  { key: 'BIENVENUE', label: 'Bienvenue', audience: 'Générique', sample: () => ({ title: 'Bienvenue sur PosMarket', body: 'Votre compte a été créé avec succès.' }) },
  { key: 'VERIFICATION_COMPTE_OK', label: 'Compte vérifié', audience: 'Générique', sample: () => ({ title: 'Compte vérifié', body: 'Votre compte a été vérifié avec succès.' }) },
  { key: 'FACTURE_PAYEE', label: 'Facture payée', audience: 'Générique', sample: () => ({ title: 'Facture payée', body: 'Votre facture a été réglée avec succès.' }) },
  { key: 'JALON_MILESTONE', label: 'Jalon / étape franchie', audience: 'Vendeur', sample: () => ({ title: '100 commandes !', body: 'Votre boutique a atteint les 100 commandes. Continuez sur cette dynamique !' }) },
];

export { EMAIL_TEST_EVENTS };

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
      `${hero(IMG.bell, input.title || subject, null, input.body || '')}
       ${CTA(`${siteUrl()}/mon-compte`, 'Accéder à mon compte')}
       ${note('Cet email vous a été envoyé suite à une activité sur votre compte.')}`,
    );
  }

  const html = layout(content, brand);
  return { subject: finalSubject, html, text: stripHtml(html) };
}