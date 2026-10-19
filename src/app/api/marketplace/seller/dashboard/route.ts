import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { stores } from '@/db/schema';
import { fetchStoreData } from '@/app/actions/store';
import { loadOrdersForStore } from '@/lib/load-store-data';
import { requireSellerSpace } from '@/lib/mobile-space';
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

    const { searchParams } = new URL(req.url);
    let storeId = searchParams.get('storeId') || (await getStoreCookie()) || '';

    if (!storeId) {
      const [first] = await db
        .select({ id: stores.id })
        .from(stores)
        .where(eq(stores.userId, guard.userId))
        .limit(1);
      storeId = first?.id || '';
    }

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
