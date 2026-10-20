/**
 * Fiche produit — alignée sur la version web mobile (ProductDetailsView).
 *
 * Structure : topbar boutique (nom centré + trait orange), galerie plein écran
 * (badges remise/fraîcheur, pastilles, compteur, zoom), carte info (vendeur,
 * titre, preuve sociale, prix, stock + délais, prix de gros), description
 * enrichie repliable, avis (+ feuille), « Dans la même boutique », barre
 * d'action fixe et feuille d'options.
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Dimensions,
  useWindowDimensions,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  MessageCircle,
  Package,
  ShoppingCart,
  Star,
  Store,
  Truck,
  X,
  Zap,
} from 'lucide-react-native';
import { fetchCatalog, fetchProductReviews, resolveImageUrl } from '@/api/client';
import { useCart } from '@/context/CartContext';
import { ProductLoadingSkeleton } from '@/components/ProductLoadingSkeleton';
import { ProductTile } from '@/components/ProductTile';
import { ProductDescription } from '@/components/RichDescription';
import { useScrollToTopOnChange } from '@/hooks/useScrollToTopOnChange';
import {
  formatCurrency,
  formatNumber,
  formatRating,
  maskName,
  generateProductSlug,
  getNormalizedWholesaleTiers,
} from '@/utils';
import {
  findVariantByOptions,
  optionValueAvailability,
  sameSelectedOptions,
  totalVariantStock,
  variantIsInStock,
} from '@/utils/variants';
import {
  buildAutoBadges,
  buildAutoSpecs,
  extractDescriptionHighlights,
} from '@/utils/product-description';
import type { StorefrontProduct, StoreData, Review } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BRAND = '#F56B2A';

/** Carte de couleurs pour l'affichage nuancier (option « couleur »). */
const COLOR_HEX: Record<string, string> = {
  noir: '#111111', blanc: '#ffffff', rouge: '#dc2626', bleu: '#2563eb',
  marine: '#1e3a8a', vert: '#16a34a', kaki: '#6b7280', jaune: '#eab308',
  orange: '#f97316', rose: '#ec4899', violet: '#7c3aed', gris: '#9ca3af',
  beige: '#d6c7a1', marron: '#795548', bordeaux: '#6b1226', or: '#f59e0b',
  argent: '#cbd5e1', 'bleu ciel': '#38bdf8', menthe: '#2dd4bf',
  ecru: '#efeae2', turquoise: '#14b8a6', magenta: '#d946ef', cyan: '#22d3ee',
  lavande: '#a78bfa', corail: '#fb7185', saumon: '#fda4af', champagne: '#f7e7ce',
};

function colorHexFor(value: string): string | undefined {
  const v = value.trim().toLowerCase();
  if (COLOR_HEX[v]) return COLOR_HEX[v];
  if (/^#?[0-9a-f]{3,8}$/i.test(v)) return v.startsWith('#') ? v : `#${v}`;
  return undefined;
}

const formatGrouped = (v: number) =>
  Math.floor(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const AVATAR_TONES = [
  { bg: '#ffedd5', fg: '#c2410c' },
  { bg: '#fef3c7', fg: '#b45309' },
  { bg: '#ffe4e6', fg: '#e11d48' },
];

export default function ProductDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { addToCart, cart, cartCount } = useCart();

  // La feuille d'options garde son CTA visible : on borne la zone scrollable
  // pour que le pied (prix + « Ajouter au panier ») ne soit jamais poussé
  // hors de l'écran quand les options sont longues.
  const sheetMaxHeight = Math.min(
    Math.round(windowHeight * 0.88),
    windowHeight - 20,
  );
  const sheetScrollMaxHeight = Math.max(140, sheetMaxHeight - 72);

  const scrollRef = useRef<ScrollView>(null);
  const galleryRef = useRef<ScrollView>(null);

  // Navigation produit → produit : Expo Router peut réutiliser l'écran,
  // ce qui conservait le scroll en bas de la fiche précédente.
  useScrollToTopOnChange(scrollRef, slug);

  const [reviewsY, setReviewsY] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [isOptionsSheetOpen, setIsOptionsSheetOpen] = useState(false);
  const [sheetFooterHeight, setSheetFooterHeight] = useState(0);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [isWholesaleExpanded, setIsWholesaleExpanded] = useState(false);
  const [addedWholesaleIdx, setAddedWholesaleIdx] = useState<number | null>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Affiche le squelette de chargement (comme le `loading.tsx` du web)
  // pendant l'ouverture de la fiche, meme si le catalogue est en cache.
  const [isOpening, setIsOpening] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsOpening(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Nouvelle fiche produit : réinitialiser l'état transitoire (galerie,
  // options, feuilles, description) pour ne rien hériter de la fiche
  // précédente lorsque l'écran est réutilisé.
  useEffect(() => {
    setReviewsY(0);
    setActiveImageIndex(0);
    setZoomImage(null);
    setSelectedOptions({});
    setIsOptionsSheetOpen(false);
    setShowAllReviews(false);
    setIsWholesaleExpanded(false);
    setAddedWholesaleIdx(null);
    setIsDescriptionExpanded(false);
    setToast(null);

    const frame = requestAnimationFrame(() => {
      galleryRef.current?.scrollTo({ x: 0, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [slug]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  // ── Catalogue : produit + boutique + produits de la même boutique ──
  const { data: catalogData, isLoading: isCatalogLoading, refetch: refetchCatalog } = useQuery({
    queryKey: ['catalog'],
    queryFn: fetchCatalog,
    staleTime: 60_000,
  });

  /** Tirer vers le bas : recharge le catalogue (fiche produit + boutique). */
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchCatalog();
    } finally {
      setRefreshing(false);
    }
  }, [refetchCatalog]);

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
        // Similaires = autres produits de la même boutique, même catégorie
        // d'abord (jamais de produit d'une autre boutique).
        related = (s.products || [])
          .filter((item) => item.id !== p.id && item.isOnline !== false)
          .sort(
            (a, b) =>
              Number(b.category === p.category) - Number(a.category === p.category),
          )
          .slice(0, 8)
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

  // ── Avis ──
  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', product?.id],
    queryFn: () =>
      product?.id
        ? fetchProductReviews(product.id)
        : Promise.resolve({ success: true, reviews: [] as Review[] }),
    enabled: !!product?.id,
  });

  const reviews: Review[] = useMemo(() => {
    const fromApi = reviewsData?.reviews;
    if (Array.isArray(fromApi) && fromApi.length > 0) return fromApi;
    return Array.isArray(product?.reviews) ? product.reviews : [];
  }, [reviewsData, product]);

  // ── Galerie ──
  // La photo de la variante complète devient la photo principale, comme sur
  // le web : l'acheteur voit exactement ce qu'il est en train de commander.
  const selectedVariantImage = useMemo(() => {
    if (
      !product ||
      !Array.isArray(product.options) ||
      !Array.isArray(product.variants) ||
      product.options.length === 0 ||
      product.variants.length === 0
    ) {
      return null;
    }
    if (!product.options.every((option) => !!selectedOptions[option.id])) {
      return null;
    }
    return findVariantByOptions(product.variants, selectedOptions)?.image || null;
  }, [product, selectedOptions]);

  const images = useMemo(() => {
    if (!product) return [];
    const list: string[] = [];
    if (selectedVariantImage) list.push(selectedVariantImage);
    if (product.image && !list.includes(product.image)) list.push(product.image);
    if (Array.isArray(product.images)) {
      product.images.forEach((img) => {
        if (img && !list.includes(img)) list.push(img);
      });
    }
    return list;
  }, [product, selectedVariantImage]);

  // Repositionne la galerie sur la photo de la variante dès qu'elle change.
  useEffect(() => {
    setActiveImageIndex(0);
    const frame = requestAnimationFrame(() => {
      galleryRef.current?.scrollTo({ x: 0, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedVariantImage]);

  // ── Options / variantes ──
  const options = useMemo(
    () => (Array.isArray(product?.options) ? product!.options! : []),
    [product],
  );
  const variants = useMemo(
    () => (Array.isArray(product?.variants) ? product!.variants! : []),
    [product],
  );
  const hasOptions = options.length > 0;
  const hasVariantMatrix = hasOptions && variants.length > 0;
  const selectedOptionCount = options.filter((o) => !!selectedOptions[o.id]).length;
  const allSelected = !hasOptions || options.every((o) => !!selectedOptions[o.id]);
  const matchedVariant = hasOptions
    ? findVariantByOptions(variants, selectedOptions)
    : undefined;
  const resolvedVariantId = hasVariantMatrix ? matchedVariant?.id : undefined;

  // ── Stock (variante choisie d'abord, sinon total des variantes) ──
  const selectedStock = product
    ? hasVariantMatrix
      ? matchedVariant
        ? Math.max(0, Number(matchedVariant.stock) || 0)
        : totalVariantStock(variants)
      : Number(product.stock) || 0
    : null;
  const stockValue = selectedStock;
  const isOutOfStock = stockValue === 0;
  const isSelectedOutOfStock =
    hasVariantMatrix && allSelected && (!matchedVariant || !variantIsInStock(matchedVariant));
  const isBuyDisabled = isOutOfStock || isSelectedOutOfStock;
  const isLowStock = stockValue !== null && stockValue > 0 && stockValue <= 5;

  // ── Prix ──
  const basePrice = matchedVariant
    ? Number(matchedVariant.price) || 0
    : Number(product?.price) || 0;
  const discountPct =
    product?.originalPrice && product.originalPrice > basePrice
      ? Math.round(((product.originalPrice - basePrice) / product.originalPrice) * 100)
      : 0;

  // ── Gros / food / WhatsApp ──
  const wholesaleTiers = useMemo(
    () => (product ? getNormalizedWholesaleTiers(product) : []),
    [product],
  );
  const mainCat = product?.mainCategory || product?.category || 'Boutique';
  const realCategory = product?.mainCategory || product?.category || '';
  const isFood =
    product?.businessType === 'food' || mainCat === 'Restauration & Livraison Rapide';
  const hasWholesale = wholesaleTiers.length > 0 && !isFood;
  const storePhone = store?.phone || store?.settings?.phone;
  const waDigits = storePhone ? String(storePhone).replace(/\D/g, '') : null;
  const storeLogo = store?.settings?.logo;

  const isCurrentSelectionInCart = product
    ? cart.some(
        (item) =>
          item.product.id === product.id &&
          item.product.storeId === product.storeId &&
          (item.variantId ?? null) === (resolvedVariantId ?? null) &&
          sameSelectedOptions(
            item.selectedOptions,
            selectedOptionCount > 0 ? selectedOptions : undefined,
          ),
      )
    : false;

  // ── Description enrichie (auto) ──
  const descriptionText = product?.description || '';
  const autoHighlights = useMemo(
    () => extractDescriptionHighlights(descriptionText),
    [descriptionText],
  );
  const autoSpecs = useMemo(
    () =>
      product
        ? buildAutoSpecs(product, {
            mainCategory: mainCat,
            storeName: product.storeName,
            isFood,
            isOutOfStock,
            stock: stockValue,
          })
        : [],
    [product, mainCat, isFood, isOutOfStock, stockValue],
  );
  const autoBadges = useMemo(() => (product ? buildAutoBadges(product) : []), [product]);
  const hasMoreContent =
    descriptionText.length > 180 ||
    autoSpecs.length > 0 ||
    autoHighlights.length > 0 ||
    autoBadges.length > 0;

  // ── Avis ──
  const rating = product?.rating || 0;
  const reviewTotal = reviews.length || product?.reviewCount || 0;
  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length;
    const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
    return { star, pct };
  });

  // ── Actions ──
  const primaryActionLabel =
    isOutOfStock || isSelectedOutOfStock
      ? 'Rupture'
      : hasOptions && !allSelected
        ? 'Choisir les options'
        : isFood
          ? 'Commander'
          : 'Ajouter au panier';

  // Même libellé que la feuille web mobile. Un appui sans sélection complète
  // affiche un toast au lieu de ne rien faire, mais le bouton reste visible
  // et actif tant que le produit a du stock.
  const sheetActionDisabled = isBuyDisabled;
  const sheetActionLabel =
    isOutOfStock || isSelectedOutOfStock
      ? 'Rupture'
      : isFood
        ? 'Commander'
        : 'Ajouter au panier';

  // Sans combinaison complète, le bouton de gros ouvre le sélecteur : son
  // libellé doit annoncer cette action plutôt qu'un ajout impossible.
  const wholesaleNeedsOptions = hasVariantMatrix && !matchedVariant;

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/' as never);
  }, [router]);

  const goToCart = useCallback(() => {
    router.push('/cart' as never);
  }, [router]);

  const openStore = useCallback(() => {
    if (!product) return;
    router.push(`/store/${product.storeSlug || product.storeId}` as never);
  }, [product, router]);

  const scrollToReviews = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(0, reviewsY - 12), animated: true });
  }, [reviewsY]);

  const selectValue = useCallback((optionId: string, value: string) => {
    setSelectedOptions((prev) => {
      // Re-toucher la valeur active la retire : même comportement que le web.
      if (prev[optionId] === value) {
        const next = { ...prev };
        delete next[optionId];
        return next;
      }
      return { ...prev, [optionId]: value };
    });
  }, []);

  const removeOption = useCallback((optionId: string) => {
    setSelectedOptions((prev) => {
      const next = { ...prev };
      delete next[optionId];
      return next;
    });
  }, []);

  const isValueDisabled = useCallback(
    (optionId: string, value: string) => {
      if (variants.length === 0) return false;
      if (selectedOptions[optionId] === value) return false;
      return !optionValueAvailability(variants, selectedOptions, optionId, value).available;
    },
    [variants, selectedOptions],
  );

  const handlePrimaryAdd = useCallback(() => {
    if (!product || isBuyDisabled) return;
    if (hasOptions && !allSelected) {
      setIsOptionsSheetOpen(true);
      return;
    }
    addToCart(
      product,
      1,
      resolvedVariantId,
      selectedOptionCount > 0 ? selectedOptions : undefined,
    );
    showToast('Produit ajouté au panier !');
  }, [
    product,
    isBuyDisabled,
    hasOptions,
    allSelected,
    addToCart,
    resolvedVariantId,
    selectedOptionCount,
    selectedOptions,
    showToast,
  ]);

  const handleSheetAdd = useCallback(() => {
    if (!product || isBuyDisabled) return;
    if (!allSelected) {
      showToast('Sélectionnez les options pour commander');
      return;
    }
    addToCart(
      product,
      1,
      resolvedVariantId,
      selectedOptionCount > 0 ? selectedOptions : undefined,
    );
    setIsOptionsSheetOpen(false);
    showToast('Produit ajouté au panier !');
  }, [
    product,
    isBuyDisabled,
    allSelected,
    addToCart,
    resolvedVariantId,
    selectedOptionCount,
    selectedOptions,
    showToast,
  ]);

  const handleWholesaleAdd = useCallback(
    (idx: number, minQty: number) => {
      if (!product || addedWholesaleIdx === idx) return;
      if (hasVariantMatrix && !matchedVariant) {
        setIsOptionsSheetOpen(true);
        return;
      }
      if (stockValue !== null && stockValue < minQty) {
        showToast(
          `Stock insuffisant (${stockValue} disponibles) pour la quantité de ${minQty}`,
        );
        return;
      }
      addToCart(
        product,
        minQty,
        matchedVariant?.id,
        selectedOptionCount > 0 ? selectedOptions : undefined,
      );
      setAddedWholesaleIdx(idx);
      setTimeout(() => {
        setAddedWholesaleIdx((prev) => (prev === idx ? null : prev));
      }, 1900);
    },
    [
      product,
      addedWholesaleIdx,
      hasVariantMatrix,
      matchedVariant,
      stockValue,
      addToCart,
      selectedOptionCount,
      selectedOptions,
      showToast,
    ],
  );

  const openWhatsApp = useCallback(
    (message: string) => {
      if (!waDigits) return;
      Linking.openURL(`https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`);
    },
    [waDigits],
  );

  if (isCatalogLoading || isOpening) {
    return <ProductLoadingSkeleton />;
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.errorContainer} edges={['top', 'bottom']}>
        <View style={styles.errorIcon}>
          <Package size={30} color="#9ca3af" />
        </View>
        <Text style={styles.errorTitle}>Produit introuvable</Text>
        <Text style={styles.errorSub}>
          Ce produit n&apos;existe plus ou n&apos;est pas disponible actuellement.
        </Text>
        <Pressable style={styles.errorBtn} onPress={() => router.replace('/' as never)}>
          <Text style={styles.errorBtnText}>Retour à l&apos;accueil</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const stockUnavailable = isOutOfStock || isSelectedOutOfStock;
  const stockLabel =
    isSelectedOutOfStock && !isOutOfStock
      ? 'Combinaison indisponible'
      : isOutOfStock
        ? 'Rupture de stock'
        : isLowStock
          ? `Plus que ${formatNumber(stockValue ?? 0)} disponibles`
          : stockValue !== null
            ? `${formatNumber(stockValue)} en stock`
            : 'En stock';
  const stockTone = stockUnavailable ? '#dc2626' : isLowStock ? '#d97706' : '#047857';
  const prepTime = isFood ? product.preparationTime : undefined;

  const renderReview = (review: Review, idx: number, compact = false) => {
    const tone = AVATAR_TONES[idx % AVATAR_TONES.length];
    return (
      <View key={review.id ?? String(idx)} style={styles.reviewCard}>
        <View style={[styles.reviewAvatar, { backgroundColor: review.avatarUrl ? '#f3f4f6' : tone.bg }]}>
          {review.avatarUrl ? (
            <Image
              source={{ uri: resolveImageUrl(review.avatarUrl) }}
              style={styles.reviewAvatarImg}
              contentFit="cover"
              alt=""
              accessible={false}
            />
          ) : (
            <Text style={[styles.reviewAvatarText, { color: tone.fg }]}>
              {review.author?.[0]?.toUpperCase() || 'A'}
            </Text>
          )}
        </View>
        <View style={styles.reviewBody}>
          <View style={styles.reviewTopRow}>
            <View style={styles.reviewHead}>
              <Text style={styles.reviewAuthor} numberOfLines={1}>
                {maskName(review.author)}
              </Text>
              <View style={styles.reviewStars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={11}
                    color="#fbbf24"
                    fill={s <= review.rating ? '#fbbf24' : 'none'}
                  />
                ))}
              </View>
            </View>
            <View style={styles.reviewMeta}>
              <Text style={styles.reviewDate}>
                {new Date(review.date).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
              <View style={styles.reviewVerified}>
                <CheckCircle2 size={10} color="#10b981" />
                <Text style={styles.reviewVerifiedText}>Avis vérifié</Text>
              </View>
            </View>
          </View>
          {review.comment ? (
            <Text
              style={styles.reviewComment}
              numberOfLines={compact ? 3 : undefined}
            >
              {review.comment}
            </Text>
          ) : null}
          {review.sellerReply ? (
            <View style={styles.sellerReply}>
              <Text style={styles.sellerReplyLabel}>Réponse du vendeur</Text>
              <Text
                style={styles.sellerReplyText}
                numberOfLines={compact ? 2 : undefined}
              >
                {review.sellerReply}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Topbar boutique (nom centré + trait) ── */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <View style={styles.topBarRow}>
          <Pressable
            style={styles.backBtn}
            onPress={goBack}
            hitSlop={8}
            accessibilityLabel="Retour"
          >
            <ArrowLeft size={20} color="#111827" />
          </Pressable>
          <Pressable style={styles.storeLink} onPress={openStore}>
            <Text style={styles.storeLinkText} numberOfLines={2}>
              {product.storeName}
            </Text>
          </Pressable>
          <View style={styles.backGhost} />
        </View>
        <View style={styles.storeUnderline} />
      </SafeAreaView>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND}
            colors={[BRAND]}
          />
        }
      >
        {/* ── Galerie plein-écran ── */}
        <View style={styles.gallery}>
          <ScrollView
            ref={galleryRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const offset = e.nativeEvent.contentOffset.x;
              setActiveImageIndex(Math.round(offset / SCREEN_WIDTH));
            }}
            scrollEventThrottle={16}
          >
            {images.map((imgUri, idx) => (
              <Pressable
                key={idx}
                onPress={() => setZoomImage(imgUri)}
                accessibilityRole="button"
                accessibilityLabel={`Agrandir la photo ${idx + 1} de ${product.name}`}
              >
                <Image
                  source={{ uri: resolveImageUrl(imgUri) }}
                  style={styles.galleryImage}
                  contentFit="cover"
                  transition={150}
                  alt=""
                  accessible={false}
                />
              </Pressable>
            ))}
          </ScrollView>

          {/* Pastilles (pilule translucide) */}
          {images.length > 1 && (
            <View style={styles.dotsPill}>
              {images.map((_, idx) => (
                <Pressable
                  key={idx}
                  onPress={() =>
                    galleryRef.current?.scrollTo({
                      x: idx * SCREEN_WIDTH,
                      animated: true,
                    })
                  }
                  style={[
                    styles.dot,
                    activeImageIndex === idx ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              ))}
            </View>
          )}

          {/* Badges (haut gauche) */}
          <View style={styles.galleryBadges}>
            {discountPct > 0 && (
              <View style={styles.discountBadge}>
                <Zap size={10} color="#ffffff" fill="#ffffff" />
                <Text style={styles.discountBadgeText}>-{discountPct}%</Text>
              </View>
            )}
            {isFood && (
              <View style={styles.freshBadge}>
                <Clock size={10} color="#15803d" />
                <Text style={styles.freshBadgeText} numberOfLines={1}>
                  Fraîchement préparé · {product.preparationTime || product.deliveryTime || 'Délai non précisé'}
                </Text>
              </View>
            )}
          </View>

          {/* Compteur (bas droite) */}
          {images.length > 1 && (
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>
                {activeImageIndex + 1}/{images.length}
              </Text>
            </View>
          )}
        </View>

        {/* ── Carte info compacte ── */}
        <View style={[styles.card, styles.infoCard]}>
          {/* Vendeur */}
          <Pressable
            style={styles.sellerRow}
            onPress={openStore}
            accessibilityRole="button"
            accessibilityLabel={`Voir la boutique ${product.storeName}`}
          >
            <View style={styles.sellerLogo}>
              {storeLogo ? (
                <Image
                  source={{ uri: resolveImageUrl(storeLogo) }}
                  style={styles.sellerLogoImg}
                  contentFit="cover"
                  alt=""
                  accessible={false}
                />
              ) : (
                <Store size={14} color="#d1d5db" />
              )}
            </View>
            <View style={styles.sellerTexts}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerLabel}>Vendu par</Text>
                <Text style={styles.sellerName} numberOfLines={1}>
                  {product.storeName}
                </Text>
                <CheckCircle2 size={11} color={BRAND} />
              </View>
              {realCategory ? (
                <Pressable
                  style={styles.categoryLink}
                  onPress={() => router.push('/' as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`Voir la catégorie ${realCategory}`}
                >
                  <Text style={styles.categoryText} numberOfLines={1}>
                    {realCategory}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <ChevronRight size={14} color="#c4c9d1" />
          </Pressable>

          {/* Titre */}
          <Text style={styles.productName} numberOfLines={3} accessibilityRole="header">
            {product.name}
          </Text>

          {/* Stats compactes */}
          <Pressable
            style={styles.proofRow}
            onPress={scrollToReviews}
            accessibilityRole="button"
            accessibilityLabel={
              rating > 0
                ? `Note ${formatRating(rating)} sur 5, ${formatNumber(reviewTotal)} avis. Voir les avis.`
                : `Nouveau produit, ${formatNumber(reviewTotal)} avis. Voir les avis.`
            }
          >
            {rating > 0 ? (
              <>
                <Star size={11} color="#EAB308" fill="#EAB308" />
                <Text style={styles.ratingValue}>{formatRating(rating)}</Text>
              </>
            ) : (
              <Text style={styles.newLabel}>Nouveau</Text>
            )}
            <Text style={styles.proofText} numberOfLines={1}>
              ({formatNumber(reviewTotal)} avis)
            </Text>
            {product.salesCount !== undefined && product.salesCount > 0 ? (
              <>
                <View style={styles.proofDot} />
                <Text style={styles.proofText}>
                  {formatNumber(product.salesCount)} {isFood ? 'commandes' : 'vendus'}
                </Text>
              </>
            ) : null}
            {product.views !== undefined && product.views > 0 ? (
              <>
                <View style={styles.proofDot} />
                <Text style={styles.proofText}>{formatNumber(product.views)} vues</Text>
              </>
            ) : null}
          </Pressable>

          {/* Prix compact */}
          <View style={styles.priceRow}>
            <View style={styles.priceLeft}>
              <Text style={styles.priceLabel}>
                {hasOptions && !allSelected ? 'Dès' : 'Prix'}
              </Text>
              <Text style={styles.priceValue}>{formatCurrency(basePrice)}</Text>
              {product.unit && !hasOptions ? (
                <Text style={styles.priceUnit}>/{product.unit}</Text>
              ) : null}
              {product.originalPrice && product.originalPrice > basePrice ? (
                <Text style={styles.priceOriginal}>
                  {formatCurrency(product.originalPrice)}
                </Text>
              ) : null}
            </View>
            {discountPct > 0 ? (
              <View style={styles.priceDiscountBadge}>
                <Text style={styles.priceDiscountBadgeText}>-{discountPct}%</Text>
              </View>
            ) : null}
          </View>

          {/* Stock + délais sur une ligne */}
          <View style={styles.stockRow}>
            <View style={styles.stockState}>
              {stockUnavailable || isLowStock ? (
                <AlertCircle size={11} color={stockTone} />
              ) : (
                <View style={styles.stockDot} />
              )}
              <Text style={[styles.stockText, { color: stockTone }]}>{stockLabel}</Text>
            </View>
            {prepTime ? (
              <View style={styles.delayItem}>
                <Clock size={11} color="#16a34a" />
                <Text style={styles.delayText}>
                  Prêt en <Text style={styles.delayValue}>{prepTime}</Text>
                </Text>
              </View>
            ) : null}
            {product.deliveryTime ? (
              <View style={styles.delayItem}>
                <Truck size={11} color="#3b82f6" />
                <Text style={styles.delayText}>
                  Livraison <Text style={styles.delayValue}>{product.deliveryTime}</Text>
                </Text>
              </View>
            ) : null}
          </View>

          {/* Prix de gros (accordéon) */}
          {hasWholesale && (
            <View style={styles.wholesale}>
              <Pressable
                style={styles.wholesaleHeader}
                onPress={() => setIsWholesaleExpanded((v) => !v)}
                accessibilityLabel="Tarifs de gros"
              >
                <View style={styles.wholesaleHeaderLeft}>
                  <Zap size={12} color={BRAND} fill={BRAND} />
                  <Text style={styles.wholesaleHeaderText}>PRIX DE GROS</Text>
                </View>
                <View style={styles.wholesaleHeaderRight}>
                  <Text style={styles.wholesaleDegressive}>Dégressif</Text>
                  <ChevronDown
                    size={14}
                    color="#b45309"
                    style={{
                      transform: [{ rotate: isWholesaleExpanded ? '180deg' : '0deg' }],
                    }}
                  />
                </View>
              </Pressable>

              {isWholesaleExpanded && (
                <>
                  <View style={styles.wholesaleBody}>
                    {wholesaleTiers.map((tier, idx) => {
                      const isAdded = addedWholesaleIdx === idx;
                      const isTierUnavailable =
                        stockValue !== null && stockValue < tier.minQty;
                      return (
                        <View
                          key={idx}
                          style={[
                            styles.wholesaleRow,
                            idx > 0 ? styles.wholesaleRowBorder : null,
                            isTierUnavailable ? styles.wholesaleRowUnavailable : null,
                          ]}
                        >
                          <View style={styles.wholesaleRowLeft}>
                            <Text style={styles.wholesaleQty}>
                              Qté Min : {tier.minQty} pièces
                            </Text>
                            <Text style={styles.wholesaleDot}>•</Text>
                            <Text style={styles.wholesaleTotal}>
                              Prix total : {formatGrouped(tier.packagePrice)} F
                            </Text>
                          </View>
                          <View style={styles.wholesaleRowRight}>
                            {tier.discountPct > 0 && (
                              <Text style={styles.wholesaleDiscount}>-{tier.discountPct}%</Text>
                            )}
                            {isTierUnavailable ? (
                              <View style={styles.wholesaleLowStock}>
                                <AlertCircle size={10} color="#ef4444" />
                                <Text style={styles.wholesaleLowStockText}>Stock bas</Text>
                              </View>
                            ) : (
                              <Pressable
                                style={[
                                  styles.wholesaleAdd,
                                  isAdded ? styles.wholesaleAddDone : null,
                                ]}
                                onPress={() => handleWholesaleAdd(idx, tier.minQty)}
                                accessibilityRole="button"
                                accessibilityLabel={
                                  wholesaleNeedsOptions
                                    ? 'Choisir les options de la variante'
                                    : `Ajouter ${tier.minQty} pièces au panier`
                                }
                              >
                                {isAdded ? (
                                  <Check size={11} color="#ffffff" strokeWidth={3} />
                                ) : (
                                  <Text style={styles.wholesaleAddText}>
                                    {wholesaleNeedsOptions ? 'Choisir' : 'Ajouter'}
                                  </Text>
                                )}
                              </Pressable>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {waDigits && (
                    <View style={styles.wholesaleFooter}>
                      <Text style={styles.wholesaleFooterText}>
                        {"Besoin d'un devis volume ?"}
                      </Text>
                      <Pressable
                        onPress={() =>
                          openWhatsApp(
                            `Bonjour ${product.storeName}, je vous contacte pour le produit "${product.name}" (Réf: ${product.id}). J'aimerais commander un gros volume. Pouvez-vous me faire votre meilleur prix de gros ? Merci !`,
                          )
                        }
                      >
                        <View style={styles.wholesaleWhatsApp}>
                          <MessageCircle size={11} color="#059669" />
                          <Text style={styles.wholesaleWhatsAppText}>
                            Négocier sur WhatsApp
                          </Text>
                        </View>
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </View>

        {/* ── Description ── */}
        <View style={[styles.card, styles.cardSpacing]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTick} />
            <Text style={styles.cardHeaderText}>
              {isFood ? 'Détails du plat' : 'Description produit'}
            </Text>
          </View>
          <View style={isDescriptionExpanded ? null : styles.descriptionCollapsed}>
            <ProductDescription
              text={descriptionText}
              highlights={autoHighlights}
              badges={autoBadges}
              specs={autoSpecs}
            />
          </View>
          {hasMoreContent && (
            <Pressable
              style={styles.readMoreBtn}
              onPress={() => setIsDescriptionExpanded((v) => !v)}
            >
              <Text style={styles.readMoreText}>
                {isDescriptionExpanded ? 'Réduire' : 'Lire la suite'}
              </Text>
              <ChevronRight
                size={10}
                color={BRAND}
                style={{
                  transform: [{ rotate: isDescriptionExpanded ? '-90deg' : '90deg' }],
                }}
              />
            </Pressable>
          )}
        </View>

        {/* ── Avis ── */}
        <View
          style={[styles.card, styles.cardSpacing, styles.reviewsCard]}
          onLayout={(e) => setReviewsY(e.nativeEvent.layout.y)}
        >
          <View
            style={[
              styles.cardHeaderRow,
              styles.cardHeaderRowAvis,
              styles.reviewsHeaderRow,
            ]}
          >
            <Text style={[styles.cardHeaderText, styles.cardHeaderTextSm]}>
              Avis {isFood ? 'sur le repas' : 'sur le produit'}
            </Text>
            {reviews.length > 2 ? (
              <Pressable
                style={styles.reviewsHeaderLink}
                onPress={() => setShowAllReviews(true)}
                accessibilityRole="button"
                accessibilityLabel={`Voir les ${reviews.length} avis`}
              >
                <Text style={styles.reviewsHeaderLinkText}>Voir tout</Text>
                <ChevronRight size={11} color={BRAND} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.reviewSummary}>
            <View style={styles.reviewSummaryScore}>
              <View style={styles.reviewSummaryValueRow}>
                <Text style={styles.reviewSummaryValue}>{formatRating(rating)}</Text>
                <Text style={styles.reviewSummaryMax}>/5</Text>
              </View>
              <View style={styles.reviewSummaryStars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={10}
                    color="#fbbf24"
                    fill={s <= Math.round(rating) ? '#fbbf24' : 'none'}
                  />
                ))}
              </View>
              <Text style={styles.reviewSummaryCount}>
                {formatNumber(reviewTotal)} avis
              </Text>
            </View>

            {reviews.length > 0 ? (
              <View style={styles.distribution}>
                {distribution.map(({ star, pct }) => (
                  <View key={star} style={styles.distributionRow}>
                    <View style={styles.distributionStarLabel}>
                      <Text style={styles.distributionStarText}>{star}</Text>
                      <Star size={6} color="#facc15" fill="#facc15" />
                    </View>
                    <View style={styles.distributionTrack}>
                      <View style={[styles.distributionFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={styles.distributionPct}>{pct}%</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {reviews.length === 0 ? (
            <View style={styles.reviewsEmpty}>
              <MessageCircle size={16} color="#d1d5db" />
              <Text style={styles.reviewsEmptyTitle}>Aucun avis rédigé</Text>
              <Text style={styles.reviewsEmptySub}>
                {isFood
                  ? 'Soyez le premier à donner votre avis !'
                  : 'Partagez votre avis pour aider la communauté !'}
              </Text>
            </View>
          ) : (
            reviews.slice(0, 2).map((r, idx) => renderReview(r, idx, true))
          )}
        </View>

        {/* ── Dans la même boutique ── */}
        {relatedProducts.length > 0 && (
          <View style={styles.relatedSection}>
            <View style={styles.relatedHeader}>
              <Text style={[styles.cardHeaderText, styles.cardHeaderTextSm]}>
                Dans la même boutique
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.relatedScrollView}
              contentContainerStyle={styles.relatedScroll}
            >
              {relatedProducts.map((p) => (
                <View key={p.id} style={styles.relatedCardWrap}>
                  <ProductTile
                    product={p}
                    onPress={() =>
                      router.push(
                        `/product/${generateProductSlug({ id: p.id, name: p.name })}` as never,
                      )
                    }
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* ── Toast ── */}
      {toast && (
        <View style={styles.toast}>
          <Check size={16} color="#ffffff" />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* ── Barre d'action fixe ── */}
      <View style={[styles.bottomBar, { paddingBottom: 10 + insets.bottom }]}>
        {isCurrentSelectionInCart ? (
          <Pressable
            style={styles.cartWideBtn}
            onPress={goToCart}
            accessibilityLabel={`Voir le panier, ${cartCount} article(s)`}
          >
            <ShoppingCart size={15} color="#ffffff" strokeWidth={2.5} />
            <Text style={styles.cartWideText}>Voir mon panier</Text>
            <View style={styles.cartWideBadge}>
              <Text style={styles.cartWideBadgeText}>
                {cartCount > 99 ? '99+' : cartCount}
              </Text>
            </View>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={[styles.primaryBtn, isBuyDisabled ? styles.btnDisabled : null]}
              onPress={handlePrimaryAdd}
              disabled={isBuyDisabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: isBuyDisabled }}
              accessibilityLabel={primaryActionLabel}
            >
              {hasOptions && !allSelected && !isBuyDisabled ? (
                <Package size={15} color="#ffffff" strokeWidth={2.5} />
              ) : (
                <ShoppingCart size={15} color="#ffffff" strokeWidth={2.5} />
              )}
              <Text style={styles.primaryBtnText} numberOfLines={1}>
                {primaryActionLabel}
              </Text>
            </Pressable>
            {cartCount > 0 && (
              <Pressable
                style={styles.cartCircle}
                onPress={goToCart}
                accessibilityLabel={`Voir le panier, ${cartCount} article(s)`}
              >
                <ShoppingCart size={18} color="#ffffff" strokeWidth={2.5} />
                <View style={styles.cartCircleBadge}>
                  <Text style={styles.cartCircleBadgeText}>
                    {cartCount > 99 ? '99+' : cartCount}
                  </Text>
                </View>
              </Pressable>
            )}
          </>
        )}
      </View>

      {/* ── Feuille options ── */}
      <Modal
        visible={isOptionsSheetOpen && hasOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOptionsSheetOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setIsOptionsSheetOpen(false)}
          />
          <View style={[styles.sheet, { maxHeight: sheetMaxHeight }]}>
            <View style={styles.sheetHandleWrap}>
              <View style={styles.sheetHandle} />
            </View>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Choisir les options</Text>
              <Pressable
                style={[styles.sheetClose, styles.optionsSheetClose]}
                onPress={() => setIsOptionsSheetOpen(false)}
                accessibilityLabel="Fermer"
              >
                <X size={18} color="#6b7280" />
              </Pressable>
            </View>

            <ScrollView
              style={[styles.sheetScroll, { maxHeight: sheetScrollMaxHeight }]}
              contentContainerStyle={[
                styles.sheetScrollContent,
                { paddingBottom: sheetFooterHeight + 16 },
              ]}
            >
              {selectedOptionCount > 0 && (
                <View style={styles.selectionBox}>
                  <Text style={styles.selectionLabel}>Sélection :</Text>
                  {options.map((o) => {
                    const v = selectedOptions[o.id];
                    if (!v) return null;
                    return (
                      <View key={o.id} style={styles.selectionChip}>
                        <Text style={styles.selectionChipText}>
                          {o.name}: {v}
                        </Text>
                        <Pressable
                          style={styles.selectionChipX}
                          onPress={() => removeOption(o.id)}
                          accessibilityLabel={`Retirer ${o.name}`}
                        >
                          <X size={9} color="#4b5563" strokeWidth={3} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}

              {options.map((option) => {
                const selectedVal = selectedOptions[option.id];
                return (
                  <View key={option.id} style={styles.optionGroup}>
                    <View style={styles.optionHeader}>
                      <Text style={styles.optionName}>{option.name}</Text>
                      {selectedVal ? (
                        <Text style={styles.optionSelected}>{selectedVal}</Text>
                      ) : (
                        <Text style={styles.optionPlaceholder}>Choisissez...</Text>
                      )}
                    </View>
                    <View style={styles.optionValues}>
                      {option.values.map((val) => {
                        const isSelected = selectedVal === val;
                        const isDisabled = isValueDisabled(option.id, val);
                        const isSwatch = /couleur|color/i.test(option.name);
                        const hex = isSwatch ? colorHexFor(val) : undefined;
                        if (isSwatch && hex) {
                          const isLight =
                            (COLOR_HEX[val.trim().toLowerCase()] || hex) === '#ffffff';
                          return (
                            <Pressable
                              key={val}
                              disabled={isDisabled}
                              onPress={() => selectValue(option.id, val)}
                              accessibilityRole="button"
                              accessibilityLabel={
                                isDisabled ? `${val}, indisponible` : val
                              }
                              accessibilityState={{
                                selected: isSelected,
                                disabled: isDisabled,
                              }}
                              style={[
                                styles.swatch,
                                { backgroundColor: hex },
                                isSelected
                                  ? styles.swatchSelected
                                  : isDisabled
                                    ? styles.swatchDisabled
                                    : null,
                              ]}
                            >
                              {isSelected && (
                                <Check
                                  size={14}
                                  color={isLight ? '#1f2937' : '#ffffff'}
                                  strokeWidth={3.5}
                                />
                              )}
                              {isDisabled && !isSelected && (
                                <X size={12} color="#9ca3af" />
                              )}
                            </Pressable>
                          );
                        }
                        return (
                          <Pressable
                            key={val}
                            disabled={isDisabled}
                            onPress={() => selectValue(option.id, val)}
                            accessibilityRole="button"
                            accessibilityLabel={isDisabled ? `${val}, indisponible` : val}
                            accessibilityState={{
                              selected: isSelected,
                              disabled: isDisabled,
                            }}
                            style={[
                              styles.chip,
                              isDisabled
                                ? styles.chipDisabled
                                : isSelected
                                  ? styles.chipSelected
                                  : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                isDisabled
                                  ? styles.chipTextDisabled
                                  : isSelected
                                    ? styles.chipTextSelected
                                    : null,
                              ]}
                            >
                              {val}
                            </Text>
                            {isSelected && (
                              <View style={styles.chipCheck}>
                                <Check size={9} color="#ffffff" strokeWidth={3.5} />
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}

              {/* Indice de disponibilité — identique au web (OptionSelectionHint) */}
              {!allSelected ? (
                <View style={styles.hintAmber}>
                  <AlertCircle size={11} color="#b45309" />
                  <Text style={styles.hintAmberText}>
                    Sélectionnez les options pour commander
                  </Text>
                </View>
              ) : hasVariantMatrix ? (
                isSelectedOutOfStock ? (
                  <View style={styles.hintRed}>
                    <AlertCircle size={11} color="#b91c1c" />
                    <Text style={styles.hintRedText}>
                      Cette combinaison est indisponible pour le moment
                    </Text>
                  </View>
                ) : matchedVariant ? (
                  <View style={styles.hintGreen}>
                    <View style={styles.hintGreenLeft}>
                      <CheckCircle2 size={11} color="#047857" />
                      <Text style={styles.hintGreenName} numberOfLines={1}>
                        {matchedVariant.name}
                      </Text>
                    </View>
                    <View style={styles.hintGreenRight}>
                      {Number(matchedVariant.price) > 0 && (
                        <Text style={styles.hintGreenPrice}>
                          {formatCurrency(Number(matchedVariant.price))}
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.hintGreenStock,
                          (Number(matchedVariant.stock) || 0) <= 5
                            ? { color: '#d97706' }
                            : null,
                        ]}
                      >
                        {(Number(matchedVariant.stock) || 0) <= 5
                          ? `Plus que ${formatNumber(Number(matchedVariant.stock) || 0)}`
                          : `${formatNumber(Number(matchedVariant.stock) || 0)} en stock`}
                      </Text>
                    </View>
                  </View>
                ) : null
              ) : null}
            </ScrollView>

            <View
              style={[
                styles.sheetFooter,
                {
                  paddingBottom: 12 + insets.bottom,
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 2,
                },
              ]}
              onLayout={(event) => {
                const height = event.nativeEvent.layout.height;
                if (height > 0 && Math.abs(height - sheetFooterHeight) > 1) {
                  setSheetFooterHeight(height);
                }
              }}
            >
              <View style={styles.sheetFooterRow}>
                <View style={styles.sheetFooterLeft}>
                  <Text style={styles.sheetFooterCount}>
                    {selectedOptionCount}/{options.length} sélectionné
                    {options.length > 1 ? 's' : ''}
                  </Text>
                  {matchedVariant && (
                    <View
                      style={[
                        styles.variantStockPill,
                        variantIsInStock(matchedVariant)
                          ? styles.variantStockOk
                          : styles.variantStockOut,
                      ]}
                    >
                      <Text
                        style={[
                          styles.variantStockPillText,
                          variantIsInStock(matchedVariant)
                            ? styles.variantStockOkText
                            : styles.variantStockOutText,
                        ]}
                      >
                        {variantIsInStock(matchedVariant)
                          ? `${Number(matchedVariant.stock) || 0} en stock`
                          : 'Rupture'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.sheetPrice}>
                  {formatCurrency(matchedVariant ? Number(matchedVariant.price) : basePrice)}
                </Text>
              </View>
              <Pressable
                style={[
                  styles.primaryBtn,
                  styles.sheetCta,
                  sheetActionDisabled ? styles.btnDisabled : null,
                ]}
                onPress={handleSheetAdd}
                disabled={sheetActionDisabled}
                accessibilityRole="button"
                accessibilityState={{ disabled: sheetActionDisabled }}
                accessibilityLabel={sheetActionLabel}
              >
                <ShoppingCart size={15} color="#ffffff" strokeWidth={2.5} />
                <Text style={styles.primaryBtnText} numberOfLines={1}>
                  {sheetActionLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Feuille avis ── */}
      <Modal
        visible={showAllReviews}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllReviews(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowAllReviews(false)}
          />
          <View style={[styles.sheet, styles.reviewsSheet]}>
            <View style={styles.reviewsSheetHeader}>
              <View style={[styles.sheetHandle, styles.reviewsSheetHandle]} />
              <View style={styles.reviewsSheetHeaderRow}>
                <View style={styles.reviewsSheetTitleRow}>
                  <View style={styles.reviewsSheetIcon}>
                    <Star size={16} color="#f59e0b" fill="#f59e0b" />
                  </View>
                  <View>
                    <Text style={styles.reviewsSheetTitle}>{reviews.length} avis</Text>
                    <Text style={styles.reviewsSheetSub}>
                      {isFood ? 'Sur le repas' : 'Sur le produit'} · {formatRating(rating)}/5
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={styles.sheetClose}
                  onPress={() => setShowAllReviews(false)}
                  accessibilityLabel="Fermer"
                >
                  <X size={16} color="#6b7280" />
                </Pressable>
              </View>
            </View>
            <FlatList
              data={reviews}
              keyExtractor={(item, index) =>
                item.id ? String(item.id) : `review-${index}`
              }
              renderItem={({ item, index }) => renderReview(item, index)}
              style={styles.sheetScroll}
              contentContainerStyle={styles.reviewsSheetList}
              initialNumToRender={6}
              maxToRenderPerBatch={8}
              windowSize={7}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      {/* ── Zoom image ── */}
      <Modal
        visible={Boolean(zoomImage)}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomImage(null)}
      >
        <View style={styles.zoomRoot}>
          <Pressable
            style={styles.zoomClose}
            onPress={() => setZoomImage(null)}
            accessibilityLabel="Fermer"
          >
            <X size={20} color="#ffffff" />
          </Pressable>
          {zoomImage ? (
            <Image
              source={{ uri: resolveImageUrl(zoomImage) }}
              style={styles.zoomImage}
              contentFit="contain"
              alt=""
              accessible={false}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  // ── Topbar ──
  topBar: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(243,244,246,0.7)',
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGhost: {
    width: 36,
    height: 36,
  },
  storeLink: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  storeLinkText: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    color: '#111827',
    textAlign: 'center',
  },
  storeUnderline: {
    alignSelf: 'center',
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: BRAND,
    marginTop: 4,
    marginBottom: 12,
  },
  scrollContent: {
    paddingBottom: 160,
  },
  // ── Galerie ──
  gallery: {
    position: 'relative',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginBottom: 14,
  },
  galleryImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: '#f3f4f6',
  },
  dotsPill: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 16,
    backgroundColor: BRAND,
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(156,163,175,0.7)',
  },
  galleryBadges: {
    position: 'absolute',
    top: 12,
    left: 12,
    alignItems: 'flex-start',
    gap: 8,
    maxWidth: SCREEN_WIDTH - 24,
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ef4444',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  discountBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  freshBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: '#f0fdf4',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: SCREEN_WIDTH - 24,
  },
  freshBadgeText: {
    color: '#15803d',
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    flexShrink: 1,
  },
  counterBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  // ── Cartes ──
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    padding: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 16,
    elevation: 1,
  },
  cardSpacing: {
    marginTop: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardHeaderRowAvis: {
    marginBottom: 10,
  },
  cardTick: {
    width: 4,
    height: 14,
    borderRadius: 2,
    backgroundColor: BRAND,
  },
  cardHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardHeaderTextSm: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  // ── Carte info compacte ──
  infoCard: {
    padding: 14,
    borderRadius: 20,
  },
  reviewsCard: {
    padding: 14,
    borderRadius: 20,
  },
  // ── Vendeur ──
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sellerLogo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: 'rgba(229,231,235,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sellerLogoImg: {
    width: '100%',
    height: '100%',
  },
  sellerTexts: {
    flex: 1,
    minWidth: 0,
  },
  sellerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sellerLabel: {
    fontSize: 9.5,
    color: '#9ca3af',
  },
  sellerName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
    flexShrink: 1,
  },
  categoryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  categoryText: {
    fontSize: 9.5,
    color: '#9ca3af',
    flexShrink: 1,
  },
  // ── Titre + stats ──
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#030712',
    lineHeight: 21,
    marginBottom: 6,
  },
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 8,
  },
  ratingValue: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#374151',
  },
  newLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#047857',
  },
  proofText: {
    fontSize: 10.5,
    color: '#9ca3af',
  },
  proofDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#d1d5db',
  },
  // ── Prix ──
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    marginBottom: 6,
  },
  priceLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 4,
    flexShrink: 1,
  },
  priceLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceValue: {
    fontSize: 21,
    fontWeight: '700',
    color: '#030712',
    letterSpacing: -0.3,
  },
  priceUnit: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6b7280',
  },
  priceOriginal: {
    fontSize: 10,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  priceDiscountBadge: {
    backgroundColor: '#fef2f2',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  priceDiscountBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#b91c1c',
  },
  // ── Stock ──
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  stockState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stockDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10b981',
  },
  stockText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  delayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  delayText: {
    fontSize: 10,
    color: '#6b7280',
  },
  delayValue: {
    fontWeight: '600',
    color: '#374151',
  },
  // ── Résumé options ──
  optionsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  optionsSummaryRowPressed: {
    backgroundColor: '#f9fafb',
  },
  optionsSummaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(245,107,42,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsSummaryBody: {
    flex: 1,
    minWidth: 0,
  },
  optionsSummaryTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#111827',
  },
  optionsSummaryText: {
    fontSize: 9.5,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 1,
  },
  optionsSummaryReady: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  optionsSummaryReadyText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#047857',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  optionsSummaryCount: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  optionsSummaryCountText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6b7280',
  },
  optionsSummaryOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#ffe4e6',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  optionsSummaryOutText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#be123c',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  // ── Prix de gros ──
  wholesale: {
    borderWidth: 1,
    borderColor: 'rgba(253,230,138,0.8)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 2,
  },
  wholesaleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,251,235,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  wholesaleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wholesaleHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#451a03',
    letterSpacing: 0.5,
  },
  wholesaleHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wholesaleDegressive: {
    fontSize: 9,
    fontWeight: '600',
    color: '#e04e0f',
    textTransform: 'uppercase',
  },
  wholesaleBody: {
    backgroundColor: 'rgba(254,243,199,0.5)',
  },
  wholesaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  wholesaleRowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(253,230,138,0.5)',
  },
  wholesaleRowUnavailable: {
    backgroundColor: 'rgba(254,242,242,0.5)',
  },
  wholesaleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flexShrink: 1,
  },
  wholesaleQty: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
  },
  wholesaleDot: {
    fontSize: 10,
    color: '#d1d5db',
    fontWeight: '700',
  },
  wholesaleTotal: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND,
  },
  wholesaleRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wholesaleDiscount: {
    fontSize: 9,
    fontWeight: '700',
    color: '#047857',
    backgroundColor: '#ecfdf5',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  wholesaleLowStock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 44,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  wholesaleLowStockText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ef4444',
    textTransform: 'uppercase',
  },
  wholesaleAdd: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  wholesaleAddDone: {
    backgroundColor: '#059669',
  },
  wholesaleAddText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  wholesaleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  wholesaleFooterText: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#6b7280',
  },
  wholesaleWhatsApp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  wholesaleWhatsAppText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#047857',
  },
  // ── Description ──
  descriptionCollapsed: {
    maxHeight: 128,
    overflow: 'hidden',
  },
  readMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  readMoreText: {
    fontSize: 10,
    fontWeight: '600',
    color: BRAND,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  // ── Avis ──
  reviewsHeaderRow: {
    justifyContent: 'space-between',
  },
  reviewsHeaderLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingVertical: 2,
    paddingLeft: 8,
  },
  reviewsHeaderLinkText: {
    fontSize: 9,
    fontWeight: '700',
    color: BRAND,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  reviewSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 8,
  },
  reviewSummaryScore: {
    width: 82,
  },
  reviewSummaryValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 1,
  },
  reviewSummaryValue: {
    fontSize: 24,
    lineHeight: 27,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  reviewSummaryMax: {
    fontSize: 10,
    fontWeight: '700',
    color: '#d1d5db',
  },
  reviewSummaryStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    marginTop: 2,
  },
  reviewSummaryCount: {
    fontSize: 9,
    color: '#9ca3af',
    marginTop: 3,
  },
  distribution: {
    flex: 1,
    gap: 3,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distributionStarLabel: {
    width: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  distributionStarText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#6b7280',
  },
  distributionTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#f3f4f6',
    overflow: 'hidden',
  },
  distributionFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fbbf24',
  },
  distributionPct: {
    width: 28,
    textAlign: 'right',
    fontSize: 8,
    fontWeight: '600',
    color: '#9ca3af',
  },
  reviewCard: {
    flexDirection: 'row',
    gap: 9,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f3f4f6',
  },
  reviewAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
  },
  reviewBody: {
    flex: 1,
    minWidth: 0,
  },
  reviewTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 1,
  },
  reviewHead: {
    flexShrink: 1,
  },
  reviewAuthor: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#111827',
  },
  reviewStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0.5,
    marginTop: 2,
  },
  reviewMeta: {
    alignItems: 'flex-end',
    gap: 1,
  },
  reviewDate: {
    fontSize: 9,
    fontWeight: '500',
    color: '#9ca3af',
  },
  reviewVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  reviewVerifiedText: {
    fontSize: 8.5,
    fontWeight: '500',
    color: '#059669',
  },
  reviewComment: {
    fontSize: 11.5,
    lineHeight: 16.5,
    color: '#4b5563',
    marginTop: 4,
  },
  sellerReply: {
    marginTop: 6,
    marginLeft: 8,
    paddingLeft: 8,
    paddingRight: 8,
    paddingVertical: 5,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(245,107,42,0.4)',
    backgroundColor: 'rgba(255,247,237,0.4)',
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  sellerReplyLabel: {
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: BRAND,
    marginBottom: 1,
  },
  sellerReplyText: {
    fontSize: 10.5,
    lineHeight: 14.5,
    color: '#4b5563',
  },
  reviewsEmpty: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 4,
    backgroundColor: 'rgba(249,250,251,0.6)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e5e7eb',
    borderRadius: 10,
    gap: 3,
  },
  reviewsEmptyTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4b5563',
    marginTop: 2,
  },
  reviewsEmptySub: {
    fontSize: 9,
    color: '#9ca3af',
  },
  // ── Similaires ──
  relatedSection: {
    marginTop: 14,
  },
  relatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  relatedScrollView: {
    marginRight: -16,
  },
  relatedScroll: {
    paddingLeft: 16,
    paddingRight: 16,
    gap: 12,
  },
  relatedCardWrap: {
    width: 176,
  },
  // ── Toast ──
  toast: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BRAND,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  // ── Barre d'action ──
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
  },
  primaryBtn: {
    flex: 1,
    minWidth: 0,
    height: 48,
    borderRadius: 999,
    backgroundColor: BRAND,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    flexShrink: 1,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  cartWideBtn: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  cartWideText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  cartWideBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartWideBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '700',
  },
  cartCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCircleBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  cartCircleBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '700',
  },
  // ── Feuilles ──
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,24,39,0.5)',
  },
  sheet: {
    width: '100%',
    flexShrink: 1,
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  reviewsSheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingTop: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexShrink: 0, // header fixe en haut
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsSheetClose: {
    backgroundColor: 'transparent',
    marginRight: -6,
  },
  sheetScroll: {
    flexGrow: 0, // la feuille se dimensionne sur son contenu, comme le web
    flexShrink: 1, // et se limite à maxHeight quand les options sont longues
    minHeight: 0,
  },
  sheetScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  selectionBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 12,
  },
  selectionLabel: {
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#9ca3af',
  },
  selectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 3,
    paddingVertical: 3,
  },
  selectionChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1f2937',
  },
  selectionChipX: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionGroup: {
    marginBottom: 14,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  optionName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  optionSelected: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND,
  },
  optionPlaceholder: {
    fontSize: 9,
    fontWeight: '500',
    color: '#d1d5db',
  },
  optionValues: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  chipDisabled: {
    backgroundColor: '#f9fafb',
    borderColor: '#f3f4f6',
  },
  chipSelected: {
    backgroundColor: BRAND,
    borderColor: BRAND,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  chipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#4b5563',
  },
  chipTextDisabled: {
    color: '#d1d5db',
    textDecorationLine: 'line-through',
  },
  chipTextSelected: {
    color: '#ffffff',
  },
  chipCheck: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  swatchSelected: {
    borderColor: BRAND,
    borderWidth: 2,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    transform: [{ scale: 1.05 }],
  },
  swatchDisabled: {
    opacity: 0.35,
  },
  hintAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: 'rgba(253,230,138,0.6)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 2,
    marginBottom: 6,
  },
  hintAmberText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#b45309',
    flex: 1,
  },
  hintRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: 'rgba(254,202,202,0.6)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 2,
    marginBottom: 6,
  },
  hintRedText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#b91c1c',
    flex: 1,
  },
  hintGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 2,
    marginBottom: 6,
  },
  hintGreenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  hintGreenRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintGreenName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#065f46',
    flexShrink: 1,
  },
  hintGreenPrice: {
    fontSize: 10,
    fontWeight: '600',
    color: '#047857',
  },
  hintGreenStock: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
  },
  sheetFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexShrink: 0,
  },
  sheetFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  sheetFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  sheetFooterCount: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#9ca3af',
  },
  variantStockPill: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  variantStockOk: {
    backgroundColor: '#ecfdf5',
    borderColor: '#d1fae5',
  },
  variantStockOut: {
    backgroundColor: '#fff1f2',
    borderColor: '#ffe4e6',
  },
  variantStockPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  variantStockOkText: {
    color: '#047857',
  },
  variantStockOutText: {
    color: '#e11d48',
  },
  sheetPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#030712',
    letterSpacing: -0.3,
  },
  sheetCta: {
    width: '100%',
    height: 48,
    borderRadius: 999,
    backgroundColor: BRAND,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  // ── Feuille avis ──
  reviewsSheetHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  reviewsSheetHandle: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  reviewsSheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewsSheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewsSheetIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#fffbeb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewsSheetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  reviewsSheetSub: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 1,
  },
  reviewsSheetList: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
  },
  // ── Zoom ──
  zoomRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomImage: {
    width: '100%',
    height: '80%',
  },
  // ── Erreur ──
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  errorSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 280,
  },
  errorBtn: {
    marginTop: 24,
    backgroundColor: BRAND,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  errorBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
