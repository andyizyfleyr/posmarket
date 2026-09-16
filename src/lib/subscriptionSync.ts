import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { subscriptionPayments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getFedaPayTransaction } from '@/lib/fedapay';
import { activateSubscription } from '@/lib/subscription';
import type { SubscriptionTier, SubscriptionDuration } from '@/types';

const STATUS_MAP: Record<string, string> = {
  approved: 'APPROVED',
  declined: 'DECLINED',
  canceled: 'CANCELED',
};

export interface FedaPaySyncResult {
  scanned: number;
  activated: number;
  updated: number;
  skipped: number;
  errors: number;
}

export async function syncFedaPaySubscriptions(userId?: string): Promise<FedaPaySyncResult> {
  const summary: FedaPaySyncResult = { scanned: 0, activated: 0, updated: 0, skipped: 0, errors: 0 };

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
      const tx = await getFedaPayTransaction(row.transactionId);
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
        console.log(`[FedaPay] Sync activé: user=${row.userId} tier=${row.tier} duration=${row.duration} tx=${row.transactionId}`);
      } else {
        summary.updated++;
        console.log(`[FedaPay] Sync statut ${status}: user=${row.userId} tx=${row.transactionId}`);
      }
    } catch (error) {
      summary.errors++;
      console.error(`[FedaPay] Sync erreur tx=${row.transactionId}:`, error);
    }
  }

  return summary;
}