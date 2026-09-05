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

    const scrollToSection = (id: string) => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-40 lg:pb-16 bg-[#f8f9fc] lg:bg-transparent -mx-4 lg:mx-auto">
        {/* Breadcrumb (desktop only) */}
        <nav
          aria-label="Fil d'Ariane"
          className="hidden md:flex items-center gap-2 mb-8 text-[11px] font-medium text-gray-400 px-4 lg:px-0 pt-6"
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
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px] gap-0 lg:gap-12 items-start">
            {/* ---------- Gallery ---------- */}
            <div className="relative lg:sticky lg:top-24">
              {/* Mobile: Swipeable Carousel inside an M3 Card */}
              <div className="lg:hidden relative bg-white overflow-hidden rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] mb-3.5 aspect-square">
                <div
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

              {/* Desktop: main image + thumbnails — Premium layout */}
              <div className="hidden lg:block space-y-4">
                <div
                  className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-50 border border-gray-100/80 shadow-[0_8px_40px_rgba(0,0,0,0.08)] group/main cursor-zoom-in"
                  onClick={() => openZoom(currentImage)}
                >
                  <Image
                    src={currentImage}
                    width={1000}
                    height={1000}
                    priority
                    alt={product.name}
                    sizes="(max-width: 1024px) 100vw, 55vw"
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover/main:scale-105"
                  />

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover/main:bg-black/5 transition-colors duration-300 pointer-events-none" />

                  {discountPct > 0 && (
                    <div className="absolute top-5 left-5 bg-red-500 text-white text-[11px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl shadow-lg shadow-red-500/25 flex items-center gap-1.5 z-10">
                      <Zap size={13} fill="currentColor" /> -{discountPct}%
                    </div>
                  )}

                  {/* Action buttons top-right */}
                  <div className="absolute top-5 right-5 flex items-center gap-2 z-10">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleShare(e); }}
                      aria-label="Partager"
                      className="w-10 h-10 rounded-xl bg-white/90 backdrop-blur-md border border-gray-200/60 shadow-sm flex items-center justify-center text-gray-600 hover:bg-white hover:text-[#f56b2a] hover:shadow-md hover:scale-105 transition-all active:scale-95"
                    >
                      <Share2 size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openZoom(currentImage); }}
                      aria-label="Agrandir l'image"
                      className="w-10 h-10 rounded-xl bg-white/90 backdrop-blur-md border border-gray-200/60 shadow-sm flex items-center justify-center text-gray-600 hover:bg-white hover:text-[#f56b2a] hover:shadow-md hover:scale-105 transition-all active:scale-95"
                    >
                      <Maximize2 size={16} />
                    </button>
                  </div>

                  {isFood && (
                    <div className="absolute bottom-5 left-5 flex items-center gap-2 bg-white/95 backdrop-blur-md border border-green-100 text-green-700 text-[10px] font-bold px-3.5 py-2 rounded-xl shadow-sm z-10">
                      <Clock size={13} />
                      Fraîchement préparé · {product.preparationTime || product.deliveryTime || "30-45 min"}
                    </div>
                  )}

                  {/* Image counter */}
                  {galleryImages.length > 1 && (
                    <div className="absolute bottom-5 right-5 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1.5 rounded-lg z-10">
                      {(galleryImages.indexOf(currentImage) !== -1 ? galleryImages.indexOf(currentImage) : 0) + 1} / {galleryImages.length}
                    </div>
                  )}
                </div>

                {galleryImages.length > 1 && (
                  <div className="grid grid-cols-6 gap-2.5">
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
                          className={`aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                            isActive
                              ? "border-[#f56b2a] ring-2 ring-orange-100 shadow-md scale-[1.02]"
                              : "border-gray-100 opacity-60 hover:opacity-100 hover:border-gray-300 hover:shadow-sm"
                          }`}
                        >
                          <Image
                            src={img}
                            alt={`${product.name} - vue ${idx + 1}`}
                            width={120}
                            height={120}
                            className="w-full h-full object-cover"
                            sizes="100px"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ---------- Details Layout ---------- */}
            <div className="space-y-3.5 lg:space-y-0">
              {/* Desktop wrapper card */}
              <div className="bg-white rounded-[24px] lg:rounded-2xl border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] lg:shadow-[0_2px_20px_rgba(0,0,0,0.06)] p-4 lg:p-6">
                {/* Store Row — Desktop Premium Badge */}
                <div className="mb-3 lg:mb-5">
                  {/* Mobile: simple text */}
                  <Link
                    to={`/store/${product.storeSlug || product.storeId}`}
                    className="lg:hidden inline-flex items-center gap-1 text-[9px] font-bold text-gray-500 hover:text-[#f56b2a] transition-colors"
                  >
                    Vendu par
                    <span className="font-black text-gray-900 max-w-[180px] truncate inline-block align-bottom">
                      {product.storeName}
                    </span>
                  </Link>
                  {/* Desktop: Premium store badge */}
                  <Link
                    to={`/store/${product.storeSlug || product.storeId}`}
                    className="hidden lg:inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-gray-50/80 hover:bg-gray-100 border border-gray-100 transition-all group/store"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#f56b2a] to-[#e04e0f] flex items-center justify-center text-white text-sm font-black shadow-sm">
                      {product.storeName?.[0]?.toUpperCase() || 'B'}
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-black text-gray-900 truncate max-w-[220px] group-hover/store:text-[#f56b2a] transition-colors">
                        {product.storeName}
                      </span>
                      <span className="block text-[10px] font-medium text-gray-400">Vendeur vérifié</span>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 group-hover/store:text-[#f56b2a] transition-colors flex-shrink-0 ml-1" />
                  </Link>
                </div>

                {/* Title */}
                <h2 className="text-sm md:text-[26px] xl:text-[28px] font-black text-gray-900 leading-[1.2] tracking-tight mb-2 lg:mb-3">
                  {product.name}
                  {product.unit && (
                    <span className="block md:inline md:ml-2 text-[9px] md:text-sm text-gray-400 font-semibold align-middle">
                      {product.unit}
                    </span>
                  )}
                </h2>

                {/* Rating & Sales Row — Mobile: inline text / Desktop: chip badges */}
                {/* Mobile */}
                <div className="flex lg:hidden flex-wrap items-center gap-x-3 gap-y-1.5 mb-4 border-b border-gray-50 pb-3">
                  <div className="flex items-center gap-1">
                    <div className="flex text-yellow-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={12}
                          fill={
                            s <= Math.round(product.rating || 0)
                              ? "currentColor"
                              : "none"
                          }
                        />
                      ))}
                    </div>
                    <span className="text-xs font-black text-gray-900">
                      {(product.rating || 0).toFixed(1)}
                    </span>
                    <button
                      onClick={() => scrollToSection("pd-avis")}
                      className="text-[10px] font-bold text-gray-400 underline underline-offset-2 decoration-gray-200 hover:text-[#f56b2a]"
                    >
                      ({formatNumber(reviewTotal)} avis)
                    </button>
                  </div>
                  <span className="w-1 h-1 bg-gray-200 rounded-full" />
                  <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                    <ShoppingBag size={11} className={accentText} />
                    {formatNumber(product.salesCount || 0)} {isFood ? 'commandes' : 'vendus'}
                  </span>
                  {!isFood && product.views != null && (
                    <>
                      <span className="w-1 h-1 bg-gray-200 rounded-full" />
                      <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                        <Eye size={11} />
                        {formatNumber(product.views)} vues
                      </span>
                    </>
                  )}
                </div>
                {/* Desktop: Chip badges */}
                <div className="hidden lg:flex flex-wrap items-center gap-2 mb-5 pb-5 border-b border-gray-100">
                  <button
                    onClick={() => scrollToSection("pd-avis")}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50/80 border border-amber-100/80 hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    <div className="flex text-amber-400 gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={12}
                          fill={
                            s <= Math.round(product.rating || 0)
                              ? "currentColor"
                              : "none"
                          }
                        />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-amber-800">
                      {(product.rating || 0).toFixed(1)}
                    </span>
                    <span className="text-[10px] font-medium text-amber-600/70">
                      ({formatNumber(reviewTotal)})
                    </span>
                  </button>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50/80 border border-gray-100/80 text-[11px] font-semibold text-gray-600">
                    <ShoppingBag size={12} className={accentText} />
                    {formatNumber(product.salesCount || 0)} {isFood ? 'commandes' : 'vendus'}
                  </span>
                  {!isFood && product.views != null && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50/80 border border-gray-100/80 text-[11px] font-semibold text-gray-500">
                      <Eye size={12} />
                      {formatNumber(product.views)}
                    </span>
                  )}
                </div>

                {/* Price block — Mobile: compact / Desktop: premium */}
                {/* Mobile */}
                <div className="lg:hidden relative overflow-hidden rounded-[20px] border border-[#f56b2a]/10 bg-gradient-to-br from-[#f56b2a]/5 via-white to-white p-3.5">
                  <span className="block text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">
                    {hasOptions && !allSelected ? "À partir de" : (isFood ? "Prix" : "Tarif unique")}
                  </span>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={`text-lg font-black tracking-tight leading-none ${accentText}`}>
                      {formatCurrency(basePrice)}
                    </span>
                    {product.originalPrice && product.originalPrice > basePrice && (
                      <>
                        <span className="text-[9px] text-gray-400 line-through font-bold">
                          {formatCurrency(product.originalPrice)}
                        </span>
                        <span className="text-[9px] font-black text-white bg-red-500 px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                          -{discountPct}%
                        </span>
                      </>
                    )}
                  </div>
                  {product.originalPrice && product.originalPrice > basePrice && (
                    <span className="mt-1.5 inline-flex text-[9px] font-black text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Économisez {formatCurrency(product.originalPrice - basePrice)}
                    </span>
                  )}
                </div>
                {/* Desktop: Premium price section */}
                <div className="hidden lg:block">
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 via-gray-850 to-gray-800 p-5 text-white">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-[#f56b2a]/8 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/3" />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.15em]">
                          {hasOptions && !allSelected ? "À partir de" : (isFood ? "Prix" : "Tarif unique")}
                        </span>
                        {/* Stock badge */}
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-500/15 px-2 py-0.5 rounded-md">
                            <AlertCircle size={10} /> Rupture
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-md animate-pulse">
                            <AlertCircle size={10} /> {stockValue} restants
                          </span>
                        ) : stockValue !== null ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-md">
                            <CheckCircle2 size={10} /> En stock
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="text-[36px] xl:text-[40px] font-black tracking-tight leading-none text-white">
                          {formatCurrency(basePrice)}
                        </span>
                        {product.originalPrice && product.originalPrice > basePrice && (
                          <span className="text-sm text-gray-500 line-through font-medium">
                            {formatCurrency(product.originalPrice)}
                          </span>
                        )}
                      </div>
                      {product.originalPrice && product.originalPrice > basePrice && (
                        <div className="flex items-center gap-2 mt-2.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            <Zap size={10} fill="currentColor" /> -{discountPct}%
                          </span>
                          <span className="text-[10px] font-medium text-gray-500">
                            Économisez {formatCurrency(product.originalPrice - basePrice)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              {/* CARD 2: OPTIONS / VARIANTS (M3 Chips) */}
              {hasOptions && (
                <div className="lg:border-t lg:border-gray-100 lg:pt-5 lg:mt-5">
                  <div className="lg:hidden bg-white rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-4">
                    {/* Mobile options card - kept as is */}
                  </div>
                  <div className="space-y-4">
                    {options.map((option: any) => (
                      <div key={option.id}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-[9px] lg:text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">
                            {option.name}
                          </h4>
                          {selectedOptions[option.id] && (
                            <span className="text-[10px] lg:text-[11px] font-black text-[#f56b2a]">
                              {selectedOptions[option.id]}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
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
                                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[10px] md:text-xs font-semibold transition-all border active:scale-95 ${
                                  isSelected
                                    ? "bg-[#f56b2a] text-white border-[#f56b2a] shadow-md shadow-orange-500/10 font-black"
                                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-900"
                                }`}
                              >
                                {isSelected && <Check size={11} strokeWidth={3} />}
                                {val}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {!allSelected && (
                      <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2 rounded-xl">
                        <AlertCircle size={12} className="flex-shrink-0" />
                        Sélectionnez toutes les options pour continuer
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* CARD 3: WHOLESALE TIERS (If available) */}
              {hasWholesale && (
                <div className="bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 text-white rounded-[24px] p-5 shadow-xl shadow-gray-950/20 border border-gray-700/60 overflow-hidden relative">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-[#f56b2a]/20 text-[#f56b2a] flex items-center justify-center border border-[#f56b2a]/30 shrink-0">
                        <Zap size={20} className="fill-[#f56b2a]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-white">
                            Tarifs Grossiste & Dégressifs
                          </span>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            B2B
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 font-medium">
                          Tarifs dégressifs automatiques appliqués au panier
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tableau des Paliers */}
                  <div className="space-y-2 mb-4">
                    {wholesaleTiers.map((tier, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 gap-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 text-xs font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-white">
                                Dès {tier.minQty} pièces
                              </span>
                              {tier.discountPct > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-black">
                                  -{tier.discountPct}%
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 block font-medium">
                              Soit {formatCurrency(tier.unitPrice)} / pièce
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3">
                          <div className="text-left sm:text-right">
                            <span className="text-xs sm:text-sm font-black text-orange-400">
                              {formatCurrency(tier.packagePrice)}
                            </span>
                            <span className="text-[9px] text-gray-400 block font-bold uppercase">
                              Prix du lot
                            </span>
                          </div>
                          <button
                            onClick={() => addWholesaleToCart(product, tier.minQty)}
                            className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-sm shrink-0"
                          >
                            <ShoppingCart size={12} />
                            Ajouter {tier.minQty}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* WhatsApp B2B Quotation Button */}
                  {waDigits && (
                    <a
                      href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
                        `Bonjour ${product.storeName}, je vous contacte concernant le produit "${product.name}" (Réf: ${product.id}). J'aimerais commander un volume important. Pouvez-vous me proposer une cotation personnalisée ? Merci !`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/30 font-black text-[11px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                      <MessageCircle size={15} />
                      Demander un devis personnalisé sur WhatsApp
                    </a>
                  )}
                </div>
              )}

              {/* CARD 4: AVAILABILITY (mobile only — stock is now in desktop price section) */}
              <div className="md:hidden bg-white rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-4">
                <div className="mb-4">
                  {stockValue !== null && stockValue > 0 && (
                    <>
                      <div className="flex items-center justify-end mb-1.5">
                        {isLowStock && (
                          <span className="text-[9px] font-black text-amber-600 animate-pulse">
                            Dernières unités ({stockValue}) !
                          </span>
                        )}
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            isLowStock ? "bg-amber-400" : "bg-green-400"
                          }`}
                          style={{
                            width: `${isLowStock ? Math.max(stockFill, 12) : stockFill}%`,
                          }}
                        />
                      </div>
                    </>
                  )}
                  {isOutOfStock && (
                    <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
                      <AlertCircle size={12} /> Rupture de stock temporaire
                    </p>
                  )}
                  {stockValue === null && (
                    <p className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400">
                      <AlertCircle size={11} /> Disponibilité à confirmer en boutique
                    </p>
                  )}
                </div>
              </div>

              {/* CTAs — desktop only (stacked full-width for premium feel) */}
              <div className="hidden lg:flex flex-col gap-2.5 border-t border-gray-100 pt-5 mt-5">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className="h-[52px] w-full bg-[#f56b2a] hover:bg-[#e04e0f] text-white font-black text-[13px] rounded-xl flex items-center justify-center gap-2.5 shadow-md shadow-orange-500/15 hover:shadow-lg hover:shadow-orange-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group"
                >
                  <ShoppingCart size={17} strokeWidth={2.5} className="flex-shrink-0 transition-transform group-hover:scale-110" />
                  <span>{isFood ? "Commander" : "Ajouter au panier"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={isOutOfStock}
                  className="h-[52px] w-full bg-white hover:bg-gray-50 text-gray-900 font-black text-[13px] rounded-xl flex items-center justify-center gap-2.5 border-2 border-gray-200 hover:border-gray-300 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group"
                >
                  <Zap size={16} fill="currentColor" className="flex-shrink-0 text-[#f56b2a] transition-transform group-hover:scale-110" />
                  <span>{isFood ? "Commander maintenant" : "Acheter maintenant"}</span>
                </button>
              </div>

              {/* Trust band — desktop: compact inline */}
              <div className="hidden lg:flex items-center justify-between border-t border-gray-100 pt-4 mt-4">
                {isFood ? (
                  <>
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500">
                      <Clock size={13} className="text-green-500" /> Préparé à la commande
                    </span>
                    <span className="w-px h-4 bg-gray-200" />
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500">
                      <ShieldCheck size={13} className="text-emerald-500" /> Fraîcheur garantie
                    </span>
                    <span className="w-px h-4 bg-gray-200" />
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500">
                      <Truck size={13} className="text-blue-500" /> Livraison rapide
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500">
                      <ShieldCheck size={13} className="text-emerald-500" /> Paiement à la livraison
                    </span>
                    <span className="w-px h-4 bg-gray-200" />
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500">
                      <RotateCcw size={13} className="text-blue-500" /> Retour 7 jours
                    </span>
                    <span className="w-px h-4 bg-gray-200" />
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500">
                      <Truck size={13} className="text-purple-500" /> Livraison sécurisée
                    </span>
                  </>
                )}
              </div>
              </div>{/* End desktop wrapper card */}

              {/* CARD 5: DESCRIPTION */}
              <div className="bg-white rounded-[24px] lg:rounded-2xl border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] lg:shadow-[0_2px_20px_rgba(0,0,0,0.06)] p-4 lg:p-6 lg:mt-5">
                <div className="flex items-center gap-2.5 mb-3 lg:mb-4">
                  <div className="hidden md:block w-1 h-5 bg-[#f56b2a] rounded-full" />
                  <h3 className="text-[9px] lg:text-xs font-black text-gray-900 uppercase tracking-[0.12em]">
                    {isFood ? 'Détails du plat' : 'Description produit'}
                  </h3>
                </div>
                <div
                  className={`text-gray-600 text-[9px] md:text-[13px] leading-relaxed lg:leading-[1.8] font-medium ${
                    !isDescriptionExpanded ? "line-clamp-4 md:line-clamp-none" : ""
                  }`}
                  style={{ whiteSpace: "pre-line" }}
                >
                  {descriptionText}
                </div>
                {descriptionText.length > 180 && (
                  <button
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    className={`mt-2.5 md:hidden font-black text-[9px] uppercase tracking-widest flex items-center gap-0.5 active:scale-95 transition-all ${accentText}`}
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
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="flex-1 border-2 border-gray-900 bg-white hover:bg-gray-50 text-gray-900 rounded-full font-black text-xs py-3.5 flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
              >
                <ShoppingCart size={14} strokeWidth={2.5} />
                {isFood ? 'Commander' : 'Panier'}
              </button>
              <button
                onClick={handleBuyNow}
                disabled={isOutOfStock}
                className="flex-[1.2] bg-[#f56b2a] hover:bg-orange-600 text-white rounded-full font-black text-xs py-3.5 flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-orange-500/10 transition-all disabled:opacity-50"
              >
                <Zap size={14} fill="currentColor" />
                {isOutOfStock ? "Rupture" : (isFood ? "Commander" : "Acheter")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
}
