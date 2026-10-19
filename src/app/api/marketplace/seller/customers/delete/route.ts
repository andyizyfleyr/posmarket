import { NextRequest, NextResponse } from 'next/server';
import { deleteCustomerAction } from '@/app/actions/customers';
import { requireSellerSpace } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/seller/customers/delete  { id }
 *
 * Supprime un client (confirmation de la liste web).
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const body = (await req.json().catch(() => ({}))) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'MissingCustomer' });
    }

    const result = await deleteCustomerAction(body.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/customers/delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Suppression impossible pour le moment.' },
      { status: 500 },
    );
  }
}
