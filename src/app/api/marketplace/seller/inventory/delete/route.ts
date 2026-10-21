import { NextRequest, NextResponse } from 'next/server';
import { deleteProductAction } from '@/app/actions/inventory';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerIdSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/** POST /api/marketplace/seller/inventory/delete — suppression d'un produit. */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = await parseBody(req, sellerIdSchema);
    if (!parsed.ok) return parsed.response;
    const { id } = parsed.data;
    const storeId = await resolveMobileStoreId(guard.userId, parsed.data.storeId);

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'NoStore' });
    }

    const result = await deleteProductAction(id, storeId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/inventory/delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Suppression impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
