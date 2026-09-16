import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { subscriptionPayments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getPayDunyaInvoiceStatus } from '@/lib/paydunya';
import { activateSubscription } from '@/lib/subscription';
import type { SubscriptionTier, SubscriptionDuration } from '@/types';

const STATUS_MAP: Record<string, string> = {
  completed: 'APPROVED',
  cancelled: 'CANCELED',
  failed: 'DECLINED',
};

export interface PayDunyaSyncResult {
  scanned: number;
  activated: number;
  updated: number;
  skipped: number;
  errors: number;
}

export async function syncPayDunyaSubscriptions(userId?: string): Promise<PayDunyaSyncResult> {
  const summary: PayDunyaSyncResult = { scanned: 0, activated: 0, updated: 0, skipped: 0, errors: 0 };

  const pending = await db
    .select()
    .from(subscriptionPayments)
    .where(
      userId
        ? and(eq(subscriptionPayments.userId, userId), eq(subscriptionPayments.status, 'PENDING'))
        : eq(subscriptionPayments.status, 'PENDING'),
    );

  for (const row of pending) {
    summary.scanned++;
    if (!row.transactionId) {
      summary.skipped++;
      continue;
    }

    try {
      const tx = await getPayDunyaInvoiceStatus(row.transactionId);
      const status = STATUS_MAP[String(tx.status || '').toLowerCase()];
      if (!status) {
        summary.skipped++;
        continue;
      }

      await db.update(subscriptionPayments)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(subscriptionPayments.transactionId, row.transactionId), eq(subscriptionPayments.status, 'PENDING')));

      if (status === 'APPROVED') {
        await activateSubscription(row.userId, row.tier as SubscriptionTier, row.duration as SubscriptionDuration);
        revalidatePath('/subscription');
        summary.activated++;
        console.log(`[PayDunya] Sync activé: user=${row.userId} tier=${row.tier} duration=${row.duration} invoice=${row.transactionId}`);
      } else {
        summary.updated++;
        console.log(`[PayDunya] Sync statut ${status}: user=${row.userId} invoice=${row.transactionId}`);
      }
    } catch (error) {
      summary.errors++;
      console.error(`[PayDunya] Sync erreur invoice=${row.transactionId}:`, error);
    }
  }

  return summary;
}