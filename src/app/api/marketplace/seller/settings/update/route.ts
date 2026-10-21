import { NextRequest, NextResponse } from 'next/server';
import { createStoreAction, updateStoreSettingsAction } from '@/app/actions/settings';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerSettingsUpdateSchema } from '@/lib/schemas';
import type { StoreSettings } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/seller/settings/update
 *
 * Enregistrement de l'onglet Boutique : met à jour la boutique courante, ou la
 * crée si l'utilisateur n'en possède aucune (mêmes server actions que le web).
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = await parseBody(req, sellerSettingsUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const settings = parsed.data.settings as StoreSettings | undefined;
    if (!settings) {
      return NextResponse.json({ success: false, error: 'Paramètres invalides.' });
    }

    const storeId = await resolveMobileStoreId(guard.userId, parsed.data.storeId);

    if (storeId) {
      const result = await updateStoreSettingsAction(storeId, settings);
      return NextResponse.json(result);
    }

    const result = await createStoreAction(settings, guard.userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/settings/update error:', error);
    return NextResponse.json(
      { success: false, error: 'Enregistrement impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
