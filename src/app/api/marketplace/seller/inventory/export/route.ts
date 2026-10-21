import { NextRequest, NextResponse } from 'next/server';
import { exportStoreProductsAction } from '@/app/actions/inventory';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerExportSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/** POST /api/marketplace/seller/inventory/export — export JSON/CSV des produits. */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = await parseBody(req, sellerExportSchema);
    if (!parsed.ok) return parsed.response;
    const { ids } = parsed.data;
    const storeId = await resolveMobileStoreId(guard.userId, parsed.data.storeId);

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'NoStore' });
    }

    const result = await exportStoreProductsAction(storeId, ids);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/inventory/export error:', error);
    return NextResponse.json(
      { success: false, error: 'Export impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
