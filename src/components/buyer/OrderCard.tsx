'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { formatCurrency } from '@/utils';
import { BuyerOrder } from './accountTypes';
import {
  ProductNameLink,
  ProductThumb,
  StatusBadge,
} from './accountUtils';

export type ReviewTargetProduct = {
  id: string;
  name: string;
  image: string;
  business_type?: string;
};

interface OrderCardProps {
  order: BuyerOrder;
  /** Rend la zone cliquable (aperçu « Mon compte »). */
  onPress?: () => void;
  /** Callback d'avis produit (page Commandes). */
  onReviewProduct?: (product: ReviewTargetProduct, storeId: string) => void;
  /** Callback « commander à nouveau ». */
  onReorder?: () => void;
  /** Libellé du bouton de récommandation. */
  reorderLabel?: string;
  reorderDisabled?: boolean;
  /** Met la commande en évidence (lien profond vers une commande). */
  highlight?: boolean;
  /** Identifiant DOM, cible du défilement. */
  cardId?: string;
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

/**
 * Carte de commande — design unique partagé par l'aperçu « Mon compte » et la
 * page « Commandes ».
 *
 * Anatomie : boutique + statut / méta / liste des produits / total et
 * récommandation. Les actions (avis, recommander) restent optionnelles.
 */
export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onPress,
  onReviewProduct,
  onReorder,
  reorderLabel = 'Recommander',
  reorderDisabled = false,
  highlight = false,
  cardId,
}) => {
  const items = order.order_items || [];
  const storeName = order.stores?.[0]?.name || 'Boutique';
  const businessType = orderBusinessType(order);
  const articleCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const dateLabel = formatDate(order.date);

  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <p className="min-w-0 flex-1 truncate text-[13px] font-bold tracking-[-0.1px] text-gray-900">
          {storeName}
        </p>
        <StatusBadge status={order.status} businessType={businessType} />
      </div>

      <p className="mt-0.5 text-[10px] font-medium text-gray-400">
        {articleCount} article{articleCount > 1 ? 's' : ''}
        {dateLabel ? ` · ${dateLabel}` : ''}
      </p>

      <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 pb-3.5">
        {items.map((item, idx) => {
          const product = item.products?.[0];
          return (
            <div key={item.id || `${order.id}-unit-${idx}`} className="flex items-center gap-2">
              <ProductThumb
                src={product?.image}
                alt={product?.name}
                className="w-[26px] h-[26px] rounded-[8px]"
                sizes="26px"
                iconSize={11}
              />
              <div className="min-w-0 flex-1">
                <ProductNameLink
                  product={product}
                  className="text-[11px] font-medium text-gray-500"
                />
              </div>
              <span className="shrink-0 text-[10px] font-semibold tabular-nums text-gray-400">
                {item.quantity} × {formatCurrency(item.price)}
              </span>
              {onReviewProduct && product?.id ? (
                <button
                  type="button"
                  onClick={() => onReviewProduct(product, order.store_id || '')}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-brand transition-colors hover:bg-brand hover:text-white active:scale-90"
                  aria-label={`Laisser un avis sur ${product.name}`}
                  title={`Laisser un avis sur ${product.name}`}
                >
                  <Star size={10} fill="currentColor" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );

  /**
   * La zone cliquable et le bouton « recommander » sont frères, jamais
   * imbriqués : un bouton dans un lien déclencherait les deux actions.
   */
  const content = onPress ? (
    <button
      type="button"
      onClick={onPress}
      className="block w-full cursor-pointer p-3.5 text-left transition-opacity active:opacity-85"
    >
      {body}
    </button>
  ) : (
    <div className="p-3.5">{body}</div>
  );

  return (
    <div
      id={cardId}
      className={`overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm ${
        highlight ? 'animate-order-highlight' : ''
      }`}
    >
      {content}

      <div className="flex items-center justify-between gap-3 bg-gray-50/60 px-3.5 py-3">
        <div className="min-w-0 shrink">
          <p className="text-[9px] font-bold uppercase tracking-[0.6px] text-gray-400">Total</p>
          <p className="mt-0.5 text-[15px] font-extrabold tabular-nums tracking-[-0.2px] text-gray-900">
            {formatCurrency(order.total)}
          </p>
        </div>
        {onReorder ? (
          <button
            type="button"
            onClick={onReorder}
            disabled={reorderDisabled}
            className="shrink-0 rounded-full border border-brand px-2.5 py-1 text-[9px] font-bold tracking-[-0.1px] text-brand transition-colors hover:bg-brand hover:text-white active:scale-95 disabled:opacity-60"
            aria-label="Remettre cette commande au panier"
          >
            {reorderDisabled ? 'Ajout…' : reorderLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default OrderCard;
