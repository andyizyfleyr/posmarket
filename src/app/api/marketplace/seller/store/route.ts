import { NextRequest, NextResponse } from 'next/server';
import {
  quickCreateStoreAction,
  quickDeleteStoreAction,
} from '@/app/actions/store';
import { updateStoreSettingsAction } from '@/app/actions/settings';
import { requireSellerSpace } from '@/lib/mobile-space';
import type { StoreSettings } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/seller/store
 *
 * Actions « boutique » de l'espace vendeur mobile (mêmes server actions que
 * le web, mêmes contrôles d'accès) :
 * - `{ action: 'create', name, businessType }`
 * - `{ action: 'delete', storeId }`
 * - `{ action: 'settings', storeId, settings }`
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const action = String(body?.action || '');

    if (action === 'create') {
      const name = String(body?.name || '').trim();
      const businessType = body?.businessType === 'food' ? 'food' : 'shopping';
      if (!name) {
        return NextResponse.json({ success: false, error: 'Nom de boutique requis.' });
      }
      const result = await quickCreateStoreAction(name, businessType);
      return NextResponse.json(result);
    }

    if (action === 'delete') {
      const storeId = String(body?.storeId || '');
      if (!storeId) {
        return NextResponse.json({ success: false, error: 'Boutique inconnue.' });
      }
      const result = await quickDeleteStoreAction(storeId);
      return NextResponse.json(result);
    }

    if (action === 'settings') {
      const storeId = String(body?.storeId || '');
      const settings = body?.settings as StoreSettings | undefined;
      if (!storeId || !settings || typeof settings !== 'object') {
        return NextResponse.json({ success: false, error: 'Paramètres invalides.' });
      }
      const result = await updateStoreSettingsAction(storeId, settings);
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: 'Action inconnue.' });
  } catch (error) {
    console.error('[API] seller/store error:', error);
    return NextResponse.json(
      { success: false, error: 'Opération impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
