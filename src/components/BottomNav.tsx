'use client';

import React from 'react';
import {
  ShoppingBasket,
  Package,
  Users,
  BarChart3,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  FileText
} from 'lucide-react';
import { ViewType, StaffRole } from '@/types';

interface BottomNavItemProps {
  id?: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}

const BottomNavItem: React.FC<BottomNavItemProps> = ({ id, icon, label, active = false, onClick }) => (
  <button
    id={id}
    onClick={onClick}
    className={`flex flex-col items-center justify-center flex-1 py-1 transition-all relative ${active ? 'text-[#f56b2a]' : 'text-gray-400'
      }`}
  >
    <div className={`p-1 rounded-xl transition-all ${active ? 'bg-orange-50 scale-110' : 'scale-100'}`}>
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { 
        size: 18, 
        strokeWidth: active ? 2.5 : 2 
      }) : icon}
    </div>
    <span className={`text-[8px] mt-0.5 font-black uppercase tracking-tighter ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
    {active && (
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#f56b2a] rounded-full shadow-lg shadow-orange-300" />
    )}
  </button>
);

interface BottomNavProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  userRole?: StaffRole;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentView, onViewChange, userRole }) => {
  const isSeller = userRole === 'SELLER';
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 flex items-center justify-around z-50 pb-safe pt-1 rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.08)] px-1">
      <BottomNavItem
        id="tour-mobile-dashboard"
        icon={<LayoutDashboard size={20} />}
        label="Accueil"
        active={currentView === 'dashboard'}
        onClick={() => onViewChange('dashboard')}
      />
      <BottomNavItem
        id="tour-mobile-pos"
        icon={<ShoppingBasket size={20} />}
        label="Vente"
        active={currentView === 'pos'}
        onClick={() => onViewChange('pos')}
      />
      <BottomNavItem
        icon={<ShoppingBag size={20} />}
        label="Commandes"
        active={currentView === 'orders'}
        onClick={() => onViewChange('orders')}
      />
      <BottomNavItem
        id="tour-mobile-inventory"
        icon={<Package size={20} />}
        label="Stocks"
        active={currentView === 'inventory'}
        onClick={() => onViewChange('inventory')}
      />
      <BottomNavItem
        icon={<Users size={20} />}
        label="Clients"
        active={currentView === 'customers'}
        onClick={() => onViewChange('customers')}
      />
      {!isSeller && (
        <BottomNavItem
          icon={<BarChart3 size={20} />}
          label="Rapports"
          active={currentView === 'reports'}
          onClick={() => onViewChange('reports')}
        />
      )}
    </nav>
  );
};

export default BottomNav;

