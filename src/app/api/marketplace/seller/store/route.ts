import { NextRequest, NextResponse } from 'next/server';
import {
  quickCreateStoreAction,
  quickDeleteStoreAction,
} from '@/app/actions/store';
import { updateStoreSettingsAction } from '@/app/actions/settings';
import { requireSellerSpace } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerStoreActionSchema } from '@/lib/schemas';
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

    const parsed = await parseBody(req, sellerStoreActionSchema);
    if (!parsed.ok) return parsed.response;
    const { action } = parsed.data;

    if (action === 'create') {
      const name = parsed.data.name ?? '';
      const businessType = parsed.data.businessType ?? 'shopping';
      if (!name) {
        return NextResponse.json({ success: false, error: 'Nom de boutique requis.' });
      }
      const result = await quickCreateStoreAction(name, businessType);
      return NextResponse.json(result);
    }

    if (action === 'delete') {
      const storeId = parsed.data.storeId ?? '';
      if (!storeId) {
        return NextResponse.json({ success: false, error: 'Boutique inconnue.' });
      }
      const result = await quickDeleteStoreAction(storeId);
      return NextResponse.json(result);
    }

    if (action === 'settings') {
      const storeId = parsed.data.storeId ?? '';
      const settings = parsed.data.settings as StoreSettings | undefined;
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
