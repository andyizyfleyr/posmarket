'use client';

import React from 'react';
import { Package, Star, ShoppingBag } from 'lucide-react';
import Button from '@/components/Button';
import { formatCurrency } from '@/utils';
import { BuyerOrder } from './accountTypes';
import {
  EmptyState,
  PanelSkeleton,
  ProductThumb,
  StatusBadge,
} from './accountUtils';

export type ReviewTargetProduct = {
  id: string;
  name: string;
  image: string;
  business_type?: string;
};

interface OrdersTabProps {
  orders: BuyerOrder[];
  loading: boolean;
  loadingMore: boolean;
  hasMoreOrders: boolean;
  onLoadMore: () => void;
  onReviewProduct: (product: ReviewTargetProduct, storeId: string) => void;
  onBrowse: () => void;
}

const formatDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

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
            className="rounded-full px-6 text-[10px] font-black uppercase tracking-widest"
          >
            Découvrir les boutiques
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const storeName = order.stores?.[0]?.name || 'Boutique';
        const businessType = orderBusinessType(order);
        const dateLabel = formatDate(order.date);
        return (
          <div
            key={order.id}
            className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="p-4 border-b border-gray-50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
                  <Package size={18} className="text-[#f56b2a]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider truncate">
                    {order.id ? `#${order.id.slice(-6)}` : 'Commande'}
                    {dateLabel ? ` • ${dateLabel}` : ''}
                  </p>
                  <p className="text-sm font-black text-[#002f34] truncate">{storeName}</p>
                </div>
              </div>
              <StatusBadge status={order.status} businessType={businessType} />
            </div>

            <div className="p-4 space-y-3">
              {order.order_items?.map((item, idx) => {
                const product = item.products?.[0];
                return (
                  <div
                    key={item.id || `${order.id}-unit-${idx}`}
                    className="flex items-center gap-3"
                  >
                    <ProductThumb src={product?.image} alt={product?.name} className="w-12 h-12" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-[#002f34] truncate">
                        {product?.name || 'Produit'}
                      </p>
                      <p className="text-[10px] text-gray-400 font-bold">
                        {item.quantity} × {formatCurrency(item.price)}
                      </p>
                    </div>
                    {product?.id && (
                      <button
                        onClick={() => onReviewProduct(product, order.store_id || '')}
                        className="shrink-0 w-9 h-9 flex items-center justify-center bg-orange-50 text-[#f56b2a] rounded-xl hover:bg-[#f56b2a] hover:text-white transition-all active:scale-90"
                        title={`Laisser un avis sur ${product.name}`}
                        aria-label={`Laisser un avis sur ${product.name}`}
                      >
                        <Star size={15} fill="currentColor" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-3 bg-gray-50/60 border-t border-gray-50 flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total</span>
              <span className="text-sm font-black text-[#002f34]">{formatCurrency(order.total)}</span>
            </div>
          </div>
        );
      })}

      {hasMoreOrders && (
        <div className="pt-2 flex justify-center">
          <Button
            onClick={onLoadMore}
            loading={loadingMore}
            variant="outline"
            size="sm"
            className="rounded-full px-8 text-[10px] font-black uppercase tracking-widest border-gray-200"
          >
            Afficher plus
          </Button>
        </div>
      )}
    </div>
  );
};