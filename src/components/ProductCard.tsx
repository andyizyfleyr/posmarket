'use client';

import React from 'react';
import { Product } from '@/types';
import { Plus, LayoutGrid, Star, Zap, Eye } from 'lucide-react';
import { formatCurrency } from '@/utils';
import ProductImage from './ProductImage';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onStoreSelect?: (storeId: string) => void;
  onClick?: () => void;
  className?: string; // Added className support
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, onStoreSelect, onClick, className = "" }) => {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 overflow-hidden group hover:shadow-lg transition-all duration-300 flex flex-col h-full shadow-sm relative ${className}`}>
      {/* Product Content - Clickable Area */}
      <div 
        onClick={onClick}
        className="flex-grow flex flex-col cursor-pointer"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-white group-hover:bg-white transition-colors duration-500">
          <ProductImage
            src={product.image}
            alt={product.name}
            containerClassName="w-full h-full"
            objectFit="contain"
          />
          
          {/* Badges on Image Content */}
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5 pointer-events-none">
            {product.wholesalePrice && (
              <div className="bg-[#f56b2a] text-white px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest flex items-center gap-1 shadow-md animate-in slide-in-from-left duration-500">
                <Zap size={8} fill="currentColor" className="animate-pulse" /> Gros
              </div>
            )}
            {product.originalPrice && product.originalPrice > product.price && (
              <div className="bg-red-500 text-white px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest shadow-md animate-in slide-in-from-left duration-500 delay-100">
                -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
              </div>
            )}
          </div>
          
          {/* Hover Gradient Overlay */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        </div>

        <div className="p-1.5 md:p-2 flex flex-col flex-grow bg-white">
          <div className="mb-1">
            <h3 className="text-[10px] md:text-xs font-bold text-gray-800 line-clamp-1 leading-tight group-hover:text-[#f56b2a] transition-colors">
              {product.name}
            </h3>
          </div>

          <div className="mt-auto">
            <div className="flex items-baseline gap-1 mb-1.5">
              <span className="text-[#1a1a1a] font-black text-xs md:text-sm">
                {formatCurrency(product.price)}
              </span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-[7px] md:text-[8px] text-gray-500 line-through">
                  {formatCurrency(product.originalPrice)}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1 -mt-1 mb-1.5 min-h-[12px]">
              {product.salesCount !== undefined && product.salesCount > 0 ? (
                <div className="text-[8px] md:text-[9px] text-gray-600 font-bold opacity-70">
                  {product.salesCount} {product.businessType === 'stay' || product.category === 'Appartements'
                    ? (product.salesCount > 1 ? 'réservations' : 'réservation')
                    : (product.salesCount > 1 ? 'ventes' : 'vente')}
                </div>
              ) : <div />}

              {product.views !== undefined && product.views > 0 && (
                <div className="text-[8px] md:text-[9px] text-gray-600 font-bold opacity-80 flex items-center gap-1">
                  {product.views} <Eye size={10} className="text-gray-600" strokeWidth={2.5} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Button Tray - Outside the clickable area */}
      {!(product.category === 'Appartements' || product.businessType === 'stay') && (
        <div className="px-1.5 md:px-2 pb-1.5 md:pb-2 bg-white">
          <button
            onClick={(e) => { 
              if ((product as any).currentBooking) return;
              e.stopPropagation(); 
              e.preventDefault();
              onAddToCart(product); 
            }}
            disabled={!!(product as any).currentBooking}
            className={`w-full py-2 rounded-lg flex items-center justify-center gap-1 text-[8px] md:text-[9px] font-black transition-all border active:scale-95 whitespace-nowrap tracking-tighter ${
              (product as any).currentBooking
                ? 'bg-orange-600 text-white border-orange-600 cursor-not-allowed uppercase !opacity-100 shadow-none'
                : 'bg-gray-50 text-gray-900 hover:bg-[#f56b2a] hover:text-white border-gray-100'
            }`}
          >
            {(product as any).currentBooking 
              ? `Occupé jusqu'au ${new Date((product as any).currentBooking.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
              : 'Ajouter au panier'}
          </button>
        </div>
      )}
    </div >
  );
};

export default ProductCard;
