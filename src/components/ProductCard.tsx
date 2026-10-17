'use client';

import React, { memo, useCallback } from 'react';
import { Product } from '@/types';
import { Eye } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/utils';
import ProductImage from './ProductImage';
import { generateProductSlug } from '@/utils/slug';

interface ProductCardProps {
  product: Product;
  onClick?: () => void;
  onPrefetch?: () => void;
  className?: string;
}

const ProductCard: React.FC<ProductCardProps> = memo(({ product, onClick, onPrefetch, className = "" }) => {
  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

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
        <div className="px-1 pt-1 md:px-2 md:pt-2">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg md:rounded-xl bg-white">
            <ProductImage
              src={product.image}
              alt={product.name}
              containerClassName="w-full h-full"
              objectFit="cover"
            />

            {/* Badges on Image Content */}
            <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5 pointer-events-none">
              {product.originalPrice && product.originalPrice > product.price && (
                <div className="bg-red-500 text-white px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest shadow-md">
                  -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
                </div>
              )}
            </div>

            {/* Hover Gradient Overlay */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none will-change-opacity" />
          </div>
        </div>

        <div className="p-1.5 md:p-2 flex flex-col flex-grow bg-white">
          <div className="mb-1">
            <h3 className="text-[9px] md:text-[11px] font-semibold text-gray-800 line-clamp-1 leading-tight will-change-contents">
              {product.name}
            </h3>
          </div>

          <div className="mt-auto">
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-[#1a1a1a] font-bold text-[10px] md:text-sm">
                {formatCurrency(product.price)}
              </span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-[8px] md:text-[9px] text-gray-500 line-through">
                  {formatCurrency(product.originalPrice)}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-1 -mt-1 mb-1.5 min-h-[14px]">
              {product.salesCount !== undefined && product.salesCount > 0 ? (
                <div className="text-[9px] text-gray-600 font-semibold opacity-70">
                  {formatNumber(product.salesCount)} {product.salesCount > 1 ? 'ventes' : 'vente'}
                </div>
              ) : <div />}

              {product.views !== undefined && product.views > 0 && (
                <div className="text-[9px] text-gray-600 font-semibold opacity-80 flex items-center gap-1">
                  {formatNumber(product.views)} <Eye size={10} className="text-gray-600" strokeWidth={2.5} />
                </div>
              )}
            </div>
          </div>
        </div>
      </a>
    </div >
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
