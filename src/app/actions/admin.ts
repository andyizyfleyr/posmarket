'use server';

import { db } from '@/db';
import { stores, profiles, orders, products, productReviews, orderItems, invoices, systemSettings, productStats, reviewAuthors, boostLogs, boostSchedules, customers } from '@/db/schema';
import { eq, desc, sql, inArray, and, ne, gte } from 'drizzle-orm';
import { revalidatePath, revalidateTag, updateTag } from 'next/cache';
import { notify, getStorePhone, getAdminEmails } from '@/lib/notifications';
import { getAdminSession, type AdminSession } from '@/app/actions/admin-auth';
import { invalidateOrdersCache, incrementProductSales } from '@/db/api';
import { ACCES_REFUSE } from '@/lib/authorization';
import { rateLimit, rateLimitMessage, getClientIp } from '@/lib/rate-limit';
import { stripJsonFences } from '@/lib/json-fences';

/**
 * Garde-fou commun à toutes les actions de ce fichier : elles appartiennent à
 * l'espace d'administration /pam. Sans cette vérification, ces actions sont des
 * endpoints HTTP publics (mise à jour de rôles, suppression de comptes, lecture
 * de l'intégralité des commandes et factures).
 */
async function requirePamAdmin() {
  return await getAdminSession();
}
import { renderEmailEvent, sendEmail, EMAIL_TEST_EVENTS } from '@/lib/email';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function getGlobalStats() {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  // Pas de cron côté serveur : on profite du chargement du tableau de bord
  // pour créditer les vues étalées arrivées à échéance.
  await applyAllDueViewBoosts();
  try {
    const [
      [{ count: totalStores }],
      [{ count: totalUsers }],
      allOrders,
      [{ count: totalProducts }],
      [{ count: pendingStores }],
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(stores),
      db.select({ count: sql<number>`count(*)` }).from(profiles),
      // Les commandes fabriquées par le panneau de boost gonfleraient le CA
      // affiché : on les totalise à part.
      db.select({ total: orders.total, boosted: orders.boosted }).from(orders),
      db.select({ count: sql<number>`count(*)` }).from(products),
      db.select({ count: sql<number>`count(*)` }).from(stores).where(eq(stores.status, 'PENDING')),
    ]);

    let totalSales = 0;
    let boostedSales = 0;
    for (const order of allOrders || []) {
      const amount = parseFloat(order.total ?? '') || 0;
      if (order.boosted) boostedSales += amount;
      else totalSales += amount;
    }

    return {
      totalStores: Number(totalStores) || 0,
      totalUsers: Number(totalUsers) || 0,
      totalSales,
      boostedSales,
      totalProducts: Number(totalProducts) || 0,
      pendingStores: Number(pendingStores) || 0
    };
  } catch (error: unknown) {
    console.error('Error fetching global stats:', error);
    return { totalStores: 0, totalUsers: 0, totalSales: 0, boostedSales: 0, totalProducts: 0, pendingStores: 0 };
  }
}

export async function getAllStores() {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  await applyAllDueViewBoosts();
  try {
    const storesList = await db.select().from(stores).orderBy(desc(stores.createdAt));
    return storesList || [];
  } catch (error: unknown) {
    console.error('Error fetching all stores:', error);
    return [];
  }
}

export async function getAllUsers() {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    const usersList = await db.select().from(profiles).orderBy(desc(profiles.createdAt));
    return usersList || [];
  } catch (error: unknown) {
    console.error('Error fetching all users:', error);
    return [];
  }
}

export async function getGlobalProducts(limit = 100) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    const productsList = await db.select().from(products).orderBy(desc(products.createdAt)).limit(limit);
    return productsList || [];
  } catch (error: unknown) {
    console.error('Error fetching global products:', error);
    return [];
  }
}

export async function getGlobalOrders(limit = 100) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    const ordersList = await db.select().from(orders).orderBy(desc(orders.date)).limit(limit);
    return ordersList || [];
  } catch (error: unknown) {
    console.error('Error fetching global orders:', error);
    return [];
  }
}

export async function getGlobalReviews(limit = 100) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    const reviewsList = await db.select().from(productReviews).orderBy(desc(productReviews.createdAt)).limit(limit);
    return reviewsList || [];
  } catch (error: unknown) {
    console.error('Error fetching global reviews:', error);
    return [];
  }
}

export async function getGlobalInvoices(limit = 100) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    const invoicesList = await db.select().from(invoices).orderBy(desc(invoices.createdAt)).limit(limit);
    return invoicesList || [];
  } catch (error: unknown) {
    console.error('Error fetching global invoices:', error);
    return [];
  }
}

export async function getOrderItems(orderId: string) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    return items || [];
  } catch (error: unknown) {
    console.error('Error fetching order items:', error);
    return [];
  }
}

export async function getStoreById(storeId: string) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
    return store || null;
  } catch (error: unknown) {
    console.error('Error fetching store:', error);
    return null;
  }
}

export async function getUserById(userId: string) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    const [user] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
    return user || null;
  } catch (error: unknown) {
    console.error('Error fetching user:', error);
    return null;
  }
}

export async function getUserStores(userId: string) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    const userStores = await db.select().from(stores).where(eq(stores.userId, userId)).orderBy(desc(stores.createdAt));
    return userStores || [];
  } catch (error: unknown) {
    console.error('Error fetching user stores:', error);
    return [];
  }
}

export async function getStoreOrders(storeId: string) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    const storeOrders = await db.select().from(orders).where(eq(orders.storeId, storeId)).orderBy(desc(orders.date));
    return storeOrders || [];
  } catch (error: unknown) {
    console.error('Error fetching store orders:', error);
    return [];
  }
}

export async function getStoreProducts(storeId: string) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    const storeProducts = await db.select().from(products).where(eq(products.storeId, storeId)).orderBy(desc(products.createdAt));
    return storeProducts || [];
  } catch (error: unknown) {
    console.error('Error fetching store products:', error);
    return [];
  }
}

export async function getAllStoreProductCounts(): Promise<Record<string, number>> {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    const rows = await db
      .select({ storeId: products.storeId, count: sql<number>`count(*)` })
      .from(products)
      .groupBy(products.storeId);
    const map: Record<string, number> = {};
    (rows || []).forEach(r => {
      if (r.storeId) map[r.storeId] = Number(r.count) || 0;
    });
    return map;
  } catch (error: unknown) {
    console.error('Error fetching store product counts:', error);
    return {};
  }
}

export async function getStoreReviews(storeId: string) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    const storeReviews = await db.select().from(productReviews).where(eq(productReviews.storeId, storeId)).orderBy(desc(productReviews.createdAt));
    return storeReviews || [];
  } catch (error: unknown) {
    console.error('Error fetching store reviews:', error);
    return [];
  }
}

export async function updateStoreApproval(storeId: string, status: string) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    await db.update(stores).set({ status }).where(eq(stores.id, storeId));
    revalidatePath('/pam/stores');
    updateTag('marketplace');

    const upper = String(status || '').toUpperCase();
    if (upper === 'APPROVED' || upper === 'APPROUVE') {
      const storeInfo = await getStorePhone(storeId);
      await notify({
        userId: storeInfo?.ownerId || null,
        phone: storeInfo?.phone || '',
        email: storeInfo?.email || '',
        eventType: 'BOUTIQUE_APPROUVEE',
        title: 'Boutique approuvée',
        body: `Félicitations ! Votre boutique « ${storeInfo?.name || ''} » a été approuvée et est maintenant en ligne sur la marketplace.`,
        templateParams: [storeInfo?.name || ''],
        emailData: { store: storeInfo?.name || '', storeSlug: storeInfo?.slug || '' },
      });
    } else if (upper === 'REJECTED' || upper === 'REJETE') {
      const storeInfo = await getStorePhone(storeId);
      await notify({
        userId: storeInfo?.ownerId || null,
        phone: storeInfo?.phone || '',
        email: storeInfo?.email || '',
        eventType: 'BOUTIQUE_REJETEE',
        title: 'Boutique rejetée',
        body: `Votre boutique « ${storeInfo?.name || ''} » n'a pas été approuvée. Bonifiez votre présentation et soumettez-la à nouveau.`,
        templateParams: [storeInfo?.name || ''],
        emailData: { store: storeInfo?.name || '', storeSlug: storeInfo?.slug || '' },
      });
    } else if (upper === 'PENDING') {
      const storeInfo = await getStorePhone(storeId);
      const admins = await getAdminEmails();
      for (const adminEmail of admins) {
        await notify({
          email: adminEmail,
          eventType: 'BOUTIQUE_EN_ATTENTE',
          title: 'Boutique en attente d\'approbation',
          body: `La boutique « ${storeInfo?.name || '—'} » attend votre validation dans le panneau d'administration.`,
          templateParams: [storeInfo?.name || '—'],
          emailData: { store: storeInfo?.name || '—', storeSlug: storeInfo?.slug || '' },
        });
      }
    }
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function updateUserRole(userId: string, isSuperAdmin: boolean) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    await db.update(profiles).set({ isSuperAdmin }).where(eq(profiles.id, userId));
    revalidatePath('/pam/users');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function updateUserAdminStatus(userId: string, isAdmin: boolean) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  return updateUserRole(userId, isAdmin);
}

export async function updateUserSubscription(userId: string, tier: string, duration: string) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    if (tier === 'NONE') {
      await db.update(profiles).set({
        subscriptionTier: null,
        subscriptionDuration: null,
        subscriptionStartDate: null,
        subscriptionEndDate: null,
        subscriptionStatus: null
      }).where(eq(profiles.id, userId));
      revalidatePath('/pam/users');
      return { success: true };
    }

    const startDate = new Date();
    const endDate = new Date();

    if (duration === 'monthly') {
      endDate.setMonth(startDate.getMonth() + 1);
    } else if (duration === 'quarterly') {
      endDate.setMonth(startDate.getMonth() + 3);
    } else if (duration === 'annual') {
      endDate.setFullYear(startDate.getFullYear() + 1);
    }

    await db.update(profiles).set({
      subscriptionTier: tier,
      subscriptionDuration: duration,
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
      subscriptionStatus: 'ACTIVE'
    }).where(eq(profiles.id, userId));
    revalidatePath('/pam/users');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export type SellerAccountUpdate = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  ninea?: string | null;
  accountType?: string | null;
  isSuperAdmin?: boolean;
};

/** Modifie les détails d'un compte vendeur depuis le panneau admin. */
export async function updateSellerAccountAction(userId: string, updates: SellerAccountUpdate) {
  try {
    const session = await getAdminSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    const patch: Record<string, unknown> = {};
    if (updates && typeof updates.fullName !== 'undefined') {
      patch.fullName = String(updates.fullName || '').trim() || null;
    }
    let previousEmail: string | null = null;
    if (typeof updates.email !== 'undefined') {
      const email = String(updates.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) return { success: false, error: 'Adresse email invalide.' };
      const [existing] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(and(eq(profiles.email, email), ne(profiles.id, userId)))
        .limit(1);
      if (existing) return { success: false, error: 'Cet email est déjà utilisé par un autre compte.' };
      const [current] = await db
        .select({ email: profiles.email })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);
      previousEmail = current?.email ?? null;
      patch.email = email;
    }
    if (typeof updates.phone !== 'undefined') {
      patch.phone = String(updates.phone || '').trim() || null;
    }
    if (typeof updates.companyName !== 'undefined') {
      patch.companyName = String(updates.companyName || '').trim() || null;
    }
    if (typeof updates.ninea !== 'undefined') {
      patch.ninea = String(updates.ninea || '').trim() || null;
    }
    if (typeof updates.accountType !== 'undefined') {
      const accountType = String(updates.accountType || '').trim();
      if (accountType !== 'buyer' && accountType !== 'seller') {
        return { success: false, error: 'Type de compte invalide.' };
      }
      patch.accountType = accountType;
    }
    if (typeof updates.isSuperAdmin === 'boolean') {
      patch.isSuperAdmin = updates.isSuperAdmin;
    }

    if (Object.keys(patch).length === 0) return { success: true };

    await db.update(profiles).set(patch).where(eq(profiles.id, userId));
    // Garde les commandes client de ce compte à jour lors d'un renommage
    // d'email, pour éviter un décalage avec l'espace client.
    if (typeof patch.email === 'string' && previousEmail) {
      await db
        .update(orders)
        .set({ buyerEmail: patch.email })
        .where(and(eq(orders.buyerUserId, userId), eq(orders.buyerEmail, previousEmail)));
    }
    revalidatePath('/pam/users');
    revalidatePath(`/pam/users/${userId}`);
    revalidatePath('/pam/stores');
    updateTag('marketplace');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error updating seller account:', error);
    return { success: false, error: errorMessage(error) };
  }
}

export async function deleteUser(userId: string) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    await db.delete(profiles).where(eq(profiles.id, userId));
    revalidatePath('/pam/users');
    updateTag('marketplace');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function forceDeleteStore(storeId: string) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    await db.delete(stores).where(eq(stores.id, storeId));
    revalidatePath('/pam/stores');
    updateTag('marketplace');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function deleteStoreAdmin(storeId: string) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  return forceDeleteStore(storeId);
}

export async function deleteUsersBulk(userIds: string[]) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  if (!userIds.length) return { success: true, deleted: 0 };
  try {
    await db.delete(profiles).where(inArray(profiles.id, userIds));
    revalidatePath('/pam/users');
    updateTag('marketplace');
    return { success: true, deleted: userIds.length };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function deleteStoresBulk(storeIds: string[]) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  if (!storeIds.length) return { success: true, deleted: 0 };
  try {
    await db.delete(stores).where(inArray(stores.id, storeIds));
    revalidatePath('/pam/stores');
    updateTag('marketplace');
    return { success: true, deleted: storeIds.length };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function deleteReview(reviewId: string) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    const [review] = await db
      .select({ productId: productReviews.productId, storeId: productReviews.storeId })
      .from(productReviews)
      .where(eq(productReviews.id, reviewId))
      .limit(1);
    await db.delete(productReviews).where(eq(productReviews.id, reviewId));
    // Sans ce recalcul, supprimer un avis laissait `review_count` et
    // `average_rating` périmés dans `product_stats`.
    if (review) await recomputeReviewAggregates(review.storeId, [review.productId]);
    revalidatePath('/pam/reviews');
    updateTag('marketplace');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function deleteProduct(productId: string) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    await db.delete(products).where(eq(products.id, productId));
    revalidatePath('/pam/inventory');
    updateTag('marketplace');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function updateStoreStatusAction(storeId: string, status: string) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  return updateStoreApproval(storeId, status);
}

export interface SystemSettingsData {
  maintenance: boolean;
  auto_indexing: boolean;
  weekly_reports: boolean;
  payment_provider?: 'kkiapay' | 'fedapay';
  kkiapay_public_key?: string;
  kkiapay_private_key?: string;
  kkiapay_secret_key?: string;
  kkiapay_env?: 'sandbox' | 'live';
  fedapay_public_key?: string;
  fedapay_secret_key?: string;
  fedapay_webhook_secret?: string;
  fedapay_env?: 'sandbox' | 'live';
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_from?: string;
  smtp_from_name?: string;
  mail_reply_to?: string;
  mail_brand_name?: string;
  mail_tagline?: string;
  mail_logo_url?: string;
  mail_footer?: string;
  admin_emails?: string;
  /** vrai si un mot de passe SMTP est déjà persisté (masqué à l'écran) */
  smtp_pass_set?: boolean;
}

export async function getSystemSettings(): Promise<{ success: boolean; error?: string; settings: SystemSettingsData }> {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    const rows = await db.select().from(systemSettings);
    const settings: SystemSettingsData = { maintenance: false, auto_indexing: true, weekly_reports: true, payment_provider: 'kkiapay', smtp_pass_set: false };
    rows.forEach(r => {
      if (r.key === 'maintenance' || r.key === 'auto_indexing' || r.key === 'weekly_reports') {
        settings[r.key] = r.value === 'true';
      } else if (r.key === 'payment_provider') {
        settings.payment_provider = r.value === 'fedapay' ? 'fedapay' : 'kkiapay';
      } else if (r.key === 'kkiapay_env') {
        settings.kkiapay_env = r.value === 'live' ? 'live' : 'sandbox';
      } else if (r.key === 'fedapay_env') {
        settings.fedapay_env = r.value === 'live' ? 'live' : 'sandbox';
      } else if (r.key === 'kkiapay_public_key' || r.key === 'kkiapay_private_key' || r.key === 'kkiapay_secret_key' || r.key === 'fedapay_public_key' || r.key === 'fedapay_secret_key' || r.key === 'fedapay_webhook_secret') {
        settings[r.key] = r.value;
      } else if (r.key === 'smtp_host' || r.key === 'smtp_port' || r.key === 'smtp_user' || r.key === 'smtp_from' || r.key === 'smtp_from_name' || r.key === 'mail_reply_to' || r.key === 'mail_brand_name' || r.key === 'mail_tagline' || r.key === 'mail_logo_url' || r.key === 'mail_footer' || r.key === 'admin_emails') {
        settings[r.key] = r.value;
      } else if (r.key === 'smtp_pass') {
        settings.smtp_pass_set = !!r.value;
      }
    });
    return { success: true, settings };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error), settings: { maintenance: false, auto_indexing: true, weekly_reports: true, payment_provider: 'kkiapay', smtp_pass_set: false } };
  }
}

export async function updateSystemSettings(settings: Partial<SystemSettingsData>) {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  try {
    const allowedStringKeys = ['payment_provider', 'kkiapay_public_key', 'kkiapay_private_key', 'kkiapay_secret_key', 'fedapay_public_key', 'fedapay_secret_key', 'fedapay_webhook_secret', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_from', 'smtp_from_name', 'mail_reply_to', 'mail_brand_name', 'mail_tagline', 'mail_logo_url', 'mail_footer', 'admin_emails'];
    const allowedEnvKeys = ['kkiapay_env', 'fedapay_env'];
    const booleanKeys = ['maintenance', 'auto_indexing', 'weekly_reports'];

    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined || value === null) continue;
      // Le mot de passe SMTP n'est persisté que s'il est réellement saisi.
      if (key === 'smtp_pass') {
        if (String(value).trim()) {
          await db.insert(systemSettings)
            .values({ key, value: String(value).trim() })
            .onConflictDoUpdate({ target: systemSettings.key, set: { value: String(value).trim(), updatedAt: new Date() } });
        }
        continue;
      }
      if (booleanKeys.includes(key)) {
        await db.insert(systemSettings)
          .values({ key, value: String(value) })
          .onConflictDoUpdate({ target: systemSettings.key, set: { value: String(value), updatedAt: new Date() } });
      } else if (allowedStringKeys.includes(key)) {
        await db.insert(systemSettings)
          .values({ key, value: String(value || '') })
          .onConflictDoUpdate({ target: systemSettings.key, set: { value: String(value || ''), updatedAt: new Date() } });
      } else if (allowedEnvKeys.includes(key)) {
        await db.insert(systemSettings)
          .values({ key, value: String(value || 'sandbox') })
          .onConflictDoUpdate({ target: systemSettings.key, set: { value: String(value || 'sandbox'), updatedAt: new Date() } });
      }
    }
    revalidatePath('/pam/settings');
    revalidatePath('/subscription');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Tests d'emails — envoi d'un échantillon de chaque notification à une adresse.
// ---------------------------------------------------------------------------

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

export async function getEmailTestEventsAction() {
  if (!(await requirePamAdmin())) throw new Error(ACCES_REFUSE);
  return EMAIL_TEST_EVENTS.map(({ key, label, audience }) => ({ key, label, audience }));
}

export async function sendTestEmailAction(eventKey: string, email: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const session = await getAdminSession();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!isEmailAddress(email)) return { success: false, error: 'Adresse email invalide' };

  const event = EMAIL_TEST_EVENTS.find(e => e.key === eventKey);
  if (!event) return { success: false, error: 'Événement inconnu' };

  try {
    const rendered = await renderEmailEvent(event.key, event.sample());
    const result = await sendEmail({ to: email.trim(), subject: `[TEST] ${rendered.subject}`, html: rendered.html });
    if (result.error) return { success: false, error: result.error };
    return { success: true, messageId: result.messageId };
  } catch (error: unknown) {
    console.error('sendTestEmailAction error:', error);
    return { success: false, error: errorMessage(error) };
  }
}

export async function sendAllTestEmailsAction(email: string): Promise<{ success: boolean; sent: number; failures: Array<{ key: string; error: string }>; error?: string }> {
  const session = await getAdminSession();
  if (!session) return { success: false, sent: 0, failures: [], error: 'Unauthorized' };
  if (!isEmailAddress(email)) return { success: false, sent: 0, failures: [], error: 'Adresse email invalide' };

  const target = email.trim();
  const failures: Array<{ key: string; error: string }> = [];
  let sent = 0;

  for (const event of EMAIL_TEST_EVENTS) {
    try {
      const rendered = await renderEmailEvent(event.key, event.sample());
      const result = await sendEmail({ to: target, subject: `[TEST] ${rendered.subject}`, html: rendered.html });
      if (result.error) {
        failures.push({ key: event.key, error: result.error });
      } else {
        sent += 1;
      }
    } catch (error: unknown) {
      failures.push({ key: event.key, error: errorMessage(error) });
    }
  }

  return { success: failures.length === 0, sent, failures };
}

// ---------------------------------------------------------------------------
// V2 — panneau « Booster les statistiques »
// ---------------------------------------------------------------------------

/** Quota journalier (24 h glissantes) par type d'action, par boutique. */
const BOOST_DAILY_QUOTA = { views: 100_000_000, orders: 10_000, reviews: 10_000 } as const;
type BoostQuotaAction = keyof typeof BOOST_DAILY_QUOTA;
type BoostAction = BoostQuotaAction | 'unboost';

/** Bornes de date d'une application : un plage explicite, sinon les N derniers jours. */
type BoostRange = { from?: string | null; to?: string | null } | null | undefined;

async function getBoostSession() {
  const session = await requirePamAdmin();
  return session || null;
}

/** UUID Postgres (4 blocs hex) : rejette tout identifiant hors format. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Garde commune à toutes les actions d'écriture du panneau « Booster les
 * statistiques » : session PAM valide, `storeId` en UUID et limitation de
 * débit par admin + IP — un script ne peut donc pas consommer les quotas 24 h
 * en boucle, ni écrire n'importe quoi dans `boost_logs`.
 *
 * `limit` appels/montre : l'UI n'émet jamais plus d'une action à la fois.
 */
async function guardBoost(
  storeId: unknown,
  opts: { action: 'views' | 'orders' | 'reviews' | 'unboost' | 'state'; limit?: number }
): Promise<{ ok: true; session: AdminSession; ip: string } | { ok: false; error: string }> {
  const session = await getBoostSession();
  if (!session) return { ok: false, error: 'Session expirée.' };
  if (!isUuid(storeId)) return { ok: false, error: 'Identifiant de boutique invalide.' };

  const ip = await getClientIp();
  const rl = rateLimit(`pam-boost:${opts.action}:${session.id}:${ip}`, opts.limit ?? 15, 60_000);
  if (!rl.ok) return { ok: false, error: rateLimitMessage(rl.retryAfterSeconds) };

  return { ok: true, session, ip };
}

/**
 * Un seul boost à la fois par boutique : deux requêtes simultanées ne peuvent
 * pas lire le même quota restant, l'écrire, puis toutes les deux l'épuiser
 * (la vérification du quota n'est pas transactionnelle).
 */
const boostLocks = new Set<string>();
function acquireBoostLock(storeId: string): boolean {
  if (boostLocks.has(storeId)) return false;
  boostLocks.add(storeId);
  return true;
}
function releaseBoostLock(storeId: string): void {
  boostLocks.delete(storeId);
}

/** Erreur renvoyée au client : jamais le détail interne (SQL, driver, stack). */
function boostFailure(error: unknown): string {
  console.error('boost action error:', error);
  return 'Erreur serveur pendant le boost. Réessayez ou consultez les logs.';
}

async function logBoost(
  storeId: string,
  action: BoostAction,
  amount: number,
  detail?: Record<string, unknown>,
  createdBy?: string
) {
  try {
    await db.insert(boostLogs).values({
      storeId,
      action,
      amount,
      detail: detail ?? {},
      createdBy: createdBy ?? null,
    });
  } catch (error) {
    // Le journal ne doit jamais faire échouer le boost lui-même.
    console.error('logBoost error:', error);
  }
}

/** Quota restant pour `action` sur les 24 dernières heures (0 = bloqué). */
async function boostQuotaLeft(storeId: string, action: BoostQuotaAction): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600_000);
  const [row] = await db
    .select({ used: sql<number>`coalesce(sum(${boostLogs.amount}), 0)::int` })
    .from(boostLogs)
    .where(
      and(
        eq(boostLogs.storeId, storeId),
        eq(boostLogs.action, action),
        gte(boostLogs.createdAt, since),
        // Les logs annulés par un « Débooster » ne consomment plus le quota.
        eq(boostLogs.voided, false)
      )
    );
  return Math.max(0, BOOST_DAILY_QUOTA[action] - (Number(row?.used) || 0));
}

/**
 * Normalise une période de boost : plage explicite `from`/`to`, sinon les
 * `spreadDays` derniers jours. La fin est toujours plafonnée à « maintenant ».
 */
function resolveBoostRange(range: BoostRange, spreadDays: number): { start: number; end: number } {
  const day = 86_400_000;
  const now = Date.now();
  const from = range?.from ? Date.parse(range.from) : NaN;
  const to = range?.to ? Date.parse(range.to) : NaN;
  if (Number.isFinite(from) || Number.isFinite(to)) {
    const end = Math.min(now, Number.isFinite(to) ? to + day - 1 : now);
    const start = Math.min(end, Number.isFinite(from) ? from : end - day + 1);
    return { start, end: Math.max(start, end) };
  }
  const days = Math.min(365, Math.max(1, Math.floor(Number(spreadDays) || 30)));
  return { start: now - days * day, end: now };
}

/** Date aléatoire dans [start, end], jamais avant `earliest` ni après « maintenant ». */
function randomDateBetween(start: number, end: number, earliest = 0): number {
  const now = Date.now();
  const low = Math.max(start, earliest);
  const high = Math.max(low, end);
  return Math.min(now, Math.max(low, low + Math.floor(Math.random() * (high - low + 1))));
}

/**
 * Catalogue boostable d'une boutique : produits vendables (prix > 0, en ligne),
 * sans limite artificielle de 200 lignes. `productId` restreint à un produit.
 */
async function getBoostCatalog(storeId: string, productId?: string | null) {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      image: products.image,
      createdAt: products.createdAt,
      isOnline: products.isOnline,
    })
    .from(products)
    .where(eq(products.storeId, storeId));
  // Un produit masqué du storefront ou gratuit ne peut pas apparaître dans une
  // commande ou un avis censés venir d'un client.
  const sellable = rows.filter((p) => Number(p.price) > 0 && p.isOnline !== false);
  if (productId) return sellable.filter((p) => p.id === productId);
  return sellable;
}

/** Crédite des vues à un ensemble de produits (2 UPDATE groupés max). */
async function addViewsToProducts(storeId: string, value: number, productIds?: string[] | null) {
  if (value <= 0) return 0;
  const ids = productIds && productIds.length
    ? productIds
    : (await db.select({ id: products.id }).from(products).where(eq(products.storeId, storeId))).map((r) => r.id);
  if (ids.length === 0) return 0;
  const base = Math.floor(value / ids.length);
  const rest = value - base * ids.length;
  if (base > 0) {
    await db
      .update(products)
      .set({ views: sql`${products.views} + ${base}`, boostedViews: sql`${products.boostedViews} + ${base}` })
      .where(inArray(products.id, ids));
  }
  if (rest > 0) {
    await db
      .update(products)
      .set({ views: sql`${products.views} + 1`, boostedViews: sql`${products.boostedViews} + 1` })
      .where(inArray(products.id, ids.slice(0, rest)));
  }
  return ids.length;
}

/**
 * Applique les échéanciers de vues arrivés à échéance (pas de cron : le
 * calcul est fait à l'ouverture du panneau, à chaque boost, et sur les pages
 * admin qui listent les boutiques / le tableau de bord).
 * Retourne le nombre de vues créditées.
 */
async function applyDueViewBoosts(storeId: string): Promise<number> {
  // Verrou identique à celui des actions de boost : deux passages simultanés
  // (panneau + tableau de bord) liraient le même `applied` et crediteraient
  // les mêmes vues deux fois. Si un boost tourne, on reprend au prochain appel.
  if (!acquireBoostLock(storeId)) return 0;
  try {
    const schedules = await db.select().from(boostSchedules).where(eq(boostSchedules.storeId, storeId));
    if (schedules.length === 0) return 0;
    const now = Date.now();
    let credited = 0;

    for (const s of schedules) {
      const start = new Date(s.startDate).getTime();
      const end = new Date(s.endDate).getTime();
      const finished = now >= end;
      if (end <= start) continue;

      const due = finished
        ? s.total
        : Math.floor(s.total * Math.min(1, Math.max(0, (now - start) / (end - start))));
      const delta = Math.max(0, due - s.applied);

      if (delta > 0) {
        if (s.scope === 'store') {
          await db
            .update(stores)
            .set({ views: sql`${stores.views} + ${delta}`, boostedViews: sql`${stores.boostedViews} + ${delta}` })
            .where(eq(stores.id, storeId));
        } else {
          await addViewsToProducts(storeId, delta, s.productId ? [s.productId] : null);
        }
        credited += delta;
        await db.update(boostSchedules).set({ applied: sql`${boostSchedules.applied} + ${delta}` }).where(eq(boostSchedules.id, s.id));
      }
      if (finished && s.applied + delta >= s.total) {
        await db.delete(boostSchedules).where(eq(boostSchedules.id, s.id));
      }
    }
    return credited;
  } finally {
    releaseBoostLock(storeId);
  }
}

/**
 * Applique les échéanciers de **toutes** les boutiques qui en ont (une seule
 * requête de détection, écritures uniquement si du crédit est dû). Utilisé par
 * le tableau de bord et la liste des boutiques pour que les vues étalées
 * progressent sans intervention.
 */
async function applyAllDueViewBoosts(): Promise<void> {
  try {
    const pending = await db
      .select({ storeId: boostSchedules.storeId })
      .from(boostSchedules)
      .groupBy(boostSchedules.storeId);
    for (const row of pending) {
      await applyDueViewBoosts(row.storeId);
    }
  } catch (error) {
    console.error('Error applying due view boosts:', error);
  }
}

/** État du panneau : journal, quotas restants, vues programmées. */
export async function getBoostStateAction(storeId: string): Promise<{
  success: boolean;
  error?: string;
  logs?: Array<{ id: string; action: string; amount: number; createdAt: string | Date; voided?: boolean }>;
  quota?: { views: number; orders: number; reviews: number };
  pendingViews?: number;
  schedules?: Array<{ id: string; scope: string; total: number; applied: number; startDate: string | Date; endDate: string | Date }>;
}> {
  const guard = await guardBoost(storeId, { action: 'state', limit: 60 });
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    const credited = await applyDueViewBoosts(storeId);
    if (credited > 0) revalidatePath('/pam/stores');

    const [logs, quotaRows, schedules] = await Promise.all([
      db
        .select({ id: boostLogs.id, action: boostLogs.action, amount: boostLogs.amount, createdAt: boostLogs.createdAt, voided: boostLogs.voided })
        .from(boostLogs)
        .where(eq(boostLogs.storeId, storeId))
        .orderBy(desc(boostLogs.createdAt))
        .limit(8),
      Promise.all(
        (Object.keys(BOOST_DAILY_QUOTA) as BoostQuotaAction[]).map(async (action) => ({
          action,
          left: await boostQuotaLeft(storeId, action),
        }))
      ),
      db.select().from(boostSchedules).where(eq(boostSchedules.storeId, storeId)).orderBy(boostSchedules.endDate),
    ]);

    const quota = { views: 0, orders: 0, reviews: 0 };
    for (const row of quotaRows) quota[row.action] = row.left;

    return {
      success: true,
      logs,
      quota,
      pendingViews: schedules.reduce((sum, s) => sum + Math.max(0, s.total - s.applied), 0),
      schedules: schedules.map((s) => ({
        id: s.id,
        scope: s.scope,
        total: s.total,
        applied: s.applied,
        startDate: s.startDate,
        endDate: s.endDate,
      })),
    };
  } catch (error: unknown) {
    return { success: false, error: boostFailure(error) };
  }
}

/**
 * Boost administrateur des vues : soit sur la boutique, soit réparti sur ses
 * produits (ou un seul produit ciblé). Aucune écriture sur le stock ni sur les
 * commandes. `spread` étale le créditation sur une période au lieu d'appliquer
 * tout immédiatement.
 */
export async function boostStoreViewsAction(
  storeId: string,
  amount: number,
  scope: 'store' | 'products',
  options?: { productId?: string | null; spread?: BoostRange }
): Promise<{
  success: boolean;
  error?: string;
  amount?: number;
  products?: number;
  scheduled?: boolean;
  from?: string;
  to?: string;
  quotaLeft?: number;
}> {
  const guard = await guardBoost(storeId, { action: 'views', limit: 20 });
  if (!guard.ok) return { success: false, error: guard.error };
  const { session, ip } = guard;
  if (scope !== 'store' && scope !== 'products') {
    return { success: false, error: 'Portée de boost invalide.' };
  }
  const requestedProductId = options?.productId || null;
  if (requestedProductId !== null && !isUuid(requestedProductId)) {
    return { success: false, error: 'Identifiant de produit invalide.' };
  }
  if (!acquireBoostLock(storeId)) {
    return { success: false, error: 'Un boost est déjà en cours pour cette boutique.' };
  }
  try {
    const value = Math.min(1_000_000, Math.max(1, Math.floor(Number(amount) || 0)));

    const [store] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);
    if (!store) return { success: false, error: 'Boutique introuvable.' };

    const quota = await boostQuotaLeft(storeId, 'views');
    if (value > quota) {
      return { success: false, error: `Quota de vues dépassé : ${quota} restante(s) sur 24 h.` };
    }

    const productId = requestedProductId;
    if (scope === 'products') {
      const catalog = await getBoostCatalog(storeId, productId);
      if (catalog.length === 0) {
        return { success: false, error: productId ? 'Ce produit n\'est pas vendable.' : 'Aucun produit vendable dans cette boutique.' };
      }
    }

    // Vues étalées : on programme un échéancier au lieu de tout créditer.
    if (options?.spread) {
      const from = options.spread.from ? Date.parse(options.spread.from) : NaN;
      const to = options.spread.to ? Date.parse(options.spread.to) : NaN;
      if (!Number.isFinite(from) || !Number.isFinite(to)) {
        return { success: false, error: 'Période de programme incomplète (début et fin requis).' };
      }
      const start = Math.max(from, Date.now());
      const end = to + 86_399_999;
      if (end <= start) {
        return { success: false, error: 'La fin de la période doit être postérieure au début.' };
      }
      await db.insert(boostSchedules).values({
        storeId,
        scope: scope === 'store' ? 'store' : productId ? 'product' : 'products',
        productId,
        total: value,
        applied: 0,
        startDate: new Date(start),
        endDate: new Date(end),
      });
      await logBoost(storeId, 'views', value, { scheduled: true, total: value, scope, productId, ip }, session.username);
      revalidatePath('/pam/stores');
      return {
        success: true,
        amount: value,
        scheduled: true,
        from: new Date(start).toISOString(),
        to: new Date(end).toISOString(),
        quotaLeft: quota - value,
      };
    }

    let productListCount: number | undefined;
    if (scope === 'products') {
      const catalog = await getBoostCatalog(storeId, productId);
      productListCount = await addViewsToProducts(storeId, value, catalog.map((p) => p.id));
    } else {
      await db
        .update(stores)
        .set({ views: sql`${stores.views} + ${value}`, boostedViews: sql`${stores.boostedViews} + ${value}` })
        .where(eq(stores.id, storeId));
    }

    await logBoost(storeId, 'views', value, { scope, productId, ip }, session.username);
    revalidatePath('/pam/stores');
    revalidatePath('/dashboard');
    updateTag('marketplace');
    return { success: true, amount: value, products: productListCount, quotaLeft: quota - value };
  } catch (error: unknown) {
    return { success: false, error: boostFailure(error) };
  } finally {
    releaseBoostLock(storeId);
  }
}

/**
 * Boost administrateur des ventes : génère de vraies commandes « Livrée »
 * étalées sur une période (`spreadDays` ou plage `from`/`to`), avec leurs
 * lignes, un client de passage et la mise à jour de
 * `product_stats.total_sales`. Le stock du vendeur n'est jamais décrémenté
 * (pas d'appel à `adjustProductStock`) : la commande porte `boosted = true`
 * pour que son annulation / suppression ne réintègre jamais de stock (voir
 * `updateOrderStatusAction`, `deleteOrderAction`).
 */
const BOOST_CUSTOMER_NAMES = [
  'Awa Ndiaye', 'Mamadou Ba', 'Fatou Sow', 'Ousmane Diop', 'Aïssatou Fall',
  'Ibrahima Sarr', 'Mbacké Camara', 'Ndèye Gueye', 'Cheikh Thiam', 'Mariama Diallo',
  'Pape Ndiaye', 'Khadidiatou Ba', 'Samba Baldé', 'Astou Sarr', 'Yaya Diouf',
  'Ndeye Mboup', 'Alioune Badara', 'Coumba Ndoye', 'Modou Kane', 'Sokhna Diagne',
];

/** Téléphone plausible pour un client de passage (jamais réellement joignable). */
function fakeCustomerPhone(): string {
  const n = () => Math.floor(Math.random() * 10);
  return `+221 7${n()} ${n()}${n()} ${n()}${n()} ${n()}${n()}`;
}

export async function boostStoreOrdersAction(
  storeId: string,
  count: number,
  spreadDays: number,
  options?: { productId?: string | null; range?: BoostRange }
): Promise<{ success: boolean; error?: string; created?: number; revenue?: number; quotaLeft?: number }> {
  const guard = await guardBoost(storeId, { action: 'orders', limit: 15 });
  if (!guard.ok) return { success: false, error: guard.error };
  const { session, ip } = guard;
  const requestedProductId = options?.productId || null;
  if (requestedProductId !== null && !isUuid(requestedProductId)) {
    return { success: false, error: 'Identifiant de produit invalide.' };
  }
  if (!acquireBoostLock(storeId)) {
    return { success: false, error: 'Un boost est déjà en cours pour cette boutique.' };
  }
  try {
    const nb = Math.min(500, Math.max(1, Math.floor(Number(count) || 0)));

    const quota = await boostQuotaLeft(storeId, 'orders');
    if (nb > quota) {
      return { success: false, error: `Quota de commandes dépassé : ${quota} restante(s) sur 24 h.` };
    }

    const [store] = await db
      .select({ id: stores.id, createdAt: stores.createdAt })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);
    if (!store) return { success: false, error: 'Boutique introuvable.' };

    const storeCreatedAt = store.createdAt ? new Date(store.createdAt).getTime() : 0;

    const catalog = await getBoostCatalog(storeId, requestedProductId);
    if (catalog.length === 0) {
      return { success: false, error: requestedProductId ? 'Ce produit n\'est pas vendable.' : 'Aucun produit vendable dans cette boutique.' };
    }

    const { start, end } = resolveBoostRange(options?.range, spreadDays);
    const orderValues: Array<Omit<typeof orders.$inferInsert, 'id'>> = [];
    const itemsByOrder: Array<Array<{ productId: string; name: string; image: string | null; quantity: number; unit: number; lineTotal: number; createdAt: number }>> = [];
    const sales = new Map<string, number>();
    let revenue = 0;

    for (let i = 0; i < nb; i += 1) {
      const lineCount = 1 + Math.floor(Math.random() * Math.min(3, catalog.length));
      const picked = [...catalog];
      for (let j = picked.length - 1; j > 0; j -= 1) {
        const k = Math.floor(Math.random() * (j + 1));
        [picked[j], picked[k]] = [picked[k], picked[j]];
      }

      const lines = picked.slice(0, lineCount).map((p) => {
        const quantity = 1 + Math.floor(Math.random() * 3);
        const unit = Math.round(Number(p.price) * 100) / 100;
        return {
          productId: p.id,
          name: p.name,
          image: p.image,
          quantity,
          unit,
          lineTotal: Math.round(unit * quantity * 100) / 100,
          createdAt: p.createdAt ? new Date(p.createdAt).getTime() : 0,
        };
      });

      const subtotal = Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100;
      // Bornes : jamais avant la création de la boutique, ni avant la création
      // du produit le plus récent de la ligne — une vente antérieure au produit
      // se verrait immédiatement dans les rapports du vendeur.
      const earliest = lines.reduce((acc, line) => Math.max(acc, line.createdAt), storeCreatedAt);
      const when = new Date(randomDateBetween(start, end, earliest));

      orderValues.push({
        storeId,
        status: 'COMPLETED',
        type: 'IN_STORE',
        paymentMethod: 'ESPECES',
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2),
        discountAmount: '0',
        date: when,
        createdAt: when,
        boosted: true,
      });
      itemsByOrder.push(lines);
      revenue += subtotal;
    }

    // Un « client de passage » par tranche de 20 commandes : les commandes
    // boostées doivent ressembler à de vraies transactions (champ client
    // renseigné) sans inonder la fiche clients du vendeur, et sans qu'un seul
    // faux client cumule des centaines d'achats.
    const CHUNK_SIZE = 20;
    const customerRows = await db
      .insert(customers)
      .values(
        Array.from({ length: Math.max(1, Math.ceil(orderValues.length / CHUNK_SIZE)) }, () => ({
          storeId,
          name: BOOST_CUSTOMER_NAMES[Math.floor(Math.random() * BOOST_CUSTOMER_NAMES.length)],
          phone: fakeCustomerPhone(),
          totalSpent: '0',
          ordersCount: 0,
        }))
      )
      .returning();

    const customerIds = orderValues.map(
      (_, i) => customerRows[Math.min(customerRows.length - 1, Math.floor(i / CHUNK_SIZE))].id
    );

    const inserted = await db
      .insert(orders)
      .values(orderValues.map((o, i) => ({ ...o, customerId: customerIds[i] })))
      .returning();

    const itemValues: Array<typeof orderItems.$inferInsert> = [];
    for (let i = 0; i < inserted.length; i += 1) {
      const orderId = inserted[i].id;
      for (const line of itemsByOrder[i]) {
        itemValues.push({
          orderId,
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unit.toFixed(2),
          total: line.lineTotal.toFixed(2),
          productName: line.name,
          productImage: line.image,
        });
        sales.set(line.productId, (sales.get(line.productId) || 0) + line.quantity);
      }
    }
    if (itemValues.length > 0) await db.insert(orderItems).values(itemValues);

    await incrementProductSales(
      storeId,
      [...sales].map(([productId, quantity]) => ({ productId, quantity }))
    );

    // Fiches client agrégés (cohérent avec `createOrderAction`) : un total par
    // client de passage plutôt que pour l'ensemble du lot.
    const totalsByCustomer = new Map<string, { count: number; spent: number }>();
    customerIds.forEach((customerId, i) => {
      const current = totalsByCustomer.get(customerId) || { count: 0, spent: 0 };
      current.count += 1;
      current.spent += Number(orderValues[i].total) || 0;
      totalsByCustomer.set(customerId, current);
    });
    for (const [customerId, totals] of totalsByCustomer) {
      await db
        .update(customers)
        .set({ totalSpent: totals.spent.toFixed(2), ordersCount: totals.count })
        .where(eq(customers.id, customerId));
    }

    // Une seule notification récapitulative plutôt qu'une par commande.
    // Jamais d'email : un boost fabrique des données, il ne doit pas déclencher
    // d'envoi de mail au vendeur (WhatsApp uniquement, s'il est configuré).
    const itemQty = itemValues.reduce((sum, item) => sum + (item.quantity || 0), 0);
    try {
      const storeInfo = await getStorePhone(storeId);
      if (storeInfo?.ownerId) {
        const totalStr = new Intl.NumberFormat('fr-FR').format(Math.round(revenue));
        await notify({
          userId: storeInfo.ownerId,
          phone: storeInfo.phone,
          eventType: 'VENTE_POS',
          title: 'Ventes enregistrées',
          body: `${inserted.length} vente(s) pour ${totalStr} FCFA.`,
          templateParams: [String(inserted.length), totalStr],
          emailData: { total: totalStr, items: itemQty, store: storeInfo.name || '', storeSlug: storeInfo.slug || '' },
        });
      }
    } catch {}

    await logBoost(
      storeId,
      'orders',
      inserted.length,
      { revenue: Math.round(revenue * 100) / 100, days: spreadDays, productId: requestedProductId, range: options?.range ?? null, ip },
      session.username
    );

    invalidateOrdersCache(storeId);
    revalidateTag(`orders:${storeId}`, 'max');
    revalidatePath('/orders');
    revalidatePath('/pos');
    revalidatePath('/inventory');
    revalidatePath('/dashboard');
    revalidatePath('/pam/stores');
    updateTag('marketplace');

    return { success: true, created: inserted.length, revenue: Math.round(revenue * 100) / 100, quotaLeft: quota - inserted.length };
  } catch (error: unknown) {
    return { success: false, error: boostFailure(error) };
  } finally {
    releaseBoostLock(storeId);
  }
}

/** Commentaires courts et variés, adaptés aux boutiques sénégalaises. */
const BOOST_REVIEW_COMMENTS = [
  'Produit conforme, très satisfait de ma commande.',
  'Livraison rapide et service au rendez-vous. Je recommande.',
  'Bonne qualité pour le prix, rien à redire.',
  'Tout s\'est bien passé, sans accroche.',
  'Très bon rapport qualité/prix, je repasserai commande.',
  'Le produit correspond à la description, merci.',
  'Accueil sympathique et commande rapide.',
  'Rien à dire, c\'est parfait.',
  'Bon produit, petit bémol sur l\'emballage.',
  'Satisfait de mon achat, délai respecté.',
  'Facile à commander, produit en règle.',
  'Bonne expérience, je reviendrai.',
  'Super qualité, dépasse mes attentes !',
  'Transaction fluide et vendeur très réactif.',
  'Colis reçu en parfait état, très bien emballé.',
  'Produit au top, conforme en tout point.',
  'Rien à signaler, service irréprochable.',
  'Très content de cet achat, je recommande les yeux fermés.',
  'Livré plus vite que prévu, merci beaucoup !',
  'Excellent produit, fonctionne à merveille.',
  'Prix très correct pour une telle qualité.',
  'Vendeur sérieux et professionnel, 5 étoiles.',
  'Tout est conforme, merci pour la réactivité.',
  'Article de très bonne facture, ravi de ma commande.',
  'Service client au top et produit parfait.',
  'Jamais déçu par cette boutique, toujours au niveau.',
  'Envoi soigné et produit 100% conforme.',
  'Excellente qualité, exactement ce qu\'il me fallait.',
  'Très satisfait, commande arrivée rapidement.',
  'Achat validé, produit de qualité supérieure.',
  'Parfait du début à la fin, merci !',
  'Super rapport qualité prix, rien à ajouter.',
  'Service rapide, efficace et courtois.',
  'Au top ! Je repasserai commande sans hésiter.',
  'Produit reçu très rapidement, conforme aux photos.',
  'Très bonne finition, matière de qualité.',
  'Boutique sérieuse, emballage très soigné.',
  'Fonctionne parfaitement, très satisfait.',
  'Expérience d\'achat parfaite, je recommande vivement.',
  'Commande traitée très vite, merci pour le professionnalisme.',
  'Très bonne surprise, la qualité est bien là.',
  'Article impeccable, livré rapidement.',
  'Conforme à 100%, je recommande sans réserves.',
  'Excellente communication et envoi rapide.',
  'Produit impeccable et bien emballé.',
  'Super achat, je suis très content du résultat.',
  'Délais respectés et produit en parfait état.',
  'Très bon article, rapport qualité prix imbattable.',
  'Achat au top, vendeur très recommandable.',
  'Livraison nickel, produit super bien protégé.',
  'Rien à redire, qualité au rendez-vous.',
  'Tout est parfait, merci au vendeur !',
  'Produit d\'excellente qualité, je repasserai par vous.',
  'Très satisfait du produit et du délai de livraison.',
  'Envoi hyper rapide, produit parfaitement conforme.',
  'Super expérience, je recommande à 100%.',
  'Colis bien reçu, article conforme et fonctionnel.',
  'Service impeccable, marchandise de première qualité.',
  'Vraiment très satisfait de cette commande !',
  'Super rapide et produit conforme à mes attentes.',
];

/** Commentaires plus longs, pour varier les longueurs d'avis générés. */
const BOOST_REVIEW_COMMENTS_EXTRA = [
  'J\'ai commandé pour toute la famille et tout le monde est content, la livraison a été faite dans les délais annoncés.',
  'Franchement je ne m\'attendais pas à une telle qualité à ce prix-là, le produit est à la hauteur de la description.',
  'Le vendeur a répondu à toutes mes questions avant l\'achat, puis le colis est arrivé bien emballé. Rien à redire.',
  'Utilise le produit depuis plusieurs jours maintenant, aucune mauvaise surprise, je recommande sans hésiter.',
  'Un petit souci d\'emballage à la réception mais le vendeur a tout de suite proposé un échange. Service au top.',
  'Commande passée le matin, reçue le lendemain. C\'est ce qu\'on appelle une bonne organisation.',
  'Le rapport qualité/prix est imbattable sur ce produit, j\'ai comparé ailleurs avant d\'acheter.',
  'Troisième achat dans cette boutique et toujours la même satisfaction, je reste fidèle.',
  'Produit conforme aux photos, taille et couleur identiques, ça fait plaisir.',
  'Rien à dire sur la transaction, paiement simple et retrait sans attente.',
  'Je recommande cette boutique à mes collègues, ils ont été tout aussi satisfaits que moi.',
  'Le produit fait exactement ce qu\'il promet, ce qui est rare de nos jours.',
  'Emballage soigné, notice en français, tout est clair. Bon travail.',
  'Livraison effectuée par le vendeur lui-même, accueil très courtois.',
  'Acheté en promotion, encore mieux que prévu. Merci pour la bonne affaire.',
];

/** Réponses du vendeur, attachées à une partie des avis générés. */
const BOOST_SELLER_REPLIES = [
  'Merci pour votre retour, ravi que le produit vous plaise !',
  'Merci beaucoup pour votre confiance, à bientôt chez nous.',
  'Votre satisfaction est notre priorité, merci d\'avoir pris le temps d\'écrire.',
  'Merci pour cette note ! N\'hésitez pas à revenir si vous avez la moindre question.',
  'C\'est avec plaisir, toute l\'équipe vous remercie.',
  'Merci ! On note votre retour pour améliorer nos prochaines livraisons.',
  'Vos encouragements nous motivent, à très vite.',
  'Merci d\'avoir choisi notre boutique, on vous remercie chaleureusement.',
  'Super retour, merci ! On reste à votre disposition.',
  'Merci pour votre fidélité, c\'est très apprécié.',
];

/**
 * Pools combinatoires : les listes manuelles ci-dessus ne couvrent qu'une
 * centaine de textes, alors que le panneau autorise désormais des centaines
 * d'avis et de réponses d'un coup (jusqu'à 500). On compose des phrases à
 * partir de trois morceaux pour rester crédible au-delà de cette centaine.
 */
const COMMENT_OPENERS = [
  'Très satisfait de cet achat.',
  'Excellent rapport qualité/prix.',
  'Le produit est conforme à la description.',
  'Rien à signaler sur cette commande.',
  'Bonne surprise au déballage.',
  'Je suis pleinement satisfait.',
  'Achat réussi, je n\'hésiterai pas à revenir.',
  'La qualité est au rendez-vous.',
  'Commande passée sans accroc.',
  'Rien à redire de cette expérience.',
  'Le produit tient toutes ses promesses.',
  'Boutique que je recommande.',
];

const COMMENT_MIDDLES = [
  'Ma commande est arrivée dans les délais',
  'L\'emballage était impeccable',
  'Le vendeur a été très réactif',
  'Le colis est arrivé en parfait état',
  'La finition est soignée et le matériau de qualité',
  'Le rapport qualité/prix est vraiment imbattable',
  'Le suivi de commande était clair du début à la fin',
  'Conforme aux photos affichées sur la fiche',
  'La livraison a été plus rapide que prévu',
  'Le service client a répondu en quelques minutes',
  'L\'usage quotidien ne révèle aucun défaut',
  'La taille et la couleur correspondent exactement à la commande',
  'Le prix est très juste pour ce niveau de qualité',
  'Aucun souci de montage ni d\'installation',
];

const COMMENT_ENDINGS = [
  ', je recommande sans réserve.',
  ', je reviendrai commander.',
  ', ça fait plaisir d\'acheter ici.',
  ', merci au vendeur.',
  ', à refaire les yeux fermés.',
  ', je suis ravi de mon achat.',
  ', parfait du début à la fin.',
  ', rien à ajouter.',
  ', je partage mon expérience autour de moi.',
  ', sans aucun regret.',
];

/** 12 × 14 × 10 = 1 680 variantes de commentaires uniques. */
const BOOST_REVIEW_COMMENTS_COMPOSED: string[] = COMMENT_OPENERS.flatMap((a) =>
  COMMENT_MIDDLES.flatMap((b) => COMMENT_ENDINGS.map((c) => `${a} ${b}${c}`))
);

const REPLY_OPENERS = [
  'Merci pour votre retour.',
  'Merci beaucoup pour votre confiance.',
  'Merci d\'avoir pris le temps d\'écrire.',
  'Merci pour cette note.',
  'Merci de nous avoir choisis.',
  'Merci pour votre fidélité.',
  'Un grand merci à vous.',
  'Merci pour votre encouragement.',
];

const REPLY_CLOSERS = [
  ' Ravi que le produit vous plaise !',
  ' À bientôt chez nous.',
  ' Toute l\'équipe vous remercie.',
  ' N\'hésitez pas à revenir si vous avez une question.',
  ' On reste à votre disposition.',
  ' Votre satisfaction est notre priorité.',
  ' On note votre retour pour nous améliorer.',
  ' À très vite pour la prochaine commande.',
];

/** 8 × 8 = 64 variantes de réponses du vendeur. */
const BOOST_SELLER_REPLIES_COMPOSED: string[] = REPLY_OPENERS.flatMap((a) =>
  REPLY_CLOSERS.map((b) => `${a}${b}`)
);

/** Profils de notes proposés dans le panneau v2. */
export type BoostRatingProfile = 'top' | 'mixed' | 'realistic';

/**
 * Note d'un avis généré selon le profil choisi :
 * - `top`      : 5★ à 70% (lancement d'un produit / rattrapage de moyenne),
 * - `mixed`    : distribution historique 45/35/15/5/5,
 * - `realistic`: mélange crédible avec quelques notes faibles.
 */
function pickBoostedRating(profile: BoostRatingProfile = 'mixed'): number {
  const roll = Math.random();
  if (profile === 'top') {
    if (roll < 0.7) return 5;
    if (roll < 0.92) return 4;
    if (roll < 0.98) return 3;
    if (roll < 0.995) return 2;
    return 1;
  }
  if (profile === 'realistic') {
    if (roll < 0.3) return 5;
    if (roll < 0.55) return 4;
    if (roll < 0.75) return 3;
    if (roll < 0.9) return 2;
    return 1;
  }
  if (roll < 0.45) return 5;
  if (roll < 0.8) return 4;
  if (roll < 0.95) return 3;
  if (roll < 0.98) return 2;
  return 1;
}

/** Un avis fourni par l'admin en JSON personnalisé, déjà validé et nettoyé. */
type CustomBoostReview = {
  rating: number;
  comment: string;
  author: string | null;
  avatar: string | null;
  reply: string | null;
  date: Date | null;
};

/**
 * Valide le JSON d'avis personnalisés saisi dans le panneau.
 *
 * Format attendu : un tableau d'objets —
 * `[{ "rating": 5, "comment": "…", "author": "…", "avatar": "https://…",
 *     "reply": "…", "date": "2025-08-12" }, …]`
 * Seul `comment` est obligatoire ; `rating` vaut 5 s'il est omis. Les alias
 * `authorName` / `authorAvatar` / `sellerReply` / `createdAt` sont acceptés.
 */
function parseCustomReviews(
  raw: string
): { ok: true; reviews: CustomBoostReview[] } | { ok: false; error: string } {
  // Garde-fou : au-delà, le parseur + la boucle de validation servent à rien
  // (500 avis × 2000 caractères = 1 Mo utile, on tolère 4× la taille réelle).
  if (raw.length > 400_000) {
    return { ok: false, error: 'JSON trop volumineux (400 000 caractères maximum).' };
  }
  let data: unknown;
  try {
    // Tolère le décor Markdown des IA (```json … ```).
    data = JSON.parse(stripJsonFences(raw));
  } catch {
    return { ok: false, error: 'JSON invalide : vérifiez la syntaxe (guillemets, virgules).' };
  }
  if (!Array.isArray(data)) {
    return { ok: false, error: 'Le JSON doit être un tableau d\'avis : [{ … }, { … }].' };
  }
  if (data.length === 0) return { ok: false, error: 'Le tableau d\'avis est vide.' };
  if (data.length > 500) return { ok: false, error: `${data.length} avis fournis : 500 maximum par envoi.` };

  /** Nettoie les caractères de contrôle invisibles (jamais affichables). */
  const clean = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  const str = (value: unknown) => {
    if (typeof value !== 'string') return null;
    const cleaned = clean(value).trim();
    return cleaned ? cleaned : null;
  };
  const reviews: CustomBoostReview[] = [];

  for (let i = 0; i < data.length; i += 1) {
    const n = i + 1;
    const item = data[i] as Record<string, unknown> | null;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: `Avis n°${n} : ce doit être un objet { … }.` };
    }

    const comment = str(item.comment);
    if (!comment) return { ok: false, error: `Avis n°${n} : le champ "comment" est obligatoire.` };
    if (comment.length > 2000) {
      return { ok: false, error: `Avis n°${n} : commentaire trop long (2000 caractères max).` };
    }

    let rating = 5;
    if (item.rating !== undefined && item.rating !== null) {
      const parsed = Number(item.rating);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
        return { ok: false, error: `Avis n°${n} : "rating" doit être un nombre entre 1 et 5.` };
      }
      rating = Math.round(parsed);
    }

    const author = str(item.author) ?? str(item.authorName);
    if (author && author.length > 80) {
      return { ok: false, error: `Avis n°${n} : nom d'auteur trop long (80 caractères max).` };
    }

    const avatar = str(item.avatar) ?? str(item.authorAvatar);
    if (avatar && avatar.length > 500) {
      return { ok: false, error: `Avis n°${n} : "avatar" trop long (500 caractères max).` };
    }
    if (avatar && !/^https?:\/\//i.test(avatar)) {
      return { ok: false, error: `Avis n°${n} : "avatar" doit être une URL http(s).` };
    }

    const reply = str(item.reply) ?? str(item.sellerReply);
    if (reply && reply.length > 500) {
      return { ok: false, error: `Avis n°${n} : réponse du vendeur trop longue (500 caractères max).` };
    }

    let date: Date | null = null;
    const rawDate = str(item.date) ?? str(item.createdAt);
    if (rawDate) {
      const parsedDate = new Date(rawDate);
      if (Number.isNaN(parsedDate.getTime())) {
        return { ok: false, error: `Avis n°${n} : "date" invalide (ISO attendu, ex. 2025-08-12).` };
      }
      date = parsedDate;
    }

    reviews.push({ rating, comment, author, avatar, reply, date });
  }

  return { ok: true, reviews };
}

/**
 * Boost administrateur des avis : fabrique de vrais avis (`product_reviews`)
 * attribués à des produits de la boutique, notés majoritairement 4-5, étalés
 * sur `spreadDays` jours et marqués `boosted = true`. Recalcule ensuite
 * `product_stats.review_count` / `average_rating` des produits touchés.
 * Les auteurs (nom + photo) sont tirés du pool `review_authors` peuplé par
 * `scripts/seed-review-authors.mjs`.
 *
 * Variante `options.customJson` : avis fournis par l'admin (tableau JSON),
 * réservés à un produit ciblé, avec notes / auteur / réponse / date propres.
 */
export async function boostStoreReviewsAction(
  storeId: string,
  count: number,
  spreadDays: number,
  options?: {
    productId?: string | null;
    range?: BoostRange;
    ratingProfile?: BoostRatingProfile;
    /** Avis JSON fournis par l'admin : remplace la génération automatique. */
    customJson?: string;
  }
): Promise<{ success: boolean; error?: string; created?: number; average?: number; quotaLeft?: number }> {
  const guard = await guardBoost(storeId, { action: 'reviews', limit: 15 });
  if (!guard.ok) return { success: false, error: guard.error };
  const { session, ip } = guard;
  const requestedProductId = options?.productId || null;
  if (requestedProductId !== null && !isUuid(requestedProductId)) {
    return { success: false, error: 'Identifiant de produit invalide.' };
  }
  if (!acquireBoostLock(storeId)) {
    return { success: false, error: 'Un boost est déjà en cours pour cette boutique.' };
  }
  try {
    const profile: BoostRatingProfile =
      options?.ratingProfile && ['top', 'mixed', 'realistic'].includes(options.ratingProfile)
        ? options.ratingProfile
        : 'mixed';

    // ── Mode personnalisé : tableau d'avis saisi par l'admin ─────────────
    let custom: CustomBoostReview[] | null = null;
    const customJson = typeof options?.customJson === 'string' ? options.customJson : '';
    if (customJson.trim()) {
      const parsed = parseCustomReviews(customJson);
      if (!parsed.ok) return { success: false, error: parsed.error };
      if (!requestedProductId) {
        return { success: false, error: 'Les avis personnalisés doivent cibler un produit précis.' };
      }
      custom = parsed.reviews;
    }

    const nb = custom
      ? custom.length
      : Math.min(500, Math.max(1, Math.floor(Number(count) || 0)));

    const quota = await boostQuotaLeft(storeId, 'reviews');
    if (nb > quota) {
      return { success: false, error: `Quota d'avis dépassé : ${quota} restant(s) sur 24 h.` };
    }

    const [store] = await db
      .select({ id: stores.id, createdAt: stores.createdAt })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);
    if (!store) return { success: false, error: 'Boutique introuvable.' };

    const storeCreatedAt = store.createdAt ? new Date(store.createdAt).getTime() : 0;

    // Même filtre que la génération de commandes : un produit hors ligne ou
    // gratuit ne peut pas recevoir d'avis censé venir d'un client.
    const catalog = await getBoostCatalog(storeId, requestedProductId);
    if (catalog.length === 0) {
      return { success: false, error: requestedProductId ? 'Ce produit n\'est pas vendable.' : 'Aucun produit vendable dans cette boutique.' };
    }

    // Le pool d'auteurs n'est nécessaire que pour les avis sans nom fourni.
    const needsAuthors = !custom || custom.some((r) => !r.author);
    const authors = needsAuthors ? await db.select().from(reviewAuthors) : [];
    if (needsAuthors && authors.length === 0) return { success: false, error: 'Pool d\'auteurs vide : lancez scripts/seed-review-authors.mjs.' };

    // Anti-doublons : lire les avis existants de la boutique pour ne JAMAIS
    // réutiliser un nom d'auteur ni un texte de commentaire déjà présent.
    // En mode personnalisé, l'admin choisit lui-même les textes : pas de filtre.
    const existingReviews = custom
      ? []
      : await db
          .select({ authorName: productReviews.authorName, comment: productReviews.comment })
          .from(productReviews)
          .where(eq(productReviews.storeId, storeId));

    const usedAuthorNames = new Set(existingReviews.map((r) => r.authorName?.trim().toLowerCase()).filter(Boolean) as string[]);
    const usedComments = new Set(existingReviews.map((r) => r.comment?.trim().toLowerCase()).filter(Boolean) as string[]);

    const allComments = [
      ...BOOST_REVIEW_COMMENTS,
      ...BOOST_REVIEW_COMMENTS_EXTRA,
      ...BOOST_REVIEW_COMMENTS_COMPOSED,
    ];
    const allReplies = [...BOOST_SELLER_REPLIES, ...BOOST_SELLER_REPLIES_COMPOSED].sort(
      () => Math.random() - 0.5
    );

    let availableAuthors = authors.filter((a) => !usedAuthorNames.has(a.fullName.trim().toLowerCase()));
    if (availableAuthors.length === 0) availableAuthors = authors; // Fallback si le pool était épuisé

    let availableComments = allComments.filter((c) => !usedComments.has(c.trim().toLowerCase()));
    if (availableComments.length === 0) availableComments = allComments;

    // Mélanger sans remise pour cette session
    availableAuthors = [...availableAuthors].sort(() => Math.random() - 0.5);
    availableComments = [...availableComments].sort(() => Math.random() - 0.5);

    const { start, end } = resolveBoostRange(options?.range, spreadDays);
    const values: Array<typeof productReviews.$inferInsert> = [];

    for (let i = 0; i < nb; i += 1) {
      const item = custom ? custom[i] : null;
      const product = catalog[Math.floor(Math.random() * catalog.length)];

      let authorName: string;
      let authorAvatar: string | null;
      if (item?.author) {
        authorName = item.author;
        authorAvatar = item.avatar;
      } else {
        const author = availableAuthors[i % availableAuthors.length];
        authorName = author.fullName;
        authorAvatar = author.avatarUrl;
        usedAuthorNames.add(author.fullName.trim().toLowerCase());
      }

      let comment: string;
      if (item) {
        comment = item.comment;
      } else {
        const generated = availableComments[i % availableComments.length];
        comment = generated;
        usedComments.add(generated.trim().toLowerCase());
      }

      const productCreatedAt = product.createdAt ? new Date(product.createdAt).getTime() : 0;
      const earliest = Math.max(storeCreatedAt, productCreatedAt);
      const when = new Date(
        item?.date
          ? Math.min(Date.now(), Math.max(earliest, item.date.getTime()))
          : randomDateBetween(start, end, earliest)
      );

      values.push({
        storeId,
        productId: product.id,
        userId: null,
        authorName,
        authorAvatar,
        rating: item ? item.rating : pickBoostedRating(profile),
        comment,
        // Mode auto : ~40 % des avis reçoivent une réponse du vendeur.
        // Mode perso : seule la réponse fournie dans le JSON est retenue.
        sellerReply: item
          ? item.reply
          : Math.random() < 0.4
            ? allReplies[i % allReplies.length]
            : null,
        createdAt: when,
        boosted: true,
      });
    }

    await db.insert(productReviews).values(values);

    // Recalcul des agrégats produits (nombre d'avis + moyenne) : mêmes
    // écritures que `submitProductReviewAction` côté marketplace.
    const affectedIds = [...new Set(values.map((v) => v.productId))];
    await recomputeReviewAggregates(storeId, affectedIds);

    await logBoost(
      storeId,
      'reviews',
      values.length,
      {
        profile,
        days: spreadDays,
        productId: requestedProductId,
        range: options?.range ?? null,
        mode: custom ? 'custom' : 'auto',
        ip,
      },
      session.username
    );

    revalidatePath('/pam/reviews');
    revalidatePath('/pam/stores');
    revalidatePath('/dashboard');
    updateTag('marketplace');

    const average = Number(
      (values.reduce((sum, v) => sum + (v.rating || 0), 0) / Math.max(1, values.length)).toFixed(1)
    );
    return { success: true, created: values.length, average, quotaLeft: quota - values.length };
  } catch (error: unknown) {
    return { success: false, error: boostFailure(error) };
  } finally {
    releaseBoostLock(storeId);
  }
}

/**
 * Recalcule `product_stats.review_count` / `average_rating` pour une liste de
 * produits. Utilisé par le boost, par la soumission d'avis et — depuis la v2 —
 * par la modération (`deleteReview`), qui laissait des moyennes périmées.
 */
async function recomputeReviewAggregates(storeId: string, productIds: string[]) {
  if (productIds.length === 0) return;
  const aggregates = await db
    .select({
      productId: productReviews.productId,
      count: sql<number>`count(*)::int`,
      avg: sql<string>`coalesce(avg(${productReviews.rating}), 0)`,
    })
    .from(productReviews)
    .where(inArray(productReviews.productId, productIds))
    .groupBy(productReviews.productId);

  const found = new Set(aggregates.map((row) => row.productId));
  for (const row of aggregates) {
    const averageRating = Number(row.avg || 0).toFixed(2);
    await db
      .insert(productStats)
      .values({ storeId, productId: row.productId, totalSales: 0, reviewCount: row.count, averageRating })
      .onConflictDoUpdate({
        target: productStats.productId,
        set: { reviewCount: row.count, averageRating },
      });
  }
  // Un produit sans plus aucun avis : on repasse la ligne à zéro plutôt que de
  // laisser une moyenne fantôme.
  const emptied = productIds.filter((id) => !found.has(id));
  if (emptied.length > 0) {
    await db
      .update(productStats)
      .set({ reviewCount: 0, averageRating: '0' })
      .where(inArray(productStats.productId, emptied));
  }
}

/**
 * Déboost : retire TOUT ce que le panneau a fabriqué pour cette boutique —
 * commandes, avis, vues, échéanciers — puis recalcule les agrégats.
 * Le stock n'est jamais touché (les commandes boostées n'en ont jamais retiré).
 */
export async function unboostStoreAction(
  storeId: string
): Promise<{ success: boolean; error?: string; removed?: { orders: number; reviews: number; views: number } }> {
  const guard = await guardBoost(storeId, { action: 'unboost', limit: 5 });
  if (!guard.ok) return { success: false, error: guard.error };
  const { session, ip } = guard;
  if (!acquireBoostLock(storeId)) {
    return { success: false, error: 'Un boost est déjà en cours pour cette boutique.' };
  }
  try {
    const [store] = await db.select({ id: stores.id }).from(stores).where(eq(stores.id, storeId)).limit(1);
    if (!store) return { success: false, error: 'Boutique introuvable.' };

    // --- Avis : suppression + recalcul des moyennes des produits touchés.
    const boostedReviews = await db
      .select({ productId: productReviews.productId })
      .from(productReviews)
      .where(and(eq(productReviews.storeId, storeId), eq(productReviews.boosted, true)));
    await db
      .delete(productReviews)
      .where(and(eq(productReviews.storeId, storeId), eq(productReviews.boosted, true)));
    const reviewProductIds = [...new Set(boostedReviews.map((r) => r.productId))];
    await recomputeReviewAggregates(storeId, reviewProductIds);

    // --- Commandes : suppression des lignes (cascade) puis décrément de
    // `total_sales` — la vente avait bien été comptée au moment du boost.
    const boostedOrders = await db
      .select({ id: orders.id, customerId: orders.customerId })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), eq(orders.boosted, true)));
    const orderIds = boostedOrders.map((o) => o.id);
    // Les commandes boostées pointent vers le « client de passage » créé par le
    // panneau : sans ce nettoyage, sa fiche resterait avec un CA fantôme.
    const boostCustomerIds = [...new Set(boostedOrders.map((o) => o.customerId).filter((id): id is string => Boolean(id)))];

    if (orderIds.length > 0) {
      const lines = await db
        .select({ productId: orderItems.productId, quantity: orderItems.quantity })
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds));
      const totals = new Map<string, number>();
      for (const line of lines) {
        if (!line.productId) continue;
        totals.set(line.productId, (totals.get(line.productId) || 0) + (line.quantity || 0));
      }
      await db.delete(orders).where(inArray(orders.id, orderIds));
      for (const [productId, qty] of totals) {
        await db
          .update(productStats)
          .set({ totalSales: sql`greatest(0, ${productStats.totalSales} - ${qty})` })
          .where(eq(productStats.productId, productId));
      }
      invalidateOrdersCache(storeId);
      revalidateTag(`orders:${storeId}`, 'max');
    }

    for (const customerId of boostCustomerIds) {
      const [agg] = await db
        .select({
          count: sql<number>`count(*)::int`,
          total: sql<string>`coalesce(sum(${orders.total}), 0)`,
        })
        .from(orders)
        .where(eq(orders.customerId, customerId));
      if (!agg || Number(agg.count) === 0) {
        await db.delete(customers).where(eq(customers.id, customerId));
      } else {
        await db
          .update(customers)
          .set({ ordersCount: Number(agg.count), totalSpent: Number(agg.total || 0).toFixed(2) })
          .where(eq(customers.id, customerId));
      }
    }

    // --- Vues : retrait de la part boostée, jamais sous la valeur réelle.
    const [storeRow] = await db
      .select({ views: stores.views, boostedViews: stores.boostedViews })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);
    const storeViewsRemoved = Math.min(storeRow?.boostedViews || 0, storeRow?.views || 0);
    if (storeViewsRemoved > 0) {
      await db
        .update(stores)
        .set({
          views: sql`greatest(0, ${stores.views} - ${storeRow!.boostedViews})`,
          boostedViews: 0,
        })
        .where(eq(stores.id, storeId));
    }

    const boostedProducts = await db
      .select({ id: products.id, views: products.views, boostedViews: products.boostedViews })
      .from(products)
      .where(eq(products.storeId, storeId));
    let productViewsRemoved = 0;
    for (const p of boostedProducts) {
      const remove = Math.min(p.boostedViews || 0, p.views || 0);
      if (remove <= 0) continue;
      productViewsRemoved += remove;
      await db
        .update(products)
        .set({ views: sql`greatest(0, ${products.views} - ${p.boostedViews})`, boostedViews: 0 })
        .where(eq(products.id, p.id));
    }

    // --- Échéanciers de vues en attente.
    await db.delete(boostSchedules).where(eq(boostSchedules.storeId, storeId));

    // --- Rendre le quota 24 h : tout ce qui vient d'être retiré est annulé.
    // Les lignes restent dans le journal (marquées « annulé ») pour l'audit,
    // mais elles ne consomment plus le quota.
    await db.update(boostLogs).set({ voided: true }).where(eq(boostLogs.storeId, storeId));

    await logBoost(storeId, 'unboost', 0, {
      orders: orderIds.length,
      reviews: reviewProductIds.length,
      views: storeViewsRemoved + productViewsRemoved,
      ip,
    }, session.username);

    revalidatePath('/pam/stores');
    revalidatePath('/pam/reviews');
    revalidatePath('/pam/orders');
    revalidatePath('/dashboard');
    updateTag('marketplace');

    return {
      success: true,
      removed: {
        orders: orderIds.length,
        reviews: boostedReviews.length,
        views: storeViewsRemoved + productViewsRemoved,
      },
    };
  } catch (error: unknown) {
    return { success: false, error: boostFailure(error) };
  } finally {
    releaseBoostLock(storeId);
  }
}
