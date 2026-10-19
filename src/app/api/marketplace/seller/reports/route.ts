import { NextRequest, NextResponse } from 'next/server';
import { fetchStoreData } from '@/app/actions/store';
import { loadOrdersForStore } from '@/lib/load-store-data';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import { getStoreCookie } from '@/utils/store-cookie';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/seller/reports?storeId=...
 *
 * Données de la page Rapports (Historique) mobile — mêmes sources que
 * `src/app/(app)/reports/page.tsx` : commandes formatées (`loadOrdersForStore`,
 * cache 20 s, 100 dernières, tri décroissant) et boutique (`fetchStoreData`,
 * dont `settings` pour le reçu). La vue mobile ne consomme ni produits ni
 * clients ni factures.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const storeId = await resolveMobileStoreId(
      guard.userId,
      searchParams.get('storeId') || (await getStoreCookie()),
    );

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'NoStore' });
    }

    const [orders, data] = await Promise.all([
      loadOrdersForStore(storeId).catch(() => []),
      fetchStoreData(storeId, undefined, {
        products: false,
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
      store: data.store,
    });
  } catch (error) {
    console.error('[API] seller/reports error:', error);
    return NextResponse.json(
      { success: false, error: 'Chargement impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
