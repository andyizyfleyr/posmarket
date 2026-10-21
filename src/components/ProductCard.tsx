'use client';

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Product } from '@/types';
import { Check, ChevronRight, Plus, Star } from 'lucide-react';
import { formatCurrency, formatNumber, formatRating } from '@/utils';
import ProductImage from './ProductImage';
import { generateProductSlug } from '@/utils/slug';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onClick?: () => void;
  onPrefetch?: () => void;
  className?: string;
  /** Affiche un discret badge avec la boutique d'origine. */
  showStore?: boolean;
}

// Champs optionnels utilisés par la carte côté marketplace
interface CardProductExtras {
  storeName?: string;
}

const STAR_SIZE = 9;

/** Étoiles pleines superposées aux étoiles vides (notation lisible). */
function Stars({ rating }: { rating: number }) {
  const ratio = Math.max(0, Math.min(5, rating)) / 5;
  return (
    <span className="relative inline-flex align-middle" aria-hidden="true">
      <span className="inline-flex gap-[1px]">
        {[0, 1, 2, 3, 4].map((index) => (
          <Star key={`empty-${index}`} size={STAR_SIZE} strokeWidth={2} className="text-gray-300" fill="none" />
        ))}
      </span>
      <span
        className="absolute inset-y-0 left-0 overflow-hidden inline-flex gap-[1px]"
        style={{ width: `${ratio * 100}%` }}
      >
        {[0, 1, 2, 3, 4].map((index) => (
          <Star key={`full-${index}`} size={STAR_SIZE} strokeWidth={2} className="text-yellow-500" fill="currentColor" />
        ))}
      </span>
    </span>
  );
}

const ProductCard: React.FC<ProductCardProps> = memo(
  ({ product, onAddToCart, onClick, onPrefetch, className = '', showStore = false }) => {
    const extras = product as CardProductExtras;
    const hasOptions =
      (Array.isArray(product.options) && product.options.length > 0) ||
      (Array.isArray(product.variants) && product.variants.length > 0);
    const stock = Number(product.stock ?? 0);
    const isOutOfStock = stock <= 0;
    const isLowStock = !isOutOfStock && stock <= 5;
    const [adding, setAdding] = useState(false);
    const addingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      return () => {
        if (addingTimerRef.current) clearTimeout(addingTimerRef.current);
      };
    }, []);

    const discount =
      product.originalPrice && product.originalPrice > product.price
        ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
        : 0;

    const salesCount = product.salesCount ?? 0;
    const rating = product.rating ?? 0;
    const reviewCount = product.reviewCount ?? 0;
    const hasStats = salesCount > 0 || rating > 0;
    const storeName = extras.storeName?.trim();

    const handleAddToCart = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        // Produit en rupture : on n'ajoute rien.
        if (isOutOfStock) return;
        // Produit à options obligatoires : la fiche produit permet de choisir.
        if (hasOptions) {
          onClick?.();
          return;
        }
        setAdding(true);
        if (addingTimerRef.current) clearTimeout(addingTimerRef.current);
        addingTimerRef.current = setTimeout(() => setAdding(false), 900);
        onAddToCart(product);
      },
      [product, onAddToCart, onClick, isOutOfStock, hasOptions],
    );

    const handleClick = useCallback(() => {
      onClick?.();
    }, [onClick]);

    return (
      <div
        className={`group relative flex h-full flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm will-change-transform ${className}`}
      >
        {/* Image + badges + ajout rapide */}
        <div className="relative px-1 pt-1 md:px-2 md:pt-2">
          <a
            href={`/product/${generateProductSlug(product)}`}
            onTouchStart={onPrefetch}
            onMouseEnter={onPrefetch}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              handleClick();
            }}
            className="relative block aspect-square w-full cursor-pointer overflow-hidden rounded-lg bg-gray-50 md:rounded-xl"
            aria-label={`${product.name}, ${formatCurrency(product.price)}`}
          >
            <ProductImage
              src={product.image}
              alt={product.name}
              containerClassName="h-full w-full"
              objectFit="cover"
            />

            {discount > 0 && (
              <span className="absolute left-1.5 top-1.5 z-10 rounded-md bg-red-600 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white shadow-md">
                -{discount}%
              </span>
            )}

            {isOutOfStock && (
              <span className="absolute right-1.5 top-1.5 z-10 rounded-md bg-gray-900/85 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                Rupture
              </span>
            )}

            {isLowStock && (
              <span className="absolute right-1.5 top-1.5 z-10 rounded-md bg-amber-700 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-white">
                Plus que {stock}
              </span>
            )}

            {showStore && storeName && (
              <span className="absolute bottom-1.5 left-1.5 z-10 max-w-[68%] truncate rounded-md bg-gray-900/60 px-1.5 py-0.5 text-[8px] font-semibold text-white">
                {storeName}
              </span>
            )}
          </a>

          {/* Ajout rapide posé sur l'image : la carte garde une hauteur unique. */}
          {!isOutOfStock && (
            <button
              onClick={hasOptions ? handleClick : handleAddToCart}
              aria-label={
                hasOptions
                  ? `Choisir les options de ${product.name}`
                  : adding
                    ? 'Ajouté au panier'
                    : `Ajouter ${product.name} au panier`
              }
              className={`absolute bottom-1.5 right-1.5 z-20 flex h-[22px] w-[22px] items-center justify-center rounded-full border shadow-sm transition-all duration-200 active:scale-90 after:absolute after:-inset-2 after:content-[''] ${
                adding
                  ? 'border-brand/30 bg-brand-soft text-brand'
                  : 'border-gray-100 bg-white/95 text-gray-900 hover:border-brand hover:bg-brand hover:text-white'
              }`}
            >
              {adding ? (
                <Check size={12} strokeWidth={3} className="text-brand" />
              ) : hasOptions ? (
                <ChevronRight size={13} strokeWidth={2.8} className="text-gray-900" />
              ) : (
                <Plus size={12} strokeWidth={2.6} className="text-gray-900" />
              )}
            </button>
          )}
        </div>

        {/* Informations : titre, ventes / note, prix */}
        <a
          href={`/product/${generateProductSlug(product)}`}
          onTouchStart={onPrefetch}
          onMouseEnter={onPrefetch}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            handleClick();
          }}
          className="flex flex-grow cursor-pointer flex-col px-1.5 pb-1.5 pt-1.5 md:px-2 md:pb-2"
        >
          <h3 className="line-clamp-1 text-[11px] font-normal leading-tight text-gray-800 md:text-[12px]">
            {product.name}
          </h3>

          <div className="mt-0.5 flex min-h-[14px] items-center gap-1 overflow-hidden">
            {salesCount > 0 ? (
              <span className="truncate text-[9.5px] text-gray-500">
                {formatNumber(salesCount)} vendu{salesCount > 1 ? 's' : ''}
              </span>
            ) : null}

            {salesCount > 0 && rating > 0 ? (
              <span className="mx-1 h-[9px] w-px shrink-0 bg-gray-300" />
            ) : null}

            {rating > 0 ? (
              <span className="flex shrink-0 items-center gap-1">
                <Stars rating={rating} />
                <span className="text-[9.5px] font-semibold text-gray-600">
                  {formatRating(rating)}
                </span>
                {reviewCount > 0 ? (
                  <span className="text-[9px] text-gray-500">({formatNumber(reviewCount)})</span>
                ) : null}
              </span>
            ) : null}

            {!hasStats ? <span className="text-[9.5px] text-gray-400">Nouveau</span> : null}
          </div>

          <div className="mt-auto flex items-baseline gap-1 pt-1">
            <span className="truncate text-[12px] font-bold text-[#1a1a1a] md:text-[13px]">
              {formatCurrency(product.price)}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-[9px] text-gray-400 line-through">
                {formatCurrency(product.originalPrice)}
              </span>
            )}
            {product.unit ? (
              <span className="truncate text-[9px] text-gray-400">/ {product.unit}</span>
            ) : null}
          </div>
        </a>
      </div>
    );
  },
);

ProductCard.displayName = 'ProductCard';

export default ProductCard;
