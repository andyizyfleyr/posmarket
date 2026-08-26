'use client';

import React, { useState } from 'react';
import {
  ShoppingBasket,
  Package,
  Users,
  BarChart3,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  FileText,
  MoreHorizontal,
  Receipt
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
    aria-label={label}
    aria-current={active ? 'page' : undefined}
    className={`relative flex flex-col items-center justify-center flex-1 min-h-[52px] py-1.5 transition-all duration-200 ${
      active ? 'text-[#f56b2a]' : 'text-gray-400 active:text-gray-600'
    }`}
  >
    <div className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 ${
      active ? 'scale-110' : 'scale-100 active:scale-95'
    }`}>
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, {
        size: 20,
        strokeWidth: active ? 2.5 : 1.8
      }) : icon}
    </div>
    <span className={`text-[9px] mt-0.5 font-bold transition-all duration-200 ${
      active ? 'opacity-100 font-black' : 'opacity-60'
    }`}>{label}</span>
    {/* Active indicator pill */}
    {active && (
      <div className="nav-active-pill absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-[3px] bg-[#f56b2a] rounded-full shadow-[0_2px_8px_rgba(245,107,42,0.4)]" />
    )}
  </button>
);

interface OverflowMenuProps {
  items: { icon: React.ReactNode; label: string; view: ViewType; id?: string }[];
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onClose: () => void;
}

const OverflowMenu: React.FC<OverflowMenuProps> = ({ items, currentView, onViewChange, onClose }) => (
  <>
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={onClose} />
    <div className="fixed bottom-[72px] right-4 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-slide-up min-w-[180px]">
      {items.map(item => (
        <button
          key={item.view}
          onClick={() => { onViewChange(item.view); onClose(); }}
          className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
            currentView === item.view
              ? 'bg-orange-50 text-[#f56b2a]'
              : 'text-gray-600 active:bg-gray-50'
          }`}
        >
          {item.icon}
          <span className="text-sm font-bold">{item.label}</span>
        </button>
      ))}
    </div>
  </>
);

interface BottomNavProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  userRole?: StaffRole;
  businessType?: string;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentView, onViewChange, userRole, businessType }) => {
  const isSeller = userRole === 'SELLER';
  const [showOverflow, setShowOverflow] = useState(false);

  // Primary items (always visible, max 5)
  const primaryItems: { id?: string; icon: React.ReactNode; label: string; view: ViewType }[] = [
    { id: 'tour-mobile-dashboard', icon: <LayoutDashboard />, label: 'Accueil', view: 'dashboard' },
    { id: 'tour-mobile-pos', icon: <ShoppingBasket />, label: 'Vente', view: 'pos' },
    { icon: <ShoppingBag />, label: 'Commandes', view: 'orders' },
    { id: 'tour-mobile-inventory', icon: <Package />, label: 'Stocks', view: 'inventory' },
    { icon: <Users />, label: 'Clients', view: 'customers' },
  ];

  // Overflow items (hidden behind "More" button)
  const overflowItems: { id?: string; icon: React.ReactNode; label: string; view: ViewType }[] = [];
  if (!isSeller) {
    overflowItems.push({ icon: <BarChart3 size={18} />, label: 'Rapports', view: 'reports' });
  }

  // If there are overflow items and we'd have 6+ total, show max 4 primary + More
  const showOverflowButton = overflowItems.length > 0;
  const visiblePrimary = showOverflowButton ? primaryItems.slice(0, 4) : primaryItems;

  // Check if current view is in overflow
  const isOverflowActive = overflowItems.some(item => item.view === currentView);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-gray-100 pb-safe"
      role="navigation"
      aria-label="Navigation principale"
    >
      <div className="flex items-center justify-around px-1">
        {visiblePrimary.map(item => (
          <BottomNavItem
            key={item.view}
            id={item.id}
            icon={item.icon}
            label={item.label}
            active={currentView === item.view}
            onClick={() => onViewChange(item.view)}
          />
        ))}
        {showOverflowButton && (
          <button
            onClick={() => setShowOverflow(!showOverflow)}
            aria-label="Plus d'options"
            aria-expanded={showOverflow}
            className={`relative flex flex-col items-center justify-center flex-1 min-h-[52px] py-1.5 transition-all duration-200 ${
              isOverflowActive ? 'text-[#f56b2a]' : 'text-gray-400 active:text-gray-600'
            }`}
          >
            <div className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 active:scale-95 ${
              showOverflow ? 'bg-orange-50 scale-110' : ''
            }`}>
              <MoreHorizontal size={20} strokeWidth={isOverflowActive ? 2.5 : 1.8} />
            </div>
            <span className={`text-[9px] mt-0.5 font-bold transition-all ${
              isOverflowActive ? 'opacity-100 font-black' : 'opacity-60'
            }`}>Plus</span>
            {isOverflowActive && (
              <div className="nav-active-pill absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-[3px] bg-[#f56b2a] rounded-full shadow-[0_2px_8px_rgba(245,107,42,0.4)]" />
            )}
          </button>
        )}
      </div>

      {showOverflow && (
        <OverflowMenu
          items={overflowItems}
          currentView={currentView}
          onViewChange={onViewChange}
          onClose={() => setShowOverflow(false)}
        />
      )}
    </nav>
  );
};

export default BottomNav;
