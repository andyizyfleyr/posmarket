import { NextRequest, NextResponse } from 'next/server';
import { createOrderAction } from '@/app/actions/orders';
import { requireSellerSpace } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerPosCheckoutSchema } from '@/lib/schemas';
import { enforceSharedRateLimit } from '@/lib/api-rate-limit';

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
    // Quota strict et partagé : l'encaissement POS touche au stock et au CA.
    const limited = await enforceSharedRateLimit(req, 'sensitive');
    if (limited) return limited;

    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = await parseBody(req, sellerPosCheckoutSchema);
    if (!parsed.ok) return parsed.response;

    const result = await createOrderAction(
      parsed.data.order as unknown as Parameters<typeof createOrderAction>[0],
      parsed.data.storeId,
    );
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
