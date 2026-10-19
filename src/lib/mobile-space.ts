import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/app/actions/session';
import {
  canAccessBuyerSpace,
  canAccessSellerSpace,
  resolveAccountAccess,
} from '@/utils/account-access';

/**
 * Gardes d'espace pour les routes API utilisées par l'application mobile.
 *
 * Les deux espaces s'excluent (`account-access.ts`) : les routes mobiles
 * appliquent donc le même aiguillage que les gardes serveur du web, mais
 * renvoient un refus JSON au lieu d'une redirection.
 *
 * `Forbidden` n'est PAS `Unauthorized` : côté app, une session valide qui
 * n'appartient pas au bon espace ne doit jamais être purgée.
 */

export type SpaceGuard =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

export async function requireSellerSpace(): Promise<SpaceGuard> {
  const { user } = await getCurrentSession();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Unauthorized' }),
    };
  }
  const access = await resolveAccountAccess(user.id);
  if (!canAccessSellerSpace(access.space)) {
    return {
      ok: false,
      response: NextResponse.json({
        success: false,
        error: 'Forbidden',
        space: access.space,
      }),
    };
  }
  return { ok: true, userId: user.id };
}

export async function requireBuyerSpace(): Promise<SpaceGuard> {
  const { user } = await getCurrentSession();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Unauthorized' }),
    };
  }
  const access = await resolveAccountAccess(user.id);
  if (!canAccessBuyerSpace(access.space)) {
    return {
      ok: false,
      response: NextResponse.json({
        success: false,
        error: 'Forbidden',
        space: access.space,
      }),
    };
  }
  return { ok: true, userId: user.id };
}
