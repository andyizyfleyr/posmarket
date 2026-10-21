import { NextRequest, NextResponse } from 'next/server';
import { searchProductsAction } from '@/app/actions/marketplace';
import { parseQuery } from '@/lib/validation';
import { searchQuerySchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/search?q=...&limit=30
 * 
 * Full-text + trigram product search for the mobile app.
 */
export async function GET(request: NextRequest) {
  const parsed = parseQuery(new URL(request.url), searchQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { q, limit } = parsed.data;

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ success: true, products: [] });
  }

  const result = await searchProductsAction(q, limit);
  return NextResponse.json(result);
}
