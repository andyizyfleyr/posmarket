import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { orderPayments } from '@/db/schema';
import { isSaspayId } from '@/lib/saspay';
import { confirmStorePayment } from '@/lib/store-payments';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Retour du guichet SasPay après paiement d'une commande boutique.
 * Le `payment` est l'identifiant local de `order_payments` (transmis dans le
 * metadata de session) : on revérifie auprès de SasPay puis on renvoie le
 * client sur l'accueil. La page de confirmation de la boutique affiche le
 * statut réel en base.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentId = url.searchParams.get('payment') || '';
  const home = new URL('/', url.origin);

  if (!isSaspayId(paymentId)) {
    return NextResponse.redirect(home);
  }

  try {
    const [row] = await db
      .select({ id: orderPayments.id, orderId: orderPayments.orderId, token: orderPayments.token })
      .from(orderPayments)
      .where(eq(orderPayments.id, paymentId))
      .limit(1);
    if (row) {
      await confirmStorePayment({ orderId: row.orderId, token: row.token });
    }
  } catch (error) {
    console.error('[store-payments] SasPay return reconciliation:', error);
  }

  return NextResponse.redirect(home);
}
