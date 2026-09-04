import React from "react";
import Image from "next/image";
import {
  Package, ArrowRight, ChevronRight, Share2, Maximize2, Zap, Clock, Star,
  ShoppingBag, Eye, ShoppingCart, AlertCircle, Check, MessageCircle,
  ShieldCheck, RotateCcw, Truck, ChevronLeft, ArrowLeft, Loader2
} from "lucide-react";
import Button from "@/components/Button";
import ProductImage from "@/components/ProductImage";
import ProductCard from "@/components/ProductCard";
import { formatCurrency, formatNumber } from "@/utils";
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
      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-40 lg:pb-12 bg-[#f8f9fc] lg:bg-transparent -mx-4 lg:mx-auto">
        {/* Breadcrumb (desktop only) */}
        <nav
          aria-label="Fil d'Ariane"
          className="hidden md:flex items-center gap-2 mb-6 text-[11px] font-bold text-gray-400 uppercase tracking-widest px-4 lg:px-0 pt-4"
        >
          <button
            onClick={() => safeNavigate("/")}
            className="hover:text-[#f56b2a] transition-colors cursor-pointer"
          >
            Accueil
          </button>
          <ChevronRight size={11} />
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
          <ChevronRight size={11} />
          <span
            className="text-gray-900 truncate max-w-[280px]"
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-14 items-start">
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

              {/* Desktop: main image + thumbnails */}
              <div className="hidden lg:block space-y-3">
                <div className="relative w-full aspect-square rounded-[32px] overflow-hidden bg-gradient-to-br from-gray-50 to-white border border-gray-100 shadow-[0_20px_60px_rgba(0,0,0,0.06)] group/main">
                  <Image
                    src={currentImage}
                    width={1000}
                    height={1000}
                    priority
                    alt={product.name}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover/main:scale-[1.04]"
                  />

                  {discountPct > 0 && (
                    <div className="absolute top-4 left-4 bg-gradient-to-r from-red-500 to-red-600 text-white text-[11px] font-black uppercase tracking-widest pl-3 pr-4 py-2 rounded-full shadow-lg shadow-red-500/30 flex items-center gap-1">
                      <Zap size={12} fill="currentColor" /> -{discountPct}%
                    </div>
                  )}

                  <button
                    onClick={() => openZoom(currentImage)}
                    aria-label="Agrandir l'image"
                    className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur-md border border-gray-100 shadow-md flex items-center justify-center text-gray-700 hover:bg-white hover:text-[#f56b2a] hover:scale-105 transition-all active:scale-95"
                  >
                    <Maximize2 size={15} />
                  </button>

                  {isFood && (
                    <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-white/90 backdrop-blur-md border border-green-100 text-green-700 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm">
                      <Clock size={11} />
                      Fraîchement préparé · {product.preparationTime || product.deliveryTime || "30-45 min"}
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
                          className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                            isActive
                              ? "border-[#f56b2a] ring-2 ring-orange-100 scale-[1.03]"
                              : "border-transparent opacity-70 hover:opacity-100"
                          }`}
                        >
                          <Image
                            src={img}
                            alt={`${product.name} - vue ${idx + 1}`}
                            width={120}
                            height={120}
                            className="w-full h-full object-cover"
                            sizes="80px"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ---------- Details Layout ---------- */}
            <div className="space-y-3.5">
              {/* CARD 1: MAIN INFO (Title, Price, Store, Rating) */}
              <div className="bg-white rounded-[24px] lg:rounded-none border lg:border-none border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] lg:shadow-none p-4 lg:p-0">
                {/* Store Row */}
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

                {/* Title */}
                <h2 className="text-sm md:text-3xl font-black text-gray-900 leading-[1.2] tracking-tight mb-2">
                  {product.name}
                  {product.unit && (
                    <span className="block md:inline md:ml-2 text-[9px] md:text-base text-gray-400 font-bold align-middle">
                      {product.unit}
                    </span>
                  )}
                </h2>

                {/* Rating & Sales Row */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-4 border-b border-gray-50 pb-3">
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

                {/* Price block - Premium Inside Card */}
                <div className="relative overflow-hidden rounded-[20px] border border-[#f56b2a]/10 bg-gradient-to-br from-[#f56b2a]/5 via-white to-white p-3.5">
                  <span className="block text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">
                    {hasOptions && !allSelected ? "À partir de" : (isFood ? "Prix" : "Tarif unique")}
                  </span>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className={`text-lg md:text-4xl font-black tracking-tight leading-none ${accentText}`}
                    >
                      {formatCurrency(basePrice)}
                    </span>
                    {product.originalPrice && product.originalPrice > basePrice && (
                      <>
                        <span className="text-[9px] md:text-xs text-gray-400 line-through font-bold">
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
              </div>

              {/* CARD 2: OPTIONS / VARIANTS (M3 Chips) */}
              {hasOptions && (
                <div className="bg-white rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-4">
                  <div className="space-y-4">
                    {options.map((option: any) => (
                      <div key={option.id}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">
                            {option.name}
                          </h4>
                          {selectedOptions[option.id] && (
                            <span className="text-[10px] font-black text-[#f56b2a]">
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

              {/* CARD 3: WHOLESALE (If available) */}
              {product.wholesalePrice && !isFood && (
                <div className="bg-gray-900 text-white rounded-[24px] p-4 shadow-lg shadow-gray-900/10 border border-gray-800">
                  <button
                    onClick={() => addWholesaleToCart(product)}
                    className="w-full flex items-center justify-between group/ws"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-[#f56b2a] flex-shrink-0">
                        <Package size={16} />
                      </div>
                      <div className="text-left min-w-0">
                        <span className="block text-[9px] font-black uppercase tracking-[0.15em] text-[#f56b2a]">
                          Offre grossiste
                        </span>
                        <span className="text-xs font-black truncate">
                          {formatCurrency(product.wholesalePrice)}{" "}
                          <span className="text-gray-400 font-bold">
                            · dès {product.wholesaleMinQty} unités
                          </span>
                        </span>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-gray-300 group-hover/ws:text-white transition-colors flex-shrink-0 ml-2">
                      Lot <ArrowRight size={12} />
                    </span>
                  </button>
                </div>
              )}

              {/* CARD 4: AVAILABILITY & DELIVERY */}
              <div className="hidden md:block bg-white rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-4">
                {/* Stock meter */}
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

              {/* CARD 5: DESCRIPTION */}
              <div className="bg-white rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="hidden md:block h-0.5 w-6 bg-[#f56b2a] rounded-full" />
                  <h3 className="text-[9px] font-black text-gray-900 uppercase tracking-[0.15em]">
                    {isFood ? 'Détails du plat' : 'Description produit'}
                  </h3>
                </div>
                <div
                  className={`text-gray-600 text-[9px] md:text-xs leading-relaxed font-medium ${
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

              {/* CTAs — desktop only */}
              <div className="hidden lg:flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  variant="primary"
                  fullWidth
                  size="xl"
                  className="sm:flex-[1.4]"
                  icon={<ShoppingCart size={19} strokeWidth={2.5} />}
                >
                  {isFood ? "Commander" : "Ajouter au panier"}
                </Button>
                <Button
                  onClick={handleBuyNow}
                  disabled={isOutOfStock}
                  variant="outline"
                  fullWidth
                  size="xl"
                  className="!border-gray-900 !text-gray-900 hover:!bg-gray-900 hover:!text-white"
                >
                  {isFood ? "Commander maintenant" : "Acheter maintenant"}
                </Button>
              </div>

              {/* Trust band */}
              {isFood ? (
                <div className="hidden lg:flex items-center justify-center gap-4 pt-3 text-[9px] font-bold text-gray-400">
                  <span className="flex items-center gap-1"><Clock size={10} /> Préparé à la commande</span>
                  <span className="w-1 h-1 bg-gray-200 rounded-full" />
                  <span className="flex items-center gap-1"><ShieldCheck size={10} /> Fraîcheur garantie</span>
                  <span className="w-1 h-1 bg-gray-200 rounded-full" />
                  <span className="flex items-center gap-1"><Truck size={10} /> Livraison rapide</span>
                </div>
              ) : (
                <div className="hidden lg:flex items-center justify-center gap-4 pt-3 text-[9px] font-bold text-gray-400">
                  <span className="flex items-center gap-1"><ShieldCheck size={10} /> Paiement à la livraison</span>
                  <span className="w-1 h-1 bg-gray-200 rounded-full" />
                  <span className="flex items-center gap-1"><RotateCcw size={10} /> Retour 7 jours</span>
                  <span className="w-1 h-1 bg-gray-200 rounded-full" />
                  <span className="flex items-center gap-1"><Truck size={10} /> Livraison sécurisée</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= AVIS (CARD-BASED) ================= */}
        <section
          id="pd-avis"
          className="mt-3.5 bg-white rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-4 lg:p-10 scroll-mt-14"
        >
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="hidden md:block h-0.5 w-6 bg-yellow-400 rounded-full" />
              <h3 className="text-[9px] md:text-sm font-black text-gray-900 uppercase tracking-[0.15em]">
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
            <div className="flex md:flex-col items-center md:items-start gap-3 md:min-w-[180px] md:border-r md:border-gray-100 md:pr-12">
              <div className="text-center md:text-left">
                <div className="flex items-baseline gap-1 justify-center md:justify-start">
                  <span className="text-xl md:text-5xl font-black text-gray-900 tracking-tighter leading-none">
                    {(product.rating || 0).toFixed(1)}
                  </span>
                  <span className="text-xs font-black text-gray-300">/5</span>
                </div>
                <div className="flex text-yellow-400 mt-1 justify-center md:justify-start">
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
                <p className="text-[8px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
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
          <section id="pd-similaires" className="mt-3.5 scroll-mt-14">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="hidden md:block h-0.5 w-6 bg-[#f56b2a] rounded-full" />
              <h3 className="text-[9px] md:text-sm font-black text-gray-900 uppercase tracking-[0.15em]">
                {isFood ? 'Vous aimerez aussi' : 'Recommandations similaires'}
              </h3>
            </div>
            <div className="flex overflow-x-auto no-scrollbar gap-3 snap-x snap-mandatory pb-4 pr-4 -mr-4 md:mr-0 md:pb-0 md:pr-0 md:grid md:grid-cols-5 md:gap-6">
              {relatedProducts.map((relProduct: StorefrontProduct) => (
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
