import { NextRequest, NextResponse } from 'next/server';
import { fetchStoreData } from '@/app/actions/store';
import { loadOrdersForStore } from '@/lib/load-store-data';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import { parseQuery } from '@/lib/validation';
import { storeIdQuerySchema } from '@/lib/schemas';
import { getStoreCookie } from '@/utils/store-cookie';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/seller/dashboard?storeId=...
 *
 * Données du tableau de bord mobile — mêmes sources que
 * `src/app/(app)/dashboard/page.tsx` : commandes formatées (cache 20 s) et
 * données de boutique (produits + boutique).
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = parseQuery(new URL(req.url), storeIdQuerySchema);
    if (!parsed.ok) return parsed.response;
    const storeId = await resolveMobileStoreId(
      guard.userId,
      parsed.data.storeId || (await getStoreCookie()),
    );

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'NoStore' });
    }

    const [orders, data] = await Promise.all([
      loadOrdersForStore(storeId).catch(() => []),
      fetchStoreData(storeId, undefined, {
        orders: false,
        customers: false,
        invoices: false,
      }),
    ]);

    if (!data.store) {
      return NextResponse.json({ success: false, error: 'Forbidden' });
    }

    return NextResponse.json({
      success: true,
      orders,
      products: data.products,
      store: data.store,
    });
  } catch (error) {
    console.error('[API] seller/dashboard error:', error);
    return NextResponse.json(
      { success: false, error: 'Chargement impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
