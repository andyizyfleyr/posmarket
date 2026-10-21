/**
 * Onglet « Mes avis » — un avis par carte : boutique, produit noté, date et
 * commentaire. Design aligné sur la carte de commande.
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
        icon={<Star size={20} color={COLORS.brand} />}
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
              <ProductThumb src={product?.image} size={40} iconSize={16} />
              <View style={styles.headText}>
                <Text style={styles.store} numberOfLines={1}>
                  {storeName}
                </Text>
                <ProductNameLink
                  product={product}
                  style={styles.name}
                  containerStyle={styles.nameWrap}
                />
                <View style={styles.ratingRow}>
                  <StarRating value={rev.rating} size={11} />
                  {dateLabel ? <Text style={styles.date}>{dateLabel}</Text> : null}
                </View>
              </View>
            </View>

            {rev.comment ? (
              <View style={styles.commentBox}>
                <Text style={styles.comment} numberOfLines={4}>
                  {rev.comment}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  store: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.brand,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
    letterSpacing: -0.1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  date: {
    fontSize: 9,
    fontWeight: '500',
    color: COLORS.textFaint,
  },
  commentBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  comment: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
});

export default ReviewsTab;
