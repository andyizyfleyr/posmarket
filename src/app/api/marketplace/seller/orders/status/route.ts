import { NextRequest, NextResponse } from 'next/server';
import { updateOrderStatusAction } from '@/app/actions/orders';
import { requireSellerSpace } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerOrderStatusSchema } from '@/lib/schemas';

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

    const parsed = await parseBody(req, sellerOrderStatusSchema);
    if (!parsed.ok) return parsed.response;

    const result = await updateOrderStatusAction(
      parsed.data.orderId,
      parsed.data.status,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/orders/status error:', error);
    return NextResponse.json(
      { success: false, error: 'Mise à jour impossible pour le moment.' },
      { status: 500 },
    );
  }
}
