import { NextRequest, NextResponse } from 'next/server';
import { fetchProductReviewsAction } from '@/app/actions/marketplace';
import { parseParams } from '@/lib/validation';
import { pathProductIdSchema } from '@/lib/schemas';

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
  const parsed = parseParams(await params, pathProductIdSchema);
  if (!parsed.ok) return parsed.response;
  const { productId } = parsed.data;

  const result = await fetchProductReviewsAction(productId);
  return NextResponse.json(result);
}
