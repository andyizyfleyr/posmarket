/**
 * Onglet « Commandes » — cartes de commande au design partagé avec l'aperçu
 * « Mon compte » (voir `OrderCard`) : boutique + total, méta + statut,
 * liste des produits, avis et récommande.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Package, ShoppingBag } from 'lucide-react-native';
import { Button } from '@/components/Button';
import type { BuyerOrder } from '@/types';
import { EmptyState, PanelSkeleton } from '@/components/buyer/ui';
import { OrderCard, type ReviewTarget } from '@/components/buyer/OrderCard';
import { useReorder } from '@/hooks/useReorder';
import { COLORS } from '@/theme';

export type ReviewTargetProduct = ReviewTarget;

interface OrdersTabProps {
  orders: BuyerOrder[];
  loading: boolean;
  loadingMore: boolean;
  hasMoreOrders: boolean;
  onLoadMore: () => void;
  onReviewProduct: (product: ReviewTargetProduct, storeId: string) => void;
  onBrowse: () => void;
}

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
        icon={<Package size={20} color={COLORS.brand} />}
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
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          onReviewProduct={onReviewProduct}
          onReorder={() => void reorder(order)}
          reorderDisabled={pendingOrderId === order.id}
        />
      ))}

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
    gap: 10,
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
  loadMoreWrap: {
    paddingTop: 8,
    alignItems: 'center',
  },
  loadMoreBtn: {
    borderRadius: 999,
    paddingHorizontal: 32,
    borderColor: COLORS.lineStrong,
  },
  loadMoreText: {
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});

export default OrdersTab;
