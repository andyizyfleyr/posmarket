import { NextRequest, NextResponse } from 'next/server';
import { updateProfileAction } from '@/app/actions/settings';
import { requireSellerSpace } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/seller/settings/profile
 *
 * Onglet Profil — met à jour le profil de l'utilisateur connecté (nom,
 * avatar). Comme `SettingsView`, le clic sur une photo envoie un data-URI que
 * l'action serveur déplace vers R2.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Requête invalide' });
    }

    const fullName = String((body as { fullName?: unknown }).fullName ?? '');
    const avatarUrl = (body as { avatarUrl?: unknown }).avatarUrl;

    const payload: { fullName: string; avatarUrl?: string } = { fullName };
    // Comme au web : `avatarUrl` absent = pas de changement (aucune suppression
    // de photo dans cet écran) ; un data-URI est transporté tel quel.
    if (typeof avatarUrl === 'string' && avatarUrl) {
      payload.avatarUrl = avatarUrl;
    }

    const result = await updateProfileAction(guard.userId, payload);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/settings/profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Enregistrement impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
