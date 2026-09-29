'use client';

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Product } from '@/types';
import { Plus, Eye } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/utils';
import ProductImage from './ProductImage';
import Loader from './Loader';
import { generateProductSlug } from '@/utils/slug';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onClick?: () => void;
  onPrefetch?: () => void;
  className?: string;
}

// Champs optionnels utilisés par la carte côté marketplace
interface CardProductExtras {
  stock?: number | null;
  options?: unknown[];
}

const ProductCard: React.FC<ProductCardProps> = memo(({ product, onAddToCart, onClick, onPrefetch, className = "" }) => {
  const extras = product as CardProductExtras;
  const hasOptions = Array.isArray(extras.options) && extras.options.length > 0;
  const isOutOfStock = extras.stock === 0;
  const [adding, setAdding] = useState(false);
  const addingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (addingTimerRef.current) clearTimeout(addingTimerRef.current);
    };
  }, []);

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
    setAdding(true);
    // Le panier se met à jour de façon synchrone ; le bref spinner confirme
    // que le tap a bien été pris en compte (latence réseau perçue).
    if (addingTimerRef.current) clearTimeout(addingTimerRef.current);
    addingTimerRef.current = setTimeout(() => setAdding(false), 600);
    onAddToCart(product);
  }, [product, onAddToCart, onClick]);

  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  return (
    /* Carte carrée : `aspect-square` fixe la hauteur sur la largeur. Le média
       occupe la place restante (flex-1) et le texte est un bloc non
       réducteur en bas. `h-full` a été retiré : il se battait avec le ratio et
       remplissait toute la hauteur de la ligne de grille. */
    <div className={`aspect-square bg-white rounded-xl border border-gray-100 overflow-hidden group flex flex-col shadow-sm relative will-change-transform ${className}`}>
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
        className="flex-grow flex flex-col min-h-0 cursor-pointer"
      >
        <div className="relative flex-grow min-h-0 overflow-hidden bg-white">
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

          {/* Action d'ajout en surimpression : elle occupe la zone image au
              lieu de sa propre bande, ce qui laisse au produit la hauteur
              restante de la carte carrée. */}
          <div className="absolute bottom-0 inset-x-0 p-1.5 z-10">
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock || adding}
              aria-label={isOutOfStock ? "Rupture de stock" : hasOptions ? "Choisir les options" : `Ajouter ${product.name} au panier`}
              className={`w-full min-h-[30px] py-1.5 rounded-lg flex items-center justify-center gap-1 text-[9px] md:text-[10px] font-bold transition-colors duration-200 border backdrop-blur-sm whitespace-nowrap tracking-tight ${
                isOutOfStock
                  ? "bg-white/90 text-gray-300 border-gray-100 cursor-not-allowed"
                  : "bg-white/90 text-gray-900 hover:bg-[#f56b2a] hover:text-white hover:border-[#f56b2a] border-gray-200 active:brightness-95"
              }`}
            >
              {adding ? (
                <Loader size="sm" color="text-[#f56b2a]" className="!w-4 !h-4" />
              ) : isOutOfStock ? "Rupture" : hasOptions ? "Choisir" : <><Plus size={12} /> Ajouter</>}
            </button>
          </div>

          {/* Hover Gradient Overlay */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none will-change-opacity" />
        </div>

        <div className="p-1.5 md:p-2 flex flex-col shrink-0 bg-white">
          <div className="mb-1">
            <h3 className="text-[9px] md:text-[11px] font-semibold text-gray-800 line-clamp-1 leading-tight will-change-contents">
              {product.name}
            </h3>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-[#1a1a1a] font-bold text-[10px] md:text-sm">
              {formatCurrency(product.price)}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-[8px] md:text-[9px] text-gray-500 line-through">
                {formatCurrency(product.originalPrice)}
              </span>
            )}
          </div>

          {/* Ventes / vues : retirés sur mobile, ils ne tiennent pas dans une
              carte carrée de trois colonnes et n'aident pas à la décision. */}
          <div className="hidden md:flex items-center justify-between gap-1 mt-1 mb-0.5 min-h-[14px]">
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
      </a>
    </div >
  );
});

ProductCard.displayName = 'ProductCard';

export default ProductCard;
