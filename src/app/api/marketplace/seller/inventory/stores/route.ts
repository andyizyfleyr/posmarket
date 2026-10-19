import { NextResponse } from 'next/server';
import { getUserManageableStoresAction } from '@/app/actions/inventory';
import { requireSellerSpace } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/** GET /api/marketplace/seller/inventory/stores — boutiques gérables (transfert). */
export async function GET() {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const result = await getUserManageableStoresAction();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/inventory/stores error:', error);
    return NextResponse.json(
      { success: false, stores: [], error: 'Chargement impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
