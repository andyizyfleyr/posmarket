import { NextRequest, NextResponse } from 'next/server';
import { submitCheckoutAction } from '@/app/actions/checkout';
import { parseBody } from '@/lib/validation';
import { checkoutSchema } from '@/lib/schemas';
import { enforceSharedRateLimit } from '@/lib/api-rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/checkout
 *
 * Processes a marketplace order submitted from the mobile app.
 */
export async function POST(req: NextRequest) {
  try {
    // Quota strict et partagé : le checkout crée des commandes, il ne doit pas
    // être saturable (stock fantôme, notifications en boucle).
    const limited = await enforceSharedRateLimit(req, 'sensitive');
    if (limited) return limited;

    const parsed = await parseBody(req, checkoutSchema);
    if (!parsed.ok) return parsed.response;
    const { orders, customer, idempotencyKey } = parsed.data;

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
