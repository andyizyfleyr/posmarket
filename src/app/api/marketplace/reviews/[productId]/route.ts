import { NextRequest, NextResponse } from 'next/server';
import { fetchProductReviewsAction } from '@/app/actions/marketplace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/reviews/[productId]
 * 
 * Returns reviews for a specific product.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  if (!productId) {
    return NextResponse.json({ success: false, error: 'Missing productId', reviews: [] }, { status: 400 });
  }

  const result = await fetchProductReviewsAction(productId);
  return NextResponse.json(result);
}
