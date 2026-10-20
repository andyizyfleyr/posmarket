import { NextResponse } from 'next/server';
import { fetchHomeMarketplaceData } from '@/app/actions/marketplace';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/**
 * GET /api/marketplace/home
 *
 * Catalogue allégé pour l'accueil mobile : boutiques + produits nécessaires
 * aux cartes (prix, image, stock, note, options/variantes). Les descriptions,
 * galeries et données de gestion ne sont pas incluses.
 */
export async function GET() {
  try {
    const stores = await fetchHomeMarketplaceData();
    return NextResponse.json(
      { success: true, stores },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (error) {
    console.error('[API] marketplace/home error:', error);
    return NextResponse.json(
      { success: false, error: "Erreur lors du chargement de l'accueil" },
      { status: 500 },
    );
  }
}
