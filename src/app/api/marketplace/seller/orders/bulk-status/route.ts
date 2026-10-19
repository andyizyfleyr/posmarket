import { NextRequest, NextResponse } from 'next/server';
import { bulkUpdateOrderStatusAction } from '@/app/actions/orders';
import { requireSellerSpace } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/seller/orders/bulk-status  { orderIds, status }
 *
 * Mise à jour groupée des statuts (barre de sélection du web).
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const body = (await req.json().catch(() => ({}))) as {
      orderIds?: string[];
      status?: string;
    };

    if (!Array.isArray(body.orderIds) || body.orderIds.length === 0 || !body.status) {
      return NextResponse.json({ success: false, error: 'MissingOrders' });
    }

    const result = await bulkUpdateOrderStatusAction(body.orderIds, body.status);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/orders/bulk-status error:', error);
    return NextResponse.json(
      { success: false, error: 'Mise à jour impossible pour le moment.' },
      { status: 500 },
    );
  }
}
