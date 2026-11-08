import { unstable_cache } from 'next/cache';
import { fetchFormattedOrders } from '@/db/api';

export const loadOrdersForStore = async (storeId: string) => {
  const getCached = unstable_cache(
    async (id: string) => fetchFormattedOrders(id),
    ['store-orders', storeId],
    {
      tags: [`orders:${storeId}`],
      revalidate: 60,
    }
  );
  return getCached(storeId);
};
