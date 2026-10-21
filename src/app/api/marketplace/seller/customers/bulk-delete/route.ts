import { NextRequest, NextResponse } from 'next/server';
import { bulkDeleteCustomersAction } from '@/app/actions/customers';
import { requireSellerSpace } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerIdsSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/seller/customers/bulk-delete  { ids }
 *
 * Suppression groupée des clients sélectionnés.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = await parseBody(req, sellerIdsSchema);
    if (!parsed.ok) return parsed.response;

    const result = await bulkDeleteCustomersAction(parsed.data.ids);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/customers/bulk-delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Suppression impossible pour le moment.' },
      { status: 500 },
    );
  }
}
