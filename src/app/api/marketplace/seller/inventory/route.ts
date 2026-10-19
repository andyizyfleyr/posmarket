import { NextRequest, NextResponse } from 'next/server';
import { getProductsAction } from '@/app/actions/inventory';
import { getProductCategoryTree } from '@/app/actions/categories';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';

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

    const { searchParams } = new URL(req.url);

    // Taxonomie produit (modale produit) — ne dépend pas de la boutique.
    if (searchParams.get('categories') === '1') {
      const tree = await getProductCategoryTree(
        searchParams.get('businessType') || 'shopping',
      );
      return NextResponse.json({ success: true, tree });
    }

    const storeId = await resolveMobileStoreId(
      guard.userId,
      searchParams.get('storeId'),
    );

    if (!storeId) {
      return NextResponse.json({
        success: false,
        error: 'NoStore',
        products: [],
        hasMore: false,
        total: 0,
      });
    }

    const offset = Number(searchParams.get('offset') || 0) || 0;
    const limit = Number(searchParams.get('limit') || 10) || 10;
    const search = searchParams.get('search') || '';
    const productType = (searchParams.get('productType') || 'all') as
      | 'all'
      | 'pos'
      | 'marketplace';
    const businessType = (searchParams.get('businessType') || 'all') as
      | 'all'
      | 'shopping'
      | 'food';

    const result = await getProductsAction(storeId, offset, limit, search, {
      productType,
      businessType,
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
