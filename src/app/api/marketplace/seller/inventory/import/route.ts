import { NextRequest, NextResponse } from 'next/server';
import { importProductsBatchAction } from '@/app/actions/inventory';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/** POST /api/marketplace/seller/inventory/import — import groupé CSV/JSON. */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Requête invalide' });
    }

    const {
      items,
      options,
    } = body as {
      items?: unknown[];
      options?: Parameters<typeof importProductsBatchAction>[2];
    };
    const storeId = await resolveMobileStoreId(
      guard.userId,
      (body as { storeId?: string }).storeId,
    );

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'NoStore' });
    }

    const result = await importProductsBatchAction(
      storeId,
      (items || []) as Parameters<typeof importProductsBatchAction>[1],
      options || { duplicateStrategy: 'skip' },
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/inventory/import error:', error);
    return NextResponse.json(
      { success: false, error: 'Import impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
