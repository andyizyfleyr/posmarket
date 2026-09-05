import React from "react";
import {
  ShoppingCart, ShieldCheck, ChevronLeft, Store, MapPin, CreditCard,
  User, Phone, Home, Briefcase, Truck, RotateCcw, Zap, CheckCircle2,
  ArrowRight, X, Check, ChevronUp, ChevronDown, Trash2, Tag, Star, Bell,
  FileText, AlertTriangle, MessageCircle
} from "lucide-react";
import ProductImage from "@/components/ProductImage";
import Button from "@/components/Button";
import { formatCurrency, formatPhoneSN, isValidPhoneSN } from "@/utils";
import { isPushSupported, enablePushNotifications } from "@/utils/push";
import { generateProformaPdf } from "@/utils/proforma";
import type { StoreData } from "@/types";

export interface CartCheckoutViewBundle {
  checkoutStage: string;
  cart: any[];
  cartItemsCount: number;
  isNavigating: boolean;
  expandedCartStores: Set<string>;
  swipeState: { key: string; dx: number } | null;
  swipeStartRef: React.MutableRefObject<{ x: number; y: number } | null>;
  customerInfo: any;
  user: any;
  buyerAddresses: any[];
  selectedAddressId: string | null;
  paymentMethod: string;
  isProcessingPayment: boolean;
  isCheckoutTransitioning: boolean;
  keyboardOffset: number;
  isWhatsAppLoading: boolean;
  stores: StoreData[];
  setCheckoutStage: (s: any) => void;
  setCompletedOrderStores: (s: any[]) => void;
  setCompletedOrderItems: (s: any[]) => void;
  setCompletedOrderTotal: (n: number) => void;
  setExpandedCartStores: (s: any) => void;
  setSwipeState: (s: any) => void;
  setCustomerInfo: (c: any) => void;
  setSelectedAddressId: (id: string | null) => void;
  setPaymentMethod: (m: any) => void;
  setIsCheckoutTransitioning: (b: boolean) => void;
  setIsWhatsAppLoading: (b: boolean) => void;
  safeNavigate: (path: string, opts?: any) => void;
  localNotify: (msg: string, type?: any) => void;
  formatCurrency: (n: number) => string;
  formatPhoneSN: (s: string) => string;
  isValidPhoneSN: (s: string) => boolean;
  getEffectiveItemPrice: (item: any) => number;
  handleCheckoutSubmit: (e: any) => void;
  handleStageChange: (stage: any) => void;
  removeFromCart: (productId: string, storeId: string, variantId?: string) => void;
  updateQuantity: (productId: string, storeId: string, delta: number, variantId?: string) => void;
  handlePromoApply: () => void;
  promoApplied: any;
  setPromoApplied: (c: any) => void;
  promoCodeInput: string;
  setPromoCodeInput: (s: string) => void;
  isPromoOpen: boolean;
  setIsPromoOpen: (b: boolean) => void;
  isApplyingPromo: boolean;
  setIsApplyingPromo: (b: boolean) => void;
  baseCartTotal: number;
  wholesaleSavings: number;
  discountAmount: number;
  cartTotal: number;
  completedOrderStores: any[];
  completedOrderItems: any[];
  completedOrderTotal: number;
}

export function CartCheckoutView(props: CartCheckoutViewBundle) {
  const {
    checkoutStage, cart, cartItemsCount, isNavigating, expandedCartStores,
    swipeState, swipeStartRef, customerInfo, user, buyerAddresses,
    selectedAddressId, paymentMethod, isProcessingPayment, isCheckoutTransitioning,
    keyboardOffset, isWhatsAppLoading, stores,
    setCheckoutStage, setCompletedOrderStores, setCompletedOrderItems,
    setCompletedOrderTotal, setExpandedCartStores, setSwipeState, setCustomerInfo,
    setSelectedAddressId, setPaymentMethod, setIsCheckoutTransitioning,
    setIsWhatsAppLoading,
    safeNavigate, localNotify, formatCurrency, formatPhoneSN, isValidPhoneSN,
    getEffectiveItemPrice, handleCheckoutSubmit, handleStageChange, removeFromCart,
    updateQuantity, handlePromoApply, promoApplied, setPromoApplied, promoCodeInput, setPromoCodeInput,
    isPromoOpen, setIsPromoOpen, isApplyingPromo, setIsApplyingPromo,
    baseCartTotal, wholesaleSavings, discountAmount, cartTotal,
    completedOrderStores, completedOrderItems, completedOrderTotal,
  } = props;

  const handleProceedToShipping = () => {
    // Vérifier les MOQ (Minimum Order Quantity / Amount) par boutique
    const storeIds = Array.from(
      new Set(cart.filter((i) => i.product?.storeId).map((item) => item.product.storeId))
    );
    for (const sId of storeIds) {
      const sObj = stores.find((s) => s.id === sId);
      const minAmount = Number(sObj?.settings?.wholesaleMinOrderAmount || 0);
      if (minAmount > 0) {
        const sItems = cart.filter((i) => i.product?.storeId === sId);
        const subtotal = sItems.reduce((sum, i) => sum + getEffectiveItemPrice(i) * (i.quantity || 1), 0);
        if (subtotal < minAmount) {
          const sName = sItems[0]?.product?.storeName || sObj?.name || "Boutique";
          localNotify(
            `Minimum de commande requis pour "${sName}" : ${formatCurrency(minAmount)} (actuel: ${formatCurrency(subtotal)})`,
            "warning"
          );
          return;
        }
      }
    }

    setIsCheckoutTransitioning(true);
    setTimeout(() => {
      setCheckoutStage("shipping");
      setIsCheckoutTransitioning(false);
    }, 500);
  };

  return (
﻿      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col">
        <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-white text-gray-900 z-10 shrink-0">
          <h2 className="text-sm md:text-lg font-black flex items-center gap-2 leading-tight min-w-0">
            {checkoutStage === "cart" ? (
              <ShoppingCart className="text-[#f56b2a] shrink-0" size={16} />
            ) : (
              <ShieldCheck className="text-green-500 shrink-0" size={16} />
            )}
            <span className="truncate">
              {checkoutStage === "cart"
                ? "Mon Panier"
                : checkoutStage === "shipping"
                  ? "Livraison"
                  : checkoutStage === "payment"
                    ? "Paiement"
                    : "Commande Validée"}
            </span>
            {checkoutStage === "cart" && cartItemsCount > 0 && (
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-orange-50 text-[#f56b2a] text-[10px] font-black tabular-nums">
                {cartItemsCount}
              </span>
            )}
          </h2>
          <button
            onClick={() => {
              safeNavigate("/", {
                action: () => {
                  setCheckoutStage("cart");
                  setCompletedOrderStores([]);
                  setCompletedOrderItems([]);
                  setCompletedOrderTotal(0);
                },
              });
            }}
            className="px-3 py-2 -mr-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500 font-black text-[10px] uppercase tracking-tight flex items-center gap-1 whitespace-nowrap"
          >
            <ChevronLeft size={12} /> Continuer les achats
          </button>
        </div>

        {/* Step Indicator */}
        {checkoutStage !== "success" && (
          <div className="bg-gray-50/50 px-4 md:px-8 py-2 border-b border-gray-100">
            <div className="flex items-center justify-between max-w-2xl mx-auto">
              {[
                { id: "cart", label: "Panier", icon: ShoppingCart },
                { id: "shipping", label: "Livraison", icon: MapPin },
                { id: "payment", label: "Paiement", icon: CreditCard },
              ].map((stage, idx, array) => {
                const Icon = stage.icon;
                const isActive = stage.id === checkoutStage;
                const isPast =
                  array.findIndex((s) => s.id === checkoutStage) > idx;
                return (
                  <React.Fragment key={stage.id}>
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <div
                        className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all ${isActive ? "bg-[#f56b2a] text-white shadow-lg shadow-orange-100 scale-110" : isPast ? "bg-green-100 text-green-600" : "bg-white border-2 border-gray-100 text-gray-500"}`}
                      >
                        {isPast ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <Icon size={isActive ? 18 : 16} />
                        )}
                      </div>
                      <span
                        className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest ${isActive ? "text-gray-900" : isPast ? "text-green-600" : "text-gray-500"}`}
                      >
                        {stage.label}
                      </span>
                    </div>
                    {idx < array.length - 1 && (
                      <div className="flex-grow h-[2px] mx-2 md:mx-4 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-[#f56b2a] transition-all duration-700 ${isPast ? "w-full" : "w-0"}`}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-grow overflow-y-auto custom-scrollbar bg-gray-50/50 p-2.5 sm:p-3 md:p-8">
          {(checkoutStage === "cart" && cart.length > 0) && (
            <div className="space-y-3">
              {/* Réassurance */}
              <div className="flex items-center justify-center gap-5 py-2.5 bg-white rounded-full border border-gray-100 shadow-sm text-[9px] font-black uppercase tracking-widest text-gray-500">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-green-500" />
                  Paiement sécurisé
                </span>
                <span className="flex items-center gap-1.5">
                  <Truck size={13} className="text-[#f56b2a]" />
                  Payez à la livraison
                </span>
              </div>

              {Array.from(
                new Set(
                  cart
                    .filter((i) => i.product?.storeId)
                    .map((item) => item.product.storeId),
                ),
              ).map((storeId) => {
                const storeItems = cart.filter(
                  (i) => i.product?.storeId === storeId,
                );
                const storeObj = stores.find((s) => s.id === storeId);
                const storeSettings = storeObj?.settings;
                const storePhone = storeObj?.phone || storeSettings?.phone;
                const waDigits = storePhone ? String(storePhone).replace(/\D/g, "") : null;
                const storeMinOrder = Number(storeSettings?.wholesaleMinOrderAmount || 0);
                const storeSubtotal = storeItems.reduce(
                  (sum, item) => sum + getEffectiveItemPrice(item) * (item.quantity || 1),
                  0,
                );
                const isBelowMinOrder = storeMinOrder > 0 && storeSubtotal < storeMinOrder;
                const missingForMinOrder = Math.max(0, storeMinOrder - storeSubtotal);
                const storeName = storeItems[0]?.product.storeName || storeObj?.name || "Boutique";
                const storeCount = storeItems.reduce(
                  (sum, i) => sum + (i.quantity || 1),
                  0,
                );
                const isStoreExpanded =
                  expandedCartStores.has(storeId);
                const visibleItems = isStoreExpanded
                  ? storeItems
                  : storeItems.slice(0, 3);
                return (
                  <div
                    key={storeId}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gray-50/70 border-b border-gray-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <Store size={12} className="text-[#f56b2a] shrink-0" />
                        <span className="text-[9px] md:text-[11px] font-black text-gray-900 truncate">
                          {storeName}
                        </span>
                      </div>
                      <span className="shrink-0 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                        {storeCount} article{storeCount > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {visibleItems.map((item) => {
                        const unitPrice = getEffectiveItemPrice(item);
                        const qty = item.quantity || 1;
                        const hasWholesale = !!(
                          item.product.wholesalePrice &&
                          Number(item.product.wholesaleMinQty) > 0
                        );
                        const wholesaleActive =
                          hasWholesale &&
                          qty >= Number(item.product.wholesaleMinQty);
                        const wholesaleLeft = hasWholesale
                          ? Math.max(
                              0,
                              Number(item.product.wholesaleMinQty) - qty,
                            )
                          : 0;
                        const itemKey = `${item.product.id}-${item.variantId || "base"}`;
                        const isSwipeOpen = swipeState?.key === itemKey;
                        const swipeDx = isSwipeOpen ? Math.min(swipeState.dx, 0) : 0;
                        return (
                          <div
                            key={itemKey}
                            className="relative bg-white overflow-hidden"
                          >
                                {/* Couche supprimable (cachée derrière) */}
                                <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center">
                                  <button
                                    onClick={() => {
                                      removeFromCart(
                                        item.product.id,
                                        item.product.storeId,
                                        item.variantId,
                                      );
                                      setSwipeState(null);
                                      localNotify("Article retiré du panier", "info");
                                    }}
                                    className="text-white flex flex-col items-center gap-1 p-2"
                                    aria-label="Supprimer"
                                  >
                                    <Trash2 size={16} />
                                    <span className="text-[9px] font-black uppercase">Retirer</span>
                                  </button>
                                </div>
                                {/* Contenu glissant */}
                                <div
                                  className="relative p-3 flex gap-3 bg-white"
                                  style={{ transform: `translateX(${swipeDx}px)`, transition: swipeStartRef.current ? 'none' : 'transform 0.25s ease' }}
                                  onTouchStart={(e) => {
                                    swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                                  }}
                                  onTouchMove={(e) => {
                                    const st = swipeStartRef.current;
                                    if (!st) return;
                                    const dy = e.touches[0].clientY - st.y;
                                    const ddx = e.touches[0].clientX - st.x;
                                    if (Math.abs(dy) > Math.abs(ddx)) return;
                                    e.preventDefault();
                                    setSwipeState({ key: itemKey, dx: Math.max(-96, Math.min(0, ddx)) });
                                  }}
                                  onTouchEnd={() => {
                                    setSwipeState((s: any) => (s && s.dx < -56 ? { key: s.key, dx: -80 } : null));
                                    swipeStartRef.current = null;
                                  }}
                                >
                            <div className="w-16 h-16 shrink-0">
                              <ProductImage
                                src={item.product.image}
                                alt={item.product.name || "Product Image"}
                                containerClassName="rounded-xl border border-gray-100 shadow-sm"
                                showZoomEffect={false}
                              />
                            </div>
                            <div className="flex-grow min-w-0 flex flex-col">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-[10px] md:text-sm font-bold text-gray-900 leading-tight line-clamp-1">
                                  {item.product.name || "Unknown Product"}
                                </h4>
                                <button
                                  onClick={() =>
                                    removeFromCart(
                                      item.product.id,
                                      item.product.storeId,
                                      item.variantId,
                                    )
                                  }
                                  aria-label={`Retirer ${item.product.name || "le produit"} du panier`}
                                  className="shrink-0 p-2.5 -m-1.5 text-gray-300 hover:text-red-500 active:text-red-500 transition-colors"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap min-h-[18px]">
                                {item.variantId && item.product.variants && (
                                  <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-full px-2 py-px text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                                    <Tag size={9} />
                                    {
                                      item.product.variants.find(
                                        (v: any) => v.id === item.variantId,
                                      )?.name
                                    }
                                  </span>
                                )}
                                {promoApplied &&
                                  promoApplied.store_id ===
                                    item.product.storeId && (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-green-600 uppercase tracking-wider">
                                      <CheckCircle2 size={9} /> Coupon
                                    </span>
                                  )}
                              </div>
                              <div className="mt-auto pt-2 flex items-end justify-between gap-3">
                                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-full p-1 md:p-0.5">
                                  <button
                                    onClick={() =>
                                      updateQuantity(
                                        item.product.id,
                                        item.product.storeId,
                                        -1,
                                        item.variantId,
                                      )
                                    }
                                    aria-label="Diminuer la quantité"
                                    className="w-9 h-9 md:w-7 md:h-7 grid place-items-center rounded-full font-black text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-sm transition-all"
                                  >
                                    −
                                  </button>
                                  <span className="w-7 text-center text-xs font-black text-gray-900 tabular-nums">
                                    {qty}
                                  </span>
                                  <button
                                    onClick={() =>
                                      updateQuantity(
                                        item.product.id,
                                        item.product.storeId,
                                        1,
                                        item.variantId,
                                      )
                                    }
                                    aria-label="Augmenter la quantité"
                                    className="w-9 h-9 md:w-7 md:h-7 grid place-items-center rounded-full font-black text-[#f56b2a] hover:bg-orange-50 active:bg-orange-100 transition-all"
                                  >
                                    +
                                  </button>
                                </div>
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="text-[10px] md:text-sm font-black text-gray-900 whitespace-nowrap tabular-nums">
                                    {formatCurrency(unitPrice * qty)}
                                  </span>
                                  {hasWholesale && (
                                    <span
                                      className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wide ${wholesaleActive ? "text-green-600" : "text-[#f56b2a]"}`}
                                    >
                                      {wholesaleActive ? (
                                        <>
                                          <CheckCircle2 size={9} /> Prix de gros
                                        </>
                                      ) : (
                                        <>
                                          <Zap size={9} fill="currentColor" />{" "}
                                          +{wholesaleLeft} = prix de gros
                                        </>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                    {storeItems.length > 3 && (
                      <button
                        onClick={() =>
                          setExpandedCartStores((prev: any) => {
                            const next = new Set(prev);
                            if (next.has(storeId)) next.delete(storeId);
                            else next.add(storeId);
                            return next;
                          })
                        }
                        aria-expanded={isStoreExpanded}
                        className="w-full flex items-center justify-center gap-1.5 py-3 border-t border-gray-50 text-[10px] font-black uppercase tracking-widest text-[#f56b2a] hover:bg-orange-50/50 active:bg-orange-100/60 transition-colors"
                      >
                        {isStoreExpanded ? (
                          <>
                            Réduire <ChevronUp size={12} />
                          </>
                        ) : (
                          <>
                            Voir tout ({storeItems.length})
                            <ChevronDown size={12} />
                          </>
                        )}
                      </button>
                    )}

                    {/* Alerte Minimum de Commande B2B */}
                    {isBelowMinOrder && (
                      <div className="p-3 bg-amber-50 border-t border-amber-200/60 flex items-start gap-2.5">
                        <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-amber-800 leading-tight">
                          <span className="font-bold">Minimum de commande de gros :</span> {formatCurrency(storeMinOrder)}.
                          <span className="block text-amber-700 mt-0.5">
                            Il vous manque <strong className="font-black text-amber-900">{formatCurrency(missingForMinOrder)}</strong> pour atteindre le seuil de commande auprès de {storeName}.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Actions B2B Boutique (Devis Proforma PDF & WhatsApp) */}
                    <div className="px-4 py-2.5 bg-gray-50/70 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-gray-500">
                        Total {storeName} : <strong className="text-gray-900">{formatCurrency(storeSubtotal)}</strong>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            generateProformaPdf({
                              reference: `PF-${Date.now().toString().slice(-6)}`,
                              date: new Date().toLocaleDateString("fr-FR"),
                              storeName: storeName,
                              storePhone: storePhone,
                              buyerName: customerInfo?.name || user?.name || "Client Professionnel",
                              buyerPhone: customerInfo?.phone,
                              items: storeItems.map((si) => ({
                                name: si.product.name + (si.variantId ? ` (${si.variantId})` : ""),
                                quantity: si.quantity || 1,
                                unitPrice: getEffectiveItemPrice(si),
                                total: getEffectiveItemPrice(si) * (si.quantity || 1),
                              })),
                              subtotal: storeSubtotal,
                              total: storeSubtotal,
                            });
                            localNotify("Devis proforma téléchargé", "success");
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:border-gray-300 text-gray-700 text-[10px] font-black uppercase tracking-wider shadow-2xs hover:bg-gray-50 transition-all active:scale-95 cursor-pointer"
                          title="Télécharger le devis proforma pour cette boutique"
                        >
                          <FileText size={12} className="text-[#f56b2a]" />
                          Devis PDF
                        </button>
                        {waDigits && (
                          <a
                            href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                              `Bonjour ${storeName}, voici ma sélection de commande en gros :\n\n` +
                              storeItems.map((si) => `• ${si.quantity || 1}x ${si.product.name} (${formatCurrency(getEffectiveItemPrice(si))}/u)`).join("\n") +
                              `\n\nTotal estimé : ${formatCurrency(storeSubtotal)}\nPourriez-vous me confirmer vos disponibilités et les modalités de livraison ? Merci !`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#1ea952] border border-[#25D366]/30 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                            title="Contacter le grossiste sur WhatsApp"
                          >
                            <MessageCircle size={12} />
                            WhatsApp B2B
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {(checkoutStage === "cart" && cart.length === 0) && (
            <div className="h-full flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="relative mb-5">
                <div className="absolute inset-0 bg-orange-100 rounded-full blur-2xl opacity-60 scale-125" />
                <div className="relative w-20 h-20 bg-white border border-gray-100 rounded-3xl grid place-items-center shadow-sm">
                  <ShoppingCart size={30} className="text-[#f56b2a]/60" />
                </div>
              </div>
              <p className="text-lg font-black text-gray-900">
                Votre panier est vide
              </p>
              <p className="text-xs font-bold text-gray-500 mt-1 max-w-[240px] leading-relaxed">
                Parcourez les boutiques et ajoutez vos produits favoris.
              </p>
              <Button
                onClick={() => safeNavigate("/")}
                loading={isNavigating}
                loadingText="Chargement..."
                variant="primary"
                size="md"
                className="mt-6"
                icon={<ArrowRight size={14} />}
                iconPosition="right"
              >
                Découvrir la boutique
              </Button>
            </div>
          )}
          {(checkoutStage === "shipping" || checkoutStage === "payment") && (
            <form
              id="checkout-form"
              onSubmit={handleCheckoutSubmit}
              className="space-y-6"
            >
              {checkoutStage === "shipping" && (
                <div className="space-y-6   ">
                  {/* Section 1: Informations Personnelles */}
                  <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#f56b2a] flex items-center justify-center font-black text-sm">
                        1
                      </div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">
                        Vos Informations
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-600 uppercase ml-1">
                          Nom Complet
                        </label>
                        <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#f56b2a] transition-colors">
                            <User size={18} />
                          </div>
                          <input
                            required
                            type="text"
                            value={customerInfo.name}
                            onChange={(e) =>
                              setCustomerInfo({
                                ...customerInfo,
                                name: e.target.value,
                              })
                            }
                            className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:bg-white transition-all no-global-border"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-600 uppercase ml-1">
                          Téléphone Mobile
                        </label>
                        <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#f56b2a] transition-colors">
                            <Phone size={18} />
                          </div>
                          <input
                            required
                            type="tel"
                            value={customerInfo.phone}
                            onChange={(e) =>
                              setCustomerInfo({
                                ...customerInfo,
                                phone: formatPhoneSN(e.target.value),
                              })
                            }
                            className={`w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border rounded-2xl font-bold text-gray-700 focus:bg-white transition-all no-global-border ${customerInfo.phone && !isValidPhoneSN(customerInfo.phone) ? "border-red-200 bg-red-50/40" : "border-gray-100"}`}
                          />
                          {customerInfo.phone && !isValidPhoneSN(customerInfo.phone) && (
                            <p className="text-[9px] font-bold text-red-500 ml-1 mt-1">Numéro invalide — ex : +221 77 123 45 67</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#f56b2a] flex items-center justify-center font-black text-sm">
                        2
                      </div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">
                        Adresse de Livraison
                      </h3>
                    </div>

                      {user && buyerAddresses.length > 0 && !customerInfo.address ? (
                        <div className="space-y-4">
                          <p className="text-xs font-bold text-gray-500 mb-3">Sélectionnez une adresse enregistrée</p>
                          <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {buyerAddresses.map((addr) => (
                              <button
                                key={addr.id}
                                onClick={() => { setSelectedAddressId(addr.id); setCustomerInfo({ ...customerInfo, name: addr.full_name, phone: addr.phone, address: addr.address, city: addr.city }); }}
                                className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${selectedAddressId === addr.id ? 'border-[#f56b2a] bg-orange-50/30' : 'border-gray-100 hover:border-gray-200'}`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                                    {addr.name === 'Maison' ? <Home size={16} /> : addr.name === 'Bureau' ? <Briefcase size={16} /> : <MapPin size={16} />}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-black text-gray-900">{addr.name}</p>
                                    <p className="text-xs text-gray-500">{addr.address}, {addr.city}</p>
                                  </div>
                                  {addr.is_default && <span className="text-[9px] font-black text-[#f56b2a] uppercase">Par défaut</span>}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : user && buyerAddresses.length > 0 && customerInfo.address ? (
                        <div className="space-y-4">
                          <div className="p-4 rounded-2xl border-2 border-[#f56b2a] bg-orange-50/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                                  <MapPin size={16} />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-black text-gray-900">{customerInfo.name}</p>
                                  <p className="text-xs text-gray-500">{customerInfo.address}, {customerInfo.city}</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => { setSelectedAddressId(null); setCustomerInfo({ ...customerInfo, address: "", city: "" }); }}
                                className="text-[9px] font-bold text-[#f56b2a] underline"
                              >
                                Changer
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-600 uppercase ml-1">
                              Adresse (Rue, Quartier...)
                            </label>
                            <div className="relative group">
                              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#f56b2a] transition-colors">
                                <MapPin size={18} />
                              </div>
                              <input
                                required
                                type="text"
                                value={customerInfo.address}
                                onChange={(e) =>
                                  setCustomerInfo({
                                    ...customerInfo,
                                    address: e.target.value,
                                  })
                                }
                                className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:bg-white transition-all no-global-border"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-600 uppercase ml-1">
                              Ville
                            </label>
                            <input
                              required
                              type="text"
                              value={customerInfo.city}
                              onChange={(e) =>
                                setCustomerInfo({
                                  ...customerInfo,
                                  city: e.target.value,
                                })
                              }
                              className="w-full px-5 py-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:bg-white transition-all no-global-border"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              {checkoutStage === "payment" && (
                <div className="space-y-4   ">
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      onClick={() => setPaymentMethod("cod")}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === "cod" ? "border-[#f56b2a] bg-orange-50" : "border-gray-100 bg-white"}`}
                    >
                      <Truck
                        size={24}
                        className={
                          paymentMethod === "cod"
                            ? "text-[#f56b2a]"
                            : "text-gray-600"
                        }
                      />
                      <div className="mt-2 font-black text-sm text-gray-900">
                        Paiement à la livraison
                      </div>
                    </div>
                    <div
                      onClick={() => setPaymentMethod("card")}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === "card" ? "border-[#f56b2a] bg-orange-50" : "border-gray-100 bg-white"}`}
                    >
                      <CreditCard
                        size={24}
                        className={
                          paymentMethod === "card"
                            ? "text-[#f56b2a]"
                            : "text-gray-600"
                        }
                      />
                      <div className="mt-2 font-black text-sm text-gray-900">
                        Carte Bancaire
                      </div>
                    </div>
                  </div>
                  {paymentMethod === "card" && (
                    <div className="space-y-3 p-4 bg-gray-100 rounded-2xl">
                      <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200">
                        <ShieldCheck
                          size={20}
                          className="text-green-500 flex-shrink-0"
                        />
                        <div className="text-xs font-bold text-gray-600">
                          Paiement sécurisé par FusionPay
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500 text-center">
                        Vous serez redirigé vers le formulaire de paiement
                        sécurisé
                      </p>
                    </div>
                  )}
                </div>
              )}
            </form>
          )}
          {checkoutStage === "success" && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 text-center relative overflow-hidden">
              <div className="relative mb-10">
                <div className="absolute inset-0 bg-green-100 rounded-full blur-2xl opacity-50 scale-150 animate-pulse" />
                <div className="relative w-24 h-24 bg-green-500 text-white rounded-full flex items-center justify-center shadow-2xl success-glow animate-success-bounce">
                  <CheckCircle2 size={48} strokeWidth={3} />
                </div>
                <div className="absolute -right-2 -top-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-white shadow-lg animate-bounce">
                  <Star size={18} fill="currentColor" />
                </div>
              </div>

              <h3 className="text-2xl md:text-3xl font-black text-gray-900 mb-3 tracking-tight leading-tight">
                Commande <span className="text-green-500">Réussie !</span>
              </h3>

              <div className="w-10 h-1 bg-green-500 rounded-full mb-4 mx-auto" />

              <p className="text-gray-500 max-w-sm mb-8 font-bold text-sm leading-relaxed">
                Votre commande a été enregistrée avec succès.
                <br className="hidden md:block" />
                Le vendeur va traiter votre commande rapidement.
              </p>

              <div className="w-full flex flex-col items-center">
                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest text-center mb-3">
                  Cliquez sur un bouton pour continuer
                </p>
                <div className="flex gap-3 w-full max-w-sm">
                  <Button
                    onClick={() => safeNavigate("/")}
                    loading={isNavigating}
                    loadingText="Chargement..."
                    variant="secondary"
                    size="md"
                    fullWidth
                    className="flex-1"
                    icon={<ArrowRight size={14} />}
                    iconPosition="right"
                  >
                    Accueil
                  </Button>
                  {(() => {
                    const firstStore = completedOrderStores[0];
                    if (!firstStore) return null;
                    const store = stores.find(
                      (s) => s.id === firstStore.storeId,
                    );
                    const storePhone = store?.phone || store?.settings?.phone;
                    if (completedOrderStores.length === 1 && storePhone && completedOrderItems.length > 0) {
                      const waMsg = `NOUVELLE COMMANDE #${Date.now().toString().slice(-6)}\n\nClient: ${customerInfo.name || "Anonyme"}\nTelephone: ${customerInfo.phone || "Non fourni"}\n\nArticles:\n${completedOrderItems.map((item) => `• ${item.quantity}x ${item.name} - ${formatCurrency(item.price * item.quantity)}`).join("\n")}\n\nTotal: ${formatCurrency(completedOrderTotal)}\nMode de paiement: ${paymentMethod === "cod" ? "Especes" : "Carte"}`;
                      const waUrl = `https://wa.me/${storePhone.replace(/\D/g, "")}?text=${encodeURIComponent(waMsg)}`;

                      return (
                        <Button
                          onClick={() => {
                            setIsWhatsAppLoading(true);
                            window.open(waUrl, "_blank");
                            setTimeout(() => setIsWhatsAppLoading(false), 1500);
                          }}
                          loading={isWhatsAppLoading}
                          loadingText="Ouverture..."
                          variant="primary"
                          size="md"
                          fullWidth
                          className="flex-1 !bg-green-500 hover:!bg-green-600"
                          icon={
                            <svg
                              viewBox="0 0 24 24"
                              className="w-4 h-4 flex-shrink-0"
                              fill="currentColor"
                            >
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.162-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                          }
                        >
                          WhatsApp
                        </Button>
                      );
                    }
                    return null;
                  })()}
                </div>
                {isPushSupported() && (
                  <button
                    onClick={async () => {
                      const r = await enablePushNotifications();
                      localNotify(
                        r.ok ? "Notifications activées" : r.reason === "denied" ? "Notifications refusées" : "Notifications indisponibles",
                        r.ok ? "success" : "info",
                      );
                    }}
                    className="mt-4 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#f56b2a] transition-colors"
                  >
                    <Bell size={12} className="inline -mt-0.5" /> M&apos;alerter de ma commande
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        {checkoutStage !== "success" && cart.length > 0 && (
          <>
            <div className="p-4 md:p-5 bg-white border-t border-gray-100 pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-5">
              {/* Récapitulatif */}
              <div className="rounded-2xl bg-gray-50/80 border border-gray-100 p-3.5 space-y-1.5 mb-4">
                <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                  <span>
                    Sous-total · {cartItemsCount} article
                    {cartItemsCount > 1 ? "s" : ""}
                  </span>
                  <span className="font-black text-gray-700 tabular-nums">
                    {formatCurrency(Number(baseCartTotal) || 0)}
                  </span>
                </div>
                {wholesaleSavings > 0 && (
                  <div className="flex justify-between items-center text-xs font-bold text-green-600">
                    <span>Économies prix de gros</span>
                    <span className="tabular-nums">
                      -{formatCurrency(wholesaleSavings)}
                    </span>
                  </div>
                )}
                {promoApplied && (
                  <div className="flex justify-between items-center text-xs font-bold text-green-600">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={11} /> Code {promoApplied.code}
                    </span>
                    <span className="tabular-nums">
                      -{formatCurrency(Number(discountAmount) || 0)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1.5 border-t border-gray-200/70 text-base font-black text-gray-900">
                  <span>Total</span>
                  <span className="text-[#f56b2a] tabular-nums">
                    {formatCurrency(Number(cartTotal) || 0)}
                  </span>
                </div>
              </div>

              {/* Code promo */}
              {checkoutStage === "cart" && !promoApplied && (
                <div className="mb-4">
                  {isPromoOpen ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={promoCodeInput}
                        onChange={(e) => setPromoCodeInput(e.target.value)}
                        placeholder="Votre code promo"
                        autoFocus
                        className="flex-grow px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl font-bold text-xs sm:text-sm uppercase w-full no-global-border"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handlePromoApply}
                          disabled={!promoCodeInput.trim()}
                          loading={isApplyingPromo}
                          loadingText="Vérification..."
                          variant="primary"
                          size="sm"
                          className="flex-1 sm:flex-initial"
                        >
                          Appliquer
                        </Button>
                        {!isApplyingPromo && (
                          <button
                            onClick={() => setIsPromoOpen(false)}
                            className="px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            Annuler
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsPromoOpen(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#f56b2a] hover:border-[#f56b2a]/40 transition-colors"
                    >
                      <Tag size={12} /> Ajouter un code promo
                    </button>
                  )}
                </div>
              )}

              {promoApplied && (
                <div className="mb-4 flex items-center justify-between gap-2 bg-green-50 px-3.5 py-2 rounded-xl border border-green-100">
                  <span className="flex items-center gap-1.5 text-green-700 font-black text-xs">
                    <CheckCircle2 size={12} /> Code {promoApplied.code} appliqué
                  </span>
                  <button
                    onClick={() => setPromoApplied(null)}
                    aria-label="Retirer le code promo"
                    className="p-2 -m-1 text-green-600/60 hover:text-red-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="hidden md:flex flex-col gap-3">
                {checkoutStage === "cart" && (
                  <Button
                    onClick={handleProceedToShipping}
                    loading={isCheckoutTransitioning}
                    loadingText="Chargement..."
                    fullWidth
                    size="xl"
                    icon={<ArrowRight size={18} />}
                    iconPosition="right"
                  >
                    Passer à la livraison
                  </Button>
                )}
                {(checkoutStage === "shipping" ||
                  checkoutStage === "payment") && (
                  <Button
                    form="checkout-form"
                    type="submit"
                    loading={isProcessingPayment}
                    loadingText={
                      checkoutStage === "payment"
                        ? "Traitement en cours..."
                        : "Passage au paiement..."
                    }
                    fullWidth
                    size="xl"
                    variant="secondary"
                  >
                    {checkoutStage === "shipping"
                      ? "Passer au paiement"
                      : "Confirmer la commande"}
                  </Button>
                )}
              </div>

              {(checkoutStage === "shipping" ||
                checkoutStage === "payment") && (
                <div className="mt-3 md:mt-0">
                  <Button
                    onClick={() =>
                      handleStageChange(
                        checkoutStage === "shipping" ? "cart" : "shipping",
                      )
                    }
                    loading={isNavigating}
                    variant="ghost"
                    size="sm"
                    fullWidth
                  >
                    ← Retour à l&apos;étape précédente
                  </Button>
                </div>
              )}
            </div>

            {/* Barre fixe mobile : Total + action principale */}
            <div
              className="md:hidden fixed left-0 right-0 bottom-0 z-[3000] bg-white/95 backdrop-blur-xl border-t border-gray-100"
              style={{
                paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
                bottom: keyboardOffset || 0,
              }}
            >
              <div className="px-3 pt-2.5">
                {checkoutStage === "cart" && (
                  <Button
                    onClick={handleProceedToShipping}
                    loading={isCheckoutTransitioning}
                    loadingText="Chargement..."
                    fullWidth
                    size="lg"
                    className="!py-4 !text-sm uppercase tracking-wide"
                    icon={<ArrowRight size={16} />}
                    iconPosition="right"
                  >
                    Passer à la livraison
                  </Button>
                )}
                {(checkoutStage === "shipping" ||
                  checkoutStage === "payment") && (
                  <Button
                    form="checkout-form"
                    type="submit"
                    loading={isProcessingPayment}
                    loadingText="Chargement..."
                    fullWidth
                    size="lg"
                    className="!py-4 !text-sm uppercase tracking-wide"
                    icon={<ArrowRight size={16} />}
                    iconPosition="right"
                  >
                    {checkoutStage === "shipping"
                      ? "Passer au paiement"
                      : "Confirmer la commande"}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );

}
