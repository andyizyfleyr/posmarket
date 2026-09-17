import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { subscriptionPayments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyKkiapayTransaction } from '@/lib/kkiapay';
import { activateSubscription } from '@/lib/subscription';
import type { SubscriptionTier, SubscriptionDuration } from '@/types';

const STATUS_MAP: Record<string, string> = {
  SUCCESS: 'APPROVED',
  FAILED: 'DECLINED',
};

export interface KkiapaySyncResult {
  scanned: number;
  activated: number;
  updated: number;
  skipped: number;
  errors: number;
}

export async function syncKkiapaySubscriptions(userId?: string): Promise<KkiapaySyncResult> {
  const summary: KkiapaySyncResult = { scanned: 0, activated: 0, updated: 0, skipped: 0, errors: 0 };
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
    const txId = String(row.reference || '').trim();
    if (!txId || txId.startsWith('test_')) {
      summary.skipped++;
      continue;
    }

    try {
      const tx = await verifyKkiapayTransaction(txId);
      const status = STATUS_MAP[String(tx.status || '').toUpperCase()];
      if (!status) {
        summary.skipped++;
        continue;
      }

      await db
        .update(subscriptionPayments)
        .set({ status, updatedAt: new Date() })
        .where(
          and(
            eq(subscriptionPayments.transactionId, row.transactionId!),
            eq(subscriptionPayments.status, 'PENDING'),
          ),
        );

      if (status === 'APPROVED') {
        await activateSubscription(row.userId, row.tier as SubscriptionTier, row.duration as SubscriptionDuration);
        revalidatePath('/subscription');
        summary.activated++;
        console.log(`[Kkiapay] Sync activé: user=${row.userId} tier=${row.tier} duration=${row.duration} reference=${txId}`);
      } else {
        summary.updated++;
        console.log(`[Kkiapay] Sync statut ${status}: user=${row.userId} reference=${txId}`);
      }
    } catch (error) {
      summary.errors++;
      console.error(`[Kkiapay] Sync erreur reference=${txId}:`, error);
    }
  }

  return summary;
}
