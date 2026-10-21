import { NextRequest, NextResponse } from 'next/server';
import {
  deleteCouponAction,
  saveCouponAction,
  toggleCouponAction,
} from '@/app/actions/settings';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerCouponsSchema } from '@/lib/schemas';

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

    const parsed = await parseBody(req, sellerCouponsSchema);
    if (!parsed.ok) return parsed.response;
    const { action } = parsed.data;

    if (action === 'save') {
      const storeId = await resolveMobileStoreId(guard.userId, parsed.data.storeId);
      if (!storeId) {
        return NextResponse.json({ success: false, error: 'Boutique inconnue' });
      }
      const coupon = parsed.data.coupon as
        | { code?: string; discountPct?: number | string; active?: boolean }
        | undefined;
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
      const id = parsed.data.id;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Code promo manquant' });
      }
      const result = await deleteCouponAction(id);
      return NextResponse.json(result);
    }

    if (action === 'toggle') {
      const id = parsed.data.id;
      if (!id) {
        return NextResponse.json({ success: false, error: 'Code promo manquant' });
      }
      const active = Boolean(parsed.data.active);
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
