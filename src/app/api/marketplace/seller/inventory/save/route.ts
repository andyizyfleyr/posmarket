import { NextRequest, NextResponse } from 'next/server';
import { saveProductAction } from '@/app/actions/inventory';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerInventorySaveSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/** POST /api/marketplace/seller/inventory/save — création / mise à jour d'un produit. */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = await parseBody(req, sellerInventorySaveSchema);
    if (!parsed.ok) return parsed.response;
    const { product } = parsed.data;
    const storeId = await resolveMobileStoreId(guard.userId, parsed.data.storeId);

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'NoStore' });
    }

    const result = await saveProductAction(
      product as unknown as Parameters<typeof saveProductAction>[0],
      storeId,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/inventory/save error:', error);
    return NextResponse.json(
      { success: false, error: 'Enregistrement impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
