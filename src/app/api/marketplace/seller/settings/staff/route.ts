import { NextRequest, NextResponse } from 'next/server';
import { addStaffAction, deleteStaffAction } from '@/app/actions/settings';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/seller/settings/staff
 *
 * Onglet Équipe (mêmes server actions que le web) :
 * - `{ action: 'add', storeId, staff: { email, role } }`
 * - `{ action: 'delete', id }`
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Requête invalide' });
    }

    const action = String((body as { action?: string }).action || '');

    if (action === 'add') {
      const storeId = await resolveMobileStoreId(
        guard.userId,
        (body as { storeId?: string }).storeId,
      );
      if (!storeId) {
        return NextResponse.json({ success: false, error: 'Boutique inconnue' });
      }
      const staff = (body as { staff?: { email?: string; role?: string } }).staff;
      const result = await addStaffAction(
        { email: staff?.email, role: staff?.role },
        storeId,
      );
      return NextResponse.json(result);
    }

    if (action === 'delete') {
      const id = String((body as { id?: string }).id || '');
      if (!id) {
        return NextResponse.json({ success: false, error: 'Membre introuvable' });
      }
      const result = await deleteStaffAction(id);
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: 'Action inconnue.' });
  } catch (error) {
    console.error('[API] seller/settings/staff error:', error);
    return NextResponse.json(
      { success: false, error: 'Opération impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
