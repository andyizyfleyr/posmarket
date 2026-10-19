import { NextRequest, NextResponse } from 'next/server';
import { createOrderAction } from '@/app/actions/orders';
import { requireSellerSpace } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/seller/pos/checkout
 *
 * Encaissement du point de vente mobile — même action que le POS web
 * (`createOrderAction`) : contrôle d'accès à la boutique, insertion de la
 * commande et des lignes, ventes/stock, notification du propriétaire.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const body = (await req.json().catch(() => null)) as {
      storeId?: string;
      order?: Parameters<typeof createOrderAction>[0];
    } | null;

    if (!body?.storeId || !body.order) {
      return NextResponse.json({ success: false, error: 'Commande incomplète.' });
    }

    const result = await createOrderAction(body.order, body.storeId);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error });
    }

    return NextResponse.json({
      success: true,
      order: {
        id: result.order?.id,
        status: result.order?.status,
        total: Number(result.order?.total) || 0,
      },
    });
  } catch (error) {
    console.error('[API] seller/pos/checkout error:', error);
    return NextResponse.json(
      { success: false, error: "Erreur lors de l'enregistrement du paiement" },
      { status: 500 },
    );
  }
}
