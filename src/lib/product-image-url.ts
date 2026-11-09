/**
 * Les images produits sont stockées en base sous forme de data URL base64.
 * Les envoyer telles quelles dans le payload RSC fait exploser le HTML :
 * 141 produits = 16,6 Mo sur le dashboard et 21,3 Mo sur le POS.
 *
 * Ces helpers remplacent uniquement les data URLs par l'endpoint
 * `/api/products/{id}/image`, qui sert l'image à la demande. Les URLs
 * distantes (R2, CDN, ...) sont conservées telles quelles.
 */

export type ClientImageProduct = {
  id: string;
  image?: string | null;
  images?: unknown;
  createdAt?: Date | string | number | null;
  created_at?: Date | string | number | null;
};

function toImageUrl(
  product: ClientImageProduct,
  raw: unknown,
  index?: number,
): unknown {
  if (typeof raw !== 'string' || !raw.startsWith('data:image/')) return raw;

  const params = new URLSearchParams();
  if (typeof index === 'number') params.set('i', String(index));

  // `created_at` sert de version de cache : l'URL change si le produit est
  // recréé. Les images existantes n'ont pas d'updated_at.
  const created = product.createdAt ?? product.created_at;
  if (created) {
    const time = new Date(created).getTime();
    if (Number.isFinite(time)) params.set('v', String(time));
  }

  const query = params.toString();
  return `/api/products/${product.id}/image${query ? `?${query}` : ''}`;
}

export function toClientProduct<T extends ClientImageProduct>(product: T): T {
  const images = Array.isArray(product.images) ? product.images : [];
  const hasPrimary = typeof product.image === 'string' && product.image.length > 0;
  const primary = hasPrimary
    ? product.image
    : typeof images[0] === 'string'
      ? images[0]
      : undefined;

  return {
    ...product,
    image: toImageUrl(product, primary, hasPrimary ? undefined : 0) as string | undefined,
    images: images
      .map((raw, index) => toImageUrl(product, raw, index))
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  } as T;
}

export function toClientProducts<T extends ClientImageProduct>(products: T[]): T[] {
  return products.map(toClientProduct);
}

type ClientImageOrderItem = {
  product?: (ClientImageProduct & { id: string }) | null;
};

type ClientImageOrder = {
  items?: ClientImageOrderItem[] | null;
};

export function toClientOrder<T extends ClientImageOrder>(order: T): T {
  if (!Array.isArray(order.items)) return order;

  return {
    ...order,
    items: order.items.map((item) =>
      item?.product?.id
        ? { ...item, product: toClientProduct(item.product) }
        : item,
    ),
  } as T;
}

export function toClientOrders<T extends ClientImageOrder>(orders: T[]): T[] {
  return orders.map(toClientOrder);
}
