'use client';

import React from 'react';
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
  
  const pathname = location.pathname;
  const isHome = pathname === '/' || pathname === '' || pathname === 'storefront';
  const isCart = pathname === '/cart';

  const handleRefresh = () => {
    if (loading) return;
    if (onRefresh) {
      onRefresh();
    } else {
      window.location.reload();
    }
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[1000] bg-white border-t border-gray-100 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-10_30px_rgba(0,0,0,0.05)]">
      <div className="h-[64px] flex items-center justify-around px-4">
        
        {/* Accueil */}
        <button
          onClick={() => {
            if (onHomeClick && !loading) onHomeClick();
          }}
          disabled={loading}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-all ${isHome ? 'text-[#f56b2a]' : 'text-gray-400'} ${loading ? 'opacity-50' : ''}`}
          aria-label="Accueil"
        >
          <Home size={22} strokeWidth={isHome ? 2.5 : 2} className={loading && isHome ? 'animate-pulse' : ''} />
          <span className={`text-[9px] mt-1 font-bold tracking-tight ${isHome ? 'text-[#f56b2a]' : 'text-gray-400'}`}>Accueil</span>
        </button>

        {/* Rechercher */}
        <button
          onClick={() => !loading && onSearchClick()}
          disabled={loading}
          className={`flex flex-col items-center justify-center flex-1 h-full text-gray-400 active:text-[#f56b2a] transition-all ${loading ? 'opacity-50' : ''}`}
          aria-label="Recherche"
        >
          <Search size={22} strokeWidth={2} className={loading ? 'animate-pulse' : ''} />
          <span className="text-[9px] mt-1 font-bold tracking-tight">Recherche</span>
        </button>

        {/* Refresh - au centre (Mobile only) */}
        <button
          onClick={handleRefresh}
          disabled={loading}
          className={`md:hidden flex flex-col items-center justify-center flex-1 h-full text-gray-400 active:text-[#f56b2a] transition-all ${loading ? 'opacity-50' : ''}`}
          aria-label="Actualiser"
        >
          <RotateCcw size={22} strokeWidth={2} className={loading ? 'animate-spin' : ''} />
          <span className="text-[9px] mt-1 font-bold tracking-tight">Actualiser</span>
        </button>

        {/* Panier */}
        <button
          onClick={() => {
            if (onCartClick && !loading) onCartClick();
          }}
          disabled={loading}
          className={`flex flex-col items-center justify-center flex-1 h-full relative ${isCart ? 'text-[#f56b2a]' : 'text-gray-400'} ${loading ? 'opacity-50' : ''}`}
          aria-label="Panier"
        >
          <div className="relative">
             <ShoppingBag size={22} strokeWidth={isCart ? 2.5 : 2} className={loading && isCart ? 'animate-pulse' : ''} />
             {cartItemsCount > 0 && (
               <span className="absolute -top-1.5 -right-1.5 bg-[#f56b2a] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">
                 {cartItemsCount}
               </span>
             )}
          </div>
          <span className="text-[9px] mt-1 font-bold tracking-tight">Panier</span>
        </button>

        {/* Compte */}
        <button
          onClick={() => !loading && onAccountClick()}
          disabled={loading}
          className={`flex flex-col items-center justify-center flex-1 h-full text-gray-400 active:text-[#f56b2a] transition-all ${loading ? 'opacity-50' : ''}`}
          aria-label="Compte"
        >
          <User size={22} strokeWidth={2} className={loading ? 'animate-pulse' : ''} />
          <span className="text-[9px] mt-1 font-bold tracking-tight">Compte</span>
        </button>

      </div>
    </nav>
  );
};
