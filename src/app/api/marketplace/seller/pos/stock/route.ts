import { NextRequest, NextResponse } from 'next/server';
import { getStockCountsAction } from '@/app/actions/inventory';
import { requireSellerSpace } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerStoreIdSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/seller/pos/stock
 *
 * Compteurs de stock live pour les badges du POS (même action que le web, qui
 * l'interroge toutes les 5 secondes).
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = await parseBody(req, sellerStoreIdSchema);
    if (!parsed.ok) return parsed.response;

    const result = await getStockCountsAction(parsed.data.storeId);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error });
    }

    return NextResponse.json({ success: true, stock: result.stock || {} });
  } catch (error) {
    console.error('[API] seller/pos/stock error:', error);
    return NextResponse.json(
      { success: false, error: 'Stock indisponible pour le moment.' },
      { status: 500 },
    );
  }
}
