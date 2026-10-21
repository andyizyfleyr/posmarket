import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { coupons } from '@/db/schema';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import { parseQuery } from '@/lib/validation';
import { storeIdQuerySchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/seller/pos/coupons?storeId=...
 *
 * Codes promo actifs de la boutique (le POS web lit la table `coupons` en
 * direct). Réponse au format snake_case attendu par l'app mobile.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = parseQuery(new URL(req.url), storeIdQuerySchema);
    if (!parsed.ok) return parsed.response;
    const storeId = await resolveMobileStoreId(guard.userId, parsed.data.storeId);

    if (!storeId) {
      return NextResponse.json({ success: true, coupons: [] });
    }

    const rows = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.storeId, storeId), eq(coupons.active, true)))
      .catch(() => []);

    return NextResponse.json({
      success: true,
      coupons: rows.map((row) => ({
        id: row.id,
        code: row.code,
        discount_pct: Number(row.discountPct) || 0,
        active: row.active,
        store_id: row.storeId,
        created_at: row.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[API] seller/pos/coupons error:', error);
    // Le POS web avale l'erreur (« Coupons table not available ») : pas de
    // blocage de la vente si les coupons sont indisponibles.
    return NextResponse.json({ success: true, coupons: [] });
  }
}
