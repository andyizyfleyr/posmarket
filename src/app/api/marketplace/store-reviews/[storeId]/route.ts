import { NextRequest, NextResponse } from 'next/server';
import { fetchStoreReviewsAction } from '@/app/actions/marketplace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/store-reviews/[storeId]
 *
 * Returns every review of a store (all of its products), with the author
 * avatar and the reviewed product name/image. Used by the mobile app's store
 * page « Avis » tab; the web app calls the same server action directly.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  if (!storeId) {
    return NextResponse.json(
      { success: false, error: 'Missing storeId', reviews: [] },
      { status: 400 },
    );
  }

  const result = await fetchStoreReviewsAction(storeId);
  return NextResponse.json(result);
}
