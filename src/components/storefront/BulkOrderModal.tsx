'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { X, Zap, ShoppingCart, Search, Package, Minus, Plus, Check, AlertCircle } from 'lucide-react';
import { Product, WholesaleTier } from '@/types';
import { formatCurrency } from '@/utils';
import ProductImage from '@/components/ProductImage';
import Button from '@/components/Button';

interface BulkOrderItem {
  product: Product & { storeId: string; storeName: string; storeSlug?: string };
  quantity: number;
}

interface BulkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Array<Product & { storeId: string; storeName: string; storeSlug?: string }>;
  onAddToCart: (items: BulkOrderItem[]) => void;
  formatCurrency: (amount: number) => string;
}

import { getNormalizedWholesaleTiers, getEffectiveWholesaleUnitPrice } from '@/utils/wholesale';

function getWholesaleInfo(product: Product): {
  hasWholesale: boolean;
  tiers: Array<{
    minQty: number;
    packagePrice: number;
    unitPrice: number;
    savings: number;
    discountPct: number;
  }>;
  minQty: number;
  bestPrice: number;
} {
  const tiers = getNormalizedWholesaleTiers(product);
  if (tiers.length === 0) {
    return { hasWholesale: false, tiers: [], minQty: 0, bestPrice: product.price };
  }

  const minQty = tiers[0].minQty;
  const bestPrice = Math.min(...tiers.map((t) => t.unitPrice));

  return { hasWholesale: true, tiers, minQty, bestPrice };
}

function getEffectivePrice(product: Product, quantity: number): number {
  return getEffectiveWholesaleUnitPrice(product, quantity);
}

export function BulkOrderModal({
  isOpen,
  onClose,
  products,
  onAddToCart,
}: BulkOrderModalProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const wholesaleProducts = useMemo(
    () => products.filter((p) => {
      const { hasWholesale } = getWholesaleInfo(p);
      return hasWholesale && p.isOnline !== false && p.stock > 0;
    }),
    [products],
  );

  const filteredProducts = useMemo(() => {
    if (!searchFilter) return wholesaleProducts;
    const q = searchFilter.toLowerCase();
    return wholesaleProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.storeName.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q),
    );
  }, [wholesaleProducts, searchFilter]);

  const selectedItems = useMemo(() => {
    return Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const product = wholesaleProducts.find((p) => p.id === id);
        return product ? { product, quantity: qty } : null;
      })
      .filter(Boolean) as BulkOrderItem[];
  }, [quantities, wholesaleProducts]);

  const totalAmount = useMemo(() => {
    return selectedItems.reduce(
      (sum, item) => sum + getEffectivePrice(item.product, item.quantity) * item.quantity,
      0,
    );
  }, [selectedItems]);

  const totalSavings = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      const normalPrice = item.product.price * item.quantity;
      const effectiveTotal = getEffectivePrice(item.product, item.quantity) * item.quantity;
      return sum + Math.max(0, normalPrice - effectiveTotal);
    }, 0);
  }, [selectedItems]);

  const totalItems = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  const updateQty = useCallback((productId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: next };
    });
  }, []);

  const setQty = useCallback((productId: string, value: number) => {
    setQuantities((prev) => {
      if (value <= 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: value };
    });
  }, []);

  const handleSubmit = useCallback(() => {
    if (selectedItems.length === 0) return;
    onAddToCart(selectedItems);
    setQuantities({});
    onClose();
  }, [selectedItems, onAddToCart, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full md:max-w-2xl md:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f56b2a] to-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
                <Package size={18} />
              </div>
              <div>
                <h2 className="text-sm font-black text-gray-900">Commande Rapide Grossiste</h2>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                  {wholesaleProducts.length} produit{wholesaleProducts.length > 1 ? 's' : ''} éligibles
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 active:scale-95 transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:border-[#f56b2a]/30 transition-all"
            />
          </div>
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-2">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                <Package size={24} className="text-gray-300" />
              </div>
              <p className="text-xs font-black text-gray-500">Aucun produit trouvé</p>
              <p className="text-[9px] font-bold text-gray-400 mt-1">
                {searchFilter ? 'Essayez un autre terme' : 'Aucun produit en vente en gros disponible'}
              </p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const qty = quantities[product.id] || 0;
              const info = getWholesaleInfo(product);
              const effectivePrice = getEffectivePrice(product, qty);
              const activeTier = qty > 0 ? info.tiers.filter((t) => qty >= t.minQty).sort((a, b) => b.minQty - a.minQty)[0] : null;
              const nextTier = info.tiers.find((t) => qty < t.minQty);
              const savings = qty > 0 ? (product.price - effectivePrice) * qty : 0;

              return (
                <div
                  key={product.id}
                  className={`rounded-2xl border p-3 transition-all ${
                    qty > 0
                      ? 'border-[#f56b2a]/30 bg-orange-50/30 shadow-sm'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Image */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gray-50 border border-gray-100">
                      <ProductImage
                        src={product.image}
                        alt={product.name}
                        containerClassName="w-full h-full"
                        objectFit="cover"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-[10px] font-black text-gray-900 leading-tight truncate">
                            {product.name}
                          </h4>
                          <p className="text-[8px] font-bold text-gray-400 truncate mt-0.5">
                            {product.storeName} · Stock: {product.stock}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-[10px] font-black text-gray-900">
                            {formatCurrency(product.price)}
                          </div>
                          {activeTier && (
                            <div className="text-[9px] font-black text-green-600">
                              → {formatCurrency(effectivePrice)} / u
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Tiers display */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {info.tiers.map((tier, i) => (
                          <button
                            key={i}
                            onClick={() => setQty(product.id, tier.minQty)}
                            className={`text-[8px] font-black px-2 py-0.5 rounded-full border transition-all active:scale-95 ${
                              activeTier && activeTier.minQty === tier.minQty
                                ? 'bg-[#f56b2a] text-white border-[#f56b2a] shadow-sm'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-[#f56b2a] hover:text-[#f56b2a]'
                            }`}
                          >
                            {tier.minQty}+ → {formatCurrency(tier.packagePrice)} ({formatCurrency(tier.unitPrice)}/u)
                          </button>
                        ))}
                      </div>

                      {/* Quantity control */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateQty(product.id, -1)}
                            disabled={qty === 0}
                            className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-30"
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            value={qty || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setQty(product.id, Math.min(val, product.stock));
                            }}
                            placeholder="0"
                            className="w-14 h-7 text-center text-xs font-black text-gray-900 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:border-[#f56b2a]/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => updateQty(product.id, 1)}
                            disabled={qty >= product.stock}
                            className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-30"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        {qty > 0 && (
                          <div className="text-right">
                            <span className="text-[10px] font-black text-gray-900">
                              {formatCurrency(effectivePrice * qty)}
                            </span>
                            {savings > 0 && (
                              <span className="text-[8px] font-black text-green-600 ml-1">
                                -{formatCurrency(savings)}
                              </span>
                            )}
                          </div>
                        )}

                        {qty > 0 && nextTier && (
                          <div className="hidden md:block text-[8px] font-bold text-[#f56b2a] bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                            +{nextTier.minQty - qty} pour {formatCurrency(nextTier.unitPrice)}/u
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer - Summary & Action */}
        <div
          className="flex-shrink-0 border-t border-gray-100 bg-white px-4 pt-3"
          style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
        >
          {selectedItems.length > 0 && (
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                  {totalItems} article{totalItems > 1 ? 's' : ''} sélectionné{totalItems > 1 ? 's' : ''}
                </span>
                {totalSavings > 0 && (
                  <span className="ml-2 text-[9px] font-black text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-100">
                    Économie: {formatCurrency(totalSavings)}
                  </span>
                )}
              </div>
              <span className="text-sm font-black text-gray-900">{formatCurrency(totalAmount)}</span>
            </div>
          )}
          <Button
            onClick={handleSubmit}
            disabled={selectedItems.length === 0}
            fullWidth
            size="lg"
            className="!rounded-xl"
            icon={<ShoppingCart size={16} />}
          >
            {selectedItems.length === 0
              ? 'Sélectionnez des produits'
              : `Ajouter ${totalItems} article${totalItems > 1 ? 's' : ''} au panier`}
          </Button>
        </div>
      </div>
    </div>
  );
}
