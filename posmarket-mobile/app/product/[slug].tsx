/**
 * Fiche Produit détaillée — Phase 4.2 du plan.
 * Galerie d'images, variantes, wholesale tiers, avis, sticky bottom bar, produits liés.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Share2,
  Star,
  ShieldCheck,
  Truck,
  Clock,
  Store,
  ChevronRight,
  Plus,
  Minus,
  Check,
  ShoppingBag,
} from 'lucide-react-native';
import { fetchCatalog, fetchProductReviews, resolveImageUrl } from '@/api/client';
import { useCart } from '@/context/CartContext';
import { Loader } from '@/components/Loader';
import { ProductCard } from '@/components/ProductCard';
import { formatCurrency, generateProductSlug, getEffectiveWholesaleUnitPrice, getTierUnitPrice } from '@/utils';
import type { StorefrontProduct, StoreData, ProductVariant, WholesaleTier } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { addToCart } = useCart();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [addedToast, setAddedToast] = useState(false);

  // ── Load catalog to find product and store ──
  const { data: catalogData, isLoading: isCatalogLoading } = useQuery({
    queryKey: ['catalog'],
    queryFn: fetchCatalog,
    staleTime: 60_000,
  });

  // Find product and store by slug (le slug est toujours construit par generateProductSlug)
  const { product, store, relatedProducts } = useMemo(() => {
    const stores = catalogData?.stores || [];
    let foundProduct: StorefrontProduct | null = null;
    let foundStore: StoreData | null = null;
    let related: StorefrontProduct[] = [];

    for (const s of stores) {
      const p = (s.products || []).find(
        (item) => generateProductSlug({ id: item.id, name: item.name }) === slug,
      );
      if (p) {
        foundProduct = {
          ...p,
          storeId: s.id,
          storeName: s.settings?.name || s.name || 'Boutique',
          storeSlug: s.slug || undefined,
        };
        foundStore = s;
        related = (s.products || [])
          .filter((item) => item.id !== p.id && item.isOnline !== false)
          .slice(0, 6)
          .map((item) => ({
            ...item,
            storeId: s.id,
            storeName: s.settings?.name || s.name || 'Boutique',
            storeSlug: s.slug || undefined,
          }));
        break;
      }
    }

    return { product: foundProduct, store: foundStore, relatedProducts: related };
  }, [catalogData, slug]);

  // ── Load reviews ──
  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', product?.id],
    queryFn: () => (product?.id ? fetchProductReviews(product.id) : Promise.resolve({ success: true, reviews: [] })),
    enabled: !!product?.id,
  });

  // ── Gallery images ──
  const images = useMemo(() => {
    if (!product) return [];
    const list: string[] = [];
    if (product.image) list.push(product.image);
    if (Array.isArray(product.images)) {
      product.images.forEach((img) => {
        if (img && !list.includes(img)) list.push(img);
      });
    }
    return list.length > 0 ? list : ['/placeholder.png'];
  }, [product]);

  // ── Price calculation (considering variants and wholesale) ──
  const selectedVariant = useMemo(() => {
    if (!product?.variants || !selectedVariantId) return null;
    return product.variants.find((v) => v.id === selectedVariantId) || null;
  }, [product, selectedVariantId]);

  const unitPrice = useMemo(() => {
    if (!product) return 0;
    const basePrice = selectedVariant
      ? Number(selectedVariant.price)
      : Number(product.price) || 0;
    // Même règle que le panier web : paliers de gros appliqués au prix (variante incluse).
    return getEffectiveWholesaleUnitPrice(product, quantity, basePrice);
  }, [product, selectedVariant, quantity]);

  const totalPrice = unitPrice * quantity;
  const isOutOfStock = product?.stock !== undefined && product.stock <= 0;

  const handleAddToCart = useCallback(() => {
    if (!product || isOutOfStock) return;
    addToCart(
      product,
      quantity,
      selectedVariant?.id,
      Object.keys(selectedOptions).length > 0 ? selectedOptions : undefined,
    );
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2000);
  }, [product, isOutOfStock, addToCart, quantity, selectedVariant, selectedOptions]);

  const handleBuyNow = useCallback(() => {
    if (!product || isOutOfStock) return;
    addToCart(
      product,
      quantity,
      selectedVariant?.id,
      Object.keys(selectedOptions).length > 0 ? selectedOptions : undefined,
    );
    router.push('/checkout' as never);
  }, [product, isOutOfStock, addToCart, quantity, selectedVariant, selectedOptions, router]);

  if (isCatalogLoading) {
    return <Loader message="Chargement du produit..." fullScreen />;
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Produit introuvable</Text>
        <Text style={styles.errorSub}>Ce produit n'est plus disponible ou a été retiré.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Retour à l'accueil</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#111827" />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {product.name}
        </Text>
        <Pressable
          style={styles.iconBtn}
          onPress={() => {
            /* optional share */
          }}
        >
          <Share2 size={20} color="#111827" />
        </Pressable>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Image Gallery */}
        <View style={styles.galleryContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const offset = e.nativeEvent.contentOffset.x;
              const index = Math.round(offset / SCREEN_WIDTH);
              setActiveImageIndex(index);
            }}
            scrollEventThrottle={16}
          >
            {images.map((imgUri, idx) => (
              <Image
                key={idx}
                source={{ uri: resolveImageUrl(imgUri) }}
                style={styles.galleryImage}
                contentFit="cover"
                transition={200}
              />
            ))}
          </ScrollView>

          {images.length > 1 && (
            <View style={styles.dotsContainer}>
              {images.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    activeImageIndex === idx ? styles.activeDot : null,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.infoCard}>
          {/* Store link */}
          {store && (
            <Pressable
              style={styles.storeRow}
              onPress={() => router.push(`/store/${store.slug || store.id}` as never)}
            >
              <Store size={16} color="#F56B2A" />
              <Text style={styles.storeName}>{product.storeName}</Text>
              <ChevronRight size={14} color="#9ca3af" />
            </Pressable>
          )}

          <Text style={styles.productName}>{product.name}</Text>

          {/* Rating & Sales */}
          <View style={styles.metaRow}>
            {product.rating !== undefined && product.rating > 0 ? (
              <View style={styles.ratingBadge}>
                <Star size={13} color="#f59e0b" fill="#f59e0b" />
                <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
                {product.reviewCount ? (
                  <Text style={styles.reviewCount}>({product.reviewCount})</Text>
                ) : null}
              </View>
            ) : null}

            {product.salesCount !== undefined && product.salesCount > 0 ? (
              <Text style={styles.salesCount}>{product.salesCount} ventes</Text>
            ) : null}

            <View
              style={[
                styles.stockPill,
                isOutOfStock ? styles.stockPillOut : styles.stockPillIn,
              ]}
            >
              <Text
                style={[
                  styles.stockPillText,
                  isOutOfStock ? styles.stockPillTextOut : styles.stockPillTextIn,
                ]}
              >
                {isOutOfStock ? 'Rupture de stock' : 'En stock'}
              </Text>
            </View>
          </View>

          {/* Pricing */}
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>{formatCurrency(unitPrice)}</Text>
            {product.originalPrice && product.originalPrice > unitPrice && (
              <Text style={styles.originalPriceText}>
                {formatCurrency(product.originalPrice)}
              </Text>
            )}
            {product.unit && (
              <Text style={styles.unitText}>/ {product.unit}</Text>
            )}
          </View>

          {/* Wholesale Tiers */}
          {Array.isArray(product.wholesaleTiers) && product.wholesaleTiers.length > 0 && (
            <View style={styles.wholesaleContainer}>
              <Text style={styles.sectionHeading}>Tarifs de gros</Text>
              <View style={styles.wholesaleGrid}>
                {product.wholesaleTiers.map((tier, idx) => {
                  const isActive = quantity >= tier.minQty;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.wholesaleTierCard,
                        isActive ? styles.wholesaleTierActive : null,
                      ]}
                    >
                      <Text style={styles.wholesaleQty}>Dès {tier.minQty} unités</Text>
                      <Text style={styles.wholesalePrice}>
                        {formatCurrency(getTierUnitPrice(tier, Number(product.price)))}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Variants */}
          {Array.isArray(product.variants) && product.variants.length > 0 && (
            <View style={styles.variantsContainer}>
              <Text style={styles.sectionHeading}>Options & Variantes</Text>
              <View style={styles.variantChips}>
                {product.variants.map((v) => {
                  const isSelected = selectedVariantId === v.id;
                  return (
                    <Pressable
                      key={v.id}
                      style={[
                        styles.variantChip,
                        isSelected ? styles.variantChipSelected : null,
                      ]}
                      onPress={() =>
                        setSelectedVariantId(isSelected ? null : v.id)
                      }
                    >
                      <Text
                        style={[
                          styles.variantChipText,
                          isSelected ? styles.variantChipTextSelected : null,
                        ]}
                      >
                        {v.name || v.sku}
                      </Text>
                      {v.price !== undefined && (
                        <Text
                          style={[
                            styles.variantPriceText,
                            isSelected ? styles.variantPriceTextSelected : null,
                          ]}
                        >
                          {formatCurrency(v.price)}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Quantity Selector */}
          <View style={styles.quantitySection}>
            <Text style={styles.sectionHeading}>Quantité</Text>
            <View style={styles.quantityControls}>
              <Pressable
                style={[styles.qtyBtn, quantity <= 1 ? styles.qtyBtnDisabled : null]}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                <Minus size={16} color={quantity <= 1 ? '#9ca3af' : '#111827'} />
              </Pressable>
              <Text style={styles.quantityNumber}>{quantity}</Text>
              <Pressable
                style={[
                  styles.qtyBtn,
                  product.stock && quantity >= product.stock ? styles.qtyBtnDisabled : null,
                ]}
                onPress={() =>
                  setQuantity((q) =>
                    product.stock ? Math.min(product.stock, q + 1) : q + 1,
                  )
                }
                disabled={Boolean(product.stock && quantity >= product.stock)}
              >
                <Plus
                  size={16}
                  color={
                    product.stock && quantity >= product.stock ? '#9ca3af' : '#111827'
                  }
                />
              </Pressable>
            </View>
          </View>

          {/* Description */}
          {Boolean(product.description) && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.sectionHeading}>Description</Text>
              <Text style={styles.descriptionText}>{product.description}</Text>
            </View>
          )}

          {/* Trust badges */}
          <View style={styles.trustBadges}>
            <View style={styles.trustItem}>
              <ShieldCheck size={18} color="#F56B2A" />
              <Text style={styles.trustText}>Paiement sécurisé</Text>
            </View>
            <View style={styles.trustItem}>
              <Truck size={18} color="#F56B2A" />
              <Text style={styles.trustText}>
                {product.deliveryTime ? `Livraison ${product.deliveryTime}` : 'Livraison rapide'}
              </Text>
            </View>
            <View style={styles.trustItem}>
              <Clock size={18} color="#F56B2A" />
              <Text style={styles.trustText}>
                {product.preparationTime ? `Prêt en ${product.preparationTime}` : 'Disponibilité immédiate'}
              </Text>
            </View>
          </View>
        </View>

        {/* Customer Reviews */}
        {reviewsData?.reviews && reviewsData.reviews.length > 0 && (
          <View style={styles.reviewsCard}>
            <Text style={styles.sectionHeading}>
              Avis clients ({reviewsData.reviews.length})
            </Text>
            {reviewsData.reviews.slice(0, 3).map((rev) => (
              <View key={rev.id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewAuthor}>{rev.author}</Text>
                  <View style={styles.ratingBadge}>
                    <Star size={12} color="#f59e0b" fill="#f59e0b" />
                    <Text style={styles.ratingText}>{rev.rating}</Text>
                  </View>
                </View>
                {rev.comment ? (
                  <Text style={styles.reviewComment}>{rev.comment}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* Related Products from same store */}
        {relatedProducts.length > 0 && (
          <View style={styles.relatedContainer}>
            <Text style={styles.sectionHeading}>Dans la même boutique</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedScroll}>
              {relatedProducts.map((p) => (
                <View key={p.id} style={styles.relatedCardWrapper}>
                  <ProductCard
                    product={p}
                    onPress={() => {
                      const newSlug = generateProductSlug({ id: p.id, name: p.name });
                      router.push(`/product/${newSlug}` as never);
                    }}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Added Toast */}
      {addedToast && (
        <View style={styles.toast}>
          <Check size={16} color="#fff" />
          <Text style={styles.toastText}>Produit ajouté au panier !</Text>
        </View>
      )}

      {/* Sticky Bottom Bar */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <View style={styles.bottomBarInner}>
          <View style={styles.bottomPriceCol}>
            <Text style={styles.bottomPriceLabel}>Total ({quantity})</Text>
            <Text style={styles.bottomPriceValue}>{formatCurrency(totalPrice)}</Text>
          </View>

          <View style={styles.bottomActions}>
            <Pressable
              style={[
                styles.addToCartBtn,
                isOutOfStock ? styles.btnDisabled : null,
              ]}
              onPress={handleAddToCart}
              disabled={isOutOfStock}
            >
              <ShoppingBag size={18} color="#F56B2A" />
              <Text style={styles.addToCartText}>Ajouter</Text>
            </Pressable>

            <Pressable
              style={[
                styles.buyNowBtn,
                isOutOfStock ? styles.btnDisabled : null,
              ]}
              onPress={handleBuyNow}
              disabled={isOutOfStock}
            >
              <Text style={styles.buyNowText}>
                {isOutOfStock ? 'Rupture' : 'Commander'}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    zIndex: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  topBarTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  galleryContainer: {
    position: 'relative',
    backgroundColor: '#ffffff',
  },
  galleryImage: {
    width: SCREEN_WIDTH,
    height: 320,
    backgroundColor: '#f3f4f6',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  activeDot: {
    backgroundColor: '#F56B2A',
    width: 18,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginTop: 8,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  storeName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F56B2A',
  },
  productName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 26,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  reviewCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  salesCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  stockPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  stockPillIn: {
    backgroundColor: '#FFF3ED',
  },
  stockPillOut: {
    backgroundColor: '#fef2f2',
  },
  stockPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  stockPillTextIn: {
    color: '#F56B2A',
  },
  stockPillTextOut: {
    color: '#dc2626',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 16,
  },
  priceText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F56B2A',
  },
  originalPriceText: {
    fontSize: 16,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  unitText: {
    fontSize: 14,
    color: '#6b7280',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 10,
  },
  wholesaleContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  wholesaleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wholesaleTierCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  wholesaleTierActive: {
    borderColor: '#F56B2A',
    backgroundColor: '#FFF3ED',
  },
  wholesaleQty: {
    fontSize: 11,
    color: '#6b7280',
  },
  wholesalePrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  variantsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  variantChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variantChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  variantChipSelected: {
    borderColor: '#F56B2A',
    backgroundColor: '#FFF3ED',
  },
  variantChipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  variantChipTextSelected: {
    color: '#F56B2A',
    fontWeight: '700',
  },
  variantPriceText: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  variantPriceTextSelected: {
    color: '#F56B2A',
  },
  quantitySection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  qtyBtnDisabled: {
    opacity: 0.4,
  },
  quantityNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    minWidth: 24,
    textAlign: 'center',
  },
  descriptionContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  descriptionText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 22,
  },
  trustBadges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  trustItem: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  trustText: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
  },
  reviewsCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginTop: 8,
  },
  reviewItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  reviewComment: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  relatedContainer: {
    marginTop: 8,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
  },
  relatedScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  relatedCardWrapper: {
    width: 170,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  bottomBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bottomPriceCol: {
    flex: 1,
  },
  bottomPriceLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  bottomPriceValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F56B2A',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addToCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#F56B2A',
    backgroundColor: '#FFF3ED',
  },
  addToCartText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F56B2A',
  },
  buyNowBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F56B2A',
  },
  buyNowText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  toast: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F56B2A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 99,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  errorSub: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F56B2A',
    borderRadius: 8,
  },
  backBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
