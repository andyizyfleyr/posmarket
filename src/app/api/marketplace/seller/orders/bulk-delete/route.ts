import { NextRequest, NextResponse } from 'next/server';
import { bulkDeleteOrdersAction } from '@/app/actions/orders';
import { requireSellerSpace } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerIdsSchema } from '@/lib/schemas';

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

    const parsed = await parseBody(req, sellerIdsSchema);
    if (!parsed.ok) return parsed.response;

    const result = await bulkDeleteOrdersAction(parsed.data.ids);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/orders/bulk-delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Suppression impossible pour le moment.' },
      { status: 500 },
    );
  }
}
