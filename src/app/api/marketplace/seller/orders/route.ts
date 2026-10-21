import { NextRequest, NextResponse } from 'next/server';
import { getOrdersAction } from '@/app/actions/orders';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import { parseQuery } from '@/lib/validation';
import { listQuerySchema } from '@/lib/schemas';

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

    const parsed = parseQuery(new URL(req.url), listQuerySchema);
    if (!parsed.ok) return parsed.response;
    const { offset, limit, search, filterStatus } = parsed.data;
    const storeId = await resolveMobileStoreId(guard.userId, parsed.data.storeId);

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'NoStore', orders: [], hasMore: false, total: 0 });
    }

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
