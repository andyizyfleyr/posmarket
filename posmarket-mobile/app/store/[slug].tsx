/**
 * Vitrine de la boutique — alignée sur la page boutique du web mobile
 * (src/views/StorefrontView.tsx → `renderStoreProfile` + onglets) :
 * cover dégradé, carte boutique centrée (logo 48 chevauchant, note, adresse,
 * description, WhatsApp), bandeau de stats, onglets Produits / Avis,
 * recherche interne, sections par catégorie avec « Voir tout » (feuille),
 * chargement infini (20 par lot) et avis boutique.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Star,
  Store,
  X,
} from 'lucide-react-native';
import {
  fetchCatalog,
  fetchStoreReviews,
  resolveImageUrl,
  searchProducts,
} from '@/api/client';
import { Loader } from '@/components/Loader';
import { ProductCard } from '@/components/ProductCard';
import { MAIN_CATEGORIES, verticalOfProduct } from '@/constants';
import { formatNumber, generateProductSlug, maskName } from '@/utils';
import { COLORS } from '@/theme';
import type { Review, StoreData, StorefrontProduct } from '@/types';

type StoreVertical = 'shopping' | 'food';

interface SheetCategory {
  cat: string;
  vertical: StoreVertical;
}

const PAGE_LIMIT = 20;
const SECTION_PREVIEW_COUNT = 6;

export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const [activeTab, setActiveTab] = useState<'products' | 'reviews'>(
    'products',
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_LIMIT);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sheetCategory, setSheetCategory] = useState<SheetCategory | null>(
    null,
  );
  const [showAllStoreReviews, setShowAllStoreReviews] = useState(false);
  const loadMoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Catalogue ──
  const { data: catalogData, isLoading } = useQuery({
    queryKey: ['catalog'],
    queryFn: fetchCatalog,
    staleTime: 60_000,
  });

  const store = useMemo(() => {
    const stores = catalogData?.stores || [];
    return (
      stores.find((s: StoreData) => s.slug === slug || s.id === slug) || null
    );
  }, [catalogData, slug]);

  /** Produits en ligne de la boutique, triés comme le web. */
  const storeProducts = useMemo(() => {
    if (!store) return [];
    const products: StorefrontProduct[] = [];
    (store.products || []).forEach((p) => {
      if (p.isOnline !== false) {
        products.push({
          ...p,
          storeId: store.id,
          storeName: store.settings?.name || store.name || 'Boutique',
          storeSlug: store.slug || undefined,
        });
      }
    });
    return products.sort((a, b) => {
      const catA = a.mainCategory || a.category || 'Autre';
      const catB = b.mainCategory || b.category || 'Autre';
      if (catA !== catB) {
        const idxA = MAIN_CATEGORIES.indexOf(catA);
        const idxB = MAIN_CATEGORIES.indexOf(catB);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      }
      const salesDiff = (b.salesCount || 0) - (a.salesCount || 0);
      if (salesDiff !== 0) return salesDiff;
      const ratingDiff = (b.rating || 0) - (a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (b.views || 0) - (a.views || 0);
    });
  }, [store]);

  // ── Recherche interne (serveur, comme le web) ──
  const normalizedSearch = searchTerm.trim();
  const searchActive = normalizedSearch.length >= 2;
  const { data: searchData, isFetching: isSearching } = useQuery({
    queryKey: ['store-search', store?.id, normalizedSearch],
    queryFn: () => searchProducts(normalizedSearch, 50),
    enabled: searchActive && !!store,
    staleTime: 30_000,
  });

  /** Source affichée : résultats serveur restreints à la boutique, sinon tout. */
  const gridSource = useMemo(() => {
    if (!searchActive) return storeProducts;
    return (searchData?.products || []).filter(
      (p) => p.storeId === store?.id,
    );
  }, [searchActive, searchData, store, storeProducts]);

  // ── Avis boutique (chargés au premier passage sur l'onglet) ──
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['store-reviews', store?.id],
    queryFn: () => fetchStoreReviews(store!.id),
    enabled: !!store && activeTab === 'reviews',
    staleTime: 60_000,
  });
  const storeReviews = reviewsData?.reviews || [];

  // ── Pagination (nouvelle recherche → retour au premier lot) ──
  const handleSearchChange = useCallback((text: string) => {
    setSearchTerm(text);
    setVisibleCount(PAGE_LIMIT);
  }, []);

  useEffect(() => {
    return () => {
      if (loadMoreTimer.current) clearTimeout(loadMoreTimer.current);
    };
  }, []);

  const pagedProducts = useMemo(
    () => gridSource.slice(0, visibleCount),
    [gridSource, visibleCount],
  );
  const hasMore = visibleCount < gridSource.length;

  const maybeLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    loadMoreTimer.current = setTimeout(() => {
      setVisibleCount((c) => c + PAGE_LIMIT);
      setIsLoadingMore(false);
    }, 400);
  }, [isLoadingMore, hasMore]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } =
        event.nativeEvent;
      if (
        layoutMeasurement.height + contentOffset.y >=
        contentSize.height - 240
      ) {
        maybeLoadMore();
      }
    },
    [maybeLoadMore],
  );

  // ── Groupes par catégorie (commerce d'abord, puis restauration) ──
  const sections = useMemo(() => {
    const groups: Record<string, StorefrontProduct[]> = {};
    pagedProducts.forEach((p) => {
      const cat = p.mainCategory || p.category || 'Autre';
      const key = `${verticalOfProduct(p)}::${cat}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return Object.keys(groups)
      .sort((a, b) => {
        const [va, ca] = a.split('::');
        const [vb, cb] = b.split('::');
        if (va !== vb) return va === 'shopping' ? -1 : 1;
        const idxA = MAIN_CATEGORIES.indexOf(ca);
        const idxB = MAIN_CATEGORIES.indexOf(cb);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      })
      .map((key) => {
        const separator = key.indexOf('::');
        return {
          key,
          cat: key.slice(separator + 2),
          vertical: key.slice(0, separator) as StoreVertical,
          items: groups[key].slice(0, SECTION_PREVIEW_COUNT),
        };
      });
  }, [pagedProducts]);

  /** Produits de la catégorie ouverte dans la feuille « Voir tout ». */
  const sheetProducts = useMemo(() => {
    if (!sheetCategory) return [];
    return storeProducts.filter((p) => {
      const category = p.category || '';
      const mCategory = p.mainCategory || '';
      const matchesCategory =
        category === sheetCategory.cat || mCategory === sheetCategory.cat;
      const matchesVertical =
        verticalOfProduct(p) === sheetCategory.vertical;
      return matchesCategory && matchesVertical;
    });
  }, [sheetCategory, storeProducts]);

  const navigateToProduct = useCallback(
    (product: StorefrontProduct) => {
      const productSlug = generateProductSlug({
        id: product.id,
        name: product.name,
      });
      router.push(`/product/${productSlug}` as never);
    },
    [router],
  );

  if (isLoading) {
    return <Loader message="Chargement de la boutique..." fullScreen />;
  }

  const storeName = store?.settings?.name || store?.name || 'Boutique';

  if (!store) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.topBar}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="Retour"
          >
            <ArrowLeft size={20} color="#111827" />
          </Pressable>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            Boutique
          </Text>
          <View style={{ width: 36 }} />
        </SafeAreaView>
        <View style={styles.notFound}>
          <View style={styles.notFoundIcon}>
            <Store size={30} color="#9CA3AF" />
          </View>
          <Text style={styles.notFoundTitle}>Boutique introuvable</Text>
          <Text style={styles.notFoundSub}>
            Cette boutique n&apos;existe pas ou n&apos;est plus disponible.
          </Text>
          <Pressable
            style={styles.notFoundBtn}
            onPress={() => router.replace('/' as never)}
          >
            <Text style={styles.notFoundBtnText}>
              Découvrir d&apos;autres boutiques
            </Text>
            <ArrowRight size={14} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>
    );
  }

  const logoUrl = store.settings?.logo
    ? resolveImageUrl(store.settings.logo as string)
    : null;
  const description = store.description || store.settings?.description || '';
  const address = store.address || (store.settings?.address as string) || '';
  const phone = store.phone || (store.settings?.phone as string) || '';
  const waDigits = phone.replace(/[^0-9]/g, '');

  const productReviewTotal = (store.products || []).reduce(
    (sum, p) => sum + (p.reviewCount || 0),
    0,
  );
  const reviewCountTotal = store.reviewCount ?? productReviewTotal;
  const onlineProducts = (store.products || []).filter(
    (p) => p.isOnline !== false,
  );
  const productCountWithImage = onlineProducts.filter((p) => p.image).length;
  const visitorsCount = formatNumber(
    (store.views || 0) +
      onlineProducts.reduce((sum, p) => sum + (p.views || 0), 0),
  );

  const openWhatsApp = () => {
    if (!waDigits) return;
    const url = `https://wa.me/${waDigits}?text=${encodeURIComponent(
      `Bonjour ${storeName}, je vous contacte depuis PosMarket.`,
    )}`;
    void Linking.openURL(url).catch(() => {});
  };

  const renderProductCard = (product: StorefrontProduct) => (
    <View key={`${product.storeId}-${product.id}`} style={styles.gridCell}>
      <ProductCard product={product} onPress={navigateToProduct} />
    </View>
  );

  const renderReview = (review: Review) => {
    const reviewedProduct = review.productId
      ? storeProducts.find((p) => p.id === review.productId)
      : undefined;
    const productName =
      review.productName || reviewedProduct?.name || 'Produit';
    const productImage = review.productImage || reviewedProduct?.image || '';
    const openReviewedProduct = review.productId
      ? () => {
          router.push(
            `/product/${generateProductSlug({
              id: review.productId as string,
              name: productName,
            })}` as never,
          );
        }
      : undefined;

    return (
      <View key={review.id} style={styles.reviewCard}>
        <View style={styles.reviewHeadRow}>
          <View style={styles.reviewAuthorRow}>
            <View style={styles.reviewAvatar}>
              {review.avatarUrl ? (
                <Image
                  source={{ uri: resolveImageUrl(review.avatarUrl) }}
                  style={styles.reviewAvatarImg}
                  contentFit="cover"
                />
              ) : (
                <Text style={styles.reviewAvatarText}>
                  {review.author?.[0]?.toUpperCase() || 'A'}
                </Text>
              )}
            </View>
            <View style={styles.reviewAuthorCol}>
              <Text style={styles.reviewAuthorName} numberOfLines={1}>
                {maskName(review.author)}
              </Text>
              <View style={styles.reviewStarsRow}>
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={8}
                    color={i < review.rating ? '#FACC15' : '#E5E7EB'}
                    fill={i < review.rating ? '#FACC15' : 'none'}
                  />
                ))}
              </View>
            </View>
          </View>
          <View style={styles.reviewMetaCol}>
            <Text style={styles.reviewDate}>
              {new Date(review.date).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
            <View style={styles.reviewVerified}>
              <CheckCircle2 size={9} color="#10B981" />
              <Text style={styles.reviewVerifiedText}>Avis vérifié</Text>
            </View>
          </View>
        </View>

        {review.comment ? (
          <Text style={styles.reviewComment} numberOfLines={3}>
            {review.comment}
          </Text>
        ) : null}

        {review.sellerReply ? (
          <View style={styles.sellerReply}>
            <Text style={styles.sellerReplyLabel}>Réponse du vendeur</Text>
            <Text style={styles.sellerReplyText}>{review.sellerReply}</Text>
          </View>
        ) : null}

        {openReviewedProduct && (
          <Pressable
            style={({ pressed }) => [
              styles.reviewProduct,
              pressed && styles.reviewProductPressed,
            ]}
            onPress={openReviewedProduct}
          >
            <View style={styles.reviewProductThumb}>
              {productImage ? (
                <Image
                  source={{ uri: resolveImageUrl(productImage) }}
                  style={styles.reviewProductImage}
                  contentFit="cover"
                />
              ) : null}
            </View>
            <View style={styles.reviewProductBody}>
              <Text style={styles.reviewProductName} numberOfLines={1}>
                {productName}
              </Text>
              <Text style={styles.reviewProductCta}>Voir le produit</Text>
            </View>
            <ChevronRight size={14} color="#6B7280" />
          </Pressable>
        )}
      </View>
    );
  };

  const reviewsAverage = storeReviews.length
    ? storeReviews.reduce((s, r) => s + (r.rating || 0), 0) /
      storeReviews.length
    : 0;
  const reviewsDistribution = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: storeReviews.filter((r) => Math.round(r.rating) === n).length,
  }));

  return (
    <View style={styles.container}>
      {/* ── Barre de navigation (application) ── */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable
          style={styles.iconBtn}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Retour"
        >
          <ArrowLeft size={20} color="#111827" />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {storeName}
        </Text>
        <View style={{ width: 36 }} />
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        stickyHeaderIndices={[1]}
      >
        {/* ── Carte boutique (bord à bord, comme le web mobile) ── */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={[COLORS.brand, '#FF8A50', '#FFB26B']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.cover}
          />

          <View style={styles.heroBody}>
            <View style={styles.logoWrap}>
              {logoUrl ? (
                <Image
                  source={{ uri: logoUrl }}
                  style={styles.logo}
                  contentFit="cover"
                />
              ) : (
                <Store size={24} color={COLORS.brand} />
              )}
            </View>

            <View style={styles.nameRow}>
              <Text style={styles.storeName} numberOfLines={2}>
                {storeName}
              </Text>
              <ShieldCheck size={14} strokeWidth={3} color="#22C55E" />
            </View>

            <View style={styles.ratingLine}>
              <Star size={11} color="#FACC15" fill="#FACC15" />
              <Text style={styles.ratingValue}>
                {(store.rating || 0).toFixed(1)}
              </Text>
              <Text style={styles.ratingCount}>
                ({formatNumber(reviewCountTotal)} avis)
              </Text>
              <Text style={styles.ratingDot}>·</Text>
              <Text style={styles.ratingCount}>
                {onlineProducts.length} produits en ligne
              </Text>
            </View>

            {address ? (
              <View style={styles.addressRow}>
                <MapPin size={11} color="rgba(245,107,42,0.7)" />
                <Text style={styles.addressText}>{address}</Text>
              </View>
            ) : null}

            {description ? (
              <Text style={styles.description}>{description}</Text>
            ) : null}

            {waDigits ? (
              <Pressable
                style={({ pressed }) => [
                  styles.whatsappButton,
                  pressed && styles.whatsappButtonPressed,
                ]}
                onPress={openWhatsApp}
              >
                <MessageCircle size={15} color="#25D366" strokeWidth={2.5} />
                <Text style={styles.whatsappText}>Contacter sur WhatsApp</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Bandeau de statistiques */}
          <View style={styles.statsStrip}>
            <View style={[styles.statCol, styles.statColBorder]}>
              <Text style={styles.statValue}>
                {formatNumber(productCountWithImage)}
              </Text>
              <Text style={styles.statLabel}>Produits</Text>
            </View>
            <View style={[styles.statCol, styles.statColBorder]}>
              <Text style={styles.statValue}>{visitorsCount}</Text>
              <Text style={styles.statLabel}>Visiteurs</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statValue}>
                {(store.rating || 0).toFixed(1)}/5
              </Text>
              <Text style={styles.statLabel}>Note</Text>
            </View>
          </View>
        </View>

        {/* ── Onglets Produits / Avis (collants) ── */}
        <View style={styles.tabsWrap}>
          <View style={styles.tabsBar}>
            <Pressable
              style={[styles.tabButton, activeTab === 'products' && styles.tabButtonActive]}
              onPress={() => setActiveTab('products')}
            >
              <ShoppingBasket
                size={14}
                color={activeTab === 'products' ? '#111827' : '#6B7280'}
                strokeWidth={2.5}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'products' && styles.tabTextActive,
                ]}
              >
                Produits
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tabButton, activeTab === 'reviews' && styles.tabButtonActive]}
              onPress={() => setActiveTab('reviews')}
            >
              <Star
                size={14}
                color={activeTab === 'reviews' ? '#EAB308' : '#6B7280'}
                fill={activeTab === 'reviews' ? '#EAB308' : 'none'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'reviews' && styles.tabTextActive,
                ]}
              >
                Avis
              </Text>
            </Pressable>
          </View>
        </View>

        {activeTab === 'products' ? (
          <View>
            {/* Recherche interne */}
            <View style={styles.searchWrap}>
              <View style={styles.searchIcon}>
                <Search size={16} color="#9CA3AF" strokeWidth={2.5} />
              </View>
              <TextInput
                style={[styles.searchInput, searchFocused && styles.searchInputFocused]}
                value={searchTerm}
                onChangeText={handleSearchChange}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Chercher dans cette boutique..."
                placeholderTextColor="#9CA3AF"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>

            {/* Sections par catégorie */}
            {sections.map((section) => (
              <View key={section.key} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle} numberOfLines={1}>
                    {section.cat}
                    {section.vertical === 'food' ? (
                      <Text style={styles.sectionFoodTag}>  Restauration</Text>
                    ) : null}
                  </Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.seeAll,
                      pressed && styles.pressedFaded,
                    ]}
                    onPress={() => setSheetCategory(section)}
                  >
                    <Text style={styles.seeAllText}>Voir tout</Text>
                    <ChevronRight
                      size={13}
                      strokeWidth={3}
                      color={COLORS.brand}
                    />
                  </Pressable>
                </View>
                <View style={styles.grid}>
                  {section.items.map(renderProductCard)}
                </View>
              </View>
            ))}

            {/* États vides / chargement */}
            {sections.length === 0 && !isLoadingMore ? (
              searchActive && isSearching ? (
                <View style={styles.searchPending}>
                  <ActivityIndicator size="large" color={COLORS.brand} />
                  <Text style={styles.loadMoreText}>
                    Recherche en cours...
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <Search size={48} color="#E5E7EB" />
                  <Text style={styles.emptyText}>
                    Aucun produit dans cette sélection
                  </Text>
                </View>
              )
            ) : null}

            {/* Chargement du lot suivant */}
            <View
              style={[styles.loadMoreWrap, isLoadingMore && styles.loadMoreWrapActive]}
            >
              {isLoadingMore ? (
                <>
                  <ActivityIndicator size="large" color={COLORS.brand} />
                  <Text style={styles.loadMoreText}>
                    Chargement des produits...
                  </Text>
                </>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.reviewsWrap}>
            {reviewsLoading ? (
              <View style={styles.reviewsLoading}>
                <ActivityIndicator size="large" color={COLORS.brand} />
                <Text style={styles.reviewsLoadingText}>
                  Chargement des avis...
                </Text>
              </View>
            ) : storeReviews.length > 0 ? (
              <>
                {/* Résumé des notes */}
                <View style={styles.reviewSummary}>
                  <View style={styles.reviewSummaryLeft}>
                    <Text style={styles.reviewSummaryAvg}>
                      {reviewsAverage.toFixed(1)}
                    </Text>
                    <View style={styles.reviewSummaryStars}>
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={12}
                          color={
                            i < Math.round(reviewsAverage)
                              ? '#FACC15'
                              : '#E5E7EB'
                          }
                          fill={
                            i < Math.round(reviewsAverage)
                              ? '#FACC15'
                              : 'none'
                          }
                        />
                      ))}
                    </View>
                    <Text style={styles.reviewSummaryCount}>
                      {storeReviews.length} avis
                    </Text>
                  </View>
                  <View style={styles.reviewDistribution}>
                    {reviewsDistribution.map(({ n, count }) => (
                      <View key={n} style={styles.reviewDistRow}>
                        <View style={styles.reviewDistLabel}>
                          <Text style={styles.reviewDistNumber}>{n}</Text>
                          <Star size={8} color="#9CA3AF" fill="#9CA3AF" />
                        </View>
                        <View style={styles.reviewDistTrack}>
                          <View
                            style={[
                              styles.reviewDistFill,
                              {
                                width: `${
                                  storeReviews.length
                                    ? (count / storeReviews.length) * 100
                                    : 0
                                }%`,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.reviewDistCount}>{count}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Liste d'avis */}
                <View style={styles.reviewList}>
                  {(showAllStoreReviews
                    ? storeReviews
                    : storeReviews.slice(0, 5)
                  ).map(renderReview)}
                </View>

                {storeReviews.length > 5 && !showAllStoreReviews ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.showMoreBtn,
                      pressed && styles.showMoreBtnPressed,
                    ]}
                    onPress={() => setShowAllStoreReviews(true)}
                  >
                    <Text style={styles.showMoreText}>
                      Voir plus d&apos;avis ({storeReviews.length - 5})
                    </Text>
                    <View style={styles.showMoreChevron}>
                      <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconBox}>
                  <Star size={32} color="#E5E7EB" />
                </View>
                <Text style={styles.emptyTitle}>
                  Aucun avis pour le moment
                </Text>
                <Text style={styles.emptySub}>
                  Les avis des clients sur les produits s&apos;afficheront ici.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Feuille « Voir tout » — tous les produits de la catégorie */}
      <Modal
        visible={sheetCategory !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetCategory(null)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSheetCategory(null)}
          />
          <View
            style={[
              styles.sheetContainer,
              { paddingBottom: Math.max(insets.bottom, 12) + 12 },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{sheetCategory?.cat}</Text>
            <Text style={styles.sheetSubtitle}>
              {formatNumber(sheetProducts.length)}{' '}
              {sheetProducts.length > 1 ? 'produits' : 'produit'}
            </Text>
            <Pressable
              style={styles.sheetClose}
              onPress={() => setSheetCategory(null)}
              hitSlop={8}
              accessibilityLabel="Fermer"
            >
              <X size={16} color={COLORS.textMuted} />
            </Pressable>
            <FlatList
              data={sheetProducts}
              keyExtractor={(p) => `${p.storeId}-${p.id}`}
              numColumns={2}
              columnWrapperStyle={styles.sheetRow}
              contentContainerStyle={styles.sheetList}
              style={styles.sheetListView}
              showsVerticalScrollIndicator={false}
              initialNumToRender={6}
              renderItem={({ item }) => (
                <View style={styles.gridCell}>
                  <ProductCard
                    product={item}
                    onPress={(p) => {
                      setSheetCategory(null);
                      navigateToProduct(p);
                    }}
                  />
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  topBarTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  // ── Carte boutique ──
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  cover: {
    height: 56,
    width: '100%',
  },
  heroBody: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    alignItems: 'center',
  },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    marginTop: -24,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
    maxWidth: '100%',
  },
  storeName: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.2,
    textAlign: 'center',
    lineHeight: 20,
  },
  ratingLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 4,
    rowGap: 2,
    marginTop: 4,
  },
  ratingValue: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.brand,
  },
  ratingCount: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  ratingDot: {
    fontSize: 11,
    color: '#D1D5DB',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  addressText: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '500',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  description: {
    marginTop: 8,
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 18,
    textAlign: 'center',
  },
  whatsappButton: {
    width: '100%',
    height: 40,
    marginTop: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  whatsappButtonPressed: {
    backgroundColor: '#F9FAFB',
  },
  whatsappText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },

  // ── Statistiques ──
  statsStrip: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: 'rgba(249,250,251,0.6)',
  },
  statCol: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statColBorder: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(229,231,235,0.6)',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 15,
  },
  statLabel: {
    marginTop: 4,
    fontSize: 8,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Onglets ──
  tabsWrap: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  tabsBar: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(243,244,246,0.6)',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#E5E7EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#111827',
  },

  // ── Recherche interne ──
  searchWrap: {
    marginHorizontal: 16,
    marginBottom: 16,
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  searchInput: {
    paddingLeft: 44,
    paddingRight: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  searchInputFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: COLORS.brand,
  },

  // ── Sections produits ──
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  sectionFoodTag: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.brand,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.brand,
  },
  pressedFaded: {
    opacity: 0.6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  gridCell: {
    width: '50%',
    marginBottom: 8,
  },

  // ── États vides / chargements ──
  searchPending: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadMoreWrap: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadMoreWrapActive: {
    paddingVertical: 40,
  },
  loadMoreText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  emptyCard: {
    marginHorizontal: 16,
    paddingVertical: 80,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 8,
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 200,
  },

  // ── Avis ──
  reviewsWrap: {
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 24,
  },
  reviewsLoading: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 16,
  },
  reviewsLoadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  reviewSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  reviewSummaryLeft: {
    alignItems: 'center',
  },
  reviewSummaryAvg: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 32,
  },
  reviewSummaryStars: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 6,
  },
  reviewSummaryCount: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reviewDistribution: {
    flex: 1,
    gap: 4,
  },
  reviewDistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewDistLabel: {
    width: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  reviewDistNumber: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  reviewDistTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  reviewDistFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FACC15',
  },
  reviewDistCount: {
    width: 16,
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  reviewList: {
    gap: 12,
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  reviewHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  reviewAvatarImg: {
    width: '100%',
    height: '100%',
  },
  reviewAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.brand,
  },
  reviewAuthorCol: {
    flexShrink: 1,
  },
  reviewAuthorName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 14,
    marginBottom: 4,
    maxWidth: 120,
  },
  reviewStarsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewMetaCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  reviewDate: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  reviewVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewVerifiedText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#059669',
  },
  reviewComment: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  sellerReply: {
    marginBottom: 12,
    marginLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(245,107,42,0.4)',
    backgroundColor: 'rgba(255,247,237,0.4)',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sellerReplyLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.brand,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 2,
  },
  sellerReplyText: {
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 18,
  },
  reviewProduct: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(249,250,251,0.5)',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  reviewProductPressed: {
    backgroundColor: '#F3F4F6',
  },
  reviewProductThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  reviewProductImage: {
    width: '100%',
    height: '100%',
  },
  reviewProductBody: {
    flex: 1,
  },
  reviewProductName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111827',
  },
  reviewProductCta: {
    fontSize: 9,
    fontWeight: '600',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  showMoreBtn: {
    paddingVertical: 16,
    backgroundColor: '#111827',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  showMoreBtnPressed: {
    backgroundColor: COLORS.brand,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  showMoreChevron: {
    transform: [{ rotate: '90deg' }],
  },

  // ── Boutique introuvable ──
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 96,
  },
  notFoundIcon: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  notFoundTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  notFoundSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 280,
  },
  notFoundBtn: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  notFoundBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Feuille « Voir tout » ──
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,47,52,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingTop: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  sheetTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    paddingHorizontal: 56,
  },
  sheetSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  sheetClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetListView: {
    flexShrink: 1,
  },
  sheetList: {
    paddingHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 24,
  },
  sheetRow: {
    paddingHorizontal: 12,
  },
});
