import { NextRequest, NextResponse } from 'next/server';
import { deleteOrderAction } from '@/app/actions/orders';
import { requireSellerSpace } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerIdSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/seller/orders/delete  { id }
 *
 * Supprime une commande (icône corbeille du détail de commande web).
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = await parseBody(req, sellerIdSchema);
    if (!parsed.ok) return parsed.response;

    const result = await deleteOrderAction(parsed.data.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/orders/delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Suppression impossible pour le moment.' },
      { status: 500 },
    );
  }
}
