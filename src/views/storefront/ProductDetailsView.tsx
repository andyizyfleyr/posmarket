import React from "react";
import Image from "next/image";
import {
  Package, ArrowRight, ChevronRight, Share2, Maximize2, Zap, Clock, Star,
  ShoppingBag, Eye, ShoppingCart, AlertCircle, Check, MessageCircle,
  ShieldCheck, RotateCcw, Truck, ChevronLeft, ArrowLeft, Loader2,
  Store, CheckCircle2, PackageCheck, Heart
} from "lucide-react";
import Button from "@/components/Button";
import ProductImage from "@/components/ProductImage";
import ProductCard from "@/components/ProductCard";
import { formatCurrency, formatNumber } from "@/utils";
import { getNormalizedWholesaleTiers } from "@/utils/wholesale";
import { generateProductSlug } from "@/utils/slug";
import { Link } from "@/components/RouterPolyfill";
import type { NotificationType, Review } from "@/types";
import type { StorefrontProduct } from "../StorefrontView";

export function ProductDetailsView(props: any) {
  const {
    selectedProductDetails,
    isInitialLoading,
    allProducts,
    isNavigating,
    selectedOptions,
    setSelectedOptions,
    sameSelectedOptions,
    selectedDetailImage,
    setSelectedDetailImage,
    setProductSwipeIdx,
    productSwipeIdx,
    setCurrentZoomImage,
    setZoomGallery,
    setIsImageModalOpen,
    lastVisitedStoreRef,
    addToCart,
    buyNow,
    localNotify,
    user,
    setAuthMode,
    setShowAuthModal,
    setShowReviewForm,
    setReviewStep,
    loadingReviews,
    selectedProductId,
    showAllProductReviews,
    setShowAllProductReviews,
    handleCardAddToCart,
    handleCardBuyNow,
    warmProduct,
    safeNavigate,
    setSelectedCategory,
    addWholesaleToCart,
    isDescriptionExpanded,
    setIsDescriptionExpanded,
    cartItemsCount,
    cartTotal,
  } = props;
    const product = selectedProductDetails;
    if (!product) {
      // Catalogue chargé mais produit introuvable -> 404 explicite
      if (!isInitialLoading && allProducts.length > 0) {
        return (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-400">
              <Package size={30} />
            </div>
            <p className="text-base font-black text-gray-900">
              Produit introuvable
            </p>
            <p className="text-xs text-gray-500 font-bold mt-1 max-w-[280px]">
              Ce produit n&apos;existe plus ou n&apos;est pas disponible
              actuellement.
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
              Retour à l&apos;accueil
            </Button>
          </div>
        );
      }
      return (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="aspect-square rounded-[24px] skeleton" />
            <div className="space-y-4">
              <div className="h-4 w-1/3 skeleton rounded" />
              <div className="h-7 w-3/4 skeleton rounded" />
              <div className="h-24 w-full skeleton rounded-2xl" />
              <div className="h-12 w-full skeleton rounded-full" />
            </div>
          </div>
        </div>
      );
    }

    const relatedProducts = allProducts
      .filter(
        (p: StorefrontProduct) =>
          ((p.category && p.category === product.category) ||
            p.storeId === product.storeId) &&
          p.id !== product.id &&
          p.isOnline !== false,
      )
      .slice(0, 10);

    const mainCat = product.mainCategory || product.category || "Boutique";
    const isFood =
      product.businessType === "food" ||
      mainCat === "Restauration & Livraison Rapide";
    const descriptionText =
      product.description ||
      "Découvrez cet article exceptionnel sélectionné avec soin par votre boutique pour sa qualité et son style unique.";

    // --- Pricing & variants ---
    const options = product.options || [];
    const hasOptions = options.length > 0;
    const allSelected =
      !hasOptions || options.every((o: any) => !!selectedOptions[o.id]);
    const matchedVariant = hasOptions
      ? product.variants?.find(
          (v: any) => sameSelectedOptions(v.optionValues, selectedOptions),
        )
      : undefined;

    const basePrice = matchedVariant ? matchedVariant.price : product.price;
    const discountPct =
      product.originalPrice && product.originalPrice > basePrice
        ? Math.round(
            ((product.originalPrice - basePrice) / product.originalPrice) *
              100,
          )
        : 0;

    const wholesaleTiers = React.useMemo(() => {
      return getNormalizedWholesaleTiers(product);
    }, [product]);

    const hasWholesale = wholesaleTiers.length > 0 && !isFood;

    const [addingWholesaleIdx, setAddingWholesaleIdx] = React.useState<number | null>(null);
    const [addedWholesaleIdx, setAddedWholesaleIdx] = React.useState<number | null>(null);

    const handleWholesaleAdd = (idx: number, minQty: number) => {
      if (addingWholesaleIdx === idx || addedWholesaleIdx === idx) return;
      setAddingWholesaleIdx(idx);
      addWholesaleToCart(product, minQty);
      setTimeout(() => {
        setAddingWholesaleIdx(null);
        setAddedWholesaleIdx(idx);
      }, 700);
      setTimeout(() => {
        setAddedWholesaleIdx((prev) => (prev === idx ? null : prev));
      }, 1900);
    };

    const productStore = React.useMemo(() => {
      if (!props.stores || !product?.storeId) return null;
      return props.stores.find((s: any) => s.id === product.storeId);
    }, [props.stores, product?.storeId]);

    const storePhone = productStore?.phone || productStore?.settings?.phone;
    const waDigits = storePhone ? String(storePhone).replace(/\D/g, "") : null;

    // --- Stock ---
    const stockValue =
      product.stock != null ? (product.stock as number) : null;
    const isOutOfStock = stockValue === 0;
    const isLowStock =
      stockValue !== null && stockValue > 0 && stockValue <= 5;
    const stockFill =
      stockValue === null
        ? 0
        : Math.min(Math.round((stockValue / 20) * 100), 100);

    // --- Gallery ---
    const galleryImages = [
      ...(product.image ? [product.image] : []),
      ...(product.images || []),
    ].filter((img, i, arr) => !!img && arr.indexOf(img) === i);
    const currentImage = selectedDetailImage || product.image;

    // --- Actions (options-aware) ---
    const resolveVariantId = () => {
      if (!hasOptions || !product.variants) return undefined;
      const variant = product.variants.find(
        (v: any) => sameSelectedOptions(v.optionValues, selectedOptions),
      );
      return variant?.id;
    };

    const handleAddToCart = () => {
      if (!allSelected) {
        localNotify(
          "Veuillez sélectionner toutes les options",
          "warning",
        );
        return;
      }
      addToCart(product, resolveVariantId());
    };

    const goToCart = () => {
      safeNavigate("/cart");
    };

    const handleBuyNow = () => {
      if (!allSelected) {
        localNotify(
          "Veuillez sélectionner toutes les options",
          "warning",
        );
        return;
      }
      buyNow(product, resolveVariantId(), selectedOptions);
    };

    const handleShare = (e: React.MouseEvent) => {
      e.stopPropagation();
      const url = window.location.href;
      if (navigator.share) {
        navigator.share({
          title: product.name,
          text: descriptionText,
          url: url,
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(url);
        localNotify("Lien produit copié dans le presse-papiers !", "success");
      }
    };

    const reviewTotal =
      product.reviewCount || product.reviews?.length || 0;
    const accentText = isFood ? "text-green-600" : "text-[#f56b2a]";

    const openZoom = (img: string) => {
      setCurrentZoomImage(img);
      setZoomGallery(galleryImages);
      setIsImageModalOpen(true);
    };

    const onGalleryScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const idx = Math.min(
        galleryImages.length - 1,
        Math.max(0, Math.round(el.scrollLeft / el.clientWidth)),
      );
      if (idx !== productSwipeIdx) {
        setProductSwipeIdx(idx);
        setSelectedDetailImage(galleryImages[idx]);
      }
    };

    const mobileGalleryRef = React.useRef<HTMLDivElement | null>(null);

    const galleryScroll = (dir: 1 | -1) => {
      const el = mobileGalleryRef.current;
      if (!el) return;
      el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
    };

    const galleryGoTo = (idx: number) => {
      const el = mobileGalleryRef.current;
      if (!el) return;
      el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
    };

    const stepGallery = (dir: 1 | -1) => {
      const idx = galleryImages.indexOf(currentImage);
      const next = (idx + dir + galleryImages.length) % galleryImages.length;
      const img = galleryImages[next];
      if (img) setSelectedDetailImage(img);
    };

    const scrollToSection = (id: string) => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 pb-40 lg:pb-16 bg-[#f8f9fc] lg:bg-transparent -mx-4 lg:mx-auto">
        {/* Breadcrumb (desktop only) */}
        <nav
          aria-label="Fil d'Ariane"
          className="hidden md:flex items-center gap-2 mb-6 text-[11px] font-medium text-gray-400 px-4 lg:px-0 pt-5"
        >
          <button
            onClick={() => safeNavigate("/")}
            className="hover:text-[#f56b2a] transition-colors cursor-pointer"
          >
            Accueil
          </button>
          <ChevronRight size={10} className="text-gray-300" />
          <button
            onClick={() =>
              safeNavigate("/", {
                action: () => setSelectedCategory(mainCat),
              })
            }
            className="hover:text-[#f56b2a] transition-colors cursor-pointer truncate max-w-[220px]"
          >
            {mainCat}
          </button>
          <ChevronRight size={10} className="text-gray-300" />
          <span
            className="text-gray-700 font-semibold truncate max-w-[320px]"
            aria-current="page"
          >
            {product.name}
          </span>
        </nav>

        {/* ================= MOBILE APP-BAR (M3 style) ================= */}
        <div className="lg:hidden sticky top-0 z-[100] bg-white border-b border-gray-100/80 px-3 py-2 flex items-center justify-between -mx-4" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <button
            onClick={() =>
              // Retour intelligent : vers la boutique d'où l'utilisateur vient,
              // sinon l'accueil.
              safeNavigate(
                lastVisitedStoreRef.current
                  ? `/store/${lastVisitedStoreRef.current}`
                  : "/",
              )
            }
            aria-label="Retour"
            className="w-11 h-11 flex items-center justify-center rounded-full text-gray-800 hover:bg-gray-100/80 active:scale-95 transition-all"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <span className="text-xs font-black tracking-[0.1em] uppercase text-gray-500 max-w-[60%] truncate">
            {product.storeName}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleShare}
              aria-label="Partager"
              className="w-11 h-11 flex items-center justify-center rounded-full text-gray-800 hover:bg-gray-100/80 active:scale-95 transition-all"
            >
              <Share2 size={19} />
            </button>
          </div>
        </div>

        {/* ================= PRODUIT ================= */}
        <div id="pd-produit" className="scroll-mt-14">
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr] gap-6 lg:gap-8 items-start">
            {/* ---------- Colonne Gauche: Galerie + Description (Desktop) ---------- */}
            <div className="space-y-4">
              {/* Mobile: Swipeable Carousel inside an M3 Card */}
              <div className="lg:hidden relative bg-white overflow-hidden rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] mb-3.5 aspect-square">
                <div
                  ref={mobileGalleryRef}
                  className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory h-full"
                  onScroll={onGalleryScroll}
                >
                  {galleryImages.map((img, idx) => (
                    <div
                      key={idx}
                      className="min-w-full snap-center h-full relative"
                      onClick={() => openZoom(galleryImages[productSwipeIdx])}
                    >
                      <Image
                        src={img}
                        alt={`${product.name} - vue ${idx + 1}`}
                        fill
                        priority={idx === 0}
                        sizes="100vw"
                        className="object-cover pointer-events-none"
                      />
                    </div>
                  ))}
                </div>

                {/* Manual slide arrows (mobile) */}
                {galleryImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        galleryScroll(-1);
                      }}
                      aria-label="Image précédente"
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md border border-gray-100 shadow-md flex items-center justify-center text-gray-700 hover:bg-white active:scale-95 transition-all z-10"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        galleryScroll(1);
                      }}
                      aria-label="Image suivante"
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md border border-gray-100 shadow-md flex items-center justify-center text-gray-700 hover:bg-white active:scale-95 transition-all z-10"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}

                {/* Slide dots (mobile) */}
                {galleryImages.length > 1 && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                    {galleryImages.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          galleryGoTo(idx);
                        }}
                        aria-label={`Aller à l'image ${idx + 1}`}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          idx === productSwipeIdx
                            ? "w-4 bg-[#f56b2a]"
                            : "w-1.5 bg-gray-400/60"
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Expand overlay button */}
                <button
                  onClick={() => openZoom(currentImage)}
                  aria-label="Agrandir l'image"
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md border border-gray-100 shadow-md flex items-center justify-center text-gray-700 active:scale-95 transition-all z-10"
                >
                  <Maximize2 size={14} />
                </button>

                {/* Discount badge */}
                {discountPct > 0 && (
                  <div className="absolute top-3 left-3 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full shadow-lg shadow-red-500/30 flex items-center gap-0.5 z-10">
                    <Zap size={10} fill="currentColor" /> -{discountPct}%
                  </div>
                )}

                {/* Freshness strip (food) */}
                {isFood && (
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-green-50 text-green-700 text-[8px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full shadow-sm z-10">
                    <Clock size={10} className="flex-shrink-0" />
                    Fraîchement préparé · {product.preparationTime || product.deliveryTime || "30-45 min"}
                  </div>
                )}

                {/* Counter badge */}
                {galleryImages.length > 1 && (
                  <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[9px] font-black px-2.5 py-1 rounded-full z-10">
                    {productSwipeIdx + 1}/{galleryImages.length}
                  </div>
                )}
              </div>

              {/* Desktop: Main Image + Thumbnails (Compact Sizing) */}
              <div className="hidden lg:block space-y-2.5">
                <div
                  className="relative w-full aspect-square max-h-[380px] xl:max-h-[420px] rounded-2xl overflow-hidden bg-white border border-gray-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] group/main cursor-zoom-in"
                  onClick={() => openZoom(currentImage)}
                >
                  <Image
                    src={currentImage}
                    width={800}
                    height={800}
                    priority
                    alt={product.name}
                    sizes="(max-width: 1024px) 100vw, 420px"
                    className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover/main:scale-105"
                  />

                  {/* Manual slide arrows (desktop) */}
                {galleryImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        stepGallery(-1);
                      }}
                      aria-label="Image précédente"
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md border border-gray-200/70 shadow-sm flex items-center justify-center text-gray-600 hover:bg-white hover:text-[#f56b2a] active:scale-95 transition-all z-10"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        stepGallery(1);
                      }}
                      aria-label="Image suivante"
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md border border-gray-200/70 shadow-sm flex items-center justify-center text-gray-600 hover:bg-white hover:text-[#f56b2a] active:scale-95 transition-all z-10"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}

                {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover/main:bg-black/5 transition-colors duration-300 pointer-events-none" />

                  {discountPct > 0 && (
                    <div className="absolute top-3.5 left-3.5 bg-red-500 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg shadow-md shadow-red-500/20 flex items-center gap-1 z-10">
                      <Zap size={11} fill="currentColor" /> -{discountPct}%
                    </div>
                  )}

                  {/* Action buttons top-right */}
                  <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 z-10">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleShare(e); }}
                      aria-label="Partager"
                      className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-md border border-gray-200/70 shadow-xs flex items-center justify-center text-gray-600 hover:bg-white hover:text-[#f56b2a] hover:scale-105 transition-all active:scale-95"
                    >
                      <Share2 size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openZoom(currentImage); }}
                      aria-label="Agrandir l'image"
                      className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-md border border-gray-200/70 shadow-xs flex items-center justify-center text-gray-600 hover:bg-white hover:text-[#f56b2a] hover:scale-105 transition-all active:scale-95"
                    >
                      <Maximize2 size={13} />
                    </button>
                  </div>

                  {isFood && (
                    <div className="absolute bottom-3.5 left-3.5 flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-green-100 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-xs z-10">
                      <Clock size={11} />
                      Fraîchement préparé · {product.preparationTime || product.deliveryTime || "30-45 min"}
                    </div>
                  )}

                  {/* Image counter */}
                  {galleryImages.length > 1 && (
                    <div className="absolute bottom-3.5 right-3.5 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-md z-10">
                      {(galleryImages.indexOf(currentImage) !== -1 ? galleryImages.indexOf(currentImage) : 0) + 1} / {galleryImages.length}
                    </div>
                  )}
                </div>

                {galleryImages.length > 1 && (
                  <div className="grid grid-cols-6 gap-2">
                    {galleryImages.slice(0, 6).map((img, idx) => {
                      const isActive =
                        currentImage === img ||
                        (!selectedDetailImage && idx === 0);
                      return (
                        <button
                          key={idx}
                          onMouseEnter={() => setSelectedDetailImage(img)}
                          onFocus={() => setSelectedDetailImage(img)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDetailImage(img);
                          }}
                          aria-label={`Voir l'image ${idx + 1}`}
                          className={`aspect-square rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer ${
                            isActive
                              ? "border-[#f56b2a] ring-2 ring-orange-100 shadow-xs scale-[1.02]"
                              : "border-gray-200/70 opacity-60 hover:opacity-100 hover:border-gray-300"
                          }`}
                        >
                          <Image
                            src={img}
                            alt={`${product.name} - vue ${idx + 1}`}
                            width={80}
                            height={80}
                            className="w-full h-full object-cover"
                            sizes="70px"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Desktop: DESCRIPTION placed under the product image */}
              <div className="hidden lg:block bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] p-4 xl:p-5">
                <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-gray-100">
                  <div className="w-1 h-4 bg-[#f56b2a] rounded-full" />
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    {isFood ? "Détails & Préparation" : "Description du produit"}
                  </h3>
                </div>
                <div
                  className="text-gray-600 text-xs xl:text-[13px] leading-relaxed font-normal"
                  style={{ whiteSpace: "pre-line" }}
                >
                  {descriptionText}
                </div>

                {/* Caractéristiques / Détails clés */}
                <div className="grid grid-cols-2 gap-2 pt-3.5 mt-3.5 border-t border-gray-100 text-xs">
                  <div className="bg-gray-50/70 p-2 rounded-lg border border-gray-100">
                    <span className="block text-[9px] text-gray-400 uppercase font-semibold">Catégorie</span>
                    <span className="font-semibold text-gray-800 truncate block text-xs">{mainCat}</span>
                  </div>
                  <div className="bg-gray-50/70 p-2 rounded-lg border border-gray-100">
                    <span className="block text-[9px] text-gray-400 uppercase font-semibold">Boutique</span>
                    <span className="font-semibold text-gray-800 truncate block text-xs">{product.storeName}</span>
                  </div>
                  <div className="bg-gray-50/70 p-2 rounded-lg border border-gray-100">
                    <span className="block text-[9px] text-gray-400 uppercase font-semibold">Disponibilité</span>
                    <span className={`font-semibold truncate block text-xs ${isOutOfStock ? "text-red-600" : "text-emerald-700"}`}>
                      {isOutOfStock ? "Rupture de stock" : "En stock"}
                    </span>
                  </div>
                  {product.sku && (
                    <div className="bg-gray-50/70 p-2 rounded-lg border border-gray-100">
                      <span className="block text-[9px] text-gray-400 uppercase font-semibold">Référence</span>
                      <span className="font-semibold text-gray-800 truncate block text-xs">{product.sku}</span>
                    </div>
                  )}
                  {product.unit && (
                    <div className="bg-gray-50/70 p-2 rounded-lg border border-gray-100">
                      <span className="block text-[9px] text-gray-400 uppercase font-semibold">Format</span>
                      <span className="font-semibold text-gray-800 truncate block text-xs">{product.unit}</span>
                    </div>
                  )}
                  {!isFood && product.deliveryTime && (
                    <div className="bg-gray-50/70 p-2 rounded-lg border border-gray-100">
                      <span className="block text-[9px] text-gray-400 uppercase font-semibold">Délai de livraison</span>
                      <span className="font-semibold text-gray-800 truncate block text-xs">
                        {product.deliveryTime}
                      </span>
                    </div>
                  )}
                  {isFood && (product.preparationTime || product.deliveryTime) && (
                    <div className="bg-gray-50/70 p-2 rounded-lg border border-gray-100">
                      <span className="block text-[9px] text-gray-400 uppercase font-semibold">Délai estimé</span>
                      <span className="font-semibold text-gray-800 truncate block text-xs">
                        {product.preparationTime || product.deliveryTime}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ---------- Colonne Droite: Panneau d'achat compact & organisé ---------- */}
            <div className="space-y-3.5 lg:space-y-0 lg:sticky lg:top-24">
              {/* DESKTOP CARD (Sleek, Compact, Clean) */}
              <div className="hidden lg:block bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 space-y-4">
                {/* Store badge & Category */}
                <div className="flex items-center justify-between gap-2">
                  <Link
                    to={`/store/${product.storeSlug || product.storeId}`}
                    className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200/60 text-xs font-semibold text-gray-700 transition-colors group/store"
                  >
                    <Store size={12} className="text-gray-400 group-hover/store:text-[#f56b2a] transition-colors" />
                    <span className="truncate max-w-[190px]">{product.storeName}</span>
                    <CheckCircle2 size={12} className="text-blue-500 flex-shrink-0" />
                  </Link>
                  {mainCat && (
                    <span className="text-[11px] font-medium text-gray-400 truncate max-w-[140px]">
                      {mainCat}
                    </span>
                  )}
                </div>

                {/* Title */}
                <div>
                  <h1 className="text-lg xl:text-xl font-bold text-gray-900 leading-snug tracking-tight">
                    {product.name}
                    {product.unit && !hasOptions && (
                      <span className="inline-flex items-center gap-1 ml-2 align-middle text-[10px] font-black text-[#f56b2a] bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-md uppercase tracking-wide">
                        <Package size={10} strokeWidth={2.5} />
                        {product.unit}
                      </span>
                    )}
                  </h1>
                </div>

                {/* Rating & Sales & Stock: fine inline line */}
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <button
                    type="button"
                    onClick={() => scrollToSection("pd-avis")}
                    className="inline-flex items-center gap-1 text-gray-700 hover:text-[#f56b2a] transition-colors cursor-pointer"
                  >
                    <div className="flex text-amber-400 gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={11}
                          fill={s <= Math.round(product.rating || 0) ? "currentColor" : "none"}
                        />
                      ))}
                    </div>
                    <span className="font-bold ml-0.5">{(product.rating || 0).toFixed(1)}</span>
                    <span className="text-gray-400 text-[11px]">({formatNumber(reviewTotal)})</span>
                  </button>

                  <span className="text-gray-300">·</span>

                  <span className="text-gray-500 text-[11px] font-medium flex items-center gap-1">
                    <ShoppingBag size={11} className={accentText} />
                    {formatNumber(product.salesCount || 0)} {isFood ? "commandes" : "vendus"}
                  </span>

                  <span className="text-gray-300">·</span>

                  {isOutOfStock ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200/60 px-2 py-0.5 rounded-full">
                      <AlertCircle size={10} /> Rupture
                    </span>
                  ) : isLowStock ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full">
                      <AlertCircle size={10} /> {stockValue} restants
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> En stock
                    </span>
                  )}
                </div>

                {/* Price block: compact & refined */}
                <div className="bg-gray-50/90 rounded-xl p-3 border border-gray-200/70 flex items-center justify-between">
                  <div>
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-0.5">
                      {hasOptions && !allSelected ? "À partir de" : (isFood ? "Prix unitaire" : "Prix")}
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-gray-950 tracking-tight leading-none">
                        {formatCurrency(basePrice)}
                      </span>
                      {product.unit && !hasOptions && (
                        <span className="text-sm font-semibold text-gray-500">
                          / {product.unit}
                        </span>
                      )}
                      {product.originalPrice && product.originalPrice > basePrice && (
                        <span className="text-xs text-gray-400 line-through font-medium">
                          {formatCurrency(product.originalPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                  {product.originalPrice && product.originalPrice > basePrice && (
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                        <Zap size={9} fill="currentColor" /> -{discountPct}%
                      </span>
                      <span className="text-[10px] font-medium text-gray-500">
                        Éco. {formatCurrency(product.originalPrice - basePrice)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Options / Variants */}
                {hasOptions && (
                  <div className="space-y-2.5 pt-1 border-t border-gray-100">
                    {options.map((option: any) => (
                      <div key={option.id}>
                        <div className="flex items-center justify-between mb-1 text-xs">
                          <span className="font-bold text-gray-700">{option.name}</span>
                          {selectedOptions[option.id] && (
                            <span className="font-semibold text-[#f56b2a] text-[11px]">
                              {selectedOptions[option.id]}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {option.values.map((val: string) => {
                            const isSelected = selectedOptions[option.id] === val;
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() =>
                                  setSelectedOptions((prev: Record<string, string>) => ({
                                    ...prev,
                                    [option.id]: val,
                                  }))
                                }
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
                                  isSelected
                                    ? "bg-gray-900 text-white border-gray-900 shadow-xs font-semibold"
                                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                                }`}
                              >
                                {isSelected && <Check size={11} strokeWidth={2.5} className="inline mr-1 -mt-0.5" />}
                                {val}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {!allSelected && (
                      <p className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200/60 px-2.5 py-1.5 rounded-lg">
                        <AlertCircle size={11} className="flex-shrink-0" />
                        Sélectionnez les options pour commander
                      </p>
                    )}
                  </div>
                )}

                {/* Wholesale / B2B */}
                {hasWholesale && (
                  <div className="bg-amber-50/40 border border-amber-200/60 rounded-xl p-3 text-gray-900 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                        <Zap size={12} className="text-[#f56b2a] fill-[#f56b2a]" />
                        Tarifs Grossiste (B2B)
                      </div>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        B2B
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {wholesaleTiers.map((tier, idx) => {
                        const isAdding = addingWholesaleIdx === idx;
                        const isAdded = addedWholesaleIdx === idx;
                        return (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg bg-white border border-amber-200/50 text-xs"
                        >
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
                            <span className="font-semibold text-gray-800">Qté Min : {tier.minQty} pièces</span>
                            <span className="text-gray-300">•</span>
                            <span className="font-bold text-gray-900">
                              Prix total : {Math.floor(tier.packagePrice).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F
                            </span>
                            {tier.discountPct > 0 && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded">
                                -{tier.discountPct}%
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleWholesaleAdd(idx, tier.minQty)}
                            className={`min-w-[86px] justify-center px-2 py-1 rounded-md text-white text-[10px] font-bold flex items-center gap-1 transition-colors ${
                              isAdded ? "bg-emerald-600" : "bg-[#f56b2a] hover:bg-[#e04e0f]"
                            }`}
                          >
                            {isAdding ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : isAdded ? (
                              <Check size={11} strokeWidth={3} />
                            ) : (
                              <>
                                <ShoppingCart size={10} />
                                Ajouter {tier.minQty}
                              </>
                            )}
                          </button>
                        </div>
                        );
                      })}
                    </div>
                    {waDigits && (
                      <a
                        href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                          `Bonjour ${product.storeName}, je vous contacte pour le produit "${product.name}" (Réf: ${product.id}). J'aimerais un devis personnalisé gros volume. Merci !`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline pt-0.5"
                      >
                        <MessageCircle size={12} />
                        Demander un devis sur WhatsApp
                      </a>
                    )}
                  </div>
                )}

                {/* CTAs: Side-by-side, perfectly balanced, sleek 44px */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={isOutOfStock}
                    className="h-11 px-3 rounded-xl bg-white hover:bg-gray-50 text-gray-900 font-bold text-xs flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                  >
                    <ShoppingCart size={15} strokeWidth={2.2} className="text-[#f56b2a] flex-shrink-0" />
                    <span className="truncate">{isFood ? "Commander" : "Ajouter au panier"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    disabled={isOutOfStock}
                    className="h-11 px-3 rounded-xl bg-[#f56b2a] hover:bg-[#e04e0f] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-orange-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Zap size={14} fill="currentColor" className="flex-shrink-0" />
                    <span className="truncate">{isFood ? "Commander direct" : "Acheter direct"}</span>
                  </button>
                </div>

                {/* Reassurance Bar: fine, compact single row */}
                <div className="grid grid-cols-3 gap-2 py-2 px-2.5 bg-gray-50/70 rounded-xl border border-gray-100 text-[10px] text-gray-500 font-medium text-center">
                  {isFood ? (
                    <>
                      <span className="flex items-center justify-center gap-1 truncate">
                        <Clock size={11} className="text-green-600 flex-shrink-0" />
                        <span>Fait minute</span>
                      </span>
                      <span className="flex items-center justify-center gap-1 truncate border-x border-gray-200">
                        <ShieldCheck size={11} className="text-emerald-600 flex-shrink-0" />
                        <span>Fraîcheur</span>
                      </span>
                      <span className="flex items-center justify-center gap-1 truncate">
                        <Truck size={11} className="text-blue-600 flex-shrink-0" />
                        <span>Livraison</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center justify-center gap-1 truncate">
                        <ShieldCheck size={11} className="text-emerald-600 flex-shrink-0" />
                        <span>Paiement sécurisé</span>
                      </span>
                      <span className="flex items-center justify-center gap-1 truncate border-x border-gray-200">
                        <RotateCcw size={11} className="text-blue-600 flex-shrink-0" />
                        <span>Retour 7 jours</span>
                      </span>
                      <span className="flex items-center justify-center gap-1 truncate">
                        <Truck size={11} className="text-purple-600 flex-shrink-0" />
                        <span>{product.deliveryTime ? product.deliveryTime : "Livraison suivie"}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* MOBILE CARD */}
              <div className="lg:hidden bg-white rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-4">
                {/* Store link */}
                <div className="mb-3">
                  <Link
                    to={`/store/${product.storeSlug || product.storeId}`}
                    className="inline-flex items-center gap-1 text-[9px] font-bold text-gray-500 hover:text-[#f56b2a] transition-colors"
                  >
                    Vendu par
                    <span className="font-black text-gray-900 max-w-[180px] truncate inline-block align-bottom">
                      {product.storeName}
                    </span>
                  </Link>
                </div>

                {/* Title (Fine & compact) */}
                <h2 className="text-sm font-bold text-gray-900 leading-snug tracking-tight mb-1.5">
                  {product.name}
                  {product.unit && !hasOptions && (
                    <span className="inline-flex items-center gap-1 ml-1.5 align-middle text-[9px] font-black text-[#f56b2a] bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                      <Package size={9} strokeWidth={2.5} />
                      {product.unit}
                    </span>
                  )}
                </h2>

                {/* Rating & Sales & Stock: Fine single line */}
                <div className="flex items-center gap-1.5 text-[11px] mb-2.5 pb-2 border-b border-gray-100 flex-wrap">
                  <div className="flex items-center gap-1 text-gray-800 font-bold">
                    <div className="flex text-amber-400 gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={10}
                          fill={s <= Math.round(product.rating || 0) ? "currentColor" : "none"}
                        />
                      ))}
                    </div>
                    <span>{(product.rating || 0).toFixed(1)}</span>
                    <button
                      onClick={() => scrollToSection("pd-avis")}
                      className="text-[10px] font-normal text-gray-400 underline decoration-gray-200"
                    >
                      ({formatNumber(reviewTotal)})
                    </button>
                  </div>

                  <span className="text-gray-300">·</span>

                  <span className="text-gray-500 text-[10px] flex items-center gap-0.5">
                    <ShoppingBag size={10} className={accentText} />
                    {formatNumber(product.salesCount || 0)} {isFood ? 'commandes' : 'vendus'}
                  </span>

                  <span className="text-gray-300">·</span>

                  {isOutOfStock ? (
                    <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.2 rounded">
                      Rupture
                    </span>
                  ) : isLowStock ? (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded">
                      Plus que {stockValue}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                      En stock
                    </span>
                  )}
                </div>

                {/* Mobile price block: Fine, sleek & compact */}
                <div className="p-2.5 rounded-xl bg-gray-50/80 border border-gray-100 mb-2.5 flex items-center justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      {hasOptions && !allSelected ? "Dès" : "Prix"}
                    </span>
                    <span className="text-lg font-black tracking-tight text-gray-950 leading-none">
                      {formatCurrency(basePrice)}
                    </span>
                    {product.unit && !hasOptions && (
                      <span className="text-[10px] font-semibold text-gray-500">
                        /{product.unit}
                      </span>
                    )}
                    {product.originalPrice && product.originalPrice > basePrice && (
                      <span className="text-[11px] text-gray-400 line-through font-medium">
                        {formatCurrency(product.originalPrice)}
                      </span>
                    )}
                  </div>
                  {product.originalPrice && product.originalPrice > basePrice && (
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                      -{discountPct}% Éco
                    </span>
                  )}
                </div>

                {/* Mobile delivery note */}
                {!isFood && product.deliveryTime && (
                  <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-2.5">
                    <Truck size={11} className="text-blue-500 flex-shrink-0" />
                    <span>Livraison en <b className="text-gray-800">{product.deliveryTime}</b></span>
                  </div>
                )}

                {/* Mobile options: Fine chips */}
                {hasOptions && (
                  <div className="space-y-2 mb-2.5">
                    {options.map((option: any) => (
                      <div key={option.id}>
                        <div className="flex items-center justify-between mb-1 text-[11px]">
                          <span className="font-bold text-gray-700">{option.name}</span>
                          {selectedOptions[option.id] && (
                            <span className="font-semibold text-[#f56b2a] text-[10px]">
                              {selectedOptions[option.id]}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {option.values.map((val: string) => {
                            const isSelected = selectedOptions[option.id] === val;
                            return (
                              <button
                                key={val}
                                onClick={() =>
                                  setSelectedOptions((prev: Record<string, string>) => ({
                                    ...prev,
                                    [option.id]: val,
                                  }))
                                }
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border active:scale-95 ${
                                  isSelected
                                    ? "bg-gray-900 text-white border-gray-900 font-semibold shadow-2xs"
                                    : "bg-white text-gray-700 border-gray-200"
                                }`}
                              >
                                {isSelected && <Check size={10} strokeWidth={2.5} className="inline mr-1 -mt-0.5" />}
                                {val}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {!allSelected && (
                      <p className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-1 rounded-lg">
                        <AlertCircle size={11} className="flex-shrink-0" />
                        Choisissez vos options
                      </p>
                    )}
                  </div>
                )}

                {/* Mobile wholesale: Redesign compact & visible */}
                {hasWholesale && (
                  <div className="bg-white rounded-2xl border border-amber-200/50 mb-2.5 overflow-hidden">
                    <div className="px-3 py-2 bg-amber-50/50 border-b border-amber-100 flex items-center justify-between">
                        <span className="text-[10px] font-black text-amber-950 flex items-center gap-1.5">
                            <Zap size={12} className="text-[#f56b2a] fill-[#f56b2a]" />
                            PRIX DE GROS
                        </span>
                        <span className="text-[9px] font-bold text-[#e04e0f] uppercase">Dégressif</span>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-px bg-amber-100/50">
                      {wholesaleTiers.map((tier, idx) => {
                        const isAdding = addingWholesaleIdx === idx;
                        const isAdded = addedWholesaleIdx === idx;
                        return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleWholesaleAdd(idx, tier.minQty)}
                          className="flex items-center justify-between px-3 py-2 bg-white hover:bg-amber-50 active:bg-amber-100 transition-colors cursor-pointer group"
                        >
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
                            <span className="text-[10px] font-black text-gray-700">
                                Qté Min : {tier.minQty} pièces
                            </span>
                            <span className="text-gray-300 font-black">•</span>
                            <span className="text-xs font-black text-[#f56b2a]">
                              Prix total : {Math.floor(tier.packagePrice).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                             {tier.discountPct > 0 && (
                              <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                -{tier.discountPct}%
                              </span>
                             )}
                            <div
                              className={`min-w-[52px] justify-center px-2 py-1 rounded-lg text-white text-[9px] font-black uppercase flex items-center gap-1 transition-colors ${
                                isAdded ? "bg-emerald-600" : "bg-gray-900"
                              }`}
                            >
                              {isAdding ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : isAdded ? (
                                <Check size={11} strokeWidth={3} />
                              ) : (
                                "Ajouter"
                              )}
                            </div>
                          </div>
                        </button>
                        );
                      })}
                    </div>

                    {waDigits && (
                      <div className="px-3 py-2 bg-white border-t border-amber-100 flex items-center justify-between text-[10px]">
                        <span className="text-gray-500 font-medium italic">Besoin d'un devis volume ?</span>
                        <a
                          href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                            `Bonjour ${product.storeName}, je vous contacte pour le produit "${product.name}" (Réf: ${product.id}). J'aimerais commander un gros volume. Pouvez-vous me faire votre meilleur prix de gros ? Merci !`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline"
                        >
                          <MessageCircle size={11} className="text-emerald-600" />
                          Négocier sur WhatsApp 🤝
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Mobile Description Card */}
              <div className="lg:hidden bg-white rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-3.5 bg-[#f56b2a] rounded-full" />
                  <h3 className="text-[11px] font-bold text-gray-900 uppercase tracking-wider">
                    {isFood ? 'Détails du plat' : 'Description produit'}
                  </h3>
                </div>
                <div
                  className={`text-gray-600 text-xs leading-relaxed font-normal ${
                    !isDescriptionExpanded ? "line-clamp-4" : ""
                  }`}
                  style={{ whiteSpace: "pre-line" }}
                >
                  {descriptionText}
                </div>
                {descriptionText.length > 180 && (
                  <button
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    className={`mt-2 font-bold text-[10px] uppercase tracking-wider flex items-center gap-0.5 active:scale-95 transition-all ${accentText}`}
                  >
                    {isDescriptionExpanded ? "Réduire" : "Lire la suite"}
                    <ChevronRight
                      size={10}
                      className={`transition-transform duration-300 ${
                        isDescriptionExpanded ? "-rotate-90" : "rotate-90"
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ================= AVIS (CARD-BASED) ================= */}
        <section
          id="pd-avis"
          className="mt-3.5 lg:mt-10 bg-white rounded-[24px] lg:rounded-2xl border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-4 lg:p-10 scroll-mt-14"
        >
          <div className="flex items-center justify-between mb-4 lg:mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="hidden md:block w-1 h-5 bg-amber-400 rounded-full" />
              <h3 className="text-[9px] md:text-sm font-black text-gray-900 uppercase tracking-[0.12em]">
                Avis {isFood ? 'sur le repas' : 'sur le produit'}
              </h3>
            </div>
            <Button
              onClick={() => {
                if (!user) {
                  setAuthMode("login");
                  setShowAuthModal(true);
                  return;
                }
                setShowReviewForm(true);
                setReviewStep(1);
              }}
              variant="secondary"
              size="sm"
              icon={<MessageCircle size={12} />}
            >
              {isFood ? 'Noter ce repas' : 'Donner mon avis'}
            </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-6 md:gap-12">
            {/* Score summary */}
            <div className="flex md:flex-col items-center md:items-center gap-3 md:min-w-[180px] md:border-r md:border-gray-100 md:pr-12">
              <div className="text-center">
                <div className="flex items-baseline gap-1 justify-center">
                  <span className="text-xl md:text-6xl font-black text-gray-900 tracking-tighter leading-none">
                    {(product.rating || 0).toFixed(1)}
                  </span>
                  <span className="text-xs md:text-lg font-black text-gray-300">/5</span>
                </div>
                <div className="flex text-amber-400 mt-2 justify-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={16}
                      fill={
                        s <= Math.round(product.rating || 0)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  ))}
                </div>
                <p className="text-[8px] md:text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-wider">
                  {formatNumber(reviewTotal)} {isFood ? 'avis clients' : 'notes et avis'}
                </p>
              </div>
            </div>

            {/* Distribution + list */}
            <div className="flex-grow min-w-0">
              {(product.reviews?.length || 0) > 0 && (
                <div className="mb-4 space-y-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count =
                      product.reviews?.filter((r: Review) => r.rating === star).length || 0;
                    const total = product.reviews?.length || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={star} className="flex items-center gap-3">
                        <span className="text-[9px] font-black text-gray-500 w-8 flex items-center gap-0.5">
                          {star}{" "}
                          <Star size={8} className="text-yellow-400" fill="currentColor" />
                        </span>
                        <div className="flex-grow h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-yellow-300 to-yellow-400 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-black text-gray-400 w-9 text-right">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="divide-y divide-gray-50">
                {selectedProductId && loadingReviews[selectedProductId] ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-[#f56b2a] animate-spin" />
                  </div>
                ) : (product.reviews?.length || 0) > 0 ? (
                  <>
                    {(showAllProductReviews
                      ? product.reviews
                      : product.reviews?.slice(0, 3)
                    )?.map((review: Review, idx: number) => (
                      <div key={idx} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                        <div
                          className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] md:text-xs font-black ${
                            [
                              "bg-gradient-to-br from-orange-100 to-orange-200 text-[#d55a20]",
                              "bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700",
                              "bg-gradient-to-br from-rose-100 to-rose-200 text-rose-600",
                            ][idx % 3]
                          }`}
                        >
                          {review.author?.[0]?.toUpperCase() || "A"}
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center justify-between gap-3 mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <h4 className="text-[9px] md:text-xs font-black text-gray-900 truncate">
                                {review.author}
                              </h4>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    size={8}
                                    className="text-yellow-400"
                                    fill={s <= review.rating ? "currentColor" : "none"}
                                  />
                                ))}
                              </div>
                            </div>
                            <span className="text-[9px] font-medium text-gray-400 flex-shrink-0">
                              {new Date(review.date).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          <p className="text-[9px] md:text-xs text-gray-600 leading-relaxed font-medium">
                            {review.comment}
                          </p>
                        </div>
                      </div>
                    ))}

                    {product.reviews && product.reviews.length > 3 && !showAllProductReviews && (
                      <button
                        onClick={() => setShowAllProductReviews(true)}
                        className="w-full py-2.5 mt-2 bg-gray-50 text-gray-900 text-[8px] md:text-[10px] font-black uppercase tracking-wider rounded-xl border border-gray-100 hover:bg-gray-100 transition-all flex items-center justify-center gap-1.5"
                      >
                        Voir les {product.reviews.length - 3} autres avis
                        <ChevronRight size={12} className="rotate-90" />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6 bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                    <MessageCircle size={18} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-xs font-black text-gray-600">
                      Aucun avis rédigé
                    </p>
                    <p className="text-[9px] text-gray-400 mt-0.5 font-medium">
                      {isFood ? 'Soyez le premier à donner votre avis !' : 'Partagez votre avis pour aider la communauté !'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ================= SIMILAIRES ================= */}
        {relatedProducts.length > 0 && (
          <section id="pd-similaires" className="mt-3.5 lg:mt-14 scroll-mt-14">
            <div className="flex items-center gap-2.5 mb-4 lg:mb-6 px-1">
              <div className="hidden md:block w-1 h-5 bg-[#f56b2a] rounded-full" />
              <h3 className="text-[9px] md:text-sm font-black text-gray-900 uppercase tracking-[0.12em]">
                {isFood ? 'Vous aimerez aussi' : 'Recommandations similaires'}
              </h3>
            </div>
            <div className="flex overflow-x-auto no-scrollbar gap-3 snap-x snap-mandatory pb-4 pr-4 -mr-4 md:mr-0 md:pb-0 md:pr-0 md:grid md:grid-cols-4 lg:grid-cols-4 md:gap-5">
              {relatedProducts.slice(0, 8).map((relProduct: StorefrontProduct) => (
                <ProductCard
                  key={`${relProduct.storeId}-${relProduct.id}`}
                  product={relProduct}
                  onAddToCart={handleCardAddToCart}
                  onBuyNow={handleCardBuyNow}
                  onStoreSelect={(id) =>
                    safeNavigate(`/store/${relProduct.storeSlug || id}`)
                  }
                  onClick={() =>
                    safeNavigate(`/product/${generateProductSlug(relProduct)}`)
                  }
                  onPrefetch={() => warmProduct({ id: relProduct.id, image: relProduct.image })}
                  className="w-[145px] xs:w-[160px] md:w-auto flex-shrink-0 md:flex-shrink snap-start"
                />
              ))}
            </div>
          </section>
        )}

        {/* ================= STICKY MOBILE ACTION BAR (M3 Floating style) ================= */}
        {(
          <div
            className="lg:hidden fixed left-0 right-0 bottom-0 z-[998] bg-white/95 backdrop-blur-xl border-t border-gray-100/80 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] px-4 pt-3"
            style={{
              paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {isFood ? (
              <div className="flex items-center justify-center gap-3 pb-2 text-[8px] font-bold text-gray-400">
                <span className="flex items-center gap-1"><Clock size={8} /> Fraîcheur garantie</span>
                <span className="w-0.5 h-0.5 bg-gray-200 rounded-full" />
                <span className="flex items-center gap-1"><Truck size={8} /> Livraison rapide</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3 pb-2 text-[8px] font-bold text-gray-400">
                <span className="flex items-center gap-1"><ShieldCheck size={8} /> Paiement à la livraison</span>
                <span className="w-0.5 h-0.5 bg-gray-200 rounded-full" />
                <span className="flex items-center gap-1"><RotateCcw size={8} /> Retour 7j</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              {cartItemsCount > 0 ? (
                <button
                  onClick={goToCart}
                  className="w-full bg-[#f56b2a] hover:bg-orange-600 text-white rounded-full font-black text-xs py-3.5 flex items-center justify-center gap-2 active:scale-95 shadow-md shadow-orange-500/10 transition-all"
                >
                  <div className="relative flex-shrink-0">
                    <ShoppingCart size={16} strokeWidth={2.5} />
                    <span className="absolute -top-2.5 -right-2.5 bg-gray-900 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full border-2 border-[#f56b2a] font-black">
                      {cartItemsCount}
                    </span>
                  </div>
                  Voir mon panier
                  <span className="opacity-60">•</span>
                  <span className="tabular-nums">
                    {formatCurrency(Number(cartTotal) || 0)}
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className="w-full border-2 border-gray-900 bg-white hover:bg-gray-50 text-gray-900 rounded-full font-black text-xs py-3.5 flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingCart size={14} strokeWidth={2.5} />
                  {isOutOfStock ? "Rupture" : (isFood ? 'Commander' : 'Ajouter au panier')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
}
