'use client';

import React from 'react';
import { Package, ShoppingBag } from 'lucide-react';
import Button from '@/components/Button';
import { BuyerOrder } from './accountTypes';
import { OrderCard, ReviewTargetProduct } from './OrderCard';
import { EmptyState, PanelSkeleton } from './accountUtils';

export type { ReviewTargetProduct };

interface OrdersTabProps {
  orders: BuyerOrder[];
  loading: boolean;
  loadingMore: boolean;
  hasMoreOrders: boolean;
  onLoadMore: () => void;
  onReviewProduct: (product: ReviewTargetProduct, storeId: string) => void;
  onBrowse: () => void;
  /** Callback « commander à nouveau ». */
  onReorder?: (order: BuyerOrder) => void;
  /** Commande en cours de remise au panier. */
  pendingOrderId?: string | null;
  /** Commande à mettre en évidence (lien profond). */
  highlightOrderId?: string | null;
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
  highlightOrderId = null,
}) => {
  if (loading && orders.length === 0) return <PanelSkeleton rows={3} />;

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<Package size={34} />}
        title="Aucune commande pour le moment"
        subtitle="Vos commandes validées apparaîtront ici avec leur statut de livraison."
        action={
          <Button
            variant="primary"
            size="sm"
            icon={<ShoppingBag size={14} />}
            onClick={onBrowse}
            className="rounded-full px-6 text-[10px] font-bold uppercase tracking-widest"
          >
            Découvrir les boutiques
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          onReviewProduct={onReviewProduct}
          onReorder={onReorder ? () => onReorder(order) : undefined}
          reorderDisabled={pendingOrderId === order.id}
          cardId={`order-${order.id}`}
          highlight={highlightOrderId === order.id}
        />
      ))}

      {hasMoreOrders && (
        <div className="pt-2 flex justify-center">
          <Button
            onClick={onLoadMore}
            loading={loadingMore}
            variant="outline"
            size="sm"
            className="rounded-full px-8 text-[10px] font-bold uppercase tracking-widest border-gray-200"
          >
            Afficher plus
          </Button>
        </div>
      )}
    </div>
  );
};

export default OrdersTab;
