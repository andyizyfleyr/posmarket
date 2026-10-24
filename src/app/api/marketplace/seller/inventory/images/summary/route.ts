import { NextRequest, NextResponse } from 'next/server';
import { requireSellerSpace } from '@/lib/mobile-space';
import { parseQuery } from '@/lib/validation';
import { sellerImagesQuerySchema } from '@/lib/schemas';
import {
  getStoreProductImagesSummary,
  resolveImagesTarget,
} from '@/lib/product-images-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/seller/inventory/images/summary?storeId=…&ids=a,b
 *
 * Compteurs affichés avant le téléchargement (produits concernés, photos
 * disponibles). Aucune image n'est lue : seuls des nombres sont renvoyés.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = parseQuery(new URL(req.url), sellerImagesQuerySchema);
    if (!parsed.ok) return parsed.response;

    const target = await resolveImagesTarget(guard.userId, parsed.data);
    if (!target.ok) {
      return NextResponse.json(
        { success: false, error: target.error },
        { status: target.status },
      );
    }

    const summary = await getStoreProductImagesSummary(
      target.storeId,
      target.productIds,
    );

    return NextResponse.json({
      success: true,
      storeId: target.storeId,
      storeName: target.storeName,
      ...summary,
    });
  } catch (error) {
    console.error('[API] seller/inventory/images/summary error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Impossible de compter les images pour le moment. Réessayez.',
      },
      { status: 500 },
    );
  }
}
