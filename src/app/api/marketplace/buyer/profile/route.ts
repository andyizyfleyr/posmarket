import { NextRequest, NextResponse } from 'next/server';
import {
  fetchBuyerProfileAction,
  updateBuyerProfileAction,
} from '@/app/actions/marketplace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/buyer/profile
 * Profil de l'acheteur connecté (nom, téléphone, photo).
 */
export async function GET() {
  try {
    const result = await fetchBuyerProfileAction();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] buyer/profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement du profil' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/marketplace/buyer/profile
 * Corps : `{ fullName?, phone?, avatarUrl? }` (avatarUrl : URL ou data-URI).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const updates: { fullName?: string; phone?: string; avatarUrl?: string | null } = {};
    if (typeof body?.fullName !== 'undefined') updates.fullName = String(body.fullName || '');
    if (typeof body?.phone !== 'undefined') updates.phone = String(body.phone || '');
    if (typeof body?.avatarUrl !== 'undefined') {
      updates.avatarUrl = body.avatarUrl === null ? null : String(body.avatarUrl || '');
    }
    const result = await updateBuyerProfileAction(updates);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] update buyer profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour du profil' },
      { status: 500 },
    );
  }
}
