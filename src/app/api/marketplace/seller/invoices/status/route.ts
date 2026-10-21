import { NextRequest, NextResponse } from 'next/server';
import { updateInvoiceStatusAction } from '@/app/actions/invoices';
import { requireSellerSpace } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerInvoiceStatusSchema } from '@/lib/schemas';

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

    const parsed = await parseBody(req, sellerInvoiceStatusSchema);
    if (!parsed.ok) return parsed.response;

    const result = await updateInvoiceStatusAction(
      parsed.data.invoiceId,
      parsed.data.status,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/invoices/status error:', error);
    return NextResponse.json(
      { success: false, error: 'Mise à jour impossible pour le moment.' },
      { status: 500 },
    );
  }
}
