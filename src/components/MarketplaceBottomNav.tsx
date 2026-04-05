'use client';

import React from 'react';
import { Home, Search } from 'lucide-react';
import { useLocation, useNavigate } from '@/components/RouterPolyfill';

interface MarketplaceBottomNavProps {
  cartItemsCount: number;
  onSearchClick: () => void;
  onHomeClick?: () => void;
}

export const MarketplaceBottomNav: React.FC<MarketplaceBottomNavProps> = ({ 
  cartItemsCount, 
  onSearchClick,
  onHomeClick
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const pathname = location.pathname;
  const isHome = pathname === '/' || pathname === '' || pathname === 'storefront';

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[200] bg-white border-t border-gray-100 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
      <div className="h-[64px] flex items-center justify-around px-6">
        
        {/* Accueil */}
        <button
          onClick={() => {
            if (onHomeClick) onHomeClick();
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-all ${isHome ? 'text-[#f56b2a]' : 'text-gray-400'}`}
        >
          <Home size={24} strokeWidth={isHome ? 2.5 : 2} />
          <span className={`text-[10px] mt-1 font-bold tracking-tight ${isHome ? 'text-[#f56b2a]' : 'text-gray-400'}`}>Accueil</span>
        </button>

        {/* Rechercher */}
        <button
          onClick={onSearchClick}
          className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 active:text-[#f56b2a] transition-all"
        >
          <Search size={24} strokeWidth={2} />
          <span className="text-[10px] mt-1 font-bold tracking-tight">Recherche</span>
        </button>

      </div>
    </nav>
  );
};
