import { NextResponse } from 'next/server';
import { fetchHomeMarketplaceData } from '@/app/actions/marketplace';
import { getHomepageLayout } from '@/lib/homepage-layout';

export const revalidate = 3600;

/**
 * GET /api/marketplace/home
 *
 * Catalogue allégé pour l'accueil mobile : boutiques + produits nécessaires
 * aux cartes (prix, image, stock, note, options/variantes). Les descriptions,
 * galeries et données de gestion ne sont pas incluses.
 */
export async function GET() {
  try {
    const [stores, homepage] = await Promise.all([
      fetchHomeMarketplaceData(),
      getHomepageLayout(),
    ]);
    return NextResponse.json(
      { success: true, stores, homepage },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
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
