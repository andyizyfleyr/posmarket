'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { BuyerReview } from './accountTypes';
import {
  EmptyState,
  PanelSkeleton,
  ProductThumb,
  ProductNameLink,
  StarRating,
} from './accountUtils';

interface ReviewsTabProps {
  reviews: BuyerReview[];
  loading: boolean;
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
 * Onglet « Mes avis » — un avis par carte : boutique, produit noté, date et
 * commentaire. Design aligné sur la carte de commande.
 */
export const ReviewsTab: React.FC<ReviewsTabProps> = ({ reviews, loading }) => {
  if (loading && reviews.length === 0) return <PanelSkeleton rows={2} />;

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={<Star size={34} />}
        title="Aucun avis publié"
        subtitle="Après une commande, laissez un avis pour aider les autres acheteurs et les boutiques."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {reviews.map((rev) => {
        const product = rev.products?.[0];
        const storeName = rev.stores?.[0]?.name || 'Boutique';
        const dateLabel = formatDate(rev.date);
        return (
          <div
            key={rev.id}
            className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <ProductThumb
                src={product?.image}
                alt={product?.name}
                className="w-10 h-10 rounded-xl"
                sizes="40px"
                iconSize={16}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[9px] font-bold uppercase tracking-[1px] text-brand">
                  {storeName}
                </p>
                <ProductNameLink
                  product={product}
                  className="text-[13px] font-bold tracking-[-0.1px] text-gray-900"
                />
                <div className="mt-0.5 flex items-center gap-2">
                  <StarRating value={rev.rating} size={11} />
                  {dateLabel ? (
                    <span className="text-[9px] font-medium text-gray-400">{dateLabel}</span>
                  ) : null}
                </div>
              </div>
            </div>

            {rev.comment ? (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="text-[10px] font-medium leading-[14px] text-gray-500">
                  {rev.comment}
                </p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export default ReviewsTab;
