import { NextRequest, NextResponse } from 'next/server';
import { bulkDeleteProductsAction } from '@/app/actions/inventory';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerIdsSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/** POST /api/marketplace/seller/inventory/bulk-delete — suppression groupée. */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = await parseBody(req, sellerIdsSchema);
    if (!parsed.ok) return parsed.response;
    const { ids } = parsed.data;
    const storeId = await resolveMobileStoreId(guard.userId, parsed.data.storeId);

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'NoStore' });
    }

    const result = await bulkDeleteProductsAction(ids, storeId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/inventory/bulk-delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Suppression impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
