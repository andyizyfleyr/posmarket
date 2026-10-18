import { NextResponse } from 'next/server';
import { fetchMarketplaceData } from '@/app/actions/marketplace';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

/**
 * GET /api/marketplace/catalog
 * 
 * Returns the full marketplace catalog (stores + products) for the mobile app.
 * This is the REST equivalent of the `fetchMarketplaceData` server action.
 */
export async function GET() {
  try {
    const stores = await fetchMarketplaceData();
    return NextResponse.json({ success: true, stores }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('[API] marketplace/catalog error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement du catalogue' },
      { status: 500 },
    );
  }
}
