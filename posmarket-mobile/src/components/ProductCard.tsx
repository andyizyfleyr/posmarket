import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Plus, Eye } from 'lucide-react-native';
import { Product } from '../types';
import { formatCurrency, formatNumber } from '../utils/format';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onClick?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = memo(({ product, onAddToCart, onClick }) => {
  const hasOptions = Array.isArray(product.options) && product.options.length > 0;
  const isOutOfStock = product.stock === 0;
  const [adding, setAdding] = useState(false);
  const addingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (addingTimerRef.current) clearTimeout(addingTimerRef.current);
    };
  }, []);

  const handleAddToCart = useCallback(() => {
    if (isOutOfStock) return;
    if (hasOptions) {
      onClick?.();
      return;
    }
    setAdding(true);
    if (addingTimerRef.current) clearTimeout(addingTimerRef.current);
    addingTimerRef.current = setTimeout(() => setAdding(false), 600);
    onAddToCart(product);
  }, [product, onAddToCart, onClick, isOutOfStock, hasOptions]);

  const discount = product.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : null;

  return (
    <View style={styles.card}>
      <Pressable onPress={onClick} style={styles.clickableArea}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: product.image || 'https://via.placeholder.com/300' }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
          {discount !== null && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>-{discount}%</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {product.name}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatCurrency(product.price)}</Text>
            {product.originalPrice && product.originalPrice > product.price ? (
              <Text style={styles.originalPrice}>{formatCurrency(product.originalPrice)}</Text>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            {product.salesCount !== undefined && product.salesCount > 0 ? (
              <Text style={styles.metaText}>
                {formatNumber(product.salesCount)} {product.salesCount > 1 ? 'ventes' : 'vente'}
              </Text>
            ) : <View />}

            {product.views !== undefined && product.views > 0 ? (
              <View style={styles.viewBadge}>
                <Text style={styles.metaText}>{formatNumber(product.views)} </Text>
                <Eye size={11} color="#6B7280" />
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      {/* Action Button: + Ajouter / Choisir / Rupture */}
      <View style={styles.buttonWrapper}>
        <Pressable
          onPress={handleAddToCart}
          disabled={isOutOfStock || adding}
          style={({ pressed }) => [
            styles.button,
            isOutOfStock ? styles.buttonDisabled : styles.buttonActive,
            pressed && styles.buttonPressed,
          ]}
        >
          {adding ? (
            <ActivityIndicator size="small" color="#EA580C" />
          ) : isOutOfStock ? (
            <Text style={styles.buttonTextDisabled}>Rupture</Text>
          ) : hasOptions ? (
            <Text style={styles.buttonTextActive}>Choisir</Text>
          ) : (
            <View style={styles.buttonContent}>
              <Plus size={13} color="#111827" />
              <Text style={styles.buttonTextActive}>Ajouter</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
});

ProductCard.displayName = 'ProductCard';

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  clickableArea: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F9FAFB',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  badgeContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  content: {
    padding: 10,
    flexGrow: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 4,
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  originalPrice: {
    fontSize: 10,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  viewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
  buttonWrapper: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  button: {
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonActive: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  buttonDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  buttonTextActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  buttonTextDisabled: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },
});
