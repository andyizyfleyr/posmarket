import { NextRequest, NextResponse } from 'next/server';
import { updateOrderStatusAction } from '@/app/actions/orders';
import { requireSellerSpace } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/seller/orders/status  { orderId, status }
 *
 * Change le statut d'une commande (boutons « Passer en cours » / « Marquer
 * livrée » du détail de commande web).
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const body = (await req.json().catch(() => ({}))) as {
      orderId?: string;
      status?: string;
    };

    if (!body.orderId || !body.status) {
      return NextResponse.json({ success: false, error: 'MissingOrder' });
    }

    const result = await updateOrderStatusAction(body.orderId, body.status);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/orders/status error:', error);
    return NextResponse.json(
      { success: false, error: 'Mise à jour impossible pour le moment.' },
      { status: 500 },
    );
  }
}
