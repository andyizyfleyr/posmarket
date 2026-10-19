/**
 * Écran Panier — copie fidèle de la vue web mobile (`CartCheckoutView`,
 * étape « Panier » de StorefrontView) :
 * carte blanche arrondie sur fond gris, en-tête « Mon Panier » + compteur +
 * « Continuer les achats », indicateur d'étapes, pilule de réassurance,
 * cartes par boutique (swipe de suppression, « Voir tout », minimum de gros),
 * code promo, récapitulatif et barre fixe « Passer à la livraison ».
 */

import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  CreditCard,
  MapPin,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tag,
  Trash2,
  Truck,
  X,
  Zap,
} from 'lucide-react-native';
import { useCart } from '@/context/CartContext';
import { usePromo } from '@/context/PromoContext';
import { useToast } from '@/components/ToastProvider';
import { fetchCatalog, resolveImageUrl } from '@/api/client';
import { cartNoun, cartNounLower, verticalOfProduct } from '@/constants';
import { formatCurrency, generateProductSlug, getEffectiveItemPrice } from '@/utils';
import { COLORS } from '@/theme';
import type { CartItem } from '@/types';

/** Largeur de la zone rouge révélée par le glissement (w-20). */
const SWIPE_WIDTH = 80;
/** Seuil de bascule du glissement (56 px, comme le web). */
const SWIPE_THRESHOLD = 56;

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notify } = useToast();
  const { cart, updateQuantity, removeFromCart } = useCart();
  const {
    promoApplied,
    setPromoApplied,
    promoCodeInput,
    setPromoCodeInput,
    isPromoOpen,
    setIsPromoOpen,
    isApplying,
    applyPromo,
  } = usePromo();

  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());
  const [swipeKey, setSwipeKey] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Boutiques (seuil de commande de gros) — même cache que l'accueil.
  const catalogQuery = useQuery({
    queryKey: ['catalog'],
    queryFn: fetchCatalog,
  });
  const stores = useMemo(
    () => catalogQuery.data?.stores || [],
    [catalogQuery.data],
  );

  // La verticale se déduit du panier : un resto parle de « commande ».
  const cartVertical = verticalOfProduct(cart.find((i) => i.product)?.product || {});
  const cartWord = cartNoun(cartVertical);
  const cartWordLower = cartNounLower(cartVertical);

  const cartItemsCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const baseCartTotal = Math.max(
    0,
    cart.reduce((sum, item) => sum + getEffectiveItemPrice(item) * (item.quantity || 1), 0),
  );

  // La remise ne porte que sur les lignes de la boutique du coupon.
  const discountAmount = promoApplied
    ? cart
        .filter((item) => item.product.storeId === promoApplied.store_id)
        .reduce((sum, item) => sum + getEffectiveItemPrice(item) * (item.quantity || 1), 0) *
      (promoApplied.discount_pct / 100)
    : 0;
  const cartTotal = baseCartTotal - discountAmount; // livraison offerte (comme le web)

  // Économies de gros : référence = prix de la variante si choisie.
  const referenceItemPrice = useCallback((item: CartItem) => {
    if (item.variantId && item.product.variants) {
      const variant = item.product.variants.find((v) => v.id === item.variantId);
      if (variant) return Number(variant.price);
    }
    return Number(item.product.price);
  }, []);

  const wholesaleSavings = cart.reduce((sum, item) => {
    const saved =
      (referenceItemPrice(item) - getEffectiveItemPrice(item)) * (item.quantity || 1);
    return sum + (saved > 0 ? saved : 0);
  }, 0);

  /** Lignes regroupées par boutique, dans l'ordre d'ajout (comme le web). */
  const storeGroups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, CartItem[]>();
    for (const item of cart) {
      const id = item.product.storeId;
      if (!map.has(id)) {
        map.set(id, []);
        order.push(id);
      }
      map.get(id)!.push(item);
    }
    return order.map((id) => ({ id, items: map.get(id)! }));
  }, [cart]);

  const goShopping = useCallback(() => {
    router.dismissTo('/' as never);
  }, [router]);

  /** Passage à la livraison : contrôle des minimums de commande de gros. */
  const handleProceedToShipping = useCallback(() => {
    if (isTransitioning) return;

    for (const { id, items } of storeGroups) {
      const storeObj = stores.find((s) => s.id === id);
      const minAmount = Number(storeObj?.settings?.wholesaleMinOrderAmount || 0);
      if (minAmount > 0) {
        const subtotal = items.reduce(
          (sum, item) => sum + getEffectiveItemPrice(item) * (item.quantity || 1),
          0,
        );
        if (subtotal < minAmount) {
          const storeName = items[0]?.product?.storeName || storeObj?.name || 'Boutique';
          notify(
            `Minimum de commande requis pour "${storeName}" : ${formatCurrency(minAmount)} (actuel: ${formatCurrency(subtotal)})`,
            'warning',
          );
          return;
        }
      }
    }

    setIsTransitioning(true);
    setTimeout(() => {
      setIsTransitioning(false);
      router.push('/checkout' as never);
    }, 500);
  }, [isTransitioning, notify, router, storeGroups, stores]);

  const handleSwipeDelete = useCallback(
    (item: CartItem) => {
      removeFromCart(item.product.id, item.variantId);
      setSwipeKey(null);
      notify(`Article retiré du ${cartWordLower}`, 'info');
    },
    [cartWordLower, notify, removeFromCart],
  );

  const toggleStoreExpanded = useCallback((storeId: string) => {
    setExpandedStores((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  }, []);

  const steps = useMemo(
    () => [
      { id: 'cart', label: cartWord, Icon: ShoppingCart },
      { id: 'shipping', label: 'Livraison', Icon: MapPin },
      { id: 'payment', label: 'Paiement', Icon: CreditCard },
    ],
    [cartWord],
  );
  const activeStepIndex = 0; // étape « Panier »

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.page,
          { paddingTop: insets.top + 16 },
        ]}
      >
        <View style={styles.cardShadow}>
          <View style={styles.card}>
            {/* ── En-tête ─────────────────────────────────────────── */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <ShoppingCart size={16} color={COLORS.brand} />
                <Text style={styles.headerTitle} numberOfLines={1}>
                  Mon {cartWord}
                </Text>
                {cartItemsCount > 0 && (
                  <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>{cartItemsCount}</Text>
                  </View>
                )}
              </View>
              <Pressable
                onPress={goShopping}
                style={styles.continueBtn}
                accessibilityLabel="Continuer les achats"
              >
                <ChevronLeft size={12} color="#6B7280" />
                <Text style={styles.continueText}>Continuer les achats</Text>
              </Pressable>
            </View>

            {/* ── Indicateur d'étapes ─────────────────────────────── */}
            <View style={styles.stepsBar}>
              <View style={styles.stepsRow}>
                {steps.map((step, idx) => {
                  const isActive = idx === activeStepIndex;
                  const isPast = idx < activeStepIndex;
                  const Icon = step.Icon;
                  return (
                    <Fragment key={step.id}>
                      <View style={styles.step}>
                        <View
                          style={[
                            styles.stepCircle,
                            isActive && styles.stepCircleActive,
                            isPast && styles.stepCirclePast,
                          ]}
                        >
                          {isPast ? (
                            <CheckCircle2 size={18} color="#16A34A" />
                          ) : (
                            <Icon
                              size={isActive ? 18 : 16}
                              color={isActive ? '#FFFFFF' : '#6B7280'}
                            />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.stepLabel,
                            isActive && styles.stepLabelActive,
                            isPast && styles.stepLabelPast,
                          ]}
                        >
                          {step.label}
                        </Text>
                      </View>
                      {idx < steps.length - 1 && (
                        <View style={styles.connector}>
                          <View
                            style={[
                              styles.connectorFill,
                              isPast && styles.connectorFillDone,
                            ]}
                          />
                        </View>
                      )}
                    </Fragment>
                  );
                })}
              </View>
            </View>

            {/* ── Contenu ─────────────────────────────────────────── */}
            <View style={styles.content}>
              {cart.length > 0 ? (
                <>
                  {/* Réassurance */}
                  <View style={styles.reassurance}>
                    <View style={styles.reassuranceItem}>
                      <ShieldCheck size={13} color="#22C55E" />
                      <Text style={styles.reassuranceText}>Paiement sécurisé</Text>
                    </View>
                    <View style={styles.reassuranceItem}>
                      <Truck size={13} color={COLORS.brand} />
                      <Text style={styles.reassuranceText}>Payez à la livraison</Text>
                    </View>
                  </View>

                  {storeGroups.map(({ id: storeId, items }) => {
                    const storeObj = stores.find((s) => s.id === storeId);
                    const storeMinOrder = Number(
                      storeObj?.settings?.wholesaleMinOrderAmount || 0,
                    );
                    const storeSubtotal = items.reduce(
                      (sum, item) =>
                        sum + getEffectiveItemPrice(item) * (item.quantity || 1),
                      0,
                    );
                    const isBelowMinOrder =
                      storeMinOrder > 0 && storeSubtotal < storeMinOrder;
                    const missingForMinOrder = Math.max(
                      0,
                      storeMinOrder - storeSubtotal,
                    );
                    const storeName =
                      items[0]?.product.storeName || storeObj?.name || 'Boutique';
                    const storeCount = items.reduce(
                      (sum, item) => sum + (item.quantity || 1),
                      0,
                    );
                    const isStoreExpanded = expandedStores.has(storeId);
                    const visibleItems = isStoreExpanded
                      ? items
                      : items.slice(0, 3);

                    return (
                      <View key={storeId} style={styles.storeCard}>
                        {/* En-tête boutique */}
                        <View style={styles.storeHeader}>
                          <View style={styles.storeHeaderLeft}>
                            <Store size={12} color={COLORS.brand} />
                            <Text style={styles.storeName} numberOfLines={1}>
                              {storeName}
                            </Text>
                          </View>
                          <Text style={styles.storeCount}>
                            {storeCount} article{storeCount > 1 ? 's' : ''}
                          </Text>
                        </View>

                        {/* Lignes article */}
                        <View>
                          {visibleItems.map((item, index) => (
                            <CartRow
                              key={`${item.product.id}-${item.variantId || 'base'}`}
                              item={item}
                              isFirst={index === 0}
                              isOpen={
                                swipeKey ===
                                `${item.product.id}-${item.variantId || 'base'}`
                              }
                              onOpen={() =>
                                setSwipeKey(`${item.product.id}-${item.variantId || 'base'}`)
                              }
                              onClose={() =>
                                setSwipeKey((prev) =>
                                  prev === `${item.product.id}-${item.variantId || 'base'}`
                                    ? null
                                    : prev,
                                )
                              }
                              onDelete={() => handleSwipeDelete(item)}
                              onPressName={() =>
                                router.push(
                                  `/product/${generateProductSlug(item.product)}` as never,
                                )
                              }
                              onRemove={() =>
                                removeFromCart(item.product.id, item.variantId)
                              }
                              onDecrease={() =>
                                updateQuantity(
                                  item.product.id,
                                  (item.quantity || 1) - 1,
                                  item.variantId,
                                )
                              }
                              onIncrease={() =>
                                updateQuantity(
                                  item.product.id,
                                  (item.quantity || 1) + 1,
                                  item.variantId,
                                )
                              }
                              cartWordLower={cartWordLower}
                              showCouponChip={promoApplied?.store_id === storeId}
                            />
                          ))}
                        </View>

                        {/* Voir tout / Réduire */}
                        {items.length > 3 && (
                          <Pressable
                            onPress={() => toggleStoreExpanded(storeId)}
                            style={styles.expandBtn}
                            accessibilityState={{ expanded: isStoreExpanded }}
                          >
                            <Text style={styles.expandText}>
                              {isStoreExpanded
                                ? 'Réduire'
                                : `Voir tout (${items.length})`}
                            </Text>
                            {isStoreExpanded ? (
                              <ChevronUp size={12} color={COLORS.brand} />
                            ) : (
                              <ChevronDown size={12} color={COLORS.brand} />
                            )}
                          </Pressable>
                        )}

                        {/* Minimum de commande de gros */}
                        {isBelowMinOrder && (
                          <View style={styles.minOrderAlert}>
                            <AlertTriangle size={15} color="#D97706" style={styles.minOrderIcon} />
                            <View style={styles.minOrderTextWrap}>
                              <Text style={styles.minOrderText}>
                                <Text style={styles.minOrderSemibold}>
                                  Minimum de commande de gros :
                                </Text>{' '}
                                {formatCurrency(storeMinOrder)}.
                              </Text>
                              <Text style={[styles.minOrderText, styles.minOrderSecondLine]}>
                                Il vous manque{' '}
                                <Text style={styles.minOrderStrong}>
                                  {formatCurrency(missingForMinOrder)}
                                </Text>{' '}
                                pour atteindre le seuil de commande auprès de {storeName}.
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Total boutique */}
                        <View style={styles.storeTotal}>
                          <Text style={styles.storeTotalText}>
                            Total {storeName} :{' '}
                            <Text style={styles.storeTotalValue}>
                              {formatCurrency(storeSubtotal)}
                            </Text>
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              ) : (
                /* ── Panier vide ─────────────────────────────────── */
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconOuter}>
                    <View style={styles.emptyIconGlow} />
                    <View style={styles.emptyIconBox}>
                      <ShoppingCart size={30} color="rgba(245,107,42,0.6)" />
                    </View>
                  </View>
                  <Text style={styles.emptyTitle}>Votre {cartWordLower} est vide</Text>
                  <Text style={styles.emptySub}>
                    Parcourez les boutiques et ajoutez vos produits favoris.
                  </Text>
                  <Pressable
                    onPress={goShopping}
                    style={({ pressed }) => [
                      styles.emptyBtn,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <Text style={styles.emptyBtnText}>Découvrir la boutique</Text>
                    <ArrowRight size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              )}
            </View>

            {/* ── Récapitulatif + code promo ──────────────────────── */}
            {cart.length > 0 && (
              <View
                style={[styles.summary, { paddingBottom: 88 + insets.bottom }]}
              >
                <View style={styles.recapBox}>
                  <View style={styles.recapRow}>
                    <Text style={styles.recapLabel}>
                      Sous-total · {cartItemsCount} article
                      {cartItemsCount > 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.recapValue}>
                      {formatCurrency(baseCartTotal)}
                    </Text>
                  </View>
                  {wholesaleSavings > 0 && (
                    <View style={styles.recapRow}>
                      <Text style={styles.recapGreen}>Économies prix de gros</Text>
                      <Text style={styles.recapGreenValue}>
                        -{formatCurrency(wholesaleSavings)}
                      </Text>
                    </View>
                  )}
                  {promoApplied && (
                    <View style={styles.recapRow}>
                      <View style={styles.recapLabelWrap}>
                        <CheckCircle2 size={11} color="#16A34A" />
                        <Text style={styles.recapGreen}>
                          Code {promoApplied.code}
                        </Text>
                      </View>
                      <Text style={styles.recapGreenValue}>
                        -{formatCurrency(discountAmount)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.recapTotalRow}>
                    <Text style={styles.recapTotalLabel}>Total</Text>
                    <Text style={styles.recapTotalValue}>
                      {formatCurrency(cartTotal)}
                    </Text>
                  </View>
                </View>

                {!promoApplied && (
                  <View style={styles.promoWrap}>
                    {isPromoOpen ? (
                      <View>
                        <View style={styles.promoInputRow}>
                          <Tag size={14} color="#9CA3AF" style={styles.promoTagIcon} />
                          <TextInput
                            value={promoCodeInput}
                            onChangeText={setPromoCodeInput}
                            placeholder="Entrez votre code promo"
                            placeholderTextColor="#9CA3AF"
                            autoCapitalize="characters"
                            autoCorrect={false}
                            autoFocus
                            editable={!isApplying}
                            style={styles.promoInput}
                          />
                          <Pressable
                            onPress={applyPromo}
                            disabled={!promoCodeInput.trim() || isApplying}
                            style={[
                              styles.promoApplyBtn,
                              (!promoCodeInput.trim() || isApplying) &&
                                styles.promoApplyBtnDisabled,
                            ]}
                            accessibilityLabel="Appliquer le code promo"
                          >
                            {isApplying ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Check size={17} color="#FFFFFF" />
                            )}
                          </Pressable>
                        </View>
                        {!isApplying && (
                          <Pressable
                            onPress={() => setIsPromoOpen(false)}
                            hitSlop={6}
                          >
                            <Text style={styles.promoCancel}>Annuler</Text>
                          </Pressable>
                        )}
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => setIsPromoOpen(true)}
                        style={styles.promoDashedBtn}
                      >
                        <Tag size={13} color="#6B7280" />
                        <Text style={styles.promoDashedText}>
                          Ajouter un code promo
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {promoApplied && (
                  <View style={styles.promoAppliedBanner}>
                    <View style={styles.promoAppliedLeft}>
                      <CheckCircle2 size={12} color="#15803D" />
                      <Text style={styles.promoAppliedText}>
                        Code {promoApplied.code} appliqué
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setPromoApplied(null)}
                      hitSlop={8}
                      accessibilityLabel="Retirer le code promo"
                    >
                      <X size={14} color="rgba(22,163,74,0.6)" />
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Barre fixe : action principale ───────────────────────── */}
      {cart.length > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
          <Pressable
            onPress={handleProceedToShipping}
            disabled={isTransitioning}
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.ctaPressed,
              isTransitioning && styles.ctaDisabled,
            ]}
          >
            {isTransitioning ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.ctaText}>Chargement...</Text>
              </>
            ) : (
              <>
                <Text style={styles.ctaText}>Passer à la livraison</Text>
                <ArrowRight size={16} color="#FFFFFF" />
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Ligne de panier (glissement pour supprimer) ─────────────────────

interface CartRowProps {
  item: CartItem;
  isFirst: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDelete: () => void;
  onPressName: () => void;
  onRemove: () => void;
  onDecrease: () => void;
  onIncrease: () => void;
  cartWordLower: string;
  showCouponChip: boolean;
}

function CartRow({
  item,
  isFirst,
  isOpen,
  onOpen,
  onClose,
  onDelete,
  onPressName,
  onRemove,
  onDecrease,
  onIncrease,
  cartWordLower,
  showCouponChip,
}: CartRowProps) {
  const [translateX] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: isOpen ? -SWIPE_WIDTH : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isOpen, translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          Math.abs(gesture.dx) > 10 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderMove: (_evt, gesture) => {
          const base = isOpen ? -SWIPE_WIDTH : 0;
          const next = Math.min(0, Math.max(-96, base + gesture.dx));
          translateX.setValue(next);
        },
        onPanResponderRelease: (_evt, gesture) => {
          const base = isOpen ? -SWIPE_WIDTH : 0;
          const shouldOpen = base + gesture.dx < -SWIPE_THRESHOLD;
          Animated.timing(translateX, {
            toValue: shouldOpen ? -SWIPE_WIDTH : 0,
            duration: 200,
            useNativeDriver: false,
          }).start();
          if (shouldOpen) onOpen();
          else onClose();
        },
        onPanResponderTerminate: () => {
          Animated.timing(translateX, {
            toValue: isOpen ? -SWIPE_WIDTH : 0,
            duration: 200,
            useNativeDriver: false,
          }).start();
        },
      }),
    [isOpen, onClose, onOpen, translateX],
  );

  const unitPrice = getEffectiveItemPrice(item);
  const qty = item.quantity || 1;
  const hasWholesale = !!(
    item.product.wholesalePrice && Number(item.product.wholesaleMinQty) > 0
  );
  const wholesaleActive = hasWholesale && qty >= Number(item.product.wholesaleMinQty);
  const wholesaleLeft = hasWholesale
    ? Math.max(0, Number(item.product.wholesaleMinQty) - qty)
    : 0;
  const variantName =
    item.variantId && item.product.variants
      ? item.product.variants.find((v) => v.id === item.variantId)?.name
      : undefined;

  return (
    <View style={[styles.rowWrap, !isFirst && styles.rowDivider]}>
      {/* Couche supprimable (cachée derrière) */}
      <View style={styles.rowDeleteLayer}>
        <Pressable
          onPress={onDelete}
          style={styles.rowDeleteBtn}
          accessibilityLabel="Supprimer"
        >
          <Trash2 size={16} color="#FFFFFF" />
          <Text style={styles.rowDeleteText}>Retirer</Text>
        </Pressable>
      </View>

      {/* Contenu glissant */}
      <Animated.View
        style={[styles.rowContent, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Image
          source={{ uri: resolveImageUrl(item.product.image) }}
          style={styles.itemImage}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.itemInfo}>
          <View style={styles.itemNameRow}>
            <Pressable onPress={onPressName} style={styles.itemNameBtn}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.product.name || 'Unknown Product'}
              </Text>
            </Pressable>
            <Pressable
              onPress={onRemove}
              hitSlop={8}
              style={styles.itemTrash}
              accessibilityLabel={`Retirer ${item.product.name || 'le produit'} du ${cartWordLower}`}
            >
              <Trash2 size={15} color="#D1D5DB" />
            </Pressable>
          </View>

          <View style={styles.itemChips}>
            {item.variantId && variantName && (
              <View style={styles.variantChip}>
                <Tag size={9} color="#6B7280" />
                <Text style={styles.variantChipText}>{variantName}</Text>
              </View>
            )}
            {showCouponChip && (
              <View style={styles.couponChip}>
                <CheckCircle2 size={9} color="#16A34A" />
                <Text style={styles.couponChipText}>Coupon</Text>
              </View>
            )}
          </View>

          <View style={styles.itemBottomRow}>
            <View style={styles.stepper}>
              <Pressable
                onPress={onDecrease}
                style={styles.stepperBtn}
                accessibilityLabel="Diminuer la quantité"
              >
                <Text style={styles.stepperMinus}>−</Text>
              </Pressable>
              <Text style={styles.stepperQty}>{qty}</Text>
              <Pressable
                onPress={onIncrease}
                style={styles.stepperBtn}
                accessibilityLabel="Augmenter la quantité"
              >
                <Text style={styles.stepperPlus}>+</Text>
              </Pressable>
            </View>

            <View style={styles.itemPriceCol}>
              <Text style={styles.itemTotal}>
                {formatCurrency(unitPrice * qty)}
              </Text>
              {hasWholesale && (
                <View style={styles.wholesaleBadge}>
                  {wholesaleActive ? (
                    <>
                      <CheckCircle2 size={9} color="#16A34A" />
                      <Text style={[styles.wholesaleBadgeText, styles.wholesaleActive]}>
                        Prix de gros
                      </Text>
                    </>
                  ) : (
                    <>
                      <Zap size={9} color={COLORS.brand} fill={COLORS.brand} />
                      <Text style={[styles.wholesaleBadgeText, styles.wholesalePending]}>
                        +{wholesaleLeft} = prix de gros
                      </Text>
                    </>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  page: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  // Carte : l'ombre est portée par l'enveloppe (overflow hidden + radius iOS).
  cardShadow: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },

  // En-tête
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
  },
  headerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FFF7ED',
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.brand,
    fontVariant: ['tabular-nums'],
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: -4,
    borderRadius: 999,
  },
  continueText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: -0.25,
  },

  // Indicateur d'étapes
  stepsBar: {
    backgroundColor: 'rgba(249,250,251,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  step: {
    alignItems: 'center',
    gap: 8,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  stepCircleActive: {
    backgroundColor: COLORS.brand,
    borderWidth: 0,
    transform: [{ scale: 1.1 }],
    elevation: 6,
    shadowColor: '#FFEDD5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  stepCirclePast: {
    backgroundColor: '#DCFCE7',
    borderWidth: 0,
  },
  stepLabel: {
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#6B7280',
  },
  stepLabelActive: {
    color: '#111827',
  },
  stepLabelPast: {
    color: '#16A34A',
  },
  connector: {
    flexGrow: 1,
    height: 2,
    marginHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  connectorFill: {
    height: 2,
    width: 0,
    backgroundColor: COLORS.brand,
  },
  connectorFillDone: {
    width: '100%',
  },

  // Contenu
  content: {
    backgroundColor: 'rgba(249,250,251,0.5)',
    padding: 10,
  },
  reassurance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  reassuranceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reassuranceText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },

  // Cartes boutique
  storeCard: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(249,250,251,0.7)',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  storeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  storeName: {
    fontSize: 9,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
  },
  storeCount: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },
  expandText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.brand,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  minOrderAlert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    backgroundColor: '#FFFBEB',
    borderTopWidth: 1,
    borderTopColor: 'rgba(253,230,138,0.6)',
  },
  minOrderIcon: {
    marginTop: 2,
  },
  minOrderTextWrap: {
    flex: 1,
  },
  minOrderText: {
    fontSize: 11,
    color: '#92400E',
    lineHeight: 13,
  },
  minOrderSemibold: {
    fontWeight: '600',
  },
  minOrderSecondLine: {
    color: '#B45309',
    marginTop: 2,
  },
  minOrderStrong: {
    fontWeight: '700',
    color: '#78350F',
  },
  storeTotal: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(249,250,251,0.7)',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  storeTotalText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  storeTotalValue: {
    color: '#111827',
    fontWeight: '700',
  },

  // Lignes article
  rowWrap: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },
  rowDeleteLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: SWIPE_WIDTH,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDeleteBtn: {
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  rowDeleteText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  rowContent: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemNameBtn: {
    flexShrink: 1,
  },
  itemName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 12,
  },
  itemTrash: {
    padding: 6,
    margin: -6,
  },
  itemChips: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
    minHeight: 18,
  },
  variantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  variantChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: -0.25,
  },
  couponChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  couponChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#16A34A',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  itemBottomRow: {
    marginTop: 'auto',
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    padding: 4,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperMinus: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6B7280',
  },
  stepperPlus: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.brand,
  },
  stepperQty: {
    width: 28,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  itemPriceCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  itemTotal: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  wholesaleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  wholesaleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  wholesaleActive: {
    color: '#16A34A',
  },
  wholesalePending: {
    color: COLORS.brand,
  },

  // Panier vide
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 16,
  },
  emptyIconOuter: {
    marginBottom: 20,
  },
  emptyIconGlow: {
    position: 'absolute',
    top: -12,
    left: -12,
    right: -12,
    bottom: -12,
    borderRadius: 999,
    backgroundColor: '#FFEDD5',
    opacity: 0.6,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  emptySub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
    lineHeight: 19,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: COLORS.brand,
    elevation: 4,
    shadowColor: '#FFEDD5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  emptyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnPressed: {
    backgroundColor: COLORS.brandHover,
    transform: [{ scale: 0.98 }],
  },

  // Récapitulatif
  summary: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  recapBox: {
    borderRadius: 16,
    backgroundColor: 'rgba(249,250,251,0.8)',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 14,
    gap: 6,
    marginBottom: 16,
  },
  recapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recapLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  recapValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    fontVariant: ['tabular-nums'],
  },
  recapLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recapGreen: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  recapGreenValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
    fontVariant: ['tabular-nums'],
  },
  recapTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(229,231,235,0.7)',
  },
  recapTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  recapTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.brand,
    fontVariant: ['tabular-nums'],
  },

  // Code promo
  promoWrap: {
    marginBottom: 16,
  },
  promoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: 'rgba(249,250,251,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(229,231,235,0.8)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  promoTagIcon: {
    marginLeft: 16,
  },
  promoInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  promoApplyBtn: {
    width: 40,
    height: 40,
    margin: 6,
    borderRadius: 12,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoApplyBtnDisabled: {
    opacity: 0.4,
  },
  promoCancel: {
    marginTop: 6,
    marginLeft: 4,
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  promoDashedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(209,213,219,0.8)',
    backgroundColor: 'rgba(249,250,251,0.5)',
  },
  promoDashedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  promoAppliedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginBottom: 16,
  },
  promoAppliedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  promoAppliedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },

  // Barre fixe
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  cta: {
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    elevation: 4,
    shadowColor: '#FFEDD5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  ctaPressed: {
    backgroundColor: COLORS.brandHover,
    transform: [{ scale: 0.98 }],
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
});
