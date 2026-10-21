/**
 * Onglet « Boutiques suivies » — les boutiques chez lesquelles l'acheteur a
 * déjà commandé au moins une fois.
 *
 * Les commandes ne donnent que le nom de la boutique : le catalogue est
 * interrogé pour retrouver le logo réel, la slug et le type d'activité.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Store } from 'lucide-react-native';
import { fetchCatalog, resolveImageUrl } from '@/api/client';
import type { BuyerOrder, StoreData } from '@/types';
import {
  EmptyState,
  PanelSkeleton,
  formatShortDate,
} from '@/components/buyer/ui';
import { COLORS } from '@/theme';

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

export const StoresTab: React.FC<StoresTabProps> = ({ orders, loading }) => {
  // Catalogue : sert uniquement aux logos et aux slugs.
  const catalogQuery = useQuery({
    queryKey: ['catalog'],
    queryFn: fetchCatalog,
    staleTime: 60_000,
  });

  const storeById = useMemo(() => {
    const map = new Map<string, StoreData>();
    for (const store of catalogQuery.data?.stores || []) {
      map.set(store.id, store);
    }
    return map;
  }, [catalogQuery.data]);

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
        icon={<Store size={20} color={COLORS.brand} />}
        title="Aucune boutique suivie"
        subtitle="Les boutiques chez lesquelles vous avez commandé apparaîtront ici."
      />
    );
  }

  return (
    <View style={styles.list}>
      {stores.map((store) => {
        const catalogStore = storeById.get(store.id);
        const logo = catalogStore?.settings?.logo
          ? resolveImageUrl(catalogStore.settings.logo as string)
          : '';
        const slug = catalogStore?.slug || store.id;
        const businessType =
          catalogStore?.business_type ||
          catalogStore?.settings?.businessType ||
          store.businessType;
        return (
          <Pressable
            key={store.id}
            onPress={() => router.push(`/store/${encodeURIComponent(slug)}` as never)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Voir la boutique ${store.name}`}
          >
            <View style={styles.cardHead}>
              <View style={styles.logoBox}>
                {logo ? (
                  <Image
                    source={{ uri: logo }}
                    style={styles.logo}
                    contentFit="cover"
                    transition={150}
                    alt=""
                  />
                ) : (
                  <Store size={16} color={COLORS.brand} />
                )}
              </View>
              <View style={styles.storeText}>
                <Text style={styles.storeName} numberOfLines={1}>
                  {store.name}
                </Text>
                <Text style={styles.storeType} numberOfLines={1}>
                  {businessType === 'food' ? 'Restauration' : 'Boutique'} ·{' '}
                  {store.orderCount} commande{store.orderCount > 1 ? 's' : ''}
                </Text>
              </View>
              <ChevronRight size={16} color="#D1D5DB" />
            </View>

            {store.lastOrderDate ? (
              <View style={styles.foot}>
                <Text style={styles.footText} numberOfLines={1}>
                  Dernière commande le {formatShortDate(store.lastOrderDate)}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
  },
  pressed: {
    opacity: 0.85,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  storeText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  storeName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
    letterSpacing: -0.1,
  },
  storeType: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  foot: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  footText: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textFaint,
  },
});

export default StoresTab;
