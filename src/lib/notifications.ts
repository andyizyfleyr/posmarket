import { eq, and, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { notificationPreferences, notificationOutbox, profiles, stores, systemSettings } from '@/db/schema';
import { isWhatsAppConfigured, sendWhatsAppTemplate, sendWhatsAppText, toE164 } from '@/lib/whatsapp';
import { COUNTRIES } from '@/constants/countries';
import { NotificationEvent } from '@/types';

// ---------------------------------------------------------------------------
// Registre des événements de notification
// ---------------------------------------------------------------------------

export interface EventDefinition {
  label: string;
  /** template Meta Cloud API approuvé (obligatoire pour message initié par la plateforme) */
  templateName: string;
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
};

// ---------------------------------------------------------------------------
// Préférences (opt-in)
// ---------------------------------------------------------------------------

async function ensurePreference(userId: string | null, phone: string, eventType: NotificationEvent): Promise<void> {
  if (!userId) return;
  const exists = await db
    .select({ id: notificationPreferences.id })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.eventType, eventType),
        eq(notificationPreferences.phone, phone),
      ),
    )
    .limit(1);
  if (exists.length === 0) {
    await db.insert(notificationPreferences).values({ userId, phone, eventType, enabled: true, channel: 'whatsapp' });
  }
}

export async function isEventEnabled(userId: string | null, phone: string, eventType: NotificationEvent): Promise<boolean> {
  if (!userId) return true;
  const rows = await db
    .select({ enabled: notificationPreferences.enabled })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.eventType, eventType),
        eq(notificationPreferences.phone, phone),
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
): Promise<void> {
  const e164 = toE164(phone);
  if (!e164) return;
  await ensurePreference(userId, e164, eventType);
  await db
    .update(notificationPreferences)
    .set({ enabled })
    .where(
      and(
        eq(notificationPreferences.userId, userId),
        eq(notificationPreferences.eventType, eventType),
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
// Envoi (via outbox → Meta Cloud API)
// ---------------------------------------------------------------------------

export interface NotifyInput {
  userId?: string | null;
  /** Numéro brut (national "97 12 34 56", "+229...") → normalisé E.164 */
  phone?: string | null;
  phoneE164?: string;
  eventType: NotificationEvent;
  /** corps de secours si le template n'est pas configuré côté Meta */
  body: string;
  title?: string;
  /** paramètres du template, ordre = ordre des {{1}}, {{2}}... dans le template */
  templateParams?: string[];
  /** pour RELANCE_PANIER_ABANDONNE etc. */
  scheduledAt?: Date;
}

export async function notify(input: NotifyInput): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!isWhatsAppConfigured()) return { ok: true, skipped: true };

  const phone = input.phoneE164 || toE164(input.phone || '');
  if (!phone) return { ok: true, skipped: true };

  const userId = input.userId || null;
  const eventType = input.eventType;

  // Opt-in (marketing) : ne rien envoyer si désactivé.
  const def = NOTIFICATION_EVENTS[eventType];
  if (def?.optIn && !(await isEventEnabled(userId, phone, eventType))) {
    await ensurePreference(userId, phone, eventType);
    return { ok: true, skipped: true };
  }

  await ensurePreference(userId, phone, eventType);

  const templateName = def?.templateName || null;
  const params = input.templateParams || [];

  try {
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

    if (input.scheduledAt && input.scheduledAt > new Date()) return { ok: true };

    const result = await deliverOutboxRow(row.id);
    return { ok: result.ok };
  } catch (err) {
    console.error('[notify] insert error:', err);
    return { ok: false };
  }
}

async function deliverOutboxRow(id: string): Promise<{ ok: boolean }> {
  const [row] = await db.select().from(notificationOutbox).where(eq(notificationOutbox.id, id)).limit(1);
  if (!row) return { ok: false };

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
  if (!isWhatsAppConfigured()) return { processed: 0 };

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
// Récupération des téléphones cibles
// ---------------------------------------------------------------------------

export async function getStorePhone(storeId: string): Promise<{ name: string; phone: string; ownerId: string | null } | null> {
  const [store] = await db.select({ name: stores.name, phone: stores.phone, settings: stores.settings, ownerId: stores.userId }).from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) return null;
  const phone = store.phone || ((store.settings as Record<string, unknown> | null)?.phone as string) || '';
  return { name: store.name, phone, ownerId: store.ownerId };
}

export async function getProfilePhone(userId: string): Promise<string> {
  const [p] = await db.select({ phone: profiles.phone }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  return p?.phone || '';
}

/** Téléphone des admins (NOUVELLE_INSCRIPTION etc.) : system_settings -> env. */
export async function getAdminPhones(): Promise<string[]> {
  const [row] = await db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, 'admin_whatsapp_phones')).limit(1);
  const fromDb = row?.value ? row.value.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const fromEnv = (process.env.WHATSAPP_ADMIN_PHONES || '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...new Set([...fromDb, ...fromEnv])];
}

// ---------------------------------------------------------------------------
// Abonnements expirants / expirés (déclenché par le cron)
// ---------------------------------------------------------------------------

export async function checkSubscriptionExpirations(): Promise<{ sent: number }> {
  const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const expiring = await db
    .select({ id: profiles.id, phone: profiles.phone, tier: profiles.subscriptionTier })
    .from(profiles)
    .where(
      and(
        eq(profiles.subscriptionStatus, 'ACTIVE'),
        sql`${profiles.subscriptionEndDate} > now()`,
        sql`${profiles.subscriptionEndDate} <= ${in7}`,
      ),
    );

  const expired = await db
    .select({ id: profiles.id, phone: profiles.phone, tier: profiles.subscriptionTier })
    .from(profiles)
    .where(and(eq(profiles.subscriptionStatus, 'ACTIVE'), sql`${profiles.subscriptionEndDate} <= now()`));

  let sent = 0;
  for (const p of expiring) {
    const res = await notify({
      userId: p.id,
      phone: p.phone,
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

export { COUNTRIES };