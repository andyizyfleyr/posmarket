/**
 * Point de vente (POS) vendeur — copie fidèle de `src/views/POSView.tsx` du web
 * (rendu mobile < 768 px) : en-tête (pastille, recherche, bascule « Gros »),
 * bandeau catégories, grille produits 3 colonnes, barre panier flottante,
 * feuille panier (client, lignes, commande, paiement, promo, totaux), modale de
 * succès (Imprimer / PDF / Nouvelle Vente) et sélecteurs gros / variante.
 *
 * Écarts assumés (points ambigus de l'audit 02) :
 * - le son de succès WebAudio n'a pas d'équivalent (silencieux) ;
 * - les toasts passent par le système global (`useToast`) — le web ne branchait
 *   `notify` que sur les cartes produit via un toast local ;
 * - le reçu utilise `expo-print` / le partage natif au lieu de l'iframe ;
 * - la barre panier est posée au-dessus de `BottomNav` (le natif n'a pas de
 *   position `fixed` : la barre est en absolu dans la zone de contenu).
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  ArrowRight,
  BadgePercent,
  Banknote,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Download,
  Image as ImageIcon,
  Minus,
  Package,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Store,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react-native';
import { useToast } from '@/components/ToastProvider';
import { COLORS } from '@/theme';
import { cartNoun } from '@/constants';
import {
  formatCurrency,
  getEffectiveWholesaleUnitPrice,
  getNormalizedWholesaleTiers,
} from '@/utils';
import { printPosReceipt, downloadPosReceiptPdf } from '@/utils/pos-receipt';
import { resolveImageUrl } from '@/api/client';
import type { Coupon, Product, StoreSettings } from '@/types';
import type { SellerCustomer } from '@/api/seller';

export interface PosCartLine {
  product: Product;
  quantity: number;
  variantId?: string | null;
  variantLabel?: string | null;
  variantSku?: string | null;
  variantOptionValues?: Record<string, string> | null;
}

/** Commande construite par le POS puis confiée à l'écran (route d'encaissement). */
export interface PosCheckoutInput {
  items: Array<{
    product: { id?: string; price?: number } | null;
    quantity: number;
    variantId: string | null;
    variantLabel: string | null;
    variantSku: string | null;
    variantOptionValues: Record<string, string> | null;
  }>;
  subtotal: number;
  total: number;
  discountAmount: number;
  promoCode?: string;
  paymentMethod: 'CASH' | 'MOBILE_MONEY';
  customer?: { id: string } | null;
  type: 'IN_STORE' | 'PICKUP';
  status: 'PENDING' | 'COMPLETED';
}

interface SellerPosViewProps {
  products: Product[];
  customers: SellerCustomer[];
  storeSettings: StoreSettings;
  canManageOrders: boolean;
  businessType?: string;
  /** Compteurs de stock live (route `/pos/stock`, sondés toutes les 5 s). */
  stockMap: Record<string, number>;
  coupons: Coupon[];
  onCheckout: (
    input: PosCheckoutInput,
  ) => Promise<{ success: boolean; orderId?: string; error?: string }>;
  /** Après une vente : recharge les compteurs de stock et les produits. */
  onSold: () => void;
}

const lineKeyOf = (productId: string, variantId?: string | null) =>
  `${productId}::${variantId ?? 'base'}`;

/** Image produit avec repli icône, comme `ProductImage` du web. */
function ProductThumb({ uri, iconSize = 32 }: { uri?: string | null; iconSize?: number }) {
  const [failed, setFailed] = useState(false);
  // Les images produit peuvent être relatives (`/api/image/...`) : même
  // résolution d'URL que les composants acheteur.
  const image = resolveImageUrl(uri);
  return (
    <View style={styles.thumbBox}>
      {image && !failed ? (
        <Image
          source={{ uri: image }}
          style={styles.thumbImg}
          contentFit="cover"
          alt=""
          onError={() => setFailed(true)}
        />
      ) : (
        <ImageIcon size={iconSize} color="#D1D5DB" />
      )}
    </View>
  );
}

/* ─── Carte produit (grille POS, sans lien) ─── */

interface PosProductCardProps {
  product: Product;
  stock: number;
  bulkMode: boolean;
  onAdd: (product: Product) => void;
  onAddBulk: (product: Product) => void;
  onOpenBulkPicker: (product: Product) => void;
  onOutOfStock: (product: Product) => void;
}

const PosProductCard = React.memo(function PosProductCard({
  product,
  stock,
  bulkMode,
  onAdd,
  onAddBulk,
  onOpenBulkPicker,
  onOutOfStock,
}: PosProductCardProps) {
  const [tapped, setTapped] = useState(false);
  const isOutOfStock = stock === 0;
  const isLowStock = stock > 0 && stock <= 5;
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const wholesaleTiers = getNormalizedWholesaleTiers(product);
  const hasWholesale = wholesaleTiers.length > 0;
  const firstWholesaleTier = hasWholesale ? wholesaleTiers[0] : null;
  const bulkAdd = bulkMode && hasWholesale && firstWholesaleTier;

  const handleTap = useCallback(() => {
    if (isOutOfStock) {
      onOutOfStock(product);
      return;
    }
    if (bulkAdd) {
      if (wholesaleTiers.length > 1) onOpenBulkPicker(product);
      else onAddBulk(product);
    } else {
      onAdd(product);
    }
    setTapped(true);
    setTimeout(() => setTapped(false), 300);
  }, [
    product,
    onAdd,
    onAddBulk,
    onOpenBulkPicker,
    onOutOfStock,
    isOutOfStock,
    bulkAdd,
    wholesaleTiers.length,
  ]);

  return (
    <Pressable
      onPress={handleTap}
      style={[
        styles.card,
        tapped ? styles.cardTapped : styles.cardIdle,
        isOutOfStock ? styles.cardDisabled : null,
      ]}
    >
      {/* Image */}
      <View style={[styles.cardImageWrap, isOutOfStock && styles.cardImageWrapOut]}>
        <ProductThumb uri={product.image} iconSize={32} />

        {/* Voile de retour au tap */}
        {tapped ? <View pointerEvents="none" style={styles.cardTapOverlay} /> : null}

        {/* Pastille « Gros » (mode gros uniquement) */}
        {bulkAdd && !isOutOfStock ? (
          <View style={[styles.addPill, tapped ? styles.addPillTapped : styles.addPillBulk]}>
            <View style={styles.addPillBulkRow}>
              <BadgePercent size={11} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.addPillBulkText}>{firstWholesaleTier?.minQty}</Text>
            </View>
          </View>
        ) : null}

        {/* Stock bas (haut gauche) */}
        {isLowStock ? (
          <View style={styles.lowStockBadge}>
            <AlertTriangle size={8} color="#FFFFFF" />
            <Text style={styles.lowStockText}>
              {stock} restant{stock > 1 ? 's' : ''}
            </Text>
          </View>
        ) : null}

        {/* Stock restant (haut droite) */}
        <View
          style={[
            styles.stockBadge,
            {
              backgroundColor:
                stock === 0 ? '#EF4444' : isLowStock ? '#F59E0B' : 'rgba(17,24,39,0.7)',
            },
          ]}
        >
          <Package size={8} color="#FFFFFF" />
          <Text style={styles.stockBadgeText}>{stock}</Text>
        </View>

        {/* Rupture : bandeau rouge en travers de la photo */}
        {isOutOfStock ? (
          <View style={styles.outOfStockOverlay} pointerEvents="none">
            <View style={styles.outOfStockBand}>
              <Text style={styles.outOfStockText}>Rupture de stock</Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={[styles.cardPrice, isOutOfStock && styles.cardPriceOut]}>
          {formatCurrency(product.price)}
        </Text>
        {isOutOfStock ? <Text style={styles.cardOutLabel}>Épuisé</Text> : null}
        {hasVariants ? (
          <Text style={styles.cardVariants}>
            {product.variants?.length ?? 0} variante
            {(product.variants?.length ?? 0) > 1 ? 's' : ''}
          </Text>
        ) : null}
        {hasWholesale && firstWholesaleTier ? (
          <View style={styles.cardWholesaleRow}>
            <BadgePercent size={8} color={bulkAdd ? '#D94F0A' : COLORS.brand} />
            <Text
              style={[styles.cardWholesaleText, bulkAdd ? styles.cardWholesaleTextBulk : null]}
            >
              Dès {firstWholesaleTier.minQty} :{' '}
              {formatCurrency(firstWholesaleTier.unitPrice)}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

/* ─── Ligne de panier ─── */

interface PosCartItemProps {
  item: PosCartLine;
  onUpdate: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
}

const PosCartItem = React.memo(function PosCartItem({
  item,
  onUpdate,
  onRemove,
}: PosCartItemProps) {
  const lineKey = lineKeyOf(item.product.id, item.variantId);
  const variant = item.variantId
    ? item.product.variants?.find((v) => v.id === item.variantId)
    : undefined;
  const basePrice = variant ? Number(variant.price) : item.product.price;
  const unitPrice = Math.min(
    getEffectiveWholesaleUnitPrice({ ...item.product, price: basePrice }, item.quantity),
    basePrice,
  );
  const isWholesale = unitPrice < basePrice;

  return (
    <View style={styles.cartLine}>
      <View style={styles.cartLineThumb}>
        <ProductThumb
          uri={variant?.image || item.product.image}
          iconSize={18}
        />
      </View>
      <View style={styles.cartLineBody}>
        <Text style={styles.cartLineName} numberOfLines={1}>
          {item.product.name}
        </Text>
        {item.variantLabel ? (
          <Text style={styles.cartLineVariant} numberOfLines={1}>
            {item.variantLabel}
          </Text>
        ) : null}
        <View style={styles.cartLinePriceRow}>
          <Text style={isWholesale ? styles.cartLinePriceBulk : styles.cartLinePrice}>
            {formatCurrency(unitPrice)}
          </Text>
          {isWholesale ? (
            <View style={styles.bulkMiniBadge}>
              <Text style={styles.bulkMiniBadgeText}>Gros</Text>
            </View>
          ) : null}
          <Text style={styles.cartLineTimes}>×</Text>
          <Text style={styles.cartLineQtyText}>{item.quantity}</Text>
        </View>
      </View>

      {/* Quantité */}
      <View style={styles.qtyControls}>
        <Pressable onPress={() => onUpdate(lineKey, -1)} style={styles.qtyBtn} hitSlop={4}>
          <Minus size={10} color="#6B7280" strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.qtyValue}>{item.quantity}</Text>
        <Pressable onPress={() => onUpdate(lineKey, 1)} style={styles.qtyBtn} hitSlop={4}>
          <Plus size={10} color="#6B7280" strokeWidth={2.5} />
        </Pressable>
      </View>

      {/* Total + suppression */}
      <View style={styles.cartLineRight}>
        <Text style={styles.cartLineTotal}>
          {formatCurrency(unitPrice * item.quantity)}
        </Text>
        <Pressable
          onPress={() => onRemove(lineKey)}
          hitSlop={6}
          style={styles.trashBtn}
          accessibilityLabel="Supprimer"
        >
          <Trash2 size={11} color="#D1D5DB" />
        </Pressable>
      </View>
    </View>
  );
});

/* ─── Vue principale ─── */

export function SellerPosView({
  products,
  customers,
  storeSettings,
  canManageOrders,
  businessType,
  stockMap,
  coupons,
  onCheckout,
  onSold,
}: SellerPosViewProps) {
  const { notify } = useToast();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  // Un resto parle de « commande », pas de « panier ».
  const cartWord = cartNoun(businessType === 'food' ? 'food' : 'shopping');

  const [searchTerm, setSearchTerm] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkPickerProduct, setBulkPickerProduct] = useState<Product | null>(null);
  const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null);
  const [variantPickerVariantId, setVariantPickerVariantId] = useState<string | null>(null);
  const [cart, setCart] = useState<PosCartLine[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<SellerCustomer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MOBILE_MONEY'>('CASH');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showCartSheet, setShowCartSheet] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState('');
  const [orderType, setOrderType] = useState<'IN_STORE' | 'PICKUP'>('IN_STORE');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [promoApplied, setPromoApplied] = useState<{ code: string; discountPct: number } | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [promoInput, setPromoInput] = useState('');

  /* ─── Données ─── */
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.mainCategory?.trim()) cats.add(p.mainCategory.trim());
      else if (p.category?.trim()) cats.add(p.category.trim());
    });
    return ['all', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(
    () =>
      products.filter((p) => {
        const matchesSearch =
          (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.category || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory =
          selectedCategory === 'all' ||
          p.category?.trim() === selectedCategory ||
          p.mainCategory?.trim() === selectedCategory;
        return matchesSearch && matchesCategory;
      }),
    [searchTerm, selectedCategory, products],
  );

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return [];
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.phone || '').includes(customerSearch),
    );
  }, [customerSearch, customers]);

  /* ─── Stock ─── */
  const stockOf = useCallback(
    (p: Product): number => {
      // Un produit à matrice n'est vendable que si au moins une variante l'est :
      // le stock global peut être positif alors que tout est épuisé.
      if (Array.isArray(p.variants) && p.variants.length > 0) {
        const total = p.variants.reduce(
          (sum, v) => sum + Math.max(0, Number(v.stock) || 0),
          0,
        );
        const live = stockMap[p.id];
        if (live != null && total <= 0) return live;
        return total;
      }
      return stockMap[p.id] ?? Number(p.stock ?? 0);
    },
    [stockMap],
  );

  // Le stock d'une ligne vient de la variante sélectionnée : le stock global du
  // produit ne dit rien de la disponibilité d'un « Rouge / M ».
  const stockOfLine = useCallback(
    (product: Product, variantId?: string | null): number => {
      if (variantId) {
        const variant = product.variants?.find((v) => v.id === variantId);
        if (variant) return Math.max(0, Number(variant.stock) || 0);
        return 0;
      }
      return stockOf(product);
    },
    [stockOf],
  );

  /* ─── Panier ─── */
  const addToCartQty = useCallback(
    (
      product: Product,
      qty: number,
      variant?: {
        id: string;
        name: string;
        sku?: string;
        price?: number;
        optionValues?: Record<string, string>;
      },
    ) => {
      const toAdd = Math.max(1, Math.floor(qty) || 1);
      const variantId = variant?.id ?? null;
      const key = lineKeyOf(product.id, variantId);
      const stock = stockOfLine(product, variantId);
      if (stock <= 0) {
        notify('Rupture de stock sur cette variante.', 'error', product.name);
        return;
      }
      const currentQty = cart
        .filter((i) => lineKeyOf(i.product.id, i.variantId) === key)
        .reduce((s, i) => s + i.quantity, 0);
      if (currentQty + toAdd > stock) {
        notify(
          `Stock insuffisant : ${stock} restant${stock > 1 ? 's' : ''}.`,
          'error',
          product.name,
        );
        return;
      }
      setCart((prev) => {
        const existing = prev.find(
          (item) => lineKeyOf(item.product.id, item.variantId) === key,
        );
        if (existing) {
          return prev.map((item) =>
            lineKeyOf(item.product.id, item.variantId) === key
              ? { ...item, quantity: item.quantity + toAdd }
              : item,
          );
        }
        return [
          ...prev,
          {
            product,
            quantity: toAdd,
            variantId,
            variantLabel: variant?.name ?? null,
            variantSku: variant?.sku ?? null,
            variantOptionValues: variant?.optionValues ?? null,
          },
        ];
      });
    },
    [cart, stockOfLine, notify],
  );

  // Un produit avec variantes exige un choix explicite : on ouvre le sélecteur
  // plutôt que de vendre « au hasard » la première variante.
  const addToCart = useCallback(
    (product: Product) => {
      if (Array.isArray(product.variants) && product.variants.length > 0) {
        setVariantPickerProduct(product);
        setVariantPickerVariantId(null);
        return;
      }
      addToCartQty(product, 1);
    },
    [addToCartQty],
  );

  const addToCartBulk = useCallback(
    (product: Product) => {
      const tiers = getNormalizedWholesaleTiers(product);
      addToCartQty(product, tiers.length > 0 ? tiers[0].minQty : 1);
    },
    [addToCartQty],
  );

  const openBulkPicker = useCallback((product: Product) => {
    setBulkPickerProduct(product);
  }, []);

  const confirmVariantAdd = useCallback(
    (product: Product, variantId: string) => {
      const variant = product.variants?.find((v) => v.id === variantId);
      if (!variant) return;
      addToCartQty(product, 1, {
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        price: Number(variant.price) || 0,
      });
      setVariantPickerProduct(null);
      setVariantPickerVariantId(null);
    },
    [addToCartQty],
  );

  const updateQuantity = useCallback(
    (key: string, delta: number) => {
      const target = cart.find((item) => lineKeyOf(item.product.id, item.variantId) === key);
      if (!target) return;
      if (delta > 0) {
        const stock = stockOfLine(target.product, target.variantId);
        if (stock <= 0 || target.quantity + delta > stock) {
          notify(
            `Stock insuffisant : ${stock} restant${stock > 1 ? 's' : ''}.`,
            'error',
            target.product.name,
          );
          return;
        }
      }
      setCart((prev) =>
        prev.map((item) =>
          lineKeyOf(item.product.id, item.variantId) === key
            ? { ...item, quantity: Math.max(1, item.quantity + delta) }
            : item,
        ),
      );
    },
    [cart, stockOfLine, notify],
  );

  const removeFromCart = useCallback((key: string) => {
    setCart((prev) =>
      prev.filter((item) => lineKeyOf(item.product.id, item.variantId) !== key),
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setSelectedCustomer(null);
    setPromoApplied(null);
  }, []);

  // Le total doit refléter le prix réellement vendu (variante), pas le prix de
  // base du produit.
  const unitPriceOf = useCallback((item: PosCartLine): number => {
    const variant = item.variantId
      ? item.product.variants?.find((v) => v.id === item.variantId)
      : undefined;
    const basePrice = variant
      ? Number(variant.price) || item.product.price
      : item.product.price;
    return Math.min(
      getEffectiveWholesaleUnitPrice({ ...item.product, price: basePrice }, item.quantity),
      basePrice,
    );
  }, []);

  const totals = useMemo(() => {
    const baseSubtotal = cart.reduce((sum, item) => sum + unitPriceOf(item) * item.quantity, 0);
    const discountAmount = promoApplied ? baseSubtotal * (promoApplied.discountPct / 100) : 0;
    const subtotal = baseSubtotal - discountAmount;
    const total = subtotal;
    return { baseSubtotal, discountAmount, subtotal, total };
  }, [cart, promoApplied, unitPriceOf]);

  const totalItems = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);

  const handlePromoApply = (code: string) => {
    const normalizedCode = code.trim().toUpperCase();
    const matchedCoupon = coupons.find((c) => c.code === normalizedCode && c.active);
    if (matchedCoupon) {
      setPromoApplied({ code: matchedCoupon.code, discountPct: matchedCoupon.discount_pct });
      setPromoInput('');
      notify(
        `Code promo "${matchedCoupon.code}" appliqué: ${matchedCoupon.discount_pct}% de réduction!`,
        'success',
      );
    } else {
      notify('Code non valide ou expiré.', 'error');
    }
  };

  /* ─── Encaissement ─── */
  const handleCheckout = () => {
    const newOrderId = 'CMD-' + Math.random().toString(36).slice(2, 11).toUpperCase();
    setCurrentOrderId(newOrderId);
    setIsProcessing(true);
    setTimeout(async () => {
      try {
        const result = await onCheckout({
          // Le prix porté par la ligne doit être celui réellement facturé
          // (variante + palier de gros) : l'action le recopie dans `order_items`.
          items: cart.map((item) => ({
            product: { id: item.product.id, price: unitPriceOf(item) },
            quantity: item.quantity,
            variantId: item.variantId ?? null,
            variantLabel: item.variantLabel ?? null,
            variantSku: item.variantSku ?? null,
            variantOptionValues: item.variantOptionValues ?? null,
          })),
          subtotal: totals.subtotal,
          total: totals.total,
          discountAmount: totals.discountAmount,
          promoCode: promoApplied ? promoApplied.code : undefined,
          paymentMethod,
          customer: selectedCustomer ? { id: selectedCustomer.id } : null,
          type: orderType,
          status: orderType === 'PICKUP' ? 'PENDING' : 'COMPLETED',
        });
        if (!result.success) throw new Error(result.error);
        if (result.orderId) setCurrentOrderId(result.orderId);
        setShowCheckoutModal(true);
        setShowCartSheet(false);
        onSold();
      } catch (err: unknown) {
        console.error(err);
        notify(
          err instanceof Error ? err.message : "Erreur lors de l'enregistrement du paiement",
          'error',
        );
      } finally {
        setIsProcessing(false);
      }
    }, 600);
  };

  const getReceiptData = useCallback(
    () => ({
      orderId: currentOrderId ? currentOrderId.slice(-8).toUpperCase() : 'CMD',
      date: new Date().toLocaleDateString('fr-FR'),
      storeName: storeSettings?.name || 'Point de Vente',
      storeAddress: storeSettings?.address || undefined,
      storePhone: storeSettings?.phone || undefined,
      storeEmail: storeSettings?.email || undefined,
      orderType,
      paymentMethod: paymentMethod === 'CASH' ? 'Espèces' : 'Mobile Money',
      customerName: selectedCustomer ? selectedCustomer.name : undefined,
      items: cart.map((item) => {
        const unitPrice = unitPriceOf(item);
        return {
          name: item.product.name,
          quantity: item.quantity,
          unit: item.product.unit,
          unitPrice,
          total: unitPrice * item.quantity,
          variantLabel: item.variantLabel ?? null,
        };
      }),
      subtotal: totals.baseSubtotal,
      discount: promoApplied
        ? { code: promoApplied.code, amount: totals.discountAmount }
        : undefined,
      total: totals.total,
    }),
    [
      currentOrderId,
      storeSettings,
      orderType,
      paymentMethod,
      selectedCustomer,
      cart,
      totals,
      promoApplied,
      unitPriceOf,
    ],
  );

  const handlePrint = useCallback(() => {
    try {
      const data = getReceiptData();
      void printPosReceipt(data).catch((err) => {
        console.error('Print error:', err);
        notify("Erreur lors de l'impression du reçu", 'error');
      });
      notify('Impression du reçu lancée', 'info');
    } catch (err) {
      console.error('Print error:', err);
      notify("Erreur lors de l'impression du reçu", 'error');
    }
  }, [getReceiptData, notify]);

  const handleDownloadPDF = useCallback(async () => {
    if (isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      const data = getReceiptData();
      await downloadPosReceiptPdf(data);
      notify('Reçu PDF téléchargé avec succès !', 'success');
    } catch (err) {
      console.error('PDF error:', err);
      notify('Erreur lors du téléchargement du PDF', 'error');
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [isDownloadingPdf, getReceiptData, notify]);

  const closeCheckout = () => {
    setShowCheckoutModal(false);
    setCart([]);
    setSelectedCustomer(null);
    setShowCartSheet(false);
    setPromoApplied(null);
    setOrderType('IN_STORE');
  };

  /* ─── Contenu du panier (en-tête, client, lignes, options, pied) ─── */
  const renderCartContent = () => (
    <>
      {/* En-tête panier */}
      <View style={styles.sheetHeader}>
        <View style={styles.sheetHeaderLeft}>
          <Pressable
            onPress={() => setShowCartSheet(false)}
            style={styles.sheetClose}
            hitSlop={8}
          >
            <ChevronDown size={20} color="#9CA3AF" />
          </Pressable>
          <LinearGradient
            colors={['#F56B2A', '#E04E0F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.receiptPill}
          >
            <Receipt size={16} color="#FFFFFF" />
          </LinearGradient>
          <View>
            <Text style={styles.sheetTitle}>{cartWord}</Text>
            <Text style={styles.sheetSubtitle}>
              {totalItems} article{totalItems > 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        {cart.length > 0 ? (
          <Pressable onPress={clearCart} hitSlop={6} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Vider</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={styles.sheetScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Client */}
        <View style={styles.customerSection}>
          <Text style={styles.fieldLabel}>Client</Text>
          {!selectedCustomer ? (
            <View style={styles.customerFieldWrap}>
              <TextInput
                value={customerSearch}
                onChangeText={setCustomerSearch}
                placeholder="Nom ou téléphone..."
                placeholderTextColor="#9CA3AF"
                style={styles.customerInput}
              />
              <View pointerEvents="none" style={styles.customerSearchIcon}>
                <Search size={13} color="#D1D5DB" />
              </View>
              {filteredCustomers.length > 0 ? (
                <View style={styles.customerDropdown}>
                  <ScrollView
                    style={styles.customerDropdownScroll}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                  >
                    {filteredCustomers.map((c) => (
                      <Pressable
                        key={c.id}
                        onPress={() => {
                          setSelectedCustomer(c);
                          setCustomerSearch('');
                        }}
                        style={styles.customerRow}
                      >
                        <Text style={styles.customerRowName}>{c.name}</Text>
                        <Text style={styles.customerRowPhone}>{c.phone}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.customerCard}>
              <View style={styles.customerCardLeft}>
                <LinearGradient
                  colors={['#F56B2A', '#E04E0F']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.customerAvatar}
                >
                  <Text style={styles.customerAvatarText}>
                    {(selectedCustomer.name[0] || '?').toUpperCase()}
                  </Text>
                </LinearGradient>
                <View>
                  <Text style={styles.customerCardName}>{selectedCustomer.name}</Text>
                  <Text style={styles.customerCardPhone}>{selectedCustomer.phone}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setSelectedCustomer(null)}
                style={styles.customerRemove}
                hitSlop={6}
              >
                <X size={14} color="#FB923C" />
              </Pressable>
            </View>
          )}
        </View>

        {/* Lignes */}
        <View style={styles.cartItems}>
          {cart.length === 0 ? (
            <View style={styles.emptyCart}>
              <View style={styles.emptyCartIcon}>
                <ShoppingBasket size={28} color="#E5E7EB" />
              </View>
              <Text style={styles.emptyCartTitle}>{cartWord} vide</Text>
              <Text style={styles.emptyCartHint}>
                {"Appuyez sur un produit pour l'ajouter"}
              </Text>
            </View>
          ) : (
            cart.map((item) => (
              <PosCartItem
                key={lineKeyOf(item.product.id, item.variantId)}
                item={item}
                onUpdate={updateQuantity}
                onRemove={removeFromCart}
              />
            ))
          )}
        </View>

        {/* Commande, paiement, promo */}
        {cart.length > 0 ? (
          <View style={styles.optionsBlock}>
            {/* Commande */}
            <View>
              <Text style={styles.fieldLabel}>Commande</Text>
              <View style={styles.optionRow}>
                {(
                  [
                    { id: 'IN_STORE' as const, label: 'Magasin', Icon: Store },
                    { id: 'PICKUP' as const, label: 'À récupérer', Icon: Clock },
                  ] as const
                ).map((t) => {
                  const active = orderType === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => setOrderType(t.id)}
                      style={[
                        styles.optionBtn,
                        active ? styles.optionBtnActive : styles.optionBtnIdle,
                      ]}
                    >
                      <t.Icon size={13} color={active ? '#FFFFFF' : '#6B7280'} />
                      <Text
                        style={[
                          styles.optionBtnText,
                          active ? styles.optionBtnTextActive : styles.optionBtnTextIdle,
                        ]}
                      >
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Paiement */}
            <View>
              <Text style={styles.fieldLabel}>Paiement</Text>
              <View style={styles.optionRow}>
                {(
                  [
                    { id: 'CASH' as const, label: 'Espèces', Icon: Banknote },
                    { id: 'MOBILE_MONEY' as const, label: 'Mobile Money', Icon: Smartphone },
                  ] as const
                ).map((pm) => {
                  const active = paymentMethod === pm.id;
                  return (
                    <Pressable
                      key={pm.id}
                      onPress={() => setPaymentMethod(pm.id)}
                      style={[
                        styles.optionBtn,
                        active ? styles.optionBtnActive : styles.optionBtnIdle,
                      ]}
                    >
                      <pm.Icon size={13} color={active ? '#FFFFFF' : '#6B7280'} />
                      <Text
                        style={[
                          styles.optionBtnText,
                          active ? styles.optionBtnTextActive : styles.optionBtnTextIdle,
                        ]}
                      >
                        {pm.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Code promo */}
            {!promoApplied ? (
              <View style={styles.promoRow}>
                <TextInput
                  value={promoInput}
                  onChangeText={setPromoInput}
                  onSubmitEditing={() => {
                    if (promoInput) handlePromoApply(promoInput);
                  }}
                  placeholder="Code promo..."
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  style={styles.promoInput}
                />
                <Pressable
                  onPress={() => {
                    if (promoInput) handlePromoApply(promoInput);
                  }}
                  style={styles.promoOkBtn}
                >
                  <Text style={styles.promoOkText}>OK</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.promoApplied}>
                <View style={styles.promoAppliedLeft}>
                  <Tag size={12} color="#15803D" />
                  <Text style={styles.promoAppliedText}>
                    {promoApplied.code} (−{promoApplied.discountPct}%)
                  </Text>
                </View>
                <Pressable onPress={() => setPromoApplied(null)} hitSlop={6}>
                  <X size={12} color="#4ADE80" />
                </Pressable>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* Totaux + encaissement */}
      <View style={[styles.sheetFooter, { paddingBottom: 12 + insets.bottom }]}>
        {cart.length > 0 ? (
          <View style={styles.totalsBlock}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Sous-total</Text>
              <Text style={styles.totalValue}>{formatCurrency(totals.baseSubtotal)}</Text>
            </View>
            {promoApplied ? (
              <View style={styles.totalRow}>
                <Text style={styles.discountLabel}>Remise ({promoApplied.code})</Text>
                <Text style={styles.discountLabel}>
                  −{formatCurrency(totals.discountAmount)}
                </Text>
              </View>
            ) : null}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(totals.total)}</Text>
            </View>
          </View>
        ) : null}

        {canManageOrders ? (
          <Pressable
            onPress={handleCheckout}
            disabled={cart.length === 0 || isProcessing}
            style={[
              styles.checkoutBtn,
              cart.length === 0 || isProcessing ? styles.checkoutBtnDisabled : null,
            ]}
          >
            {cart.length > 0 && !isProcessing ? (
              <LinearGradient
                colors={['#F56B2A', '#E04E0F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <CreditCard size={18} color={cart.length === 0 ? '#9CA3AF' : '#FFFFFF'} />
            )}
            <Text
              style={[
                styles.checkoutBtnText,
                cart.length === 0 ? styles.checkoutBtnTextDisabled : null,
              ]}
            >
              {isProcessing ? 'Envoi...' : cart.length === 0 ? `${cartWord} vide` : 'Encaisser'}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.noPermission}>
            <X size={13} color="#EF4444" />
            <Text style={styles.noPermissionText}>Permission insuffisante</Text>
          </View>
        )}
      </View>
    </>
  );

  return (
    <View style={styles.root}>
      {/* ─── Colonne produits (masquée quand la feuille panier est ouverte) ─── */}
      <View style={[styles.productsColumn, showCartSheet ? styles.hidden : null]}>
        {/* En-tête POS */}
        <View style={styles.header}>
          <LinearGradient
            colors={['#F56B2A', '#E04E0F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sparklesPill}
          >
            <Sparkles size={16} color="#FFFFFF" />
          </LinearGradient>

          {/* Recherche */}
          <View style={styles.searchWrap}>
            <View pointerEvents="none" style={styles.searchIcon}>
              <Search size={14} color="#D1D5DB" />
            </View>
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Rechercher un produit..."
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
            />
            {searchTerm ? (
              <Pressable
                onPress={() => setSearchTerm('')}
                style={styles.searchClear}
                hitSlop={6}
              >
                <X size={14} color="#D1D5DB" />
              </Pressable>
            ) : null}
          </View>

          {/* Mode gros */}
          <Pressable
            onPress={() => setBulkMode((v) => !v)}
            style={[styles.bulkToggle, bulkMode ? styles.bulkToggleActive : styles.bulkToggleIdle]}
            accessibilityLabel="Ajouter directement la quantité du palier de gros (dès) en un tap"
          >
            <BadgePercent size={14} color={bulkMode ? '#FFFFFF' : '#6B7280'} />
            <Text style={[styles.bulkToggleText, bulkMode ? styles.bulkToggleTextActive : null]}>
              Gros
            </Text>
          </Pressable>
        </View>

        {/* Catégories */}
        <View style={styles.categoriesBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesRow}
          >
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={[
                    styles.categoryChip,
                    active ? styles.categoryChipActive : styles.categoryChipIdle,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      active ? styles.categoryChipTextActive : null,
                    ]}
                  >
                    {cat === 'all' ? 'Tout' : cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Grille produits */}
        <ScrollView
          style={styles.gridScroll}
          contentContainerStyle={styles.gridScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {bulkMode ? (
            <View style={styles.bulkBanner}>
              <BadgePercent size={14} color={COLORS.brand} />
              <Text style={styles.bulkBannerText}>
                Mode gros actif : un tap ajoute la quantité du palier « Dès N », ou ouvre le
                choix des paliers si le produit en a plusieurs.
              </Text>
            </View>
          ) : null}

          {filteredProducts.length === 0 ? (
            <View style={styles.emptyGrid}>
              <View style={styles.emptyGridIcon}>
                <Search size={28} color="#D1D5DB" />
              </View>
              <Text style={styles.emptyGridTitle}>Aucun produit trouvé</Text>
              <Text style={styles.emptyGridHint}>Essayez un autre terme de recherche</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {filteredProducts.map((product) => (
                <View key={product.id} style={styles.gridItem}>
                  <PosProductCard
                    product={product}
                    stock={stockOf(product)}
                    bulkMode={bulkMode}
                    onAdd={addToCart}
                    onAddBulk={addToCartBulk}
                    onOpenBulkPicker={openBulkPicker}
                    onOutOfStock={(p) =>
                      notify(`${p.name} est en rupture de stock`, 'error', 'Produit indisponible')
                    }
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      {/* ─── Barre panier flottante ─── */}
      {cart.length > 0 && !showCartSheet ? (
        <Pressable
          onPress={() => setShowCartSheet(true)}
          style={styles.cartBarWrap}
          accessibilityLabel={`Voir le ${cartWord.toLowerCase()}`}
        >
          <LinearGradient
            colors={['#F56B2A', '#E04E0F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cartBar}
          >
            <View style={styles.cartBarLeft}>
              <View style={styles.cartBarBasketWrap}>
                <ShoppingBasket size={18} color="#FFFFFF" />
                <View style={styles.cartBarBadge}>
                  <Text style={styles.cartBarBadgeText}>{totalItems}</Text>
                </View>
              </View>
              <Text style={styles.cartBarTotal}>{formatCurrency(totals.total)}</Text>
            </View>
            <View style={styles.cartBarRight}>
              <Text style={styles.cartBarCta}>Voir le panier</Text>
              <ArrowRight size={16} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </Pressable>
      ) : null}

      {/* ─── Feuille panier (mobile) ─── */}
      <Modal
        visible={showCartSheet}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowCartSheet(false)}
      >
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setShowCartSheet(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetWrap}
            pointerEvents="box-none"
          >
            <View style={styles.sheet}>
              {/* Poignée */}
              <View style={styles.sheetHandleWrap}>
                <View style={styles.sheetHandle} />
              </View>
              {renderCartContent()}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ─── Modale de succès ─── */}
      <Modal
        visible={showCheckoutModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeCheckout}
      >
        <View style={styles.successRoot}>
          <View style={styles.successSheet}>
            {/* En-tête */}
            <LinearGradient
              colors={['#F0FDF4', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.successHeader}
            >
              <View style={styles.sheetHandle} />
              <View style={styles.successIcon}>
                <CheckCircle2 size={36} color="#16A34A" />
              </View>
              <Text style={styles.successTitle}>Vente enregistrée !</Text>
              <Text style={styles.successOrderId}>
                #{currentOrderId.slice(-8).toUpperCase()}
              </Text>
            </LinearGradient>

            {/* Récapitulatif */}
            <ScrollView
              style={styles.successScroll}
              contentContainerStyle={styles.successSummaryWrap}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.successCard}>
                <View style={styles.successRow}>
                  <Text style={styles.successRowLabel}>
                    {totalItems} article{totalItems > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.successRowValue}>
                    {formatCurrency(totals.baseSubtotal)}
                  </Text>
                </View>
                {promoApplied ? (
                  <View style={styles.successRow}>
                    <Text style={styles.discountLabel}>Remise ({promoApplied.code})</Text>
                    <Text style={styles.discountLabel}>
                      −{formatCurrency(totals.discountAmount)}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.successTotalRow}>
                  <Text style={styles.successTotalLabel}>Total payé</Text>
                  <Text style={styles.successTotalValue}>{formatCurrency(totals.total)}</Text>
                </View>
                <View style={styles.successMetaRow}>
                  <View style={styles.successMetaItem}>
                    {paymentMethod === 'CASH' ? (
                      <Banknote size={12} color="#9CA3AF" />
                    ) : (
                      <Smartphone size={12} color="#9CA3AF" />
                    )}
                    <Text style={styles.successMetaText}>
                      {paymentMethod === 'CASH' ? 'Espèces' : 'Mobile Money'}
                    </Text>
                  </View>
                  <Text style={styles.successMetaDot}>•</Text>
                  <View style={styles.successMetaItem}>
                    {orderType === 'IN_STORE' ? (
                      <Store size={12} color="#9CA3AF" />
                    ) : (
                      <Clock size={12} color="#9CA3AF" />
                    )}
                    <Text style={styles.successMetaText}>
                      {orderType === 'IN_STORE' ? 'En magasin' : 'À récupérer'}
                    </Text>
                  </View>
                  {selectedCustomer ? (
                    <>
                      <Text style={styles.successMetaDot}>•</Text>
                      <View style={styles.successMetaItem}>
                        <User size={12} color="#9CA3AF" />
                        <Text style={styles.successMetaText}>{selectedCustomer.name}</Text>
                      </View>
                    </>
                  ) : null}
                </View>
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={[styles.successActions, { paddingBottom: 20 + insets.bottom }]}>
              <View style={styles.successActionRow}>
                <Pressable onPress={handlePrint} style={styles.successActionBtn}>
                  <Printer size={16} color={COLORS.brand} />
                  <Text style={styles.successActionText}>Imprimer</Text>
                </Pressable>
                <Pressable
                  onPress={handleDownloadPDF}
                  disabled={isDownloadingPdf}
                  style={[styles.successActionBtn, isDownloadingPdf ? styles.disabled : null]}
                >
                  {isDownloadingPdf ? (
                    <ActivityIndicator size="small" color={COLORS.brand} />
                  ) : (
                    <>
                      <Download size={16} color={COLORS.brand} />
                      <Text style={styles.successActionText}>PDF</Text>
                    </>
                  )}
                </Pressable>
              </View>
              <Pressable onPress={closeCheckout} style={styles.newSaleBtn}>
                <LinearGradient
                  colors={['#F56B2A', '#E04E0F']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.newSaleText}>Nouvelle Vente</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Sélecteur de paliers de gros (mode Gros, produits multi-paliers) ─── */}
      <Modal
        visible={bulkPickerProduct !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setBulkPickerProduct(null)}
      >
        <Pressable style={styles.dialogBackdrop} onPress={() => setBulkPickerProduct(null)}>
          <Pressable style={styles.dialogCard} onPress={() => {}}>
            {bulkPickerProduct
              ? (() => {
                  const p = bulkPickerProduct;
                  const tiers = getNormalizedWholesaleTiers(p);
                  // Un produit à variantes passe d'abord par le choix de variante :
                  // la quantité de gros s'applique ensuite sur la variante retenue.
                  const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
                  const inCart = (variantId?: string | null) =>
                    cart
                      .filter(
                        (i) =>
                          i.product.id === p.id &&
                          (i.variantId ?? null) === (variantId ?? null),
                      )
                      .reduce((s, i) => s + i.quantity, 0);
                  const room = (variantId?: string | null) => {
                    const stock = hasVariants
                      ? (p.variants?.find((v) => v.id === variantId)?.stock ?? 0)
                      : stockOf(p);
                    if (stock <= 0) return 0;
                    return Math.max(0, stock - inCart(variantId));
                  };
                  const bulkQty = tiers.length > 0 ? tiers[0].minQty : 1;

                  return (
                    <>
                      <View style={styles.dialogHeader}>
                        <View style={styles.dialogThumb}>
                          <ProductThumb uri={p.image} iconSize={16} />
                        </View>
                        <View style={styles.dialogHeaderBody}>
                          <Text style={styles.dialogTitle} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Text style={styles.dialogSubtitle}>
                            Prix unitaire : {formatCurrency(p.price)}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => setBulkPickerProduct(null)}
                          hitSlop={8}
                          style={styles.dialogClose}
                          accessibilityLabel="Fermer"
                        >
                          <X size={16} color="#9CA3AF" />
                        </Pressable>
                      </View>
                      <View style={styles.dialogBody}>
                        {hasVariants ? (
                          <>
                            <Text style={styles.dialogSectionLabel}>
                              Choisir la variante · {bulkQty} u
                            </Text>
                            {(p.variants || []).map((v) => {
                              const canAdd = room(v.id) >= bulkQty;
                              return (
                                <Pressable
                                  key={v.id}
                                  disabled={!canAdd}
                                  onPress={() => {
                                    addToCartQty(p, bulkQty, {
                                      id: v.id,
                                      name: v.name,
                                      sku: v.sku,
                                      price: Number(v.price) || 0,
                                    });
                                    setBulkPickerProduct(null);
                                  }}
                                  style={[
                                    styles.dialogOption,
                                    canAdd
                                      ? styles.dialogOptionActive
                                      : styles.dialogOptionDisabled,
                                  ]}
                                >
                                  <View style={styles.dialogOptionLeftCol}>
                                    <Text style={styles.dialogOptionName} numberOfLines={1}>
                                      {v.name}
                                    </Text>
                                    {v.sku ? (
                                      <Text style={styles.dialogOptionSub}>SKU {v.sku}</Text>
                                    ) : null}
                                  </View>
                                  <View style={styles.dialogOptionRight}>
                                    <Text style={styles.dialogOptionPrice}>
                                      {formatCurrency(Number(v.price) || 0)}
                                    </Text>
                                    {!canAdd ? (
                                      <Text style={styles.dialogOptionWarn}>
                                        Stock insuffisant
                                      </Text>
                                    ) : null}
                                  </View>
                                </Pressable>
                              );
                            })}
                          </>
                        ) : (
                          <>
                            <Text style={styles.dialogSectionLabel}>
                              Choisir la quantité gros
                            </Text>
                            {tiers.map((tier) => {
                              const available = room(null);
                              const canAdd = available >= tier.minQty;
                              return (
                                <Pressable
                                  key={tier.minQty}
                                  disabled={!canAdd}
                                  onPress={() => {
                                    addToCartQty(p, tier.minQty);
                                    setBulkPickerProduct(null);
                                  }}
                                  style={[
                                    styles.dialogOption,
                                    canAdd
                                      ? styles.dialogOptionActive
                                      : styles.dialogOptionDisabled,
                                  ]}
                                >
                                  <View style={styles.dialogTierLeft}>
                                    <View style={styles.tierPill}>
                                      <Text style={styles.tierPillText}>
                                        Dès {tier.minQty}
                                      </Text>
                                    </View>
                                    <View style={styles.dialogTierBody}>
                                      <Text style={styles.dialogOptionPrice}>
                                        {formatCurrency(tier.unitPrice)}
                                        <Text style={styles.dialogOptionPriceSub}>
                                          {' '}
                                          /u (total {formatCurrency(tier.packagePrice)})
                                        </Text>
                                      </Text>
                                      {tier.discountPct > 0 ? (
                                        <Text style={styles.dialogSavings}>
                                          Économie {formatCurrency(tier.savings)} (-
                                          {tier.discountPct}%)
                                        </Text>
                                      ) : null}
                                    </View>
                                  </View>
                                  {!canAdd ? (
                                    <Text style={styles.dialogOptionWarn}>
                                      {available === 0 ? 'Rupture' : 'Stock insuffisant'}
                                    </Text>
                                  ) : null}
                                </Pressable>
                              );
                            })}
                          </>
                        )}
                        <Pressable
                          onPress={() => setBulkPickerProduct(null)}
                          style={styles.dialogCancel}
                        >
                          <Text style={styles.dialogCancelText}>Annuler</Text>
                        </Pressable>
                      </View>
                    </>
                  );
                })()
              : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Sélecteur de variante (produits à matrice) ─── */}
      <Modal
        visible={variantPickerProduct !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setVariantPickerProduct(null)}
      >
        <Pressable style={styles.dialogBackdrop} onPress={() => setVariantPickerProduct(null)}>
          <Pressable style={styles.dialogCard} onPress={() => {}}>
            {variantPickerProduct
              ? (() => {
                  const p = variantPickerProduct;
                  const list = Array.isArray(p.variants) ? p.variants : [];
                  const selected = list.find((v) => v.id === variantPickerVariantId) || null;
                  return (
                    <>
                      <View style={styles.dialogHeader}>
                        <View style={styles.dialogThumb}>
                          <ProductThumb
                            uri={selected?.image || p.image}
                            iconSize={16}
                          />
                        </View>
                        <View style={styles.dialogHeaderBody}>
                          <Text style={styles.dialogTitle} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Text style={styles.dialogSubtitle}>
                            Prix unitaire :{' '}
                            {formatCurrency(selected ? Number(selected.price) || 0 : p.price)}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => setVariantPickerProduct(null)}
                          hitSlop={8}
                          style={styles.dialogClose}
                          accessibilityLabel="Fermer"
                        >
                          <X size={16} color="#9CA3AF" />
                        </Pressable>
                      </View>

                      <ScrollView
                        style={{ maxHeight: windowHeight * 0.55 }}
                        contentContainerStyle={styles.dialogBody}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                      >
                        <Text style={styles.dialogSectionLabel}>Choisir la variante</Text>
                        {list.map((v) => {
                          const vStock = Math.max(0, Number(v.stock) || 0);
                          const out = vStock === 0;
                          const isSelected = selected?.id === v.id;
                          return (
                            <Pressable
                              key={v.id}
                              disabled={out}
                              onPress={() => setVariantPickerVariantId(v.id)}
                              style={[
                                styles.dialogOption,
                                out
                                  ? styles.dialogOptionDisabled
                                  : isSelected
                                    ? styles.dialogOptionSelected
                                    : styles.dialogOptionNeutral,
                              ]}
                            >
                              <View style={styles.dialogOptionLeftCol}>
                                <Text style={styles.dialogOptionName} numberOfLines={1}>
                                  {v.name}
                                </Text>
                                {v.sku ? (
                                  <Text style={styles.dialogOptionSub}>SKU {v.sku}</Text>
                                ) : null}
                              </View>
                              <View style={styles.dialogOptionRight}>
                                <Text style={styles.dialogOptionPrice}>
                                  {formatCurrency(Number(v.price) || 0)}
                                </Text>
                                <Text
                                  style={[
                                    styles.dialogStockText,
                                    out
                                      ? styles.dialogStockOut
                                      : vStock <= 5
                                        ? styles.dialogStockLow
                                        : null,
                                  ]}
                                >
                                  {out ? 'Rupture' : `${vStock} en stock`}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}

                        <Pressable
                          disabled={!selected || (Number(selected.stock) || 0) === 0}
                          onPress={() => selected && confirmVariantAdd(p, selected.id)}
                          style={[
                            styles.variantCta,
                            selected && (Number(selected.stock) || 0) > 0
                              ? styles.variantCtaActive
                              : styles.variantCtaDisabled,
                          ]}
                        >
                          <Text
                            style={[
                              styles.variantCtaText,
                              selected && (Number(selected.stock) || 0) > 0
                                ? styles.variantCtaTextActive
                                : styles.variantCtaTextDisabled,
                            ]}
                          >
                            {selected
                              ? `Ajouter — ${formatCurrency(Number(selected.price) || 0)}`
                              : 'Choisissez une variante'}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setVariantPickerProduct(null)}
                          style={styles.dialogCancel}
                        >
                          <Text style={styles.dialogCancelText}>Annuler</Text>
                        </Pressable>
                      </ScrollView>
                    </>
                  );
                })()
              : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FDFDFE',
  },
  productsColumn: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },

  thumbBox: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },

  // ── En-tête ─────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sparklesPill: {
    padding: 6,
    borderRadius: 12,
    shadowColor: 'rgba(254,215,170,0.3)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  searchWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  searchInput: {
    paddingLeft: 36,
    paddingRight: 16,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    fontSize: 12,
    color: '#111827',
  },
  searchClear: {
    position: 'absolute',
    right: 12,
  },
  bulkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  bulkToggleActive: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
    shadowColor: 'rgba(255,237,213,1)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  bulkToggleIdle: {
    backgroundColor: '#F9FAFB',
    borderColor: '#F3F4F6',
  },
  bulkToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
  bulkToggleTextActive: {
    color: '#FFFFFF',
  },

  // ── Catégories ──────────────────────────────────────────────────
  categoriesBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  categoriesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryChipActive: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
    shadowColor: 'rgba(255,237,213,1)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryChipIdle: {
    backgroundColor: '#F9FAFB',
    borderColor: '#F3F4F6',
  },
  categoryChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },

  // ── Grille ──────────────────────────────────────────────────────
  gridScroll: {
    flex: 1,
  },
  gridScrollContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 112,
  },
  bulkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  bulkBannerText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: '#7A3C14',
    lineHeight: 14,
  },
  emptyGrid: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyGridIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyGridTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  emptyGridHint: {
    fontSize: 10,
    color: '#D1D5DB',
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  gridItem: {
    width: '33.333%',
    padding: 4,
  },

  // ── Carte produit ───────────────────────────────────────────────
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardIdle: {
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTapped: {
    borderColor: COLORS.brand,
    shadowColor: '#FFEDD5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  cardDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#FECACA',
  },
  cardImageWrapOut: {
    opacity: 0.45,
  },
  cardImageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F9FAFB',
  },
  cardTapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,107,42,0.1)',
  },
  addPill: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPillIdle: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addPillTapped: {
    backgroundColor: COLORS.brand,
    transform: [{ scale: 1.1 }],
  },
  addPillBulk: {
    backgroundColor: COLORS.brand,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  addPillBulkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  addPillBulkText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 9,
  },
  lowStockBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  lowStockText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  stockBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  stockBadgeText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockBand: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    transform: [{ rotate: '-8deg' }],
  },
  outOfStockText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardInfo: {
    padding: 6,
    flex: 1,
    justifyContent: 'space-between',
  },
  cardName: {
    fontSize: 9,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 12,
    marginBottom: 2,
  },
  cardPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  cardPriceOut: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  cardOutLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#EF4444',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardVariants: {
    fontSize: 7,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cardWholesaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  cardWholesaleText: {
    fontSize: 7,
    fontWeight: '700',
    color: COLORS.brand,
  },
  cardWholesaleTextBulk: {
    color: '#D94F0A',
  },

  // ── Barre panier ────────────────────────────────────────────────
  cartBarWrap: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    zIndex: 40,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cartBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cartBarBasketWrap: {
    position: 'relative',
  },
  cartBarBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  cartBarBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: COLORS.brand,
  },
  cartBarTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cartBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cartBarCta: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Feuille panier ──────────────────────────────────────────────
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetWrap: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 20,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetClose: {
    padding: 4,
    marginLeft: -4,
  },
  receiptPill: {
    padding: 6,
    borderRadius: 12,
    shadowColor: 'rgba(254,215,170,0.5)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 16,
  },
  sheetSubtitle: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearBtnText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sheetScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  sheetScrollContent: {
    paddingHorizontal: 16,
  },

  // ── Client ──────────────────────────────────────────────────────
  fieldLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  customerSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
    zIndex: 20,
  },
  customerFieldWrap: {
    position: 'relative',
    zIndex: 20,
  },
  customerInput: {
    paddingLeft: 32,
    paddingRight: 12,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    fontSize: 12,
    color: '#111827',
  },
  customerSearchIcon: {
    position: 'absolute',
    left: 10,
  },
  customerDropdown: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    zIndex: 50,
  },
  customerDropdownScroll: {
    maxHeight: 144,
  },
  customerRow: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  customerRowName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  customerRowPhone: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: 'rgba(255,247,237,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,237,213,0.5)',
    borderRadius: 12,
  },
  customerCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  customerCardName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
  },
  customerCardPhone: {
    fontSize: 9,
    fontWeight: '500',
    color: COLORS.brand,
  },
  customerRemove: {
    padding: 4,
  },

  // ── Lignes panier ───────────────────────────────────────────────
  cartItems: {
    paddingVertical: 8,
  },
  cartLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  cartLineThumb: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  cartLineBody: {
    flex: 1,
    minWidth: 0,
  },
  cartLineName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 14,
  },
  cartLineVariant: {
    fontSize: 9,
    color: '#6B7280',
    fontStyle: 'italic',
    lineHeight: 12,
  },
  cartLinePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  cartLinePrice: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  cartLinePriceBulk: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.brand,
  },
  bulkMiniBadge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  bulkMiniBadgeText: {
    fontSize: 7.5,
    fontWeight: '700',
    color: COLORS.brand,
    textTransform: 'uppercase',
  },
  cartLineTimes: {
    fontSize: 10,
    color: '#D1D5DB',
  },
  cartLineQtyText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4B5563',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  qtyBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  qtyValue: {
    minWidth: 19,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
  },
  cartLineRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  cartLineTotal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  trashBtn: {
    padding: 2,
  },
  emptyCart: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCartIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyCartTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D1D5DB',
  },
  emptyCartHint: {
    fontSize: 10,
    color: '#E5E7EB',
    marginTop: 4,
  },

  // ── Options (commande, paiement, promo) ─────────────────────────
  optionsBlock: {
    gap: 10,
    paddingBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  optionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionBtnActive: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
    shadowColor: 'rgba(254,215,170,0.5)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  optionBtnIdle: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F3F4F6',
  },
  optionBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  optionBtnTextActive: {
    color: '#FFFFFF',
  },
  optionBtnTextIdle: {
    color: '#6B7280',
  },
  promoRow: {
    flexDirection: 'row',
    gap: 6,
  },
  promoInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 10,
    fontWeight: '600',
    color: '#111827',
  },
  promoOkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    justifyContent: 'center',
  },
  promoOkText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
  promoApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  promoAppliedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  promoAppliedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },

  // ── Pied ────────────────────────────────────────────────────────
  sheetFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.03,
    shadowRadius: 20,
    elevation: 6,
  },
  totalsBlock: {
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  totalValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  discountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F9FAFB',
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.brand,
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    shadowColor: 'rgba(254,215,170,0.4)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
  checkoutBtnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  checkoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  checkoutBtnTextDisabled: {
    color: '#9CA3AF',
  },
  noPermission: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
  },
  noPermissionText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#EF4444',
  },

  // ── Modale succès ───────────────────────────────────────────────
  successRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  successSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  successHeader: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 16,
    shadowColor: '#DCFCE7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 3,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  successOrderId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  successScroll: {
    flexGrow: 0,
  },
  successSummaryWrap: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  successCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 10,
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  successRowLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  successRowValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  successTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  successTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  successTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.brand,
  },
  successMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  successMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  successMetaText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  successMetaDot: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  successActions: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 10,
  },
  successActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  successActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  successActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  disabled: {
    opacity: 0.5,
  },
  newSaleBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    shadowColor: 'rgba(254,215,170,0.3)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  newSaleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Dialogues centrés (gros / variantes) ────────────────────────
  dialogBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dialogCard: {
    width: '100%',
    maxWidth: 384,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 12,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dialogThumb: {
    width: 36,
    height: 36,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  dialogHeaderBody: {
    flex: 1,
    minWidth: 0,
  },
  dialogTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  dialogSubtitle: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  dialogClose: {
    padding: 6,
    margin: -4,
  },
  dialogBody: {
    padding: 14,
  },
  dialogSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  dialogOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  dialogOptionActive: {
    backgroundColor: 'rgba(255,247,237,0.6)',
    borderColor: '#FFEDD5',
  },
  dialogOptionNeutral: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  dialogOptionSelected: {
    backgroundColor: '#FFF7ED',
    borderColor: COLORS.brand,
  },
  dialogOptionDisabled: {
    backgroundColor: '#F9FAFB',
    borderColor: '#F3F4F6',
    opacity: 0.6,
  },
  dialogOptionLeftCol: {
    flexShrink: 1,
    minWidth: 0,
  },
  dialogOptionName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
  },
  dialogOptionSub: {
    fontSize: 9,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  dialogOptionRight: {
    alignItems: 'flex-end',
  },
  dialogOptionPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.brand,
  },
  dialogOptionPriceSub: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  dialogOptionWarn: {
    fontSize: 8,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  dialogSavings: {
    fontSize: 8,
    fontWeight: '700',
    color: '#16A34A',
  },
  tierPill: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tierPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dialogTierLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  dialogTierBody: {
    flexShrink: 1,
    minWidth: 0,
  },
  dialogStockText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  dialogStockOut: {
    color: '#EF4444',
  },
  dialogStockLow: {
    color: '#D97706',
  },
  variantCta: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  variantCtaActive: {
    backgroundColor: COLORS.brand,
    shadowColor: '#FED7AA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 3,
  },
  variantCtaDisabled: {
    backgroundColor: '#F3F4F6',
  },
  variantCtaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  variantCtaTextActive: {
    color: '#FFFFFF',
  },
  variantCtaTextDisabled: {
    color: '#9CA3AF',
  },
  dialogCancel: {
    marginTop: 6,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  dialogCancelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
});
