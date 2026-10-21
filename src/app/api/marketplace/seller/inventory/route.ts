import { NextRequest, NextResponse } from 'next/server';
import { getProductsAction } from '@/app/actions/inventory';
import { getProductCategoryTree } from '@/app/actions/categories';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import { parseQuery } from '@/lib/validation';
import { inventoryQuerySchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/seller/inventory?storeId=...&offset=0&limit=10&search=
 *      &productType=all|pos|marketplace&businessType=all|shopping|food
 * GET /api/marketplace/seller/inventory?categories=1&businessType=shopping
 *
 * Liste paginée des produits (mêmes filtres que `InventoryView`) ou arbre de
 * catégories de la modale produit (`getProductCategoryTree`).
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = parseQuery(new URL(req.url), inventoryQuerySchema);
    if (!parsed.ok) return parsed.response;
    const { categories, businessType, offset, limit, search, productType } = parsed.data;

    // Taxonomie produit (modale produit) — ne dépend pas de la boutique.
    if (categories === '1') {
      const tree = await getProductCategoryTree(
        businessType === 'all' ? 'shopping' : businessType,
      );
      return NextResponse.json({ success: true, tree });
    }

    const storeId = await resolveMobileStoreId(guard.userId, parsed.data.storeId);

    if (!storeId) {
      return NextResponse.json({
        success: false,
        error: 'NoStore',
        products: [],
        hasMore: false,
        total: 0,
      });
    }

    const result = await getProductsAction(storeId, offset, limit, search, {
      productType: productType as 'all' | 'pos' | 'marketplace',
      businessType: businessType as 'all' | 'shopping' | 'food',
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/inventory error:', error);
    return NextResponse.json(
      {
        success: false,
        products: [],
        hasMore: false,
        total: 0,
        error: 'Chargement impossible pour le moment. Réessayez.',
      },
      { status: 500 },
    );
  }
}
