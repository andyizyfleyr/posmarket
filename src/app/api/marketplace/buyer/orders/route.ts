import { NextRequest, NextResponse } from 'next/server';
import { fetchBuyerOrdersAction } from '@/app/actions/marketplace';
import { requireBuyerSpace } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/buyer/orders?email=...&userId=...
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireBuyerSpace();
    if (!guard.ok) return guard.response;
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const fallback = userId || email;
    const page = Number(searchParams.get('page')) || 1;
    const limit = Number(searchParams.get('limit')) || 50;
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
