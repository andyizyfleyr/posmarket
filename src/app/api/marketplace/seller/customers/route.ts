import { NextRequest, NextResponse } from 'next/server';
import { getCustomersAction } from '@/app/actions/customers';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import { parseQuery } from '@/lib/validation';
import { listQuerySchema } from '@/lib/schemas';

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

    const parsed = parseQuery(new URL(req.url), listQuerySchema);
    if (!parsed.ok) return parsed.response;
    const { offset, limit, search } = parsed.data;
    const storeId = await resolveMobileStoreId(guard.userId, parsed.data.storeId);

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'NoStore', customers: [], hasMore: false, total: 0 });
    }

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
