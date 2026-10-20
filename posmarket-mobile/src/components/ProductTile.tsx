/**
 * ProductTile — carte produit compacte de la marketplace, inspirée de l'app
 * Android Alibaba : image carrée pleine largeur, titre fin sur une ligne,
 * ventes et note/avis, prix mis en avant. Toutes les cartes ont exactement la
 * même hauteur. L'ajout rapide reste accessible via un petit bouton « + »
 * posé sur l'image, sans augmenter la carte.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Package, Plus, Star } from 'lucide-react-native';
import { resolveImageUrl } from '@/api/client';
import { formatCurrency, formatNumber } from '@/utils';
import { COLORS } from '@/theme';
import type { StorefrontProduct } from '@/types';
import { useCart } from '@/context/CartContext';

interface ProductTileProps {
  product: StorefrontProduct;
  onPress?: (product: StorefrontProduct) => void;
}

export function ProductTile({ product, onPress }: ProductTileProps) {
  const { addToCart } = useCart();
  const [adding, setAdding] = useState(false);
  const imageUrl = resolveImageUrl(product.image);
  const isOutOfStock = product.stock <= 0;
  const hasOptions =
    (product.options?.length ?? 0) > 0 || (product.variants?.length ?? 0) > 0;

  const handleAdd = useCallback(() => {
    if (isOutOfStock || hasOptions) return;
    setAdding(true);
    addToCart(product, 1);
    setTimeout(() => setAdding(false), 600);
  }, [addToCart, product, isOutOfStock, hasOptions]);

  const handlePress = useCallback(() => {
    onPress?.(product);
  }, [onPress, product]);

  const discount =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(
          ((product.originalPrice - product.price) / product.originalPrice) *
            100,
        )
      : 0;

  const salesCount = product.salesCount ?? 0;
  const rating = product.rating ?? 0;
  const reviewCount = product.reviewCount ?? 0;
  const fullStars = Math.floor(rating);
  const hasStats = salesCount > 0 || rating > 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={handlePress}
    >
      <View style={styles.imageWrap}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={180}
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Package size={24} color={COLORS.textFaint} />
          </View>
        )}

        {discount > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discount}%</Text>
          </View>
        )}

        {isOutOfStock ? (
          <View style={styles.outOfStockBadge}>
            <Text style={styles.outOfStockText}>Rupture</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.quickAdd,
              pressed && styles.quickAddPressed,
            ]}
            onPress={hasOptions ? handlePress : handleAdd}
            disabled={adding}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={
              hasOptions ? 'Choisir les options' : 'Ajouter au panier'
            }
          >
            {({ pressed }) =>
              adding ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.brand}
                  style={styles.quickAddSpinner}
                />
              ) : (
                <Plus
                  size={12}
                  strokeWidth={2.6}
                  color={pressed ? '#FFFFFF' : '#111827'}
                />
              )
            }
          </Pressable>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>

        <View style={styles.statsRow}>
          {salesCount > 0 ? (
            <Text style={styles.salesText} numberOfLines={1}>
              {formatNumber(salesCount)} vendu{salesCount > 1 ? 's' : ''}
            </Text>
          ) : null}

          {salesCount > 0 && rating > 0 ? (
            <View style={styles.statsDivider} />
          ) : null}

          {rating > 0 ? (
            <View style={styles.ratingGroup}>
              <View style={styles.stars}>
                {[0, 1, 2, 3, 4].map((index) => (
                  <Star
                    key={index}
                    size={9}
                    strokeWidth={2}
                    color={index < fullStars ? '#EAB308' : '#D1D5DB'}
                    fill={index < fullStars ? '#EAB308' : 'none'}
                  />
                ))}
              </View>
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              {reviewCount > 0 ? (
                <Text style={styles.reviewText}>
                  ({formatNumber(reviewCount)})
                </Text>
              ) : null}
            </View>
          ) : null}

          {!hasStats ? <Text style={styles.newText}>Nouveau</Text> : null}
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price} numberOfLines={1}>
            {formatCurrency(product.price)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  cardPressed: {
    opacity: 0.88,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    backgroundColor: '#EF4444',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  outOfStockBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    backgroundColor: 'rgba(17, 24, 39, 0.86)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  outOfStockText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  quickAdd: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#EEF0F3',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  quickAddSpinner: {
    transform: [{ scale: 0.65 }],
  },
  quickAddPressed: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
  },
  info: {
    paddingTop: 6,
    paddingHorizontal: 1,
    paddingBottom: 1,
  },
  name: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: '#1F2937',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 14,
    marginTop: 2,
    overflow: 'hidden',
  },
  salesText: {
    flexShrink: 1,
    fontSize: 9.5,
    color: '#6B7280',
  },
  statsDivider: {
    width: 1,
    height: 9,
    marginHorizontal: 5,
    backgroundColor: '#D1D5DB',
  },
  ratingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  stars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  ratingText: {
    marginLeft: 3,
    fontSize: 9.5,
    fontWeight: '600',
    color: '#4B5563',
  },
  reviewText: {
    marginLeft: 2,
    fontSize: 9,
    color: '#9CA3AF',
  },
  newText: {
    fontSize: 9.5,
    color: '#9CA3AF',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    height: 19,
    marginTop: 3,
  },
  price: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
});
