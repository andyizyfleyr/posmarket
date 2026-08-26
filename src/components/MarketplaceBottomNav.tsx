'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Home, Search, ShoppingBag, User, RotateCcw } from 'lucide-react';
import { useLocation } from '@/components/RouterPolyfill';

interface MarketplaceBottomNavProps {
  cartItemsCount: number;
  onSearchClick: () => void;
  onHomeClick?: () => void;
  onCartClick?: () => void;
  onAccountClick: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}

export const MarketplaceBottomNav: React.FC<MarketplaceBottomNavProps> = ({
  cartItemsCount,
  onSearchClick,
  onHomeClick,
  onCartClick,
  onAccountClick,
  onRefresh,
  loading = false
}) => {
  const location = useLocation();
  const prevCartCount = useRef(cartItemsCount);
  const [badgeAnimating, setBadgeAnimating] = useState(false);

  const pathname = location.pathname;
  const isHome = pathname === '/' || pathname === '' || pathname === 'storefront';
  const isCart = pathname === '/cart';

  // Animate badge when count changes
  useEffect(() => {
    if (cartItemsCount !== prevCartCount.current && cartItemsCount > 0) {
      setBadgeAnimating(true);
      const timer = setTimeout(() => setBadgeAnimating(false), 300);
      prevCartCount.current = cartItemsCount;
      return () => clearTimeout(timer);
    }
    prevCartCount.current = cartItemsCount;
  }, [cartItemsCount]);

  const handleRefresh = () => {
    if (loading) return;
    if (onRefresh) {
      onRefresh();
    } else {
      window.location.reload();
    }
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-[900] bg-white/95 backdrop-blur-xl border-t border-gray-100 pb-safe"
      role="navigation"
      aria-label="Navigation marketplace"
    >
      <div className="h-[60px] flex items-center justify-around px-2">

        {/* Accueil */}
        <button
          onClick={() => {
            if (onHomeClick && !loading) onHomeClick();
          }}
          disabled={loading}
          aria-label="Accueil"
          aria-current={isHome ? 'page' : undefined}
          className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 ${
            isHome ? 'text-[#f56b2a]' : 'text-gray-400 active:text-gray-600'
          } ${loading ? 'opacity-50' : ''}`}
        >
          <div className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 ${
            isHome ? 'scale-110' : 'active:scale-95'
          }`}>
            <Home size={20} strokeWidth={isHome ? 2.5 : 1.8} className={loading && isHome ? 'animate-pulse' : ''} />
          </div>
          <span className={`text-[9px] mt-0.5 font-bold transition-all ${isHome ? 'font-black' : 'opacity-60'}`}>Accueil</span>
          {isHome && (
            <div className="nav-active-pill absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-[3px] bg-[#f56b2a] rounded-full shadow-[0_2px_8px_rgba(245,107,42,0.4)]" />
          )}
        </button>

        {/* Rechercher */}
        <button
          onClick={() => !loading && onSearchClick()}
          disabled={loading}
          aria-label="Recherche"
          className="relative flex flex-col items-center justify-center flex-1 h-full text-gray-400 active:text-gray-600 transition-all duration-200"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-xl active:scale-95 transition-all">
            <Search size={20} strokeWidth={1.8} className={loading ? 'animate-pulse' : ''} />
          </div>
          <span className="text-[9px] mt-0.5 font-bold opacity-60">Recherche</span>
        </button>

        {/* Refresh - au centre */}
        <button
          onClick={handleRefresh}
          disabled={loading}
          aria-label="Actualiser"
          className="relative flex flex-col items-center justify-center flex-1 h-full text-gray-400 active:text-gray-600 transition-all duration-200"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-xl active:scale-95 transition-all">
            <RotateCcw size={20} strokeWidth={1.8} className={loading ? 'animate-spin' : ''} />
          </div>
          <span className="text-[9px] mt-0.5 font-bold opacity-60">Actualiser</span>
        </button>

        {/* Panier */}
        <button
          onClick={() => {
            if (onCartClick && !loading) onCartClick();
          }}
          disabled={loading}
          aria-label={`Panier${cartItemsCount > 0 ? `, ${cartItemsCount} articles` : ''}`}
          aria-current={isCart ? 'page' : undefined}
          className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 ${
            isCart ? 'text-[#f56b2a]' : 'text-gray-400 active:text-gray-600'
          } ${loading ? 'opacity-50' : ''}`}
        >
          <div className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 ${
            isCart ? 'scale-110' : 'active:scale-95'
          }`}>
            <ShoppingBag size={20} strokeWidth={isCart ? 2.5 : 1.8} className={loading && isCart ? 'animate-pulse' : ''} />
            {cartItemsCount > 0 && (
              <span className={`absolute -top-1 -right-1 bg-[#f56b2a] text-white text-[8px] font-black min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center ring-2 ring-white ${
                badgeAnimating ? 'badge-pop' : ''
              }`}>
                {cartItemsCount > 99 ? '99+' : cartItemsCount}
              </span>
            )}
          </div>
          <span className={`text-[9px] mt-0.5 font-bold transition-all ${isCart ? 'font-black' : 'opacity-60'}`}>Panier</span>
          {isCart && (
            <div className="nav-active-pill absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-[3px] bg-[#f56b2a] rounded-full shadow-[0_2px_8px_rgba(245,107,42,0.4)]" />
          )}
        </button>

        {/* Compte */}
        <button
          onClick={() => !loading && onAccountClick()}
          disabled={loading}
          aria-label="Compte"
          className="relative flex flex-col items-center justify-center flex-1 h-full text-gray-400 active:text-gray-600 transition-all duration-200"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-xl active:scale-95 transition-all">
            <User size={20} strokeWidth={1.8} className={loading ? 'animate-pulse' : ''} />
          </div>
          <span className="text-[9px] mt-0.5 font-bold opacity-60">Compte</span>
        </button>

      </div>
    </nav>
  );
};
