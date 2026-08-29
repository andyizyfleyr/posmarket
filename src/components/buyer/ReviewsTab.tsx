'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { BuyerReview } from './accountTypes';
import {
  EmptyState,
  PanelSkeleton,
  ProductThumb,
  StarRating,
} from './accountUtils';

interface ReviewsTabProps {
  reviews: BuyerReview[];
  loading: boolean;
}

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
    <div className="space-y-3">
      {reviews.map((rev) => {
        const product = rev.products?.[0];
        const storeName = rev.stores?.[0]?.name || 'Boutique';
        return (
          <div
            key={rev.id}
            className="bg-white p-4 rounded-[24px] border border-gray-100 shadow-sm"
          >
            <div className="flex gap-4 mb-3">
              <ProductThumb src={product?.image} alt={product?.name} className="w-14 h-14" sizes="56px" iconSize={22} />
              <div className="flex-1 min-w-0">
                <p className="text-[9px] text-[#f56b2a] font-black uppercase tracking-wider truncate">
                  {storeName}
                </p>
                <p className="text-sm font-black text-[#002f34] truncate">{product?.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <StarRating value={rev.rating} size={13} />
                  {rev.date && (
                    <span className="text-[9px] text-gray-400 font-bold">
                      {new Date(rev.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-gray-50/60 p-4 rounded-[20px]">
              <p className="text-xs font-bold text-gray-600 leading-relaxed italic">
                «{rev.comment}»
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};