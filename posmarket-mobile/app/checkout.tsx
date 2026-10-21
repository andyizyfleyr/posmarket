/**
 * Écran Checkout — copie fidèle des étapes « Livraison », « Paiement » et
 * « Commande Validée » de la vue web mobile (`CartCheckoutView`) :
 * en-tête + indicateur d'étapes, formulaire « Contact à livrer » (nom +
 * téléphone avec indicatif), paiement à la livraison uniquement, garde-fou
 * pays (« Commande indisponible »), récapitulatif + code promo appliqué,
 * barre fixe d'action et écran de succès (boutons Accueil / WhatsApp).
 */

import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Svg, { Path } from 'react-native-svg';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  Globe,
  MapPin,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  User,
} from 'lucide-react-native';
import { useCart } from '@/context/CartContext';
import { usePromo } from '@/context/PromoContext';
import { useToast } from '@/components/ToastProvider';
import { PhoneField } from '@/components/PhoneField';
import { fetchCatalog, fetchCountryGate, submitCheckout } from '@/api/client';
import { cartNoun, verticalOfProduct } from '@/constants';
import { COUNTRIES, isValidPhoneNumber, parsePhoneNumber } from '@/constants/countries';
import { formatCurrency, getEffectiveItemPrice } from '@/utils';
import {
  notifyOrderConfirmed,
  requestNotificationPermissions,
} from '@/utils/notifications';
import { COLORS } from '@/theme';
import type { CartItem } from '@/types';

const SUPPORTED_COUNTRIES_LABEL = COUNTRIES.map((c) => c.name).join(', ');

/** Hauteur minimale de l'écran de succès (min-h-[60vh] du web). */
const SUCCESS_MIN_HEIGHT = Dimensions.get('window').height * 0.6;

type CheckoutStage = 'shipping' | 'payment' | 'success' | 'blocked';

/** Message WhatsApp de la commande validée (copie du web). */
const WHATSAPP_ICON_PATH =
  'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.162-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z';

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notify } = useToast();
  const { cart, clearCart } = useCart();
  const { promoApplied, setPromoApplied } = usePromo();

  const scrollRef = useRef<ScrollView>(null);

  const [stage, setStage] = useState<CheckoutStage>('shipping');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerLoaded, setCustomerLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWhatsAppLoading, setIsWhatsAppLoading] = useState(false);
  const [completedOrderStores, setCompletedOrderStores] = useState<
    Array<{
      storeId: string;
      storeName: string;
      orderId?: string;
      products: Array<{ id: string; name: string; image: string }>;
    }>
  >([]);
  const [completedOrderItems, setCompletedOrderItems] = useState<
    Array<{
      name: string;
      quantity: number;
      price: number;
      total?: number;
      variantLabel?: string | null;
      orderId?: string;
    }>
  >([]);
  const [completedOrderTotal, setCompletedOrderTotal] = useState(0);
  // La clé reste la même pour tous les essais d'une même commande : le serveur
  // déduplique un double envoi. Une clé neuve est tirée après chaque succès.
  const [idempotencyKey, setIdempotencyKey] = useState(
    () => `chk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );

  // Demande l'autorisation de notification (crée aussi le canal Android).
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  // Portail pays (garde UX) : le blocage autoritaire reste côté action.
  const gateQuery = useQuery({
    queryKey: ['country-gate'],
    queryFn: fetchCountryGate,
    staleTime: 30 * 60 * 1000,
  });
  const countryGate = gateQuery.data;

  // Boutiques (téléphone WhatsApp de la commande validée).
  const catalogQuery = useQuery({
    queryKey: ['catalog'],
    queryFn: fetchCatalog,
  });
  const stores = useMemo(() => catalogQuery.data?.stores || [], [catalogQuery.data]);

  const cartVertical = verticalOfProduct(cart.find((i) => i.product)?.product || {});
  const cartWord = cartNoun(cartVertical);

  const cartItemsCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const baseCartTotal = Math.max(
    0,
    cart.reduce((sum, item) => sum + getEffectiveItemPrice(item) * (item.quantity || 1), 0),
  );
  const discountAmount = promoApplied
    ? cart
        .filter((item) => item.product.storeId === promoApplied.store_id)
        .reduce((sum, item) => sum + getEffectiveItemPrice(item) * (item.quantity || 1), 0) *
      (promoApplied.discount_pct / 100)
    : 0;
  const cartTotal = baseCartTotal - discountAmount; // livraison offerte (comme le web)

  const referenceItemPrice = useCallback((item: CartItem) => {
    if (item.variantId && item.product.variants) {
      const variant = item.product.variants.find((v) => v.id === item.variantId);
      if (variant) return Number(variant.price);
    }
    return Number(item.product.price);
  }, []);

  const wholesaleSavings = cart.reduce((sum, item) => {
    const saved = (referenceItemPrice(item) - getEffectiveItemPrice(item)) * (item.quantity || 1);
    return sum + (saved > 0 ? saved : 0);
  }, 0);

  // Restauration des coordonnées client (24 h, comme le web).
  useEffect(() => {
    AsyncStorage.getItem('storefront_customer')
      .then((raw) => {
        if (!raw) return;
        try {
          const { data, timestamp } = JSON.parse(raw);
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000 && data?.name) {
            setCustomerName(data.name || '');
            setCustomerPhone(data.phone || '');
          }
        } catch {}
      })
      .finally(() => setCustomerLoaded(true));
  }, []);

  useEffect(() => {
    if (!customerLoaded) return;
    AsyncStorage.setItem(
      'storefront_customer',
      JSON.stringify({
        data: { name: customerName, phone: customerPhone, address: '', city: '', zip: '' },
        timestamp: Date.now(),
      }),
    ).catch(() => {});
  }, [customerName, customerPhone, customerLoaded]);

  // Changement d'étape : retour en haut de la carte (comme le web).
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [stage]);

  const goShopping = useCallback(() => {
    setStage('shipping');
    setCompletedOrderStores([]);
    setCompletedOrderItems([]);
    setCompletedOrderTotal(0);
    router.dismissTo('/' as never);
  }, [router]);

  const phoneError =
    customerPhone && !isValidPhoneNumber(customerPhone)
      ? `Numéro de téléphone invalide. Ex : ${parsePhoneNumber(customerPhone).country.placeholder}.`
      : undefined;

  /** Étape livraison : contrôle nom + téléphone, puis passage au paiement. */
  const handleShippingSubmit = useCallback(() => {
    if (isSubmitting) return;
    if (countryGate && !countryGate.allowed) {
      setStage('blocked');
      return;
    }
    const nameValid = Boolean(customerName.trim());
    const phoneFilled = Boolean(customerPhone);
    const phoneValid = phoneFilled && isValidPhoneNumber(customerPhone);
    if (!nameValid) {
      notify('Veuillez renseigner votre nom complet avant de continuer.', 'error');
      return;
    }
    if (!phoneValid) {
      const example = phoneFilled
        ? `Numéro invalide. Ex : ${parsePhoneNumber(customerPhone).country.placeholder}.`
        : 'Veuillez saisir votre numéro de téléphone.';
      notify(example, 'error');
      return;
    }
    setStage('payment');
  }, [countryGate, customerName, customerPhone, isSubmitting, notify]);

  /** Étape paiement : envoi de la commande (paiement à la livraison). */
  const handleConfirmOrder = useCallback(async () => {
    if (isSubmitting) return;
    if (countryGate && !countryGate.allowed) {
      setStage('blocked');
      return;
    }

    const net = await NetInfo.fetch();
    if (net.isConnected === false) {
      notify(
        "Pas de connexion Internet : la commande n'a pas été envoyée. Votre panier est conservé, réessayez une fois reconnecté.",
        'error',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      type Draft = {
        items: Array<{
          product: { id: string };
          quantity: number;
          price: number;
          variantId: string | null;
          selectedOptions: Record<string, string> | null;
        }>;
        subtotal: number;
        discountAmount: number;
        promoCode?: string;
        shippingCost: number;
        total: number;
        paymentMethod: string;
      };
      const ordersData: Record<string, Draft> = {};

      cart.forEach((item) => {
        const storeId = item.product.storeId;
        if (!storeId) return;
        if (!ordersData[storeId]) {
          ordersData[storeId] = {
            items: [],
            subtotal: 0,
            discountAmount: 0,
            shippingCost: 0,
            total: 0,
            paymentMethod: 'ESPECES',
          };
        }
        ordersData[storeId].items.push({
          product: { id: item.product.id },
          quantity: item.quantity || 1,
          price: getEffectiveItemPrice(item),
          variantId: item.variantId ?? null,
          selectedOptions: item.selectedOptions ?? null,
        });
      });

      Object.keys(ordersData).forEach((storeId) => {
        const storeOrder = ordersData[storeId];
        storeOrder.subtotal = storeOrder.items.reduce(
          (sum, line) => sum + line.price * line.quantity,
          0,
        );
        // La remise ne porte que sur la boutique du coupon (comme le web).
        storeOrder.discountAmount =
          promoApplied && promoApplied.store_id === storeId
            ? storeOrder.subtotal * (promoApplied.discount_pct / 100)
            : 0;
        if (promoApplied && promoApplied.store_id === storeId) {
          storeOrder.promoCode = promoApplied.code;
        }
        storeOrder.shippingCost = 0;
        storeOrder.total = storeOrder.subtotal - storeOrder.discountAmount;
      });

      const response = await submitCheckout({
        orders: ordersData,
        customer: {
          name: customerName.trim(),
          phone: customerPhone.replace(/\s/g, ''),
          address: '',
        },
        idempotencyKey,
      });

      if (response?.success) {
        // On affiche les montants RENVOYÉS PAR LE SERVEUR, pas le total local :
        // un coupon expiré ou un prix modifié ne doit jamais produire un écran
        // de succès (ni un message WhatsApp) avec un montant faux.
        const serverOrders =
          Array.isArray(response.orders) && response.orders.length > 0
            ? response.orders
            : null;

        if (serverOrders) {
          setCompletedOrderStores(
            serverOrders.map((order) => ({
              storeId: order.storeId,
              storeName: order.storeName,
              orderId: order.id,
              products: Array.from(
                new Map(
                  order.items.map((item) => [
                    item.productId || item.name,
                    {
                      id: item.productId || item.name,
                      name: item.name,
                      image: item.image || '',
                    },
                  ]),
                ).values(),
              ),
            })),
          );
          setCompletedOrderItems(
            serverOrders.flatMap((order) =>
              order.items.map((item) => ({
                name: item.name,
                quantity: item.quantity,
                price: item.unitPrice,
                total: item.total,
                variantLabel: item.variantLabel,
                orderId: order.id,
              })),
            ),
          );
          setCompletedOrderTotal(
            serverOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
          );
        } else {
          // Compatibilité avec un serveur plus ancien qui ne renvoie que les
          // identifiants. Le nouveau serveur renvoie toujours `orders`.
          const storeMap: Record<
            string,
            { storeId: string; storeName: string; products: Array<{ id: string; name: string; image: string }> }
          > = {};
          cart.forEach((item) => {
            const sid = item.product.storeId;
            if (!storeMap[sid]) {
              storeMap[sid] = { storeId: sid, storeName: item.product.storeName, products: [] };
            }
            if (!storeMap[sid].products.find((p) => p.id === item.product.id)) {
              storeMap[sid].products.push({
                id: item.product.id,
                name: item.product.name,
                image: item.product.image,
              });
            }
          });
          setCompletedOrderStores(Object.values(storeMap));
          setCompletedOrderItems(
            cart.map((item) => ({
              name: item.product.name,
              quantity: item.quantity || 1,
              price: getEffectiveItemPrice(item),
              total: getEffectiveItemPrice(item) * (item.quantity || 1),
              variantLabel: item.selectedOptions
                ? Object.values(item.selectedOptions).join(' / ')
                : null,
            })),
          );
          setCompletedOrderTotal(cartTotal);
        }

        setPromoApplied(null);
        setStage('success');
        clearCart();

        const ids = response.orderIds || (response.orderId ? [response.orderId] : []);
        if (ids.length > 0) notifyOrderConfirmed(ids);
        setIdempotencyKey(`chk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
      } else {
        notify(response?.error || 'Erreur lors de la validation de la commande', 'error');
      }
    } catch {
      notify(
        'Une erreur est survenue lors de la validation. Votre panier est conservé : vous pouvez réessayer sans risque de doublon.',
        'error',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    cart,
    cartTotal,
    clearCart,
    countryGate,
    customerName,
    customerPhone,
    idempotencyKey,
    isSubmitting,
    notify,
    promoApplied,
    setPromoApplied,
  ]);

  const handleBackToPreviousStage = useCallback(() => {
    if (stage === 'payment') {
      setStage('shipping');
      return;
    }
    // Étape livraison -> panier (route précédente).
    if (router.canGoBack()) router.back();
    else router.replace('/cart' as never);
  }, [router, stage]);

  const steps = useMemo(
    () => [
      { id: 'cart', label: cartWord, Icon: ShoppingCart },
      { id: 'shipping', label: 'Livraison', Icon: MapPin },
      { id: 'payment', label: 'Paiement', Icon: CreditCard },
    ],
    [cartWord],
  );
  const activeStepIndex =
    stage === 'shipping' ? 1 : stage === 'payment' ? 2 : -1;

  const stageTitle =
    stage === 'shipping'
      ? 'Livraison'
      : stage === 'payment'
        ? 'Paiement'
        : stage === 'blocked'
          ? 'Commande indisponible'
          : 'Commande Validée';

  const storePhoneForWhatsApp = useMemo(() => {
    const firstStore = completedOrderStores[0];
    if (!firstStore || completedOrderStores.length !== 1) return null;
    if (completedOrderItems.length === 0) return null;
    const store = stores.find((s) => s.id === firstStore.storeId);
    const phone = store?.phone || store?.settings?.phone;
    return phone || null;
  }, [completedOrderItems.length, completedOrderStores, stores]);

  const openWhatsApp = useCallback(() => {
    if (!storePhoneForWhatsApp) return;
    // La référence est générée au clic : le message doit refléter la commande
    // validée, pas l'instant de rendu de l'écran.
    const orderRef =
      completedOrderStores[0]?.orderId?.slice(0, 8).toUpperCase() ||
      Date.now().toString().slice(-6);
    const itemsText = completedOrderItems
      .map((item) => {
        const variant = item.variantLabel ? ` (${item.variantLabel})` : '';
        return `• ${item.quantity}x ${item.name}${variant} - ${formatCurrency(
          item.total ?? item.price * item.quantity,
        )}`;
      })
      .join('\n');
    const waMsg = `NOUVELLE COMMANDE #${orderRef}\n\nClient: ${customerName || 'Anonyme'}\nTelephone: ${customerPhone || 'Non fourni'}\n\nArticles:\n${itemsText}\n\nTotal: ${formatCurrency(completedOrderTotal)}\nMode de paiement: Especes`;
    const waUrl = `https://wa.me/${storePhoneForWhatsApp.replace(/\D/g, '')}?text=${encodeURIComponent(waMsg)}`;
    setIsWhatsAppLoading(true);
    void Linking.openURL(waUrl).catch(() => {});
    setTimeout(() => setIsWhatsAppLoading(false), 1500);
  }, [
    completedOrderItems,
    completedOrderStores,
    completedOrderTotal,
    customerName,
    customerPhone,
    storePhoneForWhatsApp,
  ]);

  const ctaLabel = stage === 'payment' ? 'Confirmer la commande' : 'Passer au paiement';

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.cardShadow}>
          <View style={styles.card}>
            {/* ── En-tête ─────────────────────────────────────────── */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <ShieldCheck size={16} color="#22C55E" />
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {stageTitle}
                </Text>
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

            {/* ── Indicateur d'étapes (masqué au succès) ──────────── */}
            {stage !== 'success' && (
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
            )}

            {/* ── Contenu ─────────────────────────────────────────── */}
            <View style={styles.content}>
              {stage === 'shipping' && (
                <View style={styles.formCard}>
                  <View style={styles.formHeader}>
                    <View style={styles.formBadge}>
                      <Text style={styles.formBadgeText}>1</Text>
                    </View>
                    <Text style={styles.formTitle}>Contact à livrer</Text>
                  </View>

                  <View style={styles.fields}>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Nom Complet</Text>
                      <View style={styles.nameField}>
                        <User size={18} color="#4B5563" />
                        <TextInput
                          value={customerName}
                          onChangeText={setCustomerName}
                          placeholder="Nom et prénom"
                          placeholderTextColor="#9CA3AF"
                          style={styles.nameInput}
                        />
                      </View>
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Téléphone Mobile</Text>
                      <PhoneField
                        value={customerPhone}
                        onChange={setCustomerPhone}
                        error={phoneError}
                        onSubmitEditing={handleShippingSubmit}
                      />
                    </View>
                  </View>
                </View>
              )}

              {stage === 'payment' && (
                <View style={styles.paymentCard}>
                  <Truck size={24} color={COLORS.brand} />
                  <Text style={styles.paymentLabel}>Paiement à la livraison</Text>
                </View>
              )}

              {stage === 'blocked' && (
                <View style={styles.blockedWrap}>
                  <View style={styles.blockedIconOuter}>
                    <View style={styles.blockedGlow} />
                    <View style={styles.blockedIconBox}>
                      <Globe size={30} color="#F59E0B" />
                    </View>
                  </View>
                  <Text style={styles.blockedTitle}>Commande indisponible</Text>
                  <Text style={styles.blockedText}>
                    Les commandes sont réservées aux clients situés dans :{' '}
                    <Text style={styles.blockedStrong}>{SUPPORTED_COUNTRIES_LABEL}</Text>
                    {countryGate?.countryName
                      ? ` Votre connexion indique ${countryGate.countryName}.`
                      : ''}
                  </Text>
                  <Text style={styles.blockedHint}>
                    Vous pouvez continuer à parcourir la boutique, mais la commande
                    restera bloquée depuis votre pays.
                  </Text>
                  <Pressable
                    onPress={goShopping}
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
                  >
                    <Text style={styles.primaryBtnText}>Parcourir la boutique</Text>
                    <ArrowRight size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              )}

              {stage === 'success' && (
                <View style={styles.successWrap}>
                  <View style={styles.successIconOuter}>
                    <View style={styles.successGlow} />
                    <View style={styles.successCircle}>
                      <CheckCircle2 size={48} color="#FFFFFF" strokeWidth={3} />
                    </View>
                    <View style={styles.successStar}>
                      <Star size={18} color="#FFFFFF" fill="#FFFFFF" />
                    </View>
                  </View>

                  <Text style={styles.successTitle}>
                    Commande <Text style={styles.successTitleAccent}>Réussie !</Text>
                  </Text>

                  <View style={styles.successBar} />

                  <Text style={styles.successText}>
                    Votre commande a été enregistrée avec succès. Le vendeur va traiter
                    votre commande rapidement.
                  </Text>

                  <View style={styles.successActions}>
                    <Text style={styles.successHint}>
                      Cliquez sur un bouton pour continuer
                    </Text>
                    <View style={styles.successButtons}>
                      <Pressable
                        onPress={goShopping}
                        style={({ pressed }) => [
                          styles.successBtn,
                          styles.successBtnHome,
                          pressed && styles.btnPressed,
                        ]}
                      >
                        <Text style={styles.successBtnText}>Accueil</Text>
                        <ArrowRight size={14} color="#FFFFFF" />
                      </Pressable>

                      {storePhoneForWhatsApp && (
                        <Pressable
                          onPress={openWhatsApp}
                          disabled={isWhatsAppLoading}
                          style={({ pressed }) => [
                            styles.successBtn,
                            styles.successBtnWhatsApp,
                            pressed && styles.btnPressed,
                          ]}
                        >
                          {isWhatsAppLoading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Svg viewBox="0 0 24 24" width={16} height={16} fill="#FFFFFF">
                              <Path d={WHATSAPP_ICON_PATH} />
                            </Svg>
                          )}
                          <Text style={styles.successBtnText}>
                            {isWhatsAppLoading ? 'Ouverture...' : 'WhatsApp'}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* ── Récapitulatif ───────────────────────────────────── */}
            {stage !== 'success' && cart.length > 0 && (
              <View style={[styles.summary, { paddingBottom: 88 + insets.bottom }]}>
                <View style={styles.recapBox}>
                  <View style={styles.recapRow}>
                    <Text style={styles.recapLabel}>
                      Sous-total · {cartItemsCount} article{cartItemsCount > 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.recapValue}>{formatCurrency(baseCartTotal)}</Text>
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
                        <Text style={styles.recapGreen}>Code {promoApplied.code}</Text>
                      </View>
                      <Text style={styles.recapGreenValue}>
                        -{formatCurrency(discountAmount)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.recapTotalRow}>
                    <Text style={styles.recapTotalLabel}>Total</Text>
                    <Text style={styles.recapTotalValue}>{formatCurrency(cartTotal)}</Text>
                  </View>
                </View>

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
                      <Text style={styles.promoRemove}>✕</Text>
                    </Pressable>
                  </View>
                )}

                {(stage === 'shipping' || stage === 'payment') && (
                  <Pressable
                    onPress={handleBackToPreviousStage}
                    style={({ pressed }) => [styles.ghostBtn, pressed && styles.ghostBtnPressed]}
                  >
                    <Text style={styles.ghostBtnText}>
                      ← Retour à l&apos;étape précédente
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Barre fixe : action principale ───────────────────────── */}
      {stage !== 'success' && cart.length > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
          <Pressable
            onPress={stage === 'shipping' ? handleShippingSubmit : handleConfirmOrder}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.ctaPressed,
              isSubmitting && styles.ctaDisabled,
            ]}
          >
            {isSubmitting ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.ctaText}>Chargement...</Text>
              </>
            ) : (
              <>
                <Text style={styles.ctaText}>{ctaLabel}</Text>
                <ArrowRight size={16} color="#FFFFFF" />
              </>
            )}
          </Pressable>
        </View>
      )}
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

  // Formulaire « Contact à livrer »
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  formBadge: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.brand,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    flexShrink: 1,
  },
  fields: {
    gap: 24,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  nameField: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingLeft: 16,
    paddingRight: 16,
    backgroundColor: 'rgba(249,250,251,0.5)',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 16,
  },
  nameInput: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 14,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },

  // Paiement à la livraison
  paymentCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.brand,
    backgroundColor: '#FFF7ED',
  },
  paymentLabel: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },

  // Commande indisponible (garde-fou pays)
  blockedWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 16,
  },
  blockedIconOuter: {
    marginBottom: 20,
  },
  blockedGlow: {
    position: 'absolute',
    top: -16,
    left: -16,
    right: -16,
    bottom: -16,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    opacity: 0.6,
  },
  blockedIconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  blockedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  blockedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
    lineHeight: 19,
  },
  blockedStrong: {
    fontWeight: '700',
    color: '#374151',
  },
  blockedHint: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 280,
    lineHeight: 16,
  },

  // Commande réussie
  successWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SUCCESS_MIN_HEIGHT,
    paddingVertical: 48,
    paddingHorizontal: 16,
  },
  successIconOuter: {
    marginBottom: 40,
  },
  successGlow: {
    position: 'absolute',
    top: -16,
    left: -16,
    right: -16,
    bottom: -16,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
    opacity: 0.5,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  successStar: {
    position: 'absolute',
    right: -8,
    top: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FACC15',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  successTitleAccent: {
    color: '#22C55E',
  },
  successBar: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#22C55E',
    marginBottom: 16,
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 22,
    marginBottom: 32,
  },
  successActions: {
    width: '100%',
    alignItems: 'center',
  },
  successHint: {
    fontSize: 9,
    fontWeight: '600',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    textAlign: 'center',
    marginBottom: 12,
  },
  successButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 384,
  },
  successBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    elevation: 2,
  },
  successBtnHome: {
    backgroundColor: '#111827',
  },
  successBtnWhatsApp: {
    backgroundColor: '#22C55E',
  },
  successBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
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
  promoRemove: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(22,163,74,0.6)',
  },
  ghostBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnPressed: {
    backgroundColor: '#F9FAFB',
  },
  ghostBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
  },

  // Boutons primaires (bloqué / vide)
  primaryBtn: {
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
  primaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
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
