'use client';

import React, { memo, useCallback, useMemo } from 'react';
import { Product } from '@/types';
import { Plus, LayoutGrid, Star, Zap, Eye } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/utils';
import { getNormalizedWholesaleTiers } from '@/utils/wholesale';
import ProductImage from './ProductImage';
import { generateProductSlug } from '@/utils/slug';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onBuyNow?: (product: Product) => void;
  onStoreSelect?: (storeId: string) => void;
  onClick?: () => void;
  onPrefetch?: () => void;
  className?: string;
}

// Champs optionnels utilisés par la carte côté marketplace
interface CardProductExtras {
  stock?: number | null;
  options?: unknown[];
}

const ProductCard: React.FC<ProductCardProps> = memo(({ product, onAddToCart, onBuyNow, onStoreSelect, onClick, onPrefetch, className = "" }) => {
  const extras = product as CardProductExtras;
  const hasOptions = Array.isArray(extras.options) && extras.options.length > 0;
  const isOutOfStock = extras.stock === 0;

  const handleAddToCart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const current = product as CardProductExtras;
    // Produit en rupture : on n'ajoute rien
    if (current.stock === 0) return;
    // Produit à options obligatoires : la fiche produit permet de choisir
    if (Array.isArray(current.options) && current.options.length > 0) {
      onClick?.();
      return;
    }
    onAddToCart(product);
  }, [product, onAddToCart, onClick]);

  const handleBuyNow = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onBuyNow?.(product);
  }, [product, onBuyNow]);

  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  const normalizedTiers = useMemo(() => getNormalizedWholesaleTiers(product), [product]);
  const firstTier = normalizedTiers[0];
  const hasWholesale = !!firstTier;

  return (
    <div className={`bg-white rounded-xl border border-gray-100 overflow-hidden group flex flex-col h-full shadow-sm relative will-change-transform ${className}`}>
      {/* Product Content - Clickable Area (real crawlable link) */}
      <a
        href={`/product/${generateProductSlug(product)}`}
        onTouchStart={onPrefetch}
        onMouseEnter={onPrefetch}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          handleClick();
        }}
        className="flex-grow flex flex-col cursor-pointer"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-white">
          <ProductImage
            src={product.image}
            alt={product.name}
            containerClassName="w-full h-full"
            objectFit="cover"
          />

          {/* Badges on Image Content */}
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5 pointer-events-none">
            {hasWholesale && firstTier && (
              <div className="bg-[#f56b2a] text-white px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1 shadow-md">
                <Zap size={9} fill="currentColor" /> Gros dès {firstTier.minQty}
              </div>
            )}
            {product.originalPrice && product.originalPrice > product.price && (
              <div className="bg-red-500 text-white px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest shadow-md">
                -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
              </div>
            )}
          </div>

          {/* Hover Gradient Overlay */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none will-change-opacity" />
        </div>

        <div className="p-1.5 md:p-2 flex flex-col flex-grow bg-white">
          <div className="mb-1">
            <h3 className="text-[9px] md:text-[11px] font-bold text-gray-800 line-clamp-1 leading-tight will-change-contents">
              {product.name}
            </h3>
          </div>

          <div className="mt-auto">
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-[#1a1a1a] font-black text-[10px] md:text-sm">
                {formatCurrency(product.price)}
              </span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-[8px] md:text-[9px] text-gray-500 line-through">
                  {formatCurrency(product.originalPrice)}
                </span>
              )}
            </div>

            {hasWholesale && firstTier && (
              <div className="text-[8px] md:text-[9px] font-black text-[#d55a20] bg-orange-50/90 border border-orange-100 rounded px-1.5 py-0.5 mb-1.5 inline-flex items-center gap-1">
                <span>Dès {firstTier.minQty} pcs :</span>
                <span className="font-extrabold">{formatCurrency(firstTier.packagePrice)}</span>
                <span className="text-[7.5px] opacity-75 font-semibold">({formatCurrency(firstTier.unitPrice)}/u)</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-1 -mt-1 mb-1.5 min-h-[14px]">
              {product.salesCount !== undefined && product.salesCount > 0 ? (
                <div className="text-[9px] text-gray-600 font-bold opacity-70">
                  {formatNumber(product.salesCount)} {product.salesCount > 1 ? 'ventes' : 'vente'}
                </div>
              ) : <div />}

              {product.views !== undefined && product.views > 0 && (
                <div className="text-[9px] text-gray-600 font-bold opacity-80 flex items-center gap-1">
                  {formatNumber(product.views)} <Eye size={10} className="text-gray-600" strokeWidth={2.5} />
                </div>
              )}
            </div>
          </div>
        </div>
      </a>

      <div className="px-1.5 md:px-2 pb-1.5 md:pb-2 bg-white">
        <button
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          aria-label={isOutOfStock ? "Rupture de stock" : hasOptions ? "Choisir les options" : `Ajouter ${product.name} au panier`}
          className={`w-full min-h-[36px] py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-[9px] md:text-[10px] font-black transition-all duration-200 border active:scale-95 whitespace-nowrap tracking-tight ${
            isOutOfStock
              ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
              : "bg-gray-50 text-gray-900 hover:bg-[#f56b2a] hover:text-white hover:border-[#f56b2a] border-gray-100"
          }`}
        >
          {isOutOfStock ? "Rupture" : hasOptions ? "Choisir" : <><Plus size={12} /> Ajouter</>}
        </button>
      </div>
    </div >
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
