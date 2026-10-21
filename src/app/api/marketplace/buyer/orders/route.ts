import { NextRequest, NextResponse } from 'next/server';
import { fetchBuyerOrdersAction } from '@/app/actions/marketplace';
import { requireBuyerSpace } from '@/lib/mobile-space';
import { parseQuery } from '@/lib/validation';
import { buyerOrdersQuerySchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/buyer/orders?email=...&userId=...
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireBuyerSpace();
    if (!guard.ok) return guard.response;
    const parsed = parseQuery(new URL(req.url), buyerOrdersQuerySchema);
    if (!parsed.ok) return parsed.response;
    const { page, limit, email, userId } = parsed.data;
    const fallback = userId || email;
    const result = await fetchBuyerOrdersAction(page, limit, fallback);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] buyer/orders error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement des commandes', orders: [] },
      { status: 500 },
    );
  }
}
