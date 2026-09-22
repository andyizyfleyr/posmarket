import { eq, and, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  notificationPreferences,
  notificationOutbox,
  profiles,
  stores,
  orders,
  storeStaff,
  adminUsers,
  systemSettings,
} from '@/db/schema';
import { isWhatsAppConfigured, sendWhatsAppTemplate, sendWhatsAppText, toE164 } from '@/lib/whatsapp';
import { isEmailConfigured, sendEmail, renderEmailEvent } from '@/lib/email';
import { COUNTRIES } from '@/constants/countries';
import { NotificationEvent } from '@/types';

// ---------------------------------------------------------------------------
// Registre des événements de notification
// ---------------------------------------------------------------------------

export interface EventDefinition {
  label: string;
  /** template Meta Cloud API approuvé (obligatoire pour message initié par la plateforme) */
  templateName: string | null;
  lang: string;
  /** types considérés "marketing" : exige l'opt-in explicite */
  optIn: boolean;
}

export const NOTIFICATION_EVENTS: Record<NotificationEvent, EventDefinition> = {
  CONFIRMATION_COMMANDE: { label: 'Confirmation de commande', templateName: 'order_confirmation', lang: 'fr', optIn: false },
  COMMANDE_PRET: { label: 'Commande prête', templateName: 'order_ready', lang: 'fr', optIn: false },
  COMMANDE_EXPEDIEE: { label: 'Commande expédiée', templateName: 'order_shipped', lang: 'fr', optIn: false },
  COMMANDE_LIVREE: { label: 'Commande livrée', templateName: 'order_delivered_v2', lang: 'fr', optIn: false },
  COMMANDE_ANNULEE: { label: 'Commande annulée', templateName: 'order_cancelled', lang: 'fr', optIn: false },
  RECU_PAIEMENT: { label: 'Reçu de paiement', templateName: 'payment_receipt', lang: 'fr', optIn: false },
  RELANCE_PANIER_ABANDONNE: { label: 'Relance panier abandonné', templateName: 'abandoned_cart', lang: 'fr', optIn: true },
  NOUVELLE_COMMANDE: { label: 'Nouvelle commande', templateName: 'new_order', lang: 'fr', optIn: false },
  NOUVEAU_CLIENT: { label: 'Nouveau client', templateName: 'new_customer', lang: 'fr', optIn: false },
  ALERTE_STOCK_BAS: { label: 'Stock bas', templateName: 'low_stock_v2', lang: 'fr', optIn: false },
  RUPTURE_STOCK: { label: 'Rupture de stock', templateName: 'out_of_stock_v2', lang: 'fr', optIn: false },
  VENTE_POS: { label: 'Vente en boutique', templateName: 'pos_sale_v2', lang: 'fr', optIn: false },
  FACTURE_PAYEE: { label: 'Facture payée', templateName: 'invoice_paid', lang: 'fr', optIn: false },
  JALON_MILESTONE: { label: 'Jalon atteint', templateName: 'milestone_reached', lang: 'fr', optIn: true },
  BIENVENUE: { label: 'Bienvenue', templateName: 'welcome_v2', lang: 'fr', optIn: false },
  ABONNEMENT_ACTIVE: { label: 'Abonnement activé', templateName: 'subscription_active_v2', lang: 'fr', optIn: false },
  ABONNEMENT_EXPIRANT: { label: 'Abonnement expirant', templateName: 'subscription_expiring_v2', lang: 'fr', optIn: false },
  ABONNEMENT_EXPIRE: { label: 'Abonnement expiré', templateName: 'subscription_expired_v2', lang: 'fr', optIn: false },
  BOUTIQUE_APPROUVEE: { label: 'Boutique approuvée', templateName: 'store_approved_v2', lang: 'fr', optIn: false },
  BOUTIQUE_REJETEE: { label: 'Boutique rejetée', templateName: 'store_rejected_v2', lang: 'fr', optIn: false },
  VERIFICATION_COMPTE_OK: { label: 'Compte vérifié', templateName: 'account_verified_v2', lang: 'fr', optIn: false },
  NOUVELLE_INSCRIPTION: { label: 'Nouvelle inscription', templateName: 'new_signup_v2', lang: 'fr', optIn: false },
  COMMANDE_A_PREPARER: { label: 'Commande à préparer', templateName: null, lang: 'fr', optIn: false },
  DEMANDE_AVIS: { label: 'Demande d\'avis', templateName: null, lang: 'fr', optIn: false },
  NOUVEL_AVIS: { label: 'Nouvel avis', templateName: null, lang: 'fr', optIn: false },
  BOUTIQUE_EN_ATTENTE: { label: 'Boutique en attente', templateName: null, lang: 'fr', optIn: false },
  RAPPORT_VENDEUR_HEBDO: { label: 'Rapport hebdomadaire', templateName: null, lang: 'fr', optIn: false },
  RAPPORT_ADMIN: { label: 'Rapport hebdomadaire', templateName: null, lang: 'fr', optIn: false },
  RECAP_VENTES_JOUR: { label: 'Récap ventes du jour', templateName: null, lang: 'fr', optIn: false },
  ALERTE_TECHNIQUE: { label: 'Alerte technique', templateName: null, lang: 'fr', optIn: false },
  PAIEMENT_INCIDENT: { label: 'Paiement en erreur', templateName: null, lang: 'fr', optIn: false },
};

// ---------------------------------------------------------------------------
// Préférences (opt-in) — canal-aware
// ---------------------------------------------------------------------------

async function ensurePreference(
  userId: string | null,
  channel: 'whatsapp' | 'email',
  eventType: NotificationEvent,
  phone: string,
  email?: string | null,
): Promise<void> {
  if (!userId) return;
  const key = channel === 'whatsapp' ? phone : '';
  const exists = await db
    .select({ id: notificationPreferences.id })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.eventType, eventType),
        eq(notificationPreferences.channel, channel),
        eq(notificationPreferences.phone, key),
      ),
    )
    .limit(1);
  if (exists.length === 0) {
    await db
      .insert(notificationPreferences)
      .values({ userId, phone: key, email: channel === 'email' ? email || null : null, eventType, enabled: true, channel });
  }
}

export async function isEventEnabled(
  userId: string | null,
  phone: string,
  eventType: NotificationEvent,
  channel: 'whatsapp' | 'email' = 'whatsapp',
): Promise<boolean> {
  if (!userId) return true;
  const key = channel === 'whatsapp' ? phone : '';
  const rows = await db
    .select({ enabled: notificationPreferences.enabled })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.eventType, eventType),
        eq(notificationPreferences.channel, channel),
        eq(notificationPreferences.phone, key),
      ),
    )
    .limit(1);
  if (rows.length === 0) return true; // défaut : activé (transactionnel)
  return rows[0].enabled !== false;
}

export async function setNotificationPreference(
  userId: string,
  phone: string,
  eventType: NotificationEvent,
  enabled: boolean,
  channel: 'whatsapp' | 'email' = 'whatsapp',
  email?: string | null,
): Promise<void> {
  const e164 = channel === 'whatsapp' ? toE164(phone) : '';
  if (channel === 'whatsapp' && !e164) return;
  if (channel === 'email' && !email) return;
  await ensurePreference(userId, channel, eventType, e164, email);
  await db
    .update(notificationPreferences)
    .set({ enabled })
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.eventType, eventType),
        eq(notificationPreferences.channel, channel),
        eq(notificationPreferences.phone, e164),
      ),
    );
}

export async function listNotificationPreferences(userId: string) {
  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
  return rows;
}

// ---------------------------------------------------------------------------
// Envoi (via outbox → Meta Cloud API + email SMTP)
// ---------------------------------------------------------------------------

export interface NotifyInput {
  userId?: string | null;
  /** Numéro brut (national "97 12 34 56", "+229...") → normalisé E.164 */
  phone?: string | null;
  phoneE164?: string;
  /** Adresse email du destinataire (canal email) */
  email?: string | null;
  eventType: NotificationEvent;
  /** corps de secours si le template n'est pas configuré côté Meta */
  body: string;
  title?: string;
  /** paramètres du template, ordre = ordre des {{1}}, {{2}}... dans le template */
  templateParams?: string[];
  /** pour RELANCE_PANIER_ABANDONNE etc. */
  scheduledAt?: Date;
  /** clé de déduplication pour les jobs planifiés (stockée dans params des lignes email) */
  marker?: string;
}

export async function notify(input: NotifyInput): Promise<{ ok: boolean; skipped?: boolean }> {
  const phone = input.phoneE164 || toE164(input.phone || '');
  const email = String(input.email || '').trim();
  const eventType = input.eventType;
  const userId = input.userId || null;

  const wantWhatsapp = isWhatsAppConfigured() && !!phone;
  const wantEmail = (await isEmailConfigured()) && !!email;

  if (!wantWhatsapp && !wantEmail) return { ok: true, skipped: true };

  const def = NOTIFICATION_EVENTS[eventType];

  // Préférences par canal : activé par défaut pour le transactionnel ;
  // l'opt-in explicite est requis pour le marketing. Un « off » explicite
  // dans les paramètres (UI) coupe le canal concerné, quel que soit le type.
  const waEnabled = wantWhatsapp ? await isEventEnabled(userId, phone, eventType, 'whatsapp') : false;
  const emEnabled = wantEmail ? await isEventEnabled(userId, '', eventType, 'email') : false;

  const printWhatsapp = wantWhatsapp && waEnabled;
  const printEmail = wantEmail && emEnabled;

  if (!printWhatsapp && !printEmail) {
    if (def?.optIn) {
      if (wantWhatsapp) await ensurePreference(userId, 'whatsapp', eventType, phone, null);
      if (wantEmail) await ensurePreference(userId, 'email', eventType, '', email);
    }
    return { ok: true, skipped: true };
  }

  if (printWhatsapp) {
    await ensurePreference(userId, 'whatsapp', eventType, phone, null);
  }
  if (printEmail) {
    await ensurePreference(userId, 'email', eventType, '', email);
  }

  const templateName = def?.templateName || null;
  const params = input.templateParams || [];
  const emailParams = input.marker ? [...params, input.marker] : params;

  let inserted = 0;
  try {
    if (printWhatsapp) {
      const [row] = await db
        .insert(notificationOutbox)
        .values({
          recipientUserId: userId,
          recipientPhone: phone,
          eventType,
          title: input.title || def?.label || null,
          body: input.body,
          provider: 'whatsapp',
          status: input.scheduledAt && input.scheduledAt > new Date() ? 'SCHEDULED' : 'PENDING',
          templateName,
          params: params,
          scheduledAt: input.scheduledAt || null,
        })
        .returning();
      const isFuture = input.scheduledAt && input.scheduledAt > new Date();
      if (!isFuture) await deliverOutboxRow(row.id);
      inserted++;
    }

    if (printEmail) {
      const [row] = await db
        .insert(notificationOutbox)
        .values({
          recipientUserId: userId,
          recipientPhone: '',
          recipientEmail: email,
          eventType,
          title: input.title || def?.label || null,
          body: input.body,
          provider: 'email',
          status: input.scheduledAt && input.scheduledAt > new Date() ? 'SCHEDULED' : 'PENDING',
          templateName,
          params: emailParams,
          scheduledAt: input.scheduledAt || null,
        })
        .returning();
      const isFuture = input.scheduledAt && input.scheduledAt > new Date();
      if (!isFuture) await deliverOutboxRow(row.id);
      inserted++;
    }

    return { ok: inserted > 0 || true };
  } catch (err) {
    console.error('[notify] insert error:', err);
    return { ok: false };
  }
}

async function deliverOutboxRow(id: string): Promise<{ ok: boolean }> {
  const [row] = await db.select().from(notificationOutbox).where(eq(notificationOutbox.id, id)).limit(1);
  if (!row) return { ok: false };

  if (row.provider === 'email') {
    const rendered = await renderEmailEvent(row.eventType, {
      title: row.title || undefined,
      body: row.body,
      params: Array.isArray(row.params) ? (row.params as string[]) : [],
    });
    const result = await sendEmail({ to: row.recipientEmail || '', subject: rendered.subject, html: rendered.html });

    if (result.error) {
      const attempts = (row.attempts || 0) + 1;
      await db
        .update(notificationOutbox)
        .set({ status: attempts >= 3 ? 'FAILED' : 'PENDING', attempts, error: result.error })
        .where(eq(notificationOutbox.id, id));
      return { ok: false };
    }

    await db
      .update(notificationOutbox)
      .set({ status: 'SENT', messageId: result.messageId || null, sentAt: new Date(), error: null })
      .where(eq(notificationOutbox.id, id));
    return { ok: true };
  }

  let templateComponents: Array<Record<string, unknown>> = [];
  const params = (row.params as string[]) || [];
  if (params.length > 0) {
    templateComponents = [
      { type: 'body', parameters: params.map((p) => ({ type: 'text', text: p })) },
    ];
  }

  const eventKey = row.eventType as NotificationEvent;
  const useTemplate = !!row.templateName && process.env.WHATSAPP_FORCE_TEXT !== 'true';
  const result = useTemplate && row.templateName
    ? await sendWhatsAppTemplate(row.recipientPhone, row.templateName, templateComponents, NOTIFICATION_EVENTS[eventKey]?.lang || 'fr')
    : await sendWhatsAppText(row.recipientPhone, row.body);

  if (result.error) {
    const attempts = (row.attempts || 0) + 1;
    await db
      .update(notificationOutbox)
      .set({ status: attempts >= 3 ? 'FAILED' : 'PENDING', attempts, error: result.error })
      .where(eq(notificationOutbox.id, id));
    return { ok: false };
  }

  await db
    .update(notificationOutbox)
    .set({ status: 'SENT', messageId: result.messageId || null, sentAt: new Date(), error: null })
    .where(eq(notificationOutbox.id, id));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Traitement de la file (cron) + expirations d'abonnement
// ---------------------------------------------------------------------------

/** Envoie tout ce qui est dû/hors-file, réessaie les échecs (< 3 tentatives). */
export async function processDueNotifications(): Promise<{ processed: number }> {
  if (!isWhatsAppConfigured() && !(await isEmailConfigured())) return { processed: 0 };

  const due = await db
    .select({ id: notificationOutbox.id })
    .from(notificationOutbox)
    .where(
      or(
        and(eq(notificationOutbox.status, 'PENDING'), sql`${notificationOutbox.scheduledAt} IS NULL`),
        and(eq(notificationOutbox.status, 'SCHEDULED'), sql`${notificationOutbox.scheduledAt} <= now()`),
        and(eq(notificationOutbox.status, 'FAILED'), sql`${notificationOutbox.attempts} < 3`),
      ),
    )
    .orderBy(notificationOutbox.createdAt)
    .limit(100);

  let processed = 0;
  for (const { id } of due) {
    const result = await deliverOutboxRow(id);
    if (result.ok) processed++;
  }
  return { processed };
}

// ---------------------------------------------------------------------------
// Récupération des cibles (téléphones + emails)
// ---------------------------------------------------------------------------

export async function getStoreContact(storeId: string): Promise<{
  name: string;
  phone: string;
  email: string;
  ownerId: string | null;
} | null> {
  const [store] = await db
    .select({
      name: stores.name,
      phone: stores.phone,
      email: stores.email,
      settings: stores.settings,
      ownerId: stores.userId,
    })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);
  if (!store) return null;
  const settings = (store.settings || {}) as Record<string, unknown> | null;
  const phone = store.phone || (settings?.phone as string) || '';
  const email = store.email || (settings?.email as string) || '';
  return { name: store.name, phone, email, ownerId: store.ownerId };
}

export async function getStorePhone(storeId: string): Promise<{ name: string; phone: string; email: string; ownerId: string | null } | null> {
  const contact = await getStoreContact(storeId);
  if (!contact) return null;
  return { name: contact.name, phone: contact.phone, email: contact.email, ownerId: contact.ownerId };
}

export async function getProfilePhone(userId: string): Promise<string> {
  const [p] = await db.select({ phone: profiles.phone }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  return p?.phone || '';
}

export async function getProfileEmail(userId: string): Promise<string> {
  const [p] = await db.select({ email: profiles.email }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  return p?.email || '';
}

/** Téléphone des admins (NOUVELLE_INSCRIPTION etc.) : system_settings -> env. */
export async function getAdminPhones(): Promise<string[]> {
  const [row] = await db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, 'admin_whatsapp_phones')).limit(1);
  const fromDb = row?.value ? row.value.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const fromEnv = (process.env.WHATSAPP_ADMIN_PHONES || '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...new Set([...fromDb, ...fromEnv])];
}

/** Emails des admins : admin_users + system_settings admin_emails -> env ADMIN_EMAILS. */
export async function getAdminEmails(): Promise<string[]> {
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, 'admin_emails'))
    .limit(1)
    .catch(() => []);
  const fromDb = row?.value ? row.value.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const fromEnv = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const users = await db
    .select({ email: adminUsers.email })
    .from(adminUsers)
    .where(eq(adminUsers.isActive, true))
    .catch(() => [] as { email: string }[]);
  const fromUsers = users.map((u) => u.email).filter(Boolean);
  return [...new Set([...fromDb, ...fromEnv, ...fromUsers])];
}

/** Emails des membres du staff d'une boutique (store_staff -> profiles.email). */
export async function getStaffEmails(storeId: string): Promise<string[]> {
  const rows = await db
    .select({ email: profiles.email })
    .from(storeStaff)
    .leftJoin(profiles, eq(storeStaff.userId, profiles.id))
    .where(eq(storeStaff.storeId, storeId))
    .catch(() => []);
  return [...new Set(rows.map((r) => r.email).filter((e): e is string => !!e))];
}

/** Notifie tout le staff d'une boutique (mail). */
export async function notifyStaff(
  storeId: string,
  eventType: NotificationEvent,
  input: Omit<NotifyInput, 'eventType' | 'email' | 'userId' | 'phone'>,
): Promise<{ sent: number }> {
  const emails = await getStaffEmails(storeId);
  let sent = 0;
  for (const email of emails) {
    await notify({ ...input, eventType, email });
    sent++;
  }
  return { sent };
}

// ---------------------------------------------------------------------------
// Abonnements expirants / expirés (déclenché par le cron)
// ---------------------------------------------------------------------------

export async function checkSubscriptionExpirations(): Promise<{ sent: number }> {
  if (!isWhatsAppConfigured() && !(await isEmailConfigured())) return { sent: 0 };

  const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const expiring = await db
    .select({ id: profiles.id, phone: profiles.phone, email: profiles.email, tier: profiles.subscriptionTier })
    .from(profiles)
    .where(
      and(
        eq(profiles.subscriptionStatus, 'ACTIVE'),
        sql`${profiles.subscriptionEndDate} > now()`,
        sql`${profiles.subscriptionEndDate} <= ${in7}`,
      ),
    );

  const expired = await db
    .select({ id: profiles.id, phone: profiles.phone, email: profiles.email, tier: profiles.subscriptionTier })
    .from(profiles)
    .where(and(eq(profiles.subscriptionStatus, 'ACTIVE'), sql`${profiles.subscriptionEndDate} <= now()`));

  let sent = 0;
  for (const p of expiring) {
    const res = await notify({
      userId: p.id,
      phone: p.phone,
      email: p.email,
      eventType: 'ABONNEMENT_EXPIRANT',
      title: 'Abonnement expirant',
      body: `Votre abonnement ${p.tier || 'PRO'} expire sous 7 jours. Rendez-vous dans votre compte pour le renouveler.`,
      templateParams: [p.tier || '', '7'],
    });
    if (res.ok) sent++;
  }
  for (const p of expired) {
    const res = await notify({
      userId: p.id,
      phone: p.phone,
      email: p.email,
      eventType: 'ABONNEMENT_EXPIRE',
      title: 'Abonnement expiré',
      body: `Votre abonnement ${p.tier || 'PRO'} a expiré. Votre compte est en pause, choisissez une formule pour le réactiver.`,
      templateParams: [p.tier || ''],
    });
    if (res.ok) sent++;
  }
  return { sent };
}

// ---------------------------------------------------------------------------
// Jobs planifiés (cron /api/cron/notifications)
// ---------------------------------------------------------------------------

async function alreadyNotified(eventType: NotificationEvent, marker: string): Promise<boolean> {
  if (!marker) return false;
  const rows = await db
    .select({ id: notificationOutbox.id })
    .from(notificationOutbox)
    .where(and(eq(notificationOutbox.eventType, eventType), sql`${notificationOutbox.params}::text ILIKE ${`%${marker}%`}`))
    .limit(1)
    .catch(() => [] as Array<{ id: string }>);
  return rows.length > 0;
}

/** Demande d'avis (J+2 après commande livrée/terminée). */
export async function sendPendingReviewRequests(): Promise<{ sent: number }> {
  if (!(await isEmailConfigured())) return { sent: 0 };
  const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const ordersToAsk = await db
    .select({ id: orders.id, storeId: orders.storeId, buyerEmail: orders.buyerEmail, buyerUserId: orders.buyerUserId, total: orders.total })
    .from(orders)
    .where(and(eq(orders.status, 'COMPLETED'), sql`${orders.date} <= ${cutoff}`))
    .limit(50);

  let sent = 0;
  for (const order of ordersToAsk) {
    const email = order.buyerEmail || (order.buyerUserId ? await getProfileEmail(order.buyerUserId) : '');
    if (!email) continue;
    const marker = `order-${order.id.slice(0, 8).toUpperCase()}`;
    if (await alreadyNotified('DEMANDE_AVIS', marker)) continue;
    const contact = order.storeId ? await getStoreContact(order.storeId) : null;
    const res = await notify({
      email,
      eventType: 'DEMANDE_AVIS',
      title: 'Donnez votre avis',
      body: `Merci pour votre achat${contact ? ` chez ${contact.name}` : ''} ! Partagez votre expérience en laissant un avis sur vos produits.`,
      templateParams: [contact?.name || 'PosMarket'],
      marker,
    });
    if (res.ok) sent++;
  }
  return { sent };
}

/** Récap journalier des ventes par boutique → staff. */
export async function sendStaffDailyRecap(): Promise<{ sent: number }> {
  if (!(await isEmailConfigured())) return { sent: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const marker = `day-${today.toISOString().slice(0, 10)}`;

  const storeRows = await db.select({ id: stores.id, name: stores.name }).from(stores).where(eq(stores.status, 'APPROVED'));
  let sent = 0;
  for (const store of storeRows) {
    const [agg] = await db
      .select({
        count: sql<number>`count(${orders.id})::int`,
        total: sql<string>`coalesce(sum(${orders.total})::numeric, 0)::text`,
      })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), sql`${orders.date} >= ${today}`));
    const count = Number(agg?.count || 0);
    const total = Number(agg?.total || 0);
    if (count === 0) continue;

    const emails = await getStaffEmails(store.id);
    if (emails.length === 0) continue;
    if (await alreadyNotified('RECAP_VENTES_JOUR', `${marker}-${store.id.slice(0, 8)}`)) continue;

    const totalStr = new Intl.NumberFormat('fr-FR').format(total);
    for (const email of emails) {
      const res = await notify({
        email,
        eventType: 'RECAP_VENTES_JOUR',
        title: `Récap des ventes — ${store.name}`,
        body: `Ventes du jour chez ${store.name} : ${count} commande(s) pour ${totalStr} FCFA.`,
        templateParams: [store.name, String(count), totalStr],
        marker: `${marker}-${store.id.slice(0, 8)}`,
      });
      if (res.ok) sent++;
    }
  }
  return { sent };
}

/** Rapport hebdomadaire vendeurs (CA sur les 7 derniers jours). */
export async function sendWeeklyVendorReports(): Promise<{ sent: number }> {
  if (!(await isEmailConfigured())) return { sent: 0 };
  const now = new Date();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const marker = `week-${now.toISOString().slice(0, 10)}`;

  const storeRows = await db
    .select({ id: stores.id, name: stores.name, userId: stores.userId, email: stores.email, settings: stores.settings })
    .from(stores)
    .where(eq(stores.status, 'APPROVED'));
  let sent = 0;
  for (const store of storeRows) {
    const [agg] = await db
      .select({
        count: sql<number>`count(${orders.id})::int`,
        total: sql<string>`coalesce(sum(${orders.total})::numeric, 0)::text`,
      })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), sql`${orders.date} >= ${since}`));
    const count = Number(agg?.count || 0);
    const total = Number(agg?.total || 0);
    if (count === 0) continue;

    const settings = (store.settings || {}) as Record<string, unknown> | null;
    const email = store.email || (settings?.email as string) || (store.userId ? await getProfileEmail(store.userId) : '');
    if (!email) continue;
    if (await alreadyNotified('RAPPORT_VENDEUR_HEBDO', `${marker}-${store.id.slice(0, 8)}`)) continue;

    const totalStr = new Intl.NumberFormat('fr-FR').format(total);
    const res = await notify({
      userId: store.userId,
      email,
      eventType: 'RAPPORT_VENDEUR_HEBDO',
      title: `Votre rapport hebdomadaire — ${store.name}`,
      body: `La semaine dernière, ${store.name} a généré ${totalStr} FCFA sur ${count} commande(s). Bonne lancée !`,
      templateParams: [store.name, String(count), totalStr],
      marker: `${marker}-${store.id.slice(0, 8)}`,
    });
    if (res.ok) sent++;
  }
  return { sent };
}

/** Rapport hebdomadaire global → admins. */
export async function sendWeeklyAdminReport(): Promise<{ sent: number }> {
  if (!(await isEmailConfigured())) return { sent: 0 };
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const marker = `week-${new Date().toISOString().slice(0, 10)}`;
  if (await alreadyNotified('RAPPORT_ADMIN', marker)) return { sent: 0 };

  const [[storesCount], [usersCount], [ordersAgg], [salesAgg]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(stores),
    db.select({ count: sql<number>`count(*)::int` }).from(profiles),
    db
      .select({ count: sql<number>`count(${orders.id})::int` })
      .from(orders)
      .where(sql`${orders.date} >= ${since}`),
    db
      .select({ total: sql<string>`coalesce(sum(${orders.total})::numeric, 0)::text` })
      .from(orders)
      .where(sql`${orders.date} >= ${since}`),
  ]);

  const count = Number(ordersAgg?.count || 0);
  const total = Number(salesAgg?.total || 0);
  const totalStr = new Intl.NumberFormat('fr-FR').format(total);
  const admins = await getAdminEmails();
  let sent = 0;
  for (const email of admins) {
    const res = await notify({
      email,
      eventType: 'RAPPORT_ADMIN',
      title: 'Rapport hebdomadaire PosMarket',
      body: `Semaine écoulée : ${count} commande(s) sur la marketplace pour ${totalStr} FCFA. ${Number(storesCount?.count || 0)} boutiques et ${Number(usersCount?.count || 0)} utilisateurs.`,
      templateParams: [String(count), totalStr, String(Number(storesCount?.count || 0)), String(Number(usersCount?.count || 0))],
      marker,
    });
    if (res.ok) sent++;
  }
  return { sent };
}

// ---------------------------------------------------------------------------

export { COUNTRIES };