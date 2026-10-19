'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { invoiceItems, invoices } from '@/db/schema'
import { requireStoreAccess } from '@/lib/authorization'
import { refreshTag } from '@/lib/revalidate'

/**
 * Factures vendeur — équivalent serveur de `saveInvoice` (`src/supabase-api.ts`)
 * et des écritures Supabase faites directement par `InvoicesView` sur le web.
 *
 * Le web écrit via le client Supabase public ; ici les écritures passent par
 * ces actions autorisées (`requireStoreAccess`), appelées par les routes de
 * l'application mobile. `updateTag` est interdit hors Server Action : on
 * invalide donc via `refreshTag` (voir `@/lib/revalidate`).
 */

const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PAID', 'OVERDUE'] as const
type InvoiceStatusValue = (typeof INVOICE_STATUSES)[number]

export type InvoiceItemInput = {
    description?: string | null
    quantity?: number | string
    unitPrice?: number | string
    total?: number | string
}

export type InvoiceInput = {
    id?: string
    invoiceNumber?: string
    customerName?: string | null
    customerEmail?: string | null
    customerAddress?: string | null
    date?: string | null
    dueDate?: string | null
    status?: string | null
    notes?: string | null
    subtotal?: number | string | null
    total?: number | string | null
    items?: InvoiceItemInput[]
}

/** Statut borné aux 4 valeurs de la vue web (défaut : Brouillon). */
function normalizeStatus(status?: string | null): InvoiceStatusValue {
    return INVOICE_STATUSES.includes(status as InvoiceStatusValue)
        ? (status as InvoiceStatusValue)
        : 'DRAFT'
}

function toDate(value?: string | null): Date | null {
    if (!value) return null
    const date = new Date(value)
    return isNaN(date.getTime()) ? null : date
}

/** `numeric` Drizzle : la colonne attend une chaîne. */
function toNumeric(value?: number | string | null): string {
    const parsed = typeof value === 'number' ? value : parseFloat(value ?? '')
    return Number.isFinite(parsed) ? parsed.toString() : '0'
}

/** Vérifie que l'appelant gère bien la boutique de la facture. */
async function requireInvoiceAccess(invoiceId: string) {
    const [row] = await db
        .select({ storeId: invoices.storeId })
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1)
    if (!row) return { ok: false as const, error: 'Facture introuvable' }
    const access = await requireStoreAccess(row.storeId)
    if (!access.ok) return { ok: false as const, error: access.error }
    return { ok: true as const, storeId: row.storeId }
}

/**
 * Crée (ou met à jour) une facture puis ses articles — même logique que
 * `saveInvoice` du web : un id `temp-` déclenche une insertion, sinon la
 * facture est mise à jour et ses articles remplacés.
 */
export async function saveInvoiceAction(invoice: InvoiceInput, storeId: string) {
    try {
        const access = await requireStoreAccess(storeId)
        if (!access.ok) return { success: false, error: access.error }

        const dataToSave = {
            storeId,
            invoiceNumber: invoice.invoiceNumber || '',
            customerName: invoice.customerName ?? null,
            customerEmail: invoice.customerEmail ?? null,
            customerAddress: invoice.customerAddress ?? null,
            subtotal: toNumeric(invoice.subtotal),
            total: toNumeric(invoice.total),
            status: normalizeStatus(invoice.status),
            notes: invoice.notes ?? null,
            date: toDate(invoice.date) ?? new Date(),
            dueDate: toDate(invoice.dueDate),
        }

        let invoiceId = invoice.id
        if (invoiceId && !invoiceId.startsWith('temp-')) {
            await db.update(invoices).set(dataToSave).where(eq(invoices.id, invoiceId))
            // Les articles sont réinsérés, comme le fait `saveInvoice`.
            await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId))
        } else {
            const [inserted] = await db.insert(invoices).values(dataToSave).returning()
            invoiceId = inserted.id
        }

        const items = (invoice.items || []).map((item) => ({
            invoiceId: invoiceId as string,
            description: item.description ?? '',
            quantity: Math.max(1, Number(item.quantity) || 1),
            unitPrice: toNumeric(item.unitPrice),
            total: toNumeric(item.total),
        }))
        if (items.length > 0) await db.insert(invoiceItems).values(items)

        revalidatePath('/invoices')
        refreshTag('marketplace')
        return { success: true, invoiceId }
    } catch (error: unknown) {
        console.error('Error saving invoice with Drizzle:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
}

/** Change le statut d'une facture (select « Statut » de la modale détail). */
export async function updateInvoiceStatusAction(invoiceId: string, status: string) {
    try {
        const access = await requireInvoiceAccess(invoiceId)
        if (!access.ok) return { success: false, error: access.error }
        if (!INVOICE_STATUSES.includes(status as InvoiceStatusValue)) {
            return { success: false, error: 'Statut invalide' }
        }
        await db.update(invoices).set({ status }).where(eq(invoices.id, invoiceId))
        revalidatePath('/invoices')
        refreshTag('marketplace')
        return { success: true }
    } catch (error: unknown) {
        console.error('Error updating invoice status with Drizzle:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
}

/** Articles d'une facture (table `invoice_items`, équivalent `fetchInvoiceItems`). */
export async function getInvoiceItemsAction(invoiceId: string) {
    try {
        const access = await requireInvoiceAccess(invoiceId)
        if (!access.ok) return { success: false, error: access.error, items: [] }

        const rows = await db
            .select()
            .from(invoiceItems)
            .where(eq(invoiceItems.invoiceId, invoiceId))

        return {
            success: true,
            items: (rows || []).map((row) => ({
                ...row,
                quantity: Number(row.quantity) || 0,
                unitPrice: parseFloat(row.unitPrice ?? '') || 0,
                total: parseFloat(row.total ?? '') || 0,
            })),
        }
    } catch (error: unknown) {
        console.error('Error fetching invoice items with Drizzle:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            items: [],
        }
    }
}
