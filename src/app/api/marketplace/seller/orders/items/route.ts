import { NextRequest, NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { orderItems, products } from '@/db/schema';
import { requireSellerSpace } from '@/lib/mobile-space';
import { parseQuery } from '@/lib/validation';
import { orderItemsQuerySchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/seller/orders/items?orderId=...
 *
 * Articles d'une commande avec leur produit (nom, prix, image, unité, paliers
 * de gros) — équivalent serveur de `fetchOrderItems` (`useSupabaseData`), qui
 * interroge Supabase côté client sur le web.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const parsed = parseQuery(new URL(req.url), orderItemsQuerySchema);
    if (!parsed.ok) return parsed.response;
    const { orderId } = parsed.data;

    const rows = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    const productIds = [
      ...new Set((rows || []).map((row) => row.productId).filter((id): id is string => Boolean(id))),
    ];

    let productsMap: Record<string, Record<string, unknown>> = {};
    if (productIds.length > 0) {
      const productRows = await db
        .select({
          id: products.id,
          name: products.name,
          price: products.price,
          image: products.image,
          businessType: products.businessType,
          mainCategory: products.mainCategory,
          unit: products.unit,
          wholesalePrice: products.wholesalePrice,
          wholesaleMinQty: products.wholesaleMinQty,
          wholesaleTiers: products.wholesaleTiers,
        })
        .from(products)
        .where(inArray(products.id, productIds));

      productsMap = Object.fromEntries(
        (productRows || []).map((p) => [
          p.id,
          {
            id: p.id,
            name: p.name,
            price: parseFloat(p.price ?? '') || 0,
            image: p.image,
            businessType: p.businessType,
            mainCategory: p.mainCategory,
            unit: p.unit || undefined,
            wholesalePrice: p.wholesalePrice ? Number(p.wholesalePrice) : undefined,
            wholesaleMinQty: p.wholesaleMinQty ? Number(p.wholesaleMinQty) : undefined,
            wholesaleTiers: (p.wholesaleTiers as Array<{ minQty: number; price: number }>) || [],
          },
        ]),
      );
    }

    return NextResponse.json({
      success: true,
      items: (rows || []).map((row) => ({
        ...row,
        product: row.productId ? productsMap[row.productId] : undefined,
      })),
    });
  } catch (error) {
    console.error('[API] seller/orders/items error:', error);
    return NextResponse.json(
      { success: false, items: [], error: 'Chargement impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
