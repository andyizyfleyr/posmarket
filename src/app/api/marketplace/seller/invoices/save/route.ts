import { NextRequest, NextResponse } from 'next/server';
import { saveInvoiceAction, type InvoiceInput } from '@/app/actions/invoices';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

interface SaveInvoiceBody {
  storeId?: string;
  invoice?: InvoiceInput;
}

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

    const body = (await req.json().catch(() => ({}))) as SaveInvoiceBody;

    const storeId = await resolveMobileStoreId(guard.userId, body.storeId || null);
    if (!storeId) {
      return NextResponse.json({ success: false, error: 'NoStore' });
    }
    if (!body.invoice) {
      return NextResponse.json({ success: false, error: 'MissingInvoice' });
    }

    const result = await saveInvoiceAction(body.invoice, storeId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/invoices/save error:', error);
    return NextResponse.json(
      { success: false, error: "Enregistrement impossible pour le moment." },
      { status: 500 },
    );
  }
}
