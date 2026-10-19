import { NextRequest, NextResponse } from 'next/server';
import { getCustomersAction } from '@/app/actions/customers';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/seller/customers?storeId=...&offset=0&limit=10&search=
 *
 * Liste paginée des clients — même action que la recherche/« voir plus » du web
 * (`CustomersView`).
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
      return NextResponse.json({ success: false, error: 'NoStore', customers: [], hasMore: false, total: 0 });
    }

    const offset = Number(searchParams.get('offset') || 0) || 0;
    const limit = Number(searchParams.get('limit') || 10) || 10;
    const search = searchParams.get('search') || '';

    const result = await getCustomersAction(storeId, offset, limit, search);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/customers error:', error);
    return NextResponse.json(
      { success: false, customers: [], hasMore: false, total: 0, error: 'Chargement impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
