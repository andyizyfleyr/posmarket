import { NextRequest, NextResponse } from 'next/server';
import { bulkDeleteProductsAction } from '@/app/actions/inventory';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/** POST /api/marketplace/seller/inventory/bulk-delete — suppression groupée. */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Requête invalide' });
    }

    const { ids } = body as { ids?: string[] };
    const storeId = await resolveMobileStoreId(
      guard.userId,
      (body as { storeId?: string }).storeId,
    );

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'NoStore' });
    }

    const result = await bulkDeleteProductsAction(ids || [], storeId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/inventory/bulk-delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Suppression impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
