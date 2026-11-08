'use server'

import { createClient } from '@/utils/supabase/server'
import { db } from '@/db'
import {
  stores,
  profiles,
  storeStaff,
  orders,
  orderItems,
  products,
  customers,
} from '@/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { toCsv } from '@/lib/csv'

type Guard =
  | { ok: true; userId: string; isSuperAdmin?: boolean }
  | { ok: false; error: string }

/** Même garde que les autres actions vendeur : propriétaire, staff, super admin. */
async function requireStoreAccess(storeId: string): Promise<Guard> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié' }
  if (!storeId) return { ok: false, error: 'Boutique inconnue' }

  const [profile] = await db
    .select({ isSuperAdmin: profiles.isSuperAdmin })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1)
  if (profile?.isSuperAdmin) return { ok: true, userId: user.id, isSuperAdmin: true }

  const [owned] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(and(eq(stores.id, storeId), eq(stores.userId, user.id)))
    .limit(1)
  if (owned) return { ok: true, userId: user.id }

  const [staff] = await db
    .select({ id: storeStaff.id })
    .from(storeStaff)
    .where(and(eq(storeStaff.storeId, storeId), eq(storeStaff.userId, user.id)))
    .limit(1)
  if (staff) return { ok: true, userId: user.id }

  return { ok: false, error: 'Boutique inaccessible' }
}

export type CsvExportResult =
  | { success: true; csv: string; filename: string; count: number }
  | { success: false; error: string }

const EXPORT_LIMIT = 500

const dateFr = (d: Date | string | null | undefined) => {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR')
}

/** Export CSV des ventes (500 dernières commandes) — date, référence, articles, totaux, statuts. */
export async function exportOrdersCsvAction(storeId: string): Promise<CsvExportResult> {
  try {
    const access = await requireStoreAccess(storeId)
    if (!access.ok) return { success: false, error: access.error }

    const rows = await db
      .select({
        order: orders,
        customerName: customers.name,
        customerPhone: customers.phone,
      })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(eq(orders.storeId, storeId))
      .orderBy(desc(orders.date))
      .limit(EXPORT_LIMIT)

    // Détail des articles par commande (pour la colonne « Articles »).
    const orderIds = rows.map((r) => r.order.id)
    const items = orderIds.length
      ? await db
          .select({
            orderId: orderItems.orderId,
            quantity: orderItems.quantity,
            name: products.name,
          })
          .from(orderItems)
          .leftJoin(products, eq(orderItems.productId, products.id))
          .where(inArray(orderItems.orderId, orderIds))
      : []
    const itemsByOrder = new Map<string, string[]>()
    for (const item of items) {
      const label = `${item.name || 'Produit'} × ${item.quantity}`
      const list = itemsByOrder.get(item.orderId)
      if (list) list.push(label)
      else itemsByOrder.set(item.orderId, [label])
    }

    const PAYMENT_STATUS: Record<string, string> = {
      PENDING: 'En attente',
      PAID: 'Payée',
      FAILED: 'Échec paiement',
      CANCELLED: 'Remboursée/Annulée',
    }
    const METHOD_LABELS: Record<string, string> = {
      CASH: 'Espèces',
      MOBILE_MONEY: 'Mobile Money',
      CARD: 'Carte bancaire',
      BANK_TRANSFER: 'Virement bancaire',
      OTHER: 'Autre',
    }
    const TYPE_LABELS: Record<string, string> = {
      IN_STORE: 'Magasin',
      ONLINE: 'En ligne',
    }

    const body = rows.map(({ order, customerName, customerPhone }) => [
      dateFr(order.date || order.createdAt),
      order.id.slice(0, 8).toUpperCase(),
      (customerName || '').trim() || order.promoCode || '—',
      order.buyerPhone || customerPhone || '',
      (itemsByOrder.get(order.id) || []).join(' | '),
      Number(order.total).toLocaleString('fr-FR'),
      order.status,
      PAYMENT_STATUS[String(order.paymentStatus || '').toUpperCase()] || order.paymentStatus || '',
      order.paymentProvider || METHOD_LABELS[String(order.paymentMethod || '').toUpperCase()] || order.paymentMethod || '',
      TYPE_LABELS[order.type] || order.type,
      order.promoCode || '',
    ])

    const csv = toCsv(
      ['Date', 'Référence', 'Client', 'Téléphone', 'Articles', 'Total (XOF)', 'Statut commande', 'Statut paiement', 'Moyen de paiement', 'Canal', 'Code promo'],
      body,
    )
    const stamp = new Date().toISOString().slice(0, 10)
    return { success: true, csv, filename: `ventes-${stamp}.csv`, count: body.length }
  } catch (error) {
    console.error('[export] Orders CSV error:', error)
    return { success: false, error: "Export impossible pour le moment. Réessayez." }
  }
}

/** Export CSV des clients (500 derniers) — nom, téléphone, dépenses, commandes. */
export async function exportCustomersCsvAction(storeId: string): Promise<CsvExportResult> {
  try {
    const access = await requireStoreAccess(storeId)
    if (!access.ok) return { success: false, error: access.error }

    const rows = await db
      .select()
      .from(customers)
      .where(eq(customers.storeId, storeId))
      .orderBy(desc(customers.totalSpent))
      .limit(EXPORT_LIMIT)

    const body = rows.map((c) => [
      c.name,
      c.phone,
      c.email || '',
      Number(c.totalSpent).toLocaleString('fr-FR'),
      c.ordersCount,
      dateFr(c.createdAt),
    ])

    const csv = toCsv(
      ['Nom', 'Téléphone', 'Email', 'Dépenses (XOF)', 'Nb commandes', 'Créé le'],
      body,
    )
    const stamp = new Date().toISOString().slice(0, 10)
    return { success: true, csv, filename: `clients-${stamp}.csv`, count: body.length }
  } catch (error) {
    console.error('[export] Customers CSV error:', error)
    return { success: false, error: "Export impossible pour le moment. Réessayez." }
  }
}
