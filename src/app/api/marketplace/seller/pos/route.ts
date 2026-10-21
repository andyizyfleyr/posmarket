import { NextRequest, NextResponse } from 'next/server';
import { fetchStoreData } from '@/app/actions/store';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import { parseQuery } from '@/lib/validation';
import { storeIdQuerySchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/seller/pos?storeId=...
 *
 * Données du point de vente mobile — mêmes sources que
 * `src/app/(app)/pos/page.tsx` : produits + clients (100 derniers) + boutique.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = parseQuery(new URL(req.url), storeIdQuerySchema);
    if (!parsed.ok) return parsed.response;
    const storeId = await resolveMobileStoreId(guard.userId, parsed.data.storeId);

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'NoStore' });
    }

    const data = await fetchStoreData(storeId, undefined, {
      orders: false,
      invoices: false,
    });

    if (!data.store) {
      return NextResponse.json({ success: false, error: 'Forbidden' });
    }

    return NextResponse.json({
      success: true,
      products: data.products,
      customers: data.customers,
      store: data.store,
    });
  } catch (error) {
    console.error('[API] seller/pos error:', error);
    return NextResponse.json(
      { success: false, error: 'Chargement impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
