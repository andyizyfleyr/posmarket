import { unstable_cache } from 'next/cache';
import { fetchFormattedOrders } from '@/db/api';

export const loadOrdersForStore = async (storeId: string, limit = 100) => {
  const getCached = unstable_cache(
    async (id: string) => fetchFormattedOrders(id, limit),
    ['store-orders', storeId, String(limit)],
    {
      tags: [`orders:${storeId}`],
      revalidate: 60,
    }
  );
  return getCached(storeId);
};
