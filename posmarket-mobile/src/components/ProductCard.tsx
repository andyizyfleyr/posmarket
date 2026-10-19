/**
 * ProductCard — transposition native fidèle du composant web
 * (src/components/ProductCard.tsx) : image carrée encadrée, badge remise
 * rouge, nom 9 px sur une ligne, prix noir 10 px + prix barré, ligne
 * « N ventes / N vues » (œil), bouton neutre 36 px qui devient orange à
 * l'appui (« Choisir » si options, « Rupture » si stock nul).
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
import { Plus, Eye, Package } from 'lucide-react-native';
import { resolveImageUrl } from '@/api/client';
import { formatCurrency, formatNumber } from '@/utils';
import { COLORS } from '@/theme';
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
  const views = product.views ?? 0;

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
              <Package size={22} color={COLORS.textFaint} />
            </View>
          )}
          {discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{discount}%</Text>
            </View>
          )}
        </View>
      </View>

      {/* Infos */}
      <View style={styles.info}>
        <Text style={styles.productName} numberOfLines={1}>
          {product.name}
        </Text>

        <View style={styles.infoBottom}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatCurrency(product.price)}</Text>
            {product.originalPrice && product.originalPrice > product.price && (
              <Text style={styles.originalPrice}>
                {formatCurrency(product.originalPrice)}
              </Text>
            )}
          </View>

          <View style={styles.metaRow}>
            {salesCount > 0 ? (
              <Text style={styles.metaSales}>
                {formatNumber(salesCount)} {salesCount > 1 ? 'ventes' : 'vente'}
              </Text>
            ) : (
              <View />
            )}
            {views > 0 && (
              <View style={styles.metaViews}>
                <Text style={styles.metaViewsText}>{formatNumber(views)}</Text>
                <Eye size={10} color="#4B5563" strokeWidth={2.5} />
              </View>
            )}
          </View>
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
          onPress={hasOptions ? handlePress : handleAdd}
          disabled={isOutOfStock || adding}
        >
          {({ pressed }) =>
            adding ? (
              <ActivityIndicator size="small" color={COLORS.brand} />
            ) : (
              <View style={styles.addButtonRow}>
                {!isOutOfStock && !hasOptions && (
                  <Plus
                    size={12}
                    strokeWidth={2.5}
                    color={pressed ? '#FFFFFF' : '#111827'}
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
                    : hasOptions
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
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
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
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
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  info: {
    padding: 6,
    flexGrow: 1,
  },
  productName: {
    fontSize: 9,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 12,
  },
  infoBottom: {
    marginTop: 'auto',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 4,
  },
  price: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  originalPrice: {
    fontSize: 8,
    color: '#6B7280',
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: -4,
    marginBottom: 6,
    minHeight: 14,
  },
  metaSales: {
    fontSize: 9,
    fontWeight: '600',
    color: '#4B5563',
    opacity: 0.7,
  },
  metaViews: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaViewsText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#4B5563',
    opacity: 0.8,
  },
  buttonWrap: {
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  addButton: {
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
  },
  addButtonDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#F3F4F6',
  },
  addButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButtonText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.1,
  },
  addButtonTextPressed: {
    color: '#FFFFFF',
  },
  addButtonTextDisabled: {
    color: '#D1D5DB',
  },
});
