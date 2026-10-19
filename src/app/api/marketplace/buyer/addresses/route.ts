import { NextRequest, NextResponse } from 'next/server';
import {
  fetchBuyerAddressesAction,
  saveBuyerAddressAction,
  deleteBuyerAddressAction,
} from '@/app/actions/marketplace';
import { requireBuyerSpace } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/buyer/addresses?email=...&userId=...
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireBuyerSpace();
    if (!guard.ok) return guard.response;
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const fallback = userId || email;

    const result = await fetchBuyerAddressesAction(fallback);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] buyer/addresses error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement des adresses', addresses: [] },
      { status: 500 },
    );
  }
}

/**
 * POST /api/marketplace/buyer/addresses
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireBuyerSpace();
    if (!guard.ok) return guard.response;
    const body = await req.json();
    const result = await saveBuyerAddressAction(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] save buyer address error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l’enregistrement' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/marketplace/buyer/addresses?id=...&userId=...&email=...
 */
export async function DELETE(req: NextRequest) {
  try {
    const guard = await requireBuyerSpace();
    if (!guard.ok) return guard.response;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const email = searchParams.get('email') || undefined;
    const userId = searchParams.get('userId') || undefined;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID manquant' }, { status: 400 });
    }

    const result = await deleteBuyerAddressAction(id, userId || email);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] delete buyer address error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la suppression' },
      { status: 500 },
    );
  }
}
