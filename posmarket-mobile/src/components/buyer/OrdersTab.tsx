/**
 * Onglet « Commandes » — cartes de commande au design partagé avec l'aperçu
 * « Mon compte » (voir `OrderCard`) : boutique + total, méta + statut,
 * liste des produits, avis et récommande.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Package, ShoppingBag } from 'lucide-react-native';
import { Button } from '@/components/Button';
import type { BuyerOrder } from '@/types';
import { EmptyState, PanelSkeleton } from '@/components/buyer/ui';
import { OrderCard, type ReviewTarget } from '@/components/buyer/OrderCard';
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
  /** Remise au panier d'une commande déjà passée. */
  onReorder: (order: BuyerOrder) => void;
  /** Commande en cours de remise au panier. */
  pendingOrderId?: string | null;
  /** Commande à mettre en évidence (issue de l'aperçu). */
  targetOrderId?: string | null;
  /** Jeton de surbrillance : relance l'animation à chaque nouvelle cible. */
  targetKey?: string | number;
  /**
   * Position de la commande ciblée, relative au haut de la liste.
   * L'écran parent l'utilise pour scroller jusqu'à la bonne commande.
   */
  onTargetOffset?: (offset: number) => void;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  orders,
  loading,
  loadingMore,
  hasMoreOrders,
  onLoadMore,
  onReviewProduct,
  onBrowse,
  onReorder,
  pendingOrderId = null,
  targetOrderId,
  targetKey,
  onTargetOffset,
}) => {
  /** Décalage vertical de chaque carte dans la liste. */
  const cardOffsets = useRef<Record<string, number>>({});
  const listOffset = useRef(0);
  const notified = useRef<string | null>(null);
  // Incrémenté à chaque mesure : relance l'effet de ciblage.
  const [measureTick, setMeasureTick] = useState(0);

  const handleListLayout = useCallback((event: LayoutChangeEvent) => {
    listOffset.current = event.nativeEvent.layout.y;
    setMeasureTick((tick) => tick + 1);
  }, []);

  const handleCardLayout = useCallback(
    (orderId: string) => (event: LayoutChangeEvent) => {
      cardOffsets.current[orderId] = event.nativeEvent.layout.y;
      setMeasureTick((tick) => tick + 1);
    },
    [],
  );

  // Une fois la mesure connue, on signale la position de la cible.
  useEffect(() => {
    if (!targetOrderId || !onTargetOffset) return;
    const token = `${targetOrderId}#${targetKey ?? ''}`;
    if (notified.current === token) return;
    const cardOffset = cardOffsets.current[targetOrderId];
    if (cardOffset === undefined) return;
    notified.current = token;
    // Position de la carte par rapport au haut de la section.
    onTargetOffset(listOffset.current + cardOffset);
  }, [targetOrderId, targetKey, onTargetOffset, orders, measureTick]);

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
    <View style={styles.list} onLayout={handleListLayout}>
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          onReviewProduct={onReviewProduct}
          onReorder={() => onReorder(order)}
          reorderDisabled={pendingOrderId === order.id}
          highlight={order.id === targetOrderId}
          highlightKey={targetKey}
          onLayout={handleCardLayout(order.id)}
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
