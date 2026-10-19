import { NextRequest, NextResponse } from 'next/server';
import { fetchStoreData } from '@/app/actions/store';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/seller/invoices?storeId=...
 *
 * Données de la page « Factures » mobile — mêmes sources que
 * `src/app/(app)/invoices/page.tsx` : factures (100 max, sans tri), produits
 * (sélecteur d'articles de la modale de création) et boutique (réglages
 * affichés sur la facture). Les `numeric` (`subtotal`, `total`) sont
 * normalisés en nombres pour l'app.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const storeId = await resolveMobileStoreId(
      guard.userId,
      searchParams.get('storeId'),
    );

    if (!storeId) {
      return NextResponse.json({
        success: false,
        error: 'NoStore',
        invoices: [],
        products: [],
      });
    }

    const data = await fetchStoreData(storeId, undefined, {
      orders: false,
      customers: false,
    });

    if (!data.store) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden',
        invoices: [],
        products: [],
      });
    }

    return NextResponse.json({
      success: true,
      invoices: (data.invoices || []).map((invoice) => ({
        ...invoice,
        subtotal: Number(invoice.subtotal ?? 0) || 0,
        total: Number(invoice.total ?? 0) || 0,
      })),
      products: data.products,
      store: data.store,
    });
  } catch (error) {
    console.error('[API] seller/invoices error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Chargement impossible pour le moment. Réessayez.',
        invoices: [],
        products: [],
      },
      { status: 500 },
    );
  }
}
