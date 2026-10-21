import { NextRequest, NextResponse } from 'next/server';
import { submitCheckoutAction } from '@/app/actions/checkout';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/checkout
 *
 * Processes a marketplace order submitted from the mobile app.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orders, customer, idempotencyKey } = body;

    if (!orders || typeof orders !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Données de commande invalides' },
        { status: 400 },
      );
    }

    const result = await submitCheckoutAction(orders, customer, idempotencyKey);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] checkout error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la commande',
      },
      { status: 500 },
    );
  }
}
