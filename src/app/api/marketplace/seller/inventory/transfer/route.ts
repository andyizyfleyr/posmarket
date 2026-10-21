import { NextRequest, NextResponse } from 'next/server';
import { transferProductsBetweenStoresAction } from '@/app/actions/inventory';
import { requireSellerSpace } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerInventoryTransferSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/** POST /api/marketplace/seller/inventory/transfer — copie/inter-boutiques. */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = await parseBody(req, sellerInventoryTransferSchema);
    if (!parsed.ok) return parsed.response;
    const { sourceStoreId, targetStoreId, productIds, options } = parsed.data;

    const result = await transferProductsBetweenStoresAction(
      sourceStoreId,
      targetStoreId,
      productIds,
      (options || { duplicateStrategy: 'skip', copyStock: false }) as Parameters<
        typeof transferProductsBetweenStoresAction
      >[3],
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/inventory/transfer error:', error);
    return NextResponse.json(
      { success: false, error: 'Transfert impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
