import { NextRequest, NextResponse } from 'next/server';
import { getInvoiceItemsAction } from '@/app/actions/invoices';
import { parseQuery } from '@/lib/validation';
import { invoiceItemsQuerySchema } from '@/lib/schemas';
import { requireSellerSpace } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/seller/invoices/items?invoiceId=...
 *
 * Articles d'une facture — équivalent de `fetchInvoiceItems`
 * (`useSupabaseData`), qui interroge Supabase côté client sur le web.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = parseQuery(new URL(req.url), invoiceItemsQuerySchema);
    if (!parsed.ok) return parsed.response;
    const { invoiceId } = parsed.data;

    const result = await getInvoiceItemsAction(invoiceId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/invoices/items error:', error);
    return NextResponse.json(
      { success: false, items: [], error: 'Chargement impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
