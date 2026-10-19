import { NextRequest, NextResponse } from 'next/server';
import { deleteOrderAction } from '@/app/actions/orders';
import { requireSellerSpace } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/seller/orders/delete  { id }
 *
 * Supprime une commande (icône corbeille du détail de commande web).
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const body = (await req.json().catch(() => ({}))) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'MissingOrder' });
    }

    const result = await deleteOrderAction(body.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/orders/delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Suppression impossible pour le moment.' },
      { status: 500 },
    );
  }
}
