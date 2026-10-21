import { NextRequest, NextResponse } from 'next/server';
import { saveInvoiceAction, type InvoiceInput } from '@/app/actions/invoices';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerInvoiceSaveSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/seller/invoices/save  { storeId, invoice }
 *
 * Enregistre une facture et ses articles (modale « Nouvelle Facture » du web).
 * Reprend le bon chemin `saveInvoice` de `src/supabase-api.ts`, qui n'était
 * pas branché sur la page web.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = await parseBody(req, sellerInvoiceSaveSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const storeId = await resolveMobileStoreId(guard.userId, body.storeId || null);
    if (!storeId) {
      return NextResponse.json({ success: false, error: 'NoStore' });
    }
    if (!body.invoice) {
      return NextResponse.json({ success: false, error: 'MissingInvoice' });
    }

    const result = await saveInvoiceAction(
      body.invoice as unknown as InvoiceInput,
      storeId,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/invoices/save error:', error);
    return NextResponse.json(
      { success: false, error: "Enregistrement impossible pour le moment." },
      { status: 500 },
    );
  }
}
