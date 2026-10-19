import { NextRequest, NextResponse } from 'next/server';
import {
  fetchBuyerReviewsAction,
  saveProductReviewAction,
} from '@/app/actions/marketplace';
import { requireBuyerSpace } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/buyer/reviews
 * Avis publiés par l'acheteur connecté.
 */
export async function GET() {
  try {
    const guard = await requireBuyerSpace();
    if (!guard.ok) return guard.response;
    const result = await fetchBuyerReviewsAction();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] buyer/reviews error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement des avis', reviews: [] },
      { status: 500 },
    );
  }
}

/**
 * POST /api/marketplace/buyer/reviews
 * Corps : `{ storeId, productId, rating, comment, author? }`.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireBuyerSpace();
    if (!guard.ok) return guard.response;
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const storeId = String(body?.storeId || '').trim();
    const productId = String(body?.productId || '').trim();
    if (!storeId || !productId) {
      return NextResponse.json({ success: false, error: 'Produit ou boutique manquant.' });
    }
    const result = await saveProductReviewAction(storeId, productId, {
      rating: Number(body?.rating) || 0,
      comment: String(body?.comment || '').trim(),
      author: String(body?.author || '').trim(),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] save buyer review error:', error);
    return NextResponse.json(
      { success: false, error: "Erreur lors de la publication de l'avis" },
      { status: 500 },
    );
  }
}
