/**
 * Onglet « Commandes » — copie mobile de
 * `src/components/buyer/OrdersTab.tsx` du web : cartes de commande, statut,
 * lignes produit avec vignette, bouton d'avis et total.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Package, RotateCcw, ShoppingBag, Star } from 'lucide-react-native';
import { Button } from '@/components/Button';
import { formatCurrency } from '@/utils';
import type { BuyerOrder } from '@/types';
import {
  EmptyState,
  PanelSkeleton,
  ProductNameLink,
  ProductThumb,
  StatusBadge,
  formatShortDate,
} from '@/components/buyer/ui';
import { useReorder } from '@/hooks/useReorder';
import { COLORS } from '@/theme';

export interface ReviewTargetProduct {
  id: string;
  name: string;
  image: string;
  business_type?: string;
}

interface OrdersTabProps {
  orders: BuyerOrder[];
  loading: boolean;
  loadingMore: boolean;
  hasMoreOrders: boolean;
  onLoadMore: () => void;
  onReviewProduct: (product: ReviewTargetProduct, storeId: string) => void;
  onBrowse: () => void;
}

const orderBusinessType = (order: BuyerOrder): string | undefined =>
  order.stores?.[0]?.business_type ||
  order.order_items?.[0]?.products?.[0]?.business_type;

export const OrdersTab: React.FC<OrdersTabProps> = ({
  orders,
  loading,
  loadingMore,
  hasMoreOrders,
  onLoadMore,
  onReviewProduct,
  onBrowse,
}) => {
  const { reorder, pendingOrderId } = useReorder();

  if (loading && orders.length === 0) return <PanelSkeleton rows={3} />;

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<Package size={24} color="#D1D5DB" />}
        title="Aucune commande pour le moment"
        subtitle="Vos commandes validées apparaîtront ici avec leur statut de livraison."
        action={
          <Button
            variant="primary"
            size="sm"
            icon={<ShoppingBag size={12} color="#FFFFFF" />}
            onPress={onBrowse}
            style={styles.browseBtn}
            textStyle={styles.browseText}
          >
            Découvrir les boutiques
          </Button>
        }
      />
    );
  }

  return (
    <View style={styles.list}>
      {orders.map((order) => {
        const storeName = order.stores?.[0]?.name || 'Boutique';
        const businessType = orderBusinessType(order);
        const dateLabel = formatShortDate(order.date);
        return (
          <View key={order.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.orderIcon}>
                  <Package size={14} color={COLORS.brand} />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.orderRef} numberOfLines={1}>
                    {order.id ? `#${order.id.slice(-6)}` : 'Commande'}
                    {dateLabel ? ` • ${dateLabel}` : ''}
                  </Text>
                  <Text style={styles.storeName} numberOfLines={1}>
                    {storeName}
                  </Text>
                </View>
              </View>
              <StatusBadge status={order.status} businessType={businessType} />
            </View>

            <View style={styles.items}>
              {order.order_items?.map((item, idx) => {
                const product = item.products?.[0];
                return (
                  <View key={item.id || `${order.id}-unit-${idx}`} style={styles.itemRow}>
                    <ProductThumb src={product?.image} size={32} iconSize={14} />
                    <View style={styles.itemText}>
                      <ProductNameLink product={product} style={styles.itemName} />
                      <Text style={styles.itemMeta}>
                        {item.quantity} × {formatCurrency(item.price)}
                      </Text>
                      {item.variantLabel ? (
                        <Text style={styles.itemVariant}>{item.variantLabel}</Text>
                      ) : null}
                    </View>
                    {product?.id ? (
                      <Pressable
                        onPress={() => onReviewProduct(product, order.store_id || '')}
                        style={styles.reviewBtn}
                        accessibilityLabel={`Laisser un avis sur ${product.name}`}
                      >
                        <Star size={12} color={COLORS.brand} fill={COLORS.brand} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(order.total)}</Text>
            </View>

            <Pressable
              onPress={() => void reorder(order)}
              disabled={pendingOrderId === order.id}
              style={({ pressed }) => [
                styles.reorderBtn,
                pressed && styles.pressed,
                pendingOrderId === order.id && styles.disabled,
              ]}
              accessibilityLabel="Remettre cette commande au panier"
            >
              <RotateCcw size={12} color={COLORS.brand} />
              <Text style={styles.reorderText}>
                {pendingOrderId === order.id ? 'Ajout…' : 'Commander à nouveau'}
              </Text>
            </Pressable>
          </View>
        );
      })}

      {hasMoreOrders && (
        <View style={styles.loadMoreWrap}>
          <Button
            onPress={onLoadMore}
            loading={loadingMore}
            variant="outline"
            size="sm"
            style={styles.loadMoreBtn}
            textStyle={styles.loadMoreText}
          >
            Afficher plus
          </Button>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  browseBtn: {
    borderRadius: 999,
    paddingHorizontal: 24,
  },
  browseText: {
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  orderIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  orderRef: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  storeName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
    letterSpacing: -0.1,
    marginTop: 1,
  },
  items: {
    padding: 12,
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemText: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
    letterSpacing: -0.1,
  },
  itemMeta: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 1,
  },
  itemVariant: {
    fontSize: 10,
    color: COLORS.brand,
    fontWeight: '700',
    marginTop: 1,
  },
  reviewBtn: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(249,250,251,0.6)',
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    margin: 10,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: COLORS.brandSoft,
    borderWidth: 1,
    borderColor: 'rgba(245,107,42,0.20)',
  },
  reorderText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.brand,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.6,
  },
  totalLabel: {
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.2,
  },
  loadMoreWrap: {
    paddingTop: 8,
    alignItems: 'center',
  },
  loadMoreBtn: {
    borderRadius: 999,
    paddingHorizontal: 32,
    borderColor: '#E5E7EB',
  },
  loadMoreText: {
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});

export default OrdersTab;
