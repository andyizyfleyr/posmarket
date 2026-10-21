import { NextRequest, NextResponse } from 'next/server';
import {
  fetchBuyerReviewsAction,
  saveProductReviewAction,
} from '@/app/actions/marketplace';
import { requireBuyerSpace } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { buyerReviewSchema } from '@/lib/schemas';

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
    const parsed = await parseBody(req, buyerReviewSchema);
    if (!parsed.ok) return parsed.response;
    const { storeId, productId, rating, comment, author } = parsed.data;
    const result = await saveProductReviewAction(storeId, productId, {
      rating,
      comment,
      author,
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
