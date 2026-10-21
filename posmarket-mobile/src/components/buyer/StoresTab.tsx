/**
 * Onglet « Boutiques » — liste des boutiques chez lesquelles l'acheteur a
 * déjà passé au moins une commande. Données dérivées des commandes.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ShoppingBag, Store } from 'lucide-react-native';
import { formatCurrency } from '@/utils';
import type { BuyerOrder } from '@/types';
import {
  EmptyState,
  PanelSkeleton,
  ProductThumb,
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
  totalSpent: number;
  lastOrderDate?: string;
}

export const StoresTab: React.FC<StoresTabProps> = ({ orders, loading }) => {
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
        existing.totalSpent += order.total || 0;
        const t = order.date ? new Date(order.date).getTime() : 0;
        const cur = existing.lastOrderDate ? new Date(existing.lastOrderDate).getTime() : 0;
        if (t > cur) existing.lastOrderDate = order.date;
      } else {
        map.set(id, {
          id,
          name,
          businessType,
          orderCount: 1,
          totalSpent: order.total || 0,
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
        icon={<Store size={24} color="#D1D5DB" />}
        title="Aucune boutique"
        subtitle="Les boutiques chez lesquelles vous avez commandé apparaîtront ici."
      />
    );
  }

  return (
    <View style={styles.list}>
      {stores.map((store) => (
        <Pressable
          key={store.id}
          onPress={() => {
            if (store.id) router.push(`/store/${encodeURIComponent(store.id)}`);
          }}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Voir la boutique ${store.name}`}
        >
          <View style={styles.cardHead}>
            <View style={styles.storeIcon}>
              <Store size={16} color={COLORS.brand} />
            </View>
            <View style={styles.storeText}>
              <Text style={styles.storeName} numberOfLines={1}>
                {store.name}
              </Text>
              {store.businessType ? (
                <Text style={styles.storeType} numberOfLines={1}>
                  {store.businessType === 'food' ? 'Restauration' : 'Boutique'}
                </Text>
              ) : null}
            </View>
            <View style={styles.chevron}>
              <ShoppingBag size={14} color="#9CA3AF" />
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{store.orderCount}</Text>
              <Text style={styles.statLabel}>
                commande{store.orderCount > 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatCurrency(store.totalSpent)}</Text>
              <Text style={styles.statLabel}>dépensé</Text>
            </View>
            {store.lastOrderDate ? (
              <>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValueSmall}>
                    {formatShortDate(store.lastOrderDate)}
                  </Text>
                  <Text style={styles.statLabel}>dernière</Text>
                </View>
              </>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  storeIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#6B7280',
    fontWeight: '500',
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.ink,
    fontVariant: ['tabular-nums'],
  },
  statValueSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.ink,
  },
  statLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#F3F4F6',
  },
});

export default StoresTab;