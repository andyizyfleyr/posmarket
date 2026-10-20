/**
 * ProductTile — carte produit compacte de la marketplace, inspirée de l'app
 * Android Alibaba : image carrée pleine largeur, titre fin sur une ligne,
 * ventes et note/avis, prix mis en avant. Toutes les cartes ont exactement la
 * même hauteur. L'ajout rapide reste accessible via un petit bouton « + »
 * posé sur l'image, sans augmenter la carte.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import {
  Check,
  ChevronRight,
  Package,
  Plus,
  Star,
} from 'lucide-react-native';
import { resolveImageUrl } from '@/api/client';
import {
  effectiveProductStock,
  formatCurrency,
  formatNumber,
  formatRating,
  productDiscountPercent,
  variantPriceRange,
} from '@/utils';
import { COLORS } from '@/theme';
import type { StorefrontProduct } from '@/types';
import { useCartActions } from '@/context/CartContext';

interface ProductTileProps {
  product: StorefrontProduct;
  onPress?: (product: StorefrontProduct) => void;
  /** Affiche un discret badge avec la boutique d'origine. */
  showStore?: boolean;
  /** Réduit les statistiques (une étoile) sur les très petits écrans. */
  compact?: boolean;
}

const STAR_SIZE = 9;
const STAR_GAP = 1;
const STARS_WIDTH = STAR_SIZE * 5 + STAR_GAP * 4;

function Stars({ rating }: { rating: number }) {
  const ratio = Math.max(0, Math.min(5, rating)) / 5;
  return (
    <View
      style={styles.starsWrap}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.starsRow}>
        {[0, 1, 2, 3, 4].map((index) => (
          <Star
            key={`empty-${index}`}
            size={STAR_SIZE}
            strokeWidth={2}
            color="#D1D5DB"
            fill="none"
          />
        ))}
      </View>
      <View style={[styles.starsClip, { width: STARS_WIDTH * ratio }]}>
        <View style={styles.starsRow}>
          {[0, 1, 2, 3, 4].map((index) => (
            <Star
              key={`full-${index}`}
              size={STAR_SIZE}
              strokeWidth={2}
              color="#EAB308"
              fill="#EAB308"
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function ProductTileComponent({
  product,
  onPress,
  showStore = false,
  compact = false,
}: ProductTileProps) {
  const { addToCart } = useCartActions();
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageUrl = resolveImageUrl(product.image);
  const imageFailed = Boolean(imageUrl) && failedImageUrl === imageUrl;

  useEffect(
    () => () => {
      if (addedTimer.current) clearTimeout(addedTimer.current);
    },
    [],
  );

  const stock = effectiveProductStock(product);
  const isOutOfStock = stock <= 0;
  const isLowStock = !isOutOfStock && stock <= 5;
  const hasOptions =
    (product.options?.length ?? 0) > 0 || (product.variants?.length ?? 0) > 0;

  const handlePress = useCallback(() => {
    onPress?.(product);
  }, [onPress, product]);

  const handleAdd = useCallback(() => {
    if (isOutOfStock || hasOptions) return;
    addToCart(product, 1);
    setAdded(true);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(false), 900);
  }, [addToCart, product, isOutOfStock, hasOptions]);

  const discount = productDiscountPercent(product);
  const priceRange = variantPriceRange(product);
  const displayPrice = priceRange?.min ?? (Number(product.price) || 0);
  const pricePrefix =
    priceRange && priceRange.max > priceRange.min ? 'dès ' : '';
  const priceLabel = `${pricePrefix}${formatCurrency(displayPrice)}`;

  const salesCount = product.salesCount ?? 0;
  const rating = product.rating ?? 0;
  const reviewCount = product.reviewCount ?? 0;
  const hasStats = salesCount > 0 || rating > 0;
  const storeName = product.storeName?.trim();

  const stockLabel = isOutOfStock
    ? ', rupture de stock'
    : isLowStock
      ? `, plus que ${stock} en stock`
      : '';
  const ratingLabel =
    rating > 0
      ? `, note ${formatRating(rating)} sur 5${
          reviewCount > 0 ? `, ${formatNumber(reviewCount)} avis` : ''
        }`
      : '';
  const storeLabel =
    showStore && storeName ? `, vendu par ${storeName}` : '';
  const cardLabel = `${product.name}, ${priceLabel}${
    product.unit ? ` / ${product.unit}` : ''
  }${discount > 0 ? `, ${discount}% de réduction` : ''}${ratingLabel}${stockLabel}${storeLabel}`;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={cardLabel}
      accessibilityHint="Ouvre la fiche produit"
    >
      <View style={styles.imageWrap}>
        {imageUrl && !imageFailed ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={180}
            alt=""
            accessible={false}
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            onError={() => setFailedImageUrl(imageUrl)}
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Package size={24} color={COLORS.textFaint} />
          </View>
        )}

        {discount > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText} maxFontSizeMultiplier={1.1}>
              -{discount}%
            </Text>
          </View>
        )}

        {isOutOfStock ? (
          <View style={styles.outOfStockBadge}>
            <Text style={styles.outOfStockText} maxFontSizeMultiplier={1.1}>
              Rupture
            </Text>
          </View>
        ) : isLowStock ? (
          <View style={styles.lowStockBadge}>
            <Text style={styles.lowStockText} maxFontSizeMultiplier={1.1}>
              Plus que {stock}
            </Text>
          </View>
        ) : null}

        {showStore && storeName ? (
          <View style={styles.storeBadge}>
            <Text style={styles.storeBadgeText} numberOfLines={1}>
              {storeName}
            </Text>
          </View>
        ) : null}

        {!isOutOfStock && (
          <Pressable
            style={({ pressed }) => [
              styles.quickAdd,
              added && styles.quickAddAdded,
              pressed && styles.quickAddPressed,
            ]}
            onPress={hasOptions ? handlePress : handleAdd}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={
              hasOptions
                ? 'Choisir les options'
                : added
                  ? 'Ajouté au panier'
                  : 'Ajouter au panier'
            }
          >
            {({ pressed }) =>
              added ? (
                <Check
                  size={12}
                  strokeWidth={3}
                  color={pressed ? '#FFFFFF' : COLORS.brand}
                />
              ) : hasOptions ? (
                <ChevronRight
                  size={13}
                  strokeWidth={2.8}
                  color={pressed ? '#FFFFFF' : '#111827'}
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
        <Text
          style={styles.name}
          numberOfLines={1}
          maxFontSizeMultiplier={1.25}
        >
          {product.name}
        </Text>

        <View style={styles.statsRow}>
          {salesCount > 0 ? (
            <Text
              style={styles.salesText}
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}
            >
              {formatNumber(salesCount)} vendu{salesCount > 1 ? 's' : ''}
            </Text>
          ) : null}

          {salesCount > 0 && rating > 0 ? (
            <View style={styles.statsDivider} />
          ) : null}

          {rating > 0 ? (
            <View style={styles.ratingGroup}>
              {compact ? (
                <Star
                  size={STAR_SIZE}
                  strokeWidth={2}
                  color="#EAB308"
                  fill="#EAB308"
                />
              ) : (
                <Stars rating={rating} />
              )}
              <Text
                style={styles.ratingText}
                maxFontSizeMultiplier={1.2}
              >
                {formatRating(rating)}
              </Text>
              {reviewCount > 0 ? (
                <Text
                  style={styles.reviewText}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}
                >
                  ({formatNumber(reviewCount)})
                </Text>
              ) : null}
            </View>
          ) : null}

          {!hasStats ? (
            <Text style={styles.newText} maxFontSizeMultiplier={1.2}>
              Nouveau
            </Text>
          ) : null}
        </View>

        <View style={styles.priceRow}>
          <Text
            style={styles.price}
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
          >
            {priceLabel}
          </Text>
          {product.unit ? (
            <Text
              style={styles.unitText}
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}
            >
              {' / '}
              {product.unit}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export const ProductTile = React.memo(ProductTileComponent);

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
    backgroundColor: '#DC2626',
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
  lowStockBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    backgroundColor: '#B45309',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  lowStockText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  storeBadge: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    maxWidth: '68%',
    backgroundColor: 'rgba(17, 24, 39, 0.58)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  storeBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '600',
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
  quickAddAdded: {
    backgroundColor: COLORS.brandSoft,
    borderColor: COLORS.brandTint,
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
    fontWeight: '400',
    color: '#1F2937',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 14,
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
  starsWrap: {
    width: STARS_WIDTH,
    height: STAR_SIZE,
  },
  starsRow: {
    width: STARS_WIDTH,
    height: STAR_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: STAR_GAP,
  },
  starsClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    overflow: 'hidden',
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
    color: '#6B7280',
  },
  newText: {
    fontSize: 9.5,
    color: '#6B7280',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    minHeight: 19,
    marginTop: 3,
  },
  price: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
  unitText: {
    flexShrink: 1,
    marginLeft: 1,
    fontSize: 9,
    fontWeight: '500',
    color: '#6B7280',
  },
});
