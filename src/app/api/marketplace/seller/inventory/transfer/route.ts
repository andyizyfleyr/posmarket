import { NextRequest, NextResponse } from 'next/server';
import { transferProductsBetweenStoresAction } from '@/app/actions/inventory';
import { requireSellerSpace } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/** POST /api/marketplace/seller/inventory/transfer — copie/inter-boutiques. */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Requête invalide' });
    }

    const { targetStoreId, productIds, options } = body as {
      targetStoreId?: string;
      productIds?: string[];
      options?: Parameters<typeof transferProductsBetweenStoresAction>[3];
    };
    const sourceStoreId = (body as { sourceStoreId?: string }).sourceStoreId;

    if (!sourceStoreId || !targetStoreId) {
      return NextResponse.json({
        success: false,
        error: 'Veuillez sélectionner une boutique de destination.',
      });
    }

    const result = await transferProductsBetweenStoresAction(
      sourceStoreId,
      targetStoreId,
      productIds || [],
      options || { duplicateStrategy: 'skip', copyStock: false },
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/inventory/transfer error:', error);
    return NextResponse.json(
      { success: false, error: 'Transfert impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
