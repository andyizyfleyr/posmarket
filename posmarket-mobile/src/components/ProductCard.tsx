/**
 * ProductCard — Phase 3.1 du plan.
 * Transposition native du composant web ProductCard.
 * 3 états du bouton : « + Ajouter », « Choisir » (options), « Rupture ».
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Star, ShoppingCart } from 'lucide-react-native';
import { resolveImageUrl } from '@/api/client';
import { formatCurrency } from '@/utils';
import type { StorefrontProduct } from '@/types';
import { useCart } from '@/context/CartContext';

interface ProductCardProps {
  product: StorefrontProduct;
  onPress?: (product: StorefrontProduct) => void;
}

export function ProductCard({ product, onPress }: ProductCardProps) {
  const { addToCart } = useCart();
  const [adding, setAdding] = useState(false);
  const imageUrl = resolveImageUrl(product.image);
  const isOutOfStock = product.stock <= 0;
  const hasRequiredOptions =
    (product.options && product.options.length > 0) ||
    (product.variants && product.variants.length > 0);

  const handleAdd = useCallback(() => {
    if (isOutOfStock || hasRequiredOptions) return;
    setAdding(true);
    addToCart(product, 1);
    setTimeout(() => setAdding(false), 600);
  }, [addToCart, product, isOutOfStock, hasRequiredOptions]);

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

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={handlePress}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <ShoppingCart size={24} color="#9CA3AF" />
          </View>
        )}
        {discount > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discount}%</Text>
          </View>
        )}
        {isOutOfStock && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockText}>Rupture</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.storeName} numberOfLines={1}>
          {product.storeName}
        </Text>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>

        {/* Rating */}
        {(product.rating ?? 0) > 0 && (
          <View style={styles.ratingRow}>
            <Star size={12} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.ratingText}>
              {(product.rating ?? 0).toFixed(1)}
            </Text>
            {(product.reviewCount ?? 0) > 0 && (
              <Text style={styles.reviewCount}>
                ({product.reviewCount})
              </Text>
            )}
          </View>
        )}

        {/* Price */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatCurrency(product.price)}</Text>
          {product.originalPrice && product.originalPrice > product.price && (
            <Text style={styles.originalPrice}>
              {formatCurrency(product.originalPrice)}
            </Text>
          )}
        </View>

        {/* Add button */}
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            isOutOfStock && styles.addButtonDisabled,
            hasRequiredOptions && !isOutOfStock && styles.addButtonOptions,
            pressed && !isOutOfStock && styles.addButtonPressed,
          ]}
          onPress={hasRequiredOptions ? handlePress : handleAdd}
          disabled={isOutOfStock}
        >
          {adding ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text
              style={[
                styles.addButtonText,
                isOutOfStock && styles.addButtonTextDisabled,
              ]}
            >
              {isOutOfStock
                ? 'Rupture'
                : hasRequiredOptions
                  ? 'Choisir'
                  : '+ Ajouter'}
            </Text>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    margin: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F3F4F6',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#EF4444',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  discountText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  info: {
    padding: 10,
    gap: 3,
  },
  storeName: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 18,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
  },
  reviewCount: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  originalPrice: {
    fontSize: 11,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  addButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  addButtonPressed: {
    backgroundColor: '#1D4ED8',
    transform: [{ scale: 0.95 }],
  },
  addButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  addButtonOptions: {
    backgroundColor: '#7C3AED',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  addButtonTextDisabled: {
    color: '#FFF',
  },
});
