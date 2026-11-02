import { NextRequest, NextResponse } from 'next/server';
import { importProductsBatchAction } from '@/app/actions/inventory';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { sellerInventoryImportSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * L'import crée les produits un par un, avec un aller-retour par catégorie.
 * Sur un plan où le défaut est de 10 s, une cinquantaine de produits suffit à
 * dépasser le délai : la fonction est tuée et la plateforme renvoie sa propre
 * page d'erreur, que le client ne sait pas interpréter. Le message affiché
 * devient alors « An unexpected response was received from the server »,
 * sans rapport apparent avec la vraie cause.
 *
 * Les crons du projet déclarent déjà 60 s pour la même raison.
 */
export const maxDuration = 60;

/** POST /api/marketplace/seller/inventory/import — import groupé CSV/JSON. */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = await parseBody(req, sellerInventoryImportSchema);
    if (!parsed.ok) return parsed.response;
    const { items, options } = parsed.data;
    const storeId = await resolveMobileStoreId(guard.userId, parsed.data.storeId);

    if (!storeId) {
      return NextResponse.json({ success: false, error: 'NoStore' });
    }

    const result = await importProductsBatchAction(
      storeId,
      (items || []) as unknown as Parameters<typeof importProductsBatchAction>[1],
      (options || { duplicateStrategy: 'skip' }) as Parameters<
        typeof importProductsBatchAction
      >[2],
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] seller/inventory/import error:', error);
    return NextResponse.json(
      { success: false, error: 'Import impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
