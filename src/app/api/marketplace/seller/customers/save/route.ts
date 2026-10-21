import { NextRequest, NextResponse } from 'next/server';
import { saveCustomerAction } from '@/app/actions/customers';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerCustomerSaveSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/seller/customers/save
 *
 * Crée ou met à jour un client (modale « Nouveau Client » / « Modifier Client »
 * du web, qui appelle `saveCustomerAction`).
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = await parseBody(req, sellerCustomerSaveSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // Le web retombe sur `customers[0].store_id` quand le contexte n'a pas
    // d'identifiant ; côté mobile le storeId est explicite ou déduit du profil.
    const storeId = await resolveMobileStoreId(guard.userId, body.storeId || null);
    if (!storeId) {
      return NextResponse.json({ success: false, error: 'NoStore' });
    }

    const result = await saveCustomerAction(
      {
        id: body.id,
        name: body.name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        address: body.address ?? null,
        totalSpent: body.totalSpent,
        ordersCount: body.ordersCount,
      },
      storeId,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/customers/save error:', error);
    return NextResponse.json(
      { success: false, error: 'Enregistrement impossible pour le moment.' },
      { status: 500 },
    );
  }
}
