/**
 * ProductCard — transposition native fidèle du composant web
 * (src/components/ProductCard.tsx) : carte blanche à bord fin, badge remise
 * rouge, nom discret, prix en noir, bouton neutre qui devient orange à l'appui.
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
import { Plus, Star, ShoppingCart } from 'lucide-react-native';
import { resolveImageUrl } from '@/api/client';
import { formatCurrency } from '@/utils';
import { COLORS, RADIUS } from '@/theme';
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
      <View style={styles.imageWrap}>
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
              <ShoppingCart size={22} color={COLORS.textFaint} />
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
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.storeName} numberOfLines={1}>
          {product.storeName}
        </Text>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>

        {(product.rating ?? 0) > 0 && (
          <View style={styles.ratingRow}>
            <Star size={10} color={COLORS.warning} fill={COLORS.warning} />
            <Text style={styles.ratingText}>
              {(product.rating ?? 0).toFixed(1)}
            </Text>
            {(product.reviewCount ?? 0) > 0 && (
              <Text style={styles.reviewCount}>({product.reviewCount})</Text>
            )}
          </View>
        )}

        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatCurrency(product.price)}</Text>
          {product.originalPrice && product.originalPrice > product.price && (
            <Text style={styles.originalPrice}>
              {formatCurrency(product.originalPrice)}
            </Text>
          )}
        </View>
      </View>

      {/* Bouton — style web : neutre au repos, orange à l'appui */}
      <View style={styles.buttonWrap}>
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            isOutOfStock && styles.addButtonDisabled,
            pressed && !isOutOfStock && styles.addButtonPressed,
          ]}
          onPress={hasRequiredOptions ? handlePress : handleAdd}
          disabled={isOutOfStock || adding}
        >
          {({ pressed }) =>
            adding ? (
              <ActivityIndicator size="small" color={COLORS.brand} />
            ) : (
              <View style={styles.addButtonRow}>
                {!isOutOfStock && !hasRequiredOptions && (
                  <Plus
                    size={13}
                    strokeWidth={2.5}
                    color={pressed ? '#FFFFFF' : COLORS.text}
                  />
                )}
                <Text
                  style={[
                    styles.addButtonText,
                    isOutOfStock && styles.addButtonTextDisabled,
                    pressed && !isOutOfStock && styles.addButtonTextPressed,
                  ]}
                >
                  {isOutOfStock
                    ? 'Rupture'
                    : hasRequiredOptions
                      ? 'Choisir'
                      : 'Ajouter'}
                </Text>
              </View>
            )
          }
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.line,
    overflow: 'hidden',
    margin: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  cardPressed: {
    opacity: 0.92,
  },
  imageWrap: {
    padding: 4,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceMuted,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
  },
  discountBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: COLORS.danger,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  discountText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.40)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  info: {
    paddingHorizontal: 8,
    paddingTop: 2,
    gap: 2,
    flexGrow: 1,
  },
  storeName: {
    fontSize: 9,
    color: COLORS.textFaint,
    fontWeight: '500',
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 16,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  ratingText: {
    fontSize: 10,
    color: COLORS.warning,
    fontWeight: '600',
  },
  reviewCount: {
    fontSize: 9,
    color: COLORS.textFaint,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginTop: 1,
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.price,
  },
  originalPrice: {
    fontSize: 10,
    color: COLORS.textFaint,
    textDecorationLine: 'line-through',
  },
  buttonWrap: {
    padding: 6,
  },
  addButton: {
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
  },
  addButtonDisabled: {
    backgroundColor: COLORS.surfaceMuted,
    borderColor: COLORS.line,
  },
  addButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  addButtonTextPressed: {
    color: '#FFFFFF',
  },
  addButtonTextDisabled: {
    color: '#D1D5DB',
    fontWeight: '600',
  },
});
