import { NextRequest, NextResponse } from 'next/server';
import { fetchActiveCouponsAction } from '@/app/actions/marketplace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/coupons?storeIds=a,b
 *
 * Codes promo actifs des boutiques demandées. Utilisé par le panier mobile
 * (« Ajouter un code promo ») ; le web lit directement la table `coupons`.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('storeIds') || '';
  const storeIds = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const result = await fetchActiveCouponsAction(storeIds);
  return NextResponse.json(result);
}
