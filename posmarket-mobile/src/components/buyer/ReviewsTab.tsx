/**
 * Onglet « Avis » — copie mobile de `src/components/buyer/ReviewsTab.tsx` du
 * web : carte par avis (boutique, produit, note, date, commentaire).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import type { BuyerReview } from '@/types';
import {
  EmptyState,
  PanelSkeleton,
  ProductNameLink,
  ProductThumb,
  StarRating,
  formatShortDate,
} from '@/components/buyer/ui';
import { COLORS } from '@/theme';

interface ReviewsTabProps {
  reviews: BuyerReview[];
  loading: boolean;
}

export const ReviewsTab: React.FC<ReviewsTabProps> = ({ reviews, loading }) => {
  if (loading && reviews.length === 0) return <PanelSkeleton rows={2} />;

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={<Star size={34} color="#D1D5DB" />}
        title="Aucun avis publié"
        subtitle="Après une commande, laissez un avis pour aider les autres acheteurs et les boutiques."
      />
    );
  }

  return (
    <View style={styles.list}>
      {reviews.map((rev) => {
        const product = rev.products?.[0];
        const storeName = rev.stores?.[0]?.name || 'Boutique';
        const dateLabel = formatShortDate(rev.date);
        return (
          <View key={rev.id} style={styles.card}>
            <View style={styles.head}>
              <ProductThumb src={product?.image} size={56} iconSize={22} />
              <View style={styles.headText}>
                <Text style={styles.store} numberOfLines={1}>
                  {storeName}
                </Text>
                <ProductNameLink product={product} style={styles.name} />
                <View style={styles.ratingRow}>
                  <StarRating value={rev.rating} size={13} />
                  {dateLabel ? <Text style={styles.date}>{dateLabel}</Text> : null}
                </View>
              </View>
            </View>
            <View style={styles.commentBox}>
              <Text style={styles.comment}>«{rev.comment}»</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  head: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  headText: {
    flex: 1,
    minWidth: 0,
  },
  store: {
    fontSize: 10,
    color: COLORS.brand,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.ink,
    letterSpacing: -0.2,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  date: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  commentBox: {
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  comment: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
    lineHeight: 20,
    fontStyle: 'italic',
  },
});

export default ReviewsTab;
