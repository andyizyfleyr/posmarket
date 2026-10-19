import { NextRequest, NextResponse } from 'next/server';
import { bulkDeleteOrdersAction } from '@/app/actions/orders';
import { requireSellerSpace } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/seller/orders/bulk-delete  { ids }
 *
 * Suppression groupée des commandes sélectionnées.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const body = (await req.json().catch(() => ({}))) as { ids?: string[] };
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ success: false, error: 'MissingOrders' });
    }

    const result = await bulkDeleteOrdersAction(body.ids);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/orders/bulk-delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Suppression impossible pour le moment.' },
      { status: 500 },
    );
  }
}
