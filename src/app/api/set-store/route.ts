import { NextRequest, NextResponse } from 'next/server';
import { setStoreCookie } from '@/utils/store-cookie';
import { parseBody } from '@/lib/validation';
import { sellerStoreIdSchema } from '@/lib/schemas';
import { requireStoreAccess } from '@/lib/authorization';
import { enforceSharedRateLimit } from '@/lib/api-rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/set-store
 *
 * Positionne la boutique active (cookie `currentStoreId`) pour l'utilisateur
 * connecté. Cette route ÉCRIT un état lié au compte : sans authentification,
 * n'importe quel visiteur pouvait changer la boutique courante d'une session
 * et provoquer des lectures incohérentes. L'accès à la boutique est donc
 * vérifié avec la même garde que les server actions (`requireStoreAccess`) :
 * propriétaire, membre d'équipe, ou super-admin.
 */
export async function POST(req: NextRequest) {
  try {
    const limited = await enforceSharedRateLimit(req, 'write');
    if (limited) return limited;

    const parsed = await parseBody(req, sellerStoreIdSchema);
    if (!parsed.ok) return parsed.response;

    const access = await requireStoreAccess(parsed.data.storeId);
    if (!access.ok) {
      // Message volontairement identique pour « non authentifié » et
      // « boutique non autorisée » : ne rien révéler sur l'existence d'une
      // boutique à un appelant non autorisé.
      return NextResponse.json({ success: false, error: 'Accès refusé.' }, { status: 403 });
    }

    await setStoreCookie(parsed.data.storeId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
