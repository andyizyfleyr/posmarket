import { NextRequest, NextResponse } from 'next/server';
import { addStaffAction, deleteStaffAction } from '@/app/actions/settings';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerStaffSchema } from '@/lib/schemas';

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

    const parsed = await parseBody(req, sellerStaffSchema);
    if (!parsed.ok) return parsed.response;
    const { action } = parsed.data;

    if (action === 'add') {
      const storeId = await resolveMobileStoreId(guard.userId, parsed.data.storeId);
      if (!storeId) {
        return NextResponse.json({ success: false, error: 'Boutique inconnue' });
      }
      const staff = parsed.data.staff;
      const result = await addStaffAction(
        { email: staff?.email, role: staff?.role },
        storeId,
      );
      return NextResponse.json(result);
    }

    if (action === 'delete') {
      const id = parsed.data.id ?? '';
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
