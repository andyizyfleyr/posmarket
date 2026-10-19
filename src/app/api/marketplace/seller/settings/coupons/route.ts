import { NextRequest, NextResponse } from 'next/server';
import {
  deleteCouponAction,
  saveCouponAction,
  toggleCouponAction,
} from '@/app/actions/settings';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/seller/settings/coupons
 *
 * Onglet Promos (mêmes server actions que le web) :
 * - `{ action: 'save', storeId, coupon: { code, discountPct, active } }`
 * - `{ action: 'delete', id }`
 * - `{ action: 'toggle', id, active }`
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Requête invalide' });
    }

    const action = String((body as { action?: string }).action || '');

    if (action === 'save') {
      const storeId = await resolveMobileStoreId(
        guard.userId,
        (body as { storeId?: string }).storeId,
      );
      if (!storeId) {
        return NextResponse.json({ success: false, error: 'Boutique inconnue' });
      }
      const coupon = (body as {
        coupon?: { code?: string; discountPct?: number | string; active?: boolean };
      }).coupon;
      const result = await saveCouponAction(
        {
          code: coupon?.code,
          discountPct: coupon?.discountPct,
          active: coupon?.active,
        },
        storeId,
      );
      return NextResponse.json(result);
    }

    if (action === 'delete') {
      const id = String((body as { id?: string }).id || '');
      if (!id) {
        return NextResponse.json({ success: false, error: 'Code promo manquant' });
      }
      const result = await deleteCouponAction(id);
      return NextResponse.json(result);
    }

    if (action === 'toggle') {
      const id = String((body as { id?: string }).id || '');
      if (!id) {
        return NextResponse.json({ success: false, error: 'Code promo manquant' });
      }
      const active = Boolean((body as { active?: boolean }).active);
      const result = await toggleCouponAction(id, active);
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: 'Action inconnue.' });
  } catch (error) {
    console.error('[API] seller/settings/coupons error:', error);
    return NextResponse.json(
      { success: false, error: 'Opération impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
