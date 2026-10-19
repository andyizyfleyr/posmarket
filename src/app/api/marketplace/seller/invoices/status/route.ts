import { NextRequest, NextResponse } from 'next/server';
import { updateInvoiceStatusAction } from '@/app/actions/invoices';
import { requireSellerSpace } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/seller/invoices/status  { invoiceId, status }
 *
 * Change le statut d'une facture (select « Statut » de la modale détail web).
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const body = (await req.json().catch(() => ({}))) as {
      invoiceId?: string;
      status?: string;
    };

    if (!body.invoiceId || !body.status) {
      return NextResponse.json({ success: false, error: 'MissingInvoice' });
    }

    const result = await updateInvoiceStatusAction(body.invoiceId, body.status);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/invoices/status error:', error);
    return NextResponse.json(
      { success: false, error: 'Mise à jour impossible pour le moment.' },
      { status: 500 },
    );
  }
}
