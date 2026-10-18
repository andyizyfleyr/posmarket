import { NextRequest, NextResponse } from 'next/server';
import { searchProductsAction } from '@/app/actions/marketplace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/search?q=...&limit=30
 * 
 * Full-text + trigram product search for the mobile app.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ success: true, products: [] });
  }

  const result = await searchProductsAction(q, limit);
  return NextResponse.json(result);
}
