/**
 * ProductTile — carte produit compacte pour le fil d'accueil, inspirée de
 * l'app Android Alibaba : image pleine largeur dont la hauteur suit le ratio
 * réel de la photo, titre sur une ligne, prix mis en avant, pas de bloc
 * d'informations supplémentaire. L'ajout rapide reste accessible via un petit
 * bouton « + » posé sur l'image, sans augmenter la hauteur de la carte.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image, type ImageLoadEventData } from 'expo-image';
import { Package, Plus } from 'lucide-react-native';
import { resolveImageUrl } from '@/api/client';
import { formatCurrency } from '@/utils';
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
  const [imageRatio, setImageRatio] = useState(1);
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

  const handleImageLoad = useCallback((event: ImageLoadEventData) => {
    const { width, height } = event.source;
    if (width > 0 && height > 0) {
      // On garde des proportions raisonnables pour éviter les cartes extrêmes.
      setImageRatio(Math.min(1.45, Math.max(0.7, width / height)));
    }
  }, []);

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
      <View style={[styles.imageWrap, { aspectRatio: imageRatio }]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={180}
            onLoad={handleImageLoad}
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
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={
              hasOptions ? 'Choisir les options' : 'Ajouter au panier'
            }
          >
            {({ pressed }) =>
              adding ? (
                <ActivityIndicator size="small" color={COLORS.brand} />
              ) : (
                <Plus
                  size={17}
                  strokeWidth={2.8}
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
        <View style={styles.priceRow}>
          <Text style={styles.price} numberOfLines={1}>
            {formatCurrency(product.price)}
          </Text>
          {product.originalPrice && product.originalPrice > product.price && (
            <Text style={styles.originalPrice} numberOfLines={1}>
              {formatCurrency(product.originalPrice)}
            </Text>
          )}
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
    right: 6,
    bottom: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF0F3',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
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
    fontWeight: '500',
    color: '#111827',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginTop: 3,
  },
  price: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
  originalPrice: {
    flexShrink: 1,
    fontSize: 9.5,
    color: '#EF4444',
    textDecorationLine: 'line-through',
  },
});
