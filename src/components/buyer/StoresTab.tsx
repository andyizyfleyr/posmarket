'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useNavigate } from '@/components/RouterPolyfill';
import { ChevronRight, Store as StoreIcon } from 'lucide-react';
import { fetchMarketplaceData } from '@/app/actions/marketplace';
import { needsNoOptimization } from '@/lib/imageOptimizer';
import { BuyerOrder } from './accountTypes';
import { EmptyState, PanelSkeleton } from './accountUtils';
import type { StoreData } from '@/types';

interface StoresTabProps {
  orders: BuyerOrder[];
  loading: boolean;
}

interface StoreEntry {
  id: string;
  name: string;
  businessType?: string;
  orderCount: number;
  lastOrderDate?: string;
}

const formatDate = (iso?: string): string => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

/**
 * Onglet « Mes boutiques » — les boutiques chez lesquelles l'acheteur a déjà
 * commandé au moins une fois.
 *
 * Les commandes ne donnent que le nom de la boutique : le catalogue est
 * interrogé pour retrouver le logo réel, le slug et le type d'activité.
 */
export const StoresTab: React.FC<StoresTabProps> = ({ orders, loading }) => {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<StoreData[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stores = (await fetchMarketplaceData()) as StoreData[];
        if (!cancelled) setCatalog(stores || []);
      } catch {
        /* le catalogue reste vide : les boutiques sont listées sans logo */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const storeById = useMemo(() => {
    const map = new Map<string, StoreData>();
    for (const store of catalog) map.set(store.id, store);
    return map;
  }, [catalog]);

  const stores = useMemo<StoreEntry[]>(() => {
    const map = new Map<string, StoreEntry>();
    for (const order of orders) {
      const id = order.store_id || order.stores?.[0]?.name || '';
      if (!id) continue;
      const name = order.stores?.[0]?.name || 'Boutique';
      const businessType = order.stores?.[0]?.business_type;
      const existing = map.get(id);
      if (existing) {
        existing.orderCount += 1;
        const t = order.date ? new Date(order.date).getTime() : 0;
        const cur = existing.lastOrderDate
          ? new Date(existing.lastOrderDate).getTime()
          : 0;
        if (t > cur) existing.lastOrderDate = order.date;
      } else {
        map.set(id, {
          id,
          name,
          businessType,
          orderCount: 1,
          lastOrderDate: order.date,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const ta = a.lastOrderDate ? new Date(a.lastOrderDate).getTime() : 0;
      const tb = b.lastOrderDate ? new Date(b.lastOrderDate).getTime() : 0;
      return tb - ta;
    });
  }, [orders]);

  if (loading && orders.length === 0) return <PanelSkeleton rows={3} />;

  if (stores.length === 0) {
    return (
      <EmptyState
        icon={<StoreIcon size={34} />}
        title="Aucune boutique suivie"
        subtitle="Les boutiques chez lesquelles vous avez commandé apparaîtront ici."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {stores.map((store) => {
        const catalogStore = storeById.get(store.id);
        const logo = catalogStore?.settings?.logo || '';
        const slug = catalogStore?.slug || store.id;
        const businessType =
          catalogStore?.business_type ||
          catalogStore?.settings?.businessType ||
          store.businessType;
        const lastOrderLabel = formatDate(store.lastOrderDate);
        return (
          <button
            key={store.id}
            type="button"
            onClick={() => navigate(`/store/${encodeURIComponent(slug)}`)}
            className="w-full cursor-pointer rounded-2xl border border-gray-100 bg-white p-3.5 text-left shadow-sm transition-all hover:border-gray-200 hover:shadow-md active:scale-[0.99]"
            aria-label={`Voir la boutique ${store.name}`}
          >
            <div className="flex items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[14px] bg-orange-50">
                {logo ? (
                  <Image
                    src={logo}
                    alt=""
                    fill
                    sizes="44px"
                    className="object-cover"
                    unoptimized={needsNoOptimization(logo)}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <StoreIcon size={16} className="text-brand" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold tracking-[-0.1px] text-gray-900">
                  {store.name}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-medium text-gray-500">
                  {businessType === 'food' ? 'Restauration' : 'Boutique'} ·{' '}
                  {store.orderCount} commande{store.orderCount > 1 ? 's' : ''}
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-gray-300" />
            </div>

            {lastOrderLabel ? (
              <div className="mt-3 border-t border-gray-100 pt-2.5">
                <p className="truncate text-[10px] font-medium text-gray-400">
                  Dernière commande le {lastOrderLabel}
                </p>
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};

export default StoresTab;
