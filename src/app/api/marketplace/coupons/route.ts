import { NextRequest, NextResponse } from 'next/server';
import { fetchActiveCouponsAction } from '@/app/actions/marketplace';
import { parseQuery } from '@/lib/validation';
import { couponsQuerySchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/coupons?storeIds=a,b
 *
 * Codes promo actifs des boutiques demandées. Utilisé par le panier mobile
 * (« Ajouter un code promo ») ; le web lit directement la table `coupons`.
 */
export async function GET(request: NextRequest) {
  const parsed = parseQuery(new URL(request.url), couponsQuerySchema);
  if (!parsed.ok) return parsed.response;
  const storeIds = parsed.data.storeIds
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const result = await fetchActiveCouponsAction(storeIds);
  return NextResponse.json(result);
}
