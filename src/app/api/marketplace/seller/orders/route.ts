import { NextRequest, NextResponse } from 'next/server';
import { getOrdersAction } from '@/app/actions/orders';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/seller/orders?storeId=...&offset=0&limit=10&search=&filterStatus=
 *
 * Liste paginée des commandes — même action que la recherche/« voir plus » du
 * web (`OrdersView`).
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const storeId = await resolveMobileStoreId(
      guard.userId,
      searchParams.get('storeId'),
    );

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'NoStore', orders: [], hasMore: false, total: 0 });
    }

    const offset = Number(searchParams.get('offset') || 0) || 0;
    const limit = Number(searchParams.get('limit') || 10) || 10;
    const search = searchParams.get('search') || '';
    const filterStatus = searchParams.get('filterStatus') || 'all';

    const result = await getOrdersAction(storeId, offset, limit, search, filterStatus);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/orders error:', error);
    return NextResponse.json(
      { success: false, orders: [], hasMore: false, total: 0, error: 'Chargement impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
