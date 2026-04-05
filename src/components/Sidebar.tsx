'use client';

import React from 'react';
import {
  ShoppingBasket,
  Package,
  Users,
  BarChart3,
  Settings,
  HelpCircle,
  LogOut,
  LayoutDashboard,
  FileText,
  CreditCard,
  ShoppingBag,
  Gift,
  Shield,
  Globe,
  TrendingUp,
  Store,
  Wallet,
  Activity
} from 'lucide-react';
import { ViewType, StaffRole } from '@/types';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps & { id?: string }> = ({ icon, label, active = false, onClick, id }) => (
  <div
    id={id}
    onClick={onClick}
    className={`flex flex-col items-center justify-center py-4 px-2 cursor-pointer transition-all relative group ${active ? 'text-white bg-[#f56b2a]/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
  >
    {active && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-[#f56b2a] rounded-r-md" />}
    <div className="mb-1">{icon}</div>
    <span className="text-[10px] font-bold uppercase tracking-tighter text-center">{label}</span>

    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl border border-slate-700">
      {label}
    </div>
  </div>
);

interface SidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onLogout?: () => void;
  userRole?: StaffRole;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, onLogout, userRole }) => {
  const isSeller = userRole === 'SELLER';
  const isAdminView = (currentView as string) === 'admin';

  return (
    <aside className={`w-20 flex flex-col items-stretch border-r z-40 hidden md:flex transition-all duration-500 ${isAdminView ? 'bg-[#0a0a0c] border-[#f56b2a]/20' : 'bg-slate-900 border-slate-800'}`}>
      <div className="flex-grow flex flex-col pt-4">
        {currentView !== 'admin' && (
          <>
            <SidebarItem
              id="tour-sidebar-dashboard"
              icon={<LayoutDashboard size={22} />}
              label="Accueil"
              active={currentView === 'dashboard'}
              onClick={() => onViewChange('dashboard')}
            />
            <SidebarItem
              id="tour-sidebar-pos"
              icon={<ShoppingBasket size={22} />}
              label="Vente"
              active={currentView === 'pos'}
              onClick={() => onViewChange('pos')}
            />
            <SidebarItem
              id="tour-sidebar-orders"
              icon={<ShoppingBag size={22} />}
              label="Commandes"
              active={currentView === 'orders'}
              onClick={() => onViewChange('orders')}
            />
            <SidebarItem
              id="tour-sidebar-inventory"
              icon={<Package size={22} />}
              label="Stocks"
              active={currentView === 'inventory'}
              onClick={() => onViewChange('inventory')}
            />
            <SidebarItem
              id="tour-sidebar-customers"
              icon={<Users size={22} />}
              label="Clients"
              active={currentView === 'customers'}
              onClick={() => onViewChange('customers')}
            />
            {!isSeller && (
              <SidebarItem
                id="tour-sidebar-reports"
                icon={<BarChart3 size={22} />}
                label="Rapports"
                active={currentView === 'reports'}
                onClick={() => onViewChange('reports')}
              />
            )}
            {!isSeller && (
              <SidebarItem
                id="tour-sidebar-subscription"
                icon={<CreditCard size={22} />}
                label="Abonnement"
                active={currentView === 'subscription'}
                onClick={() => onViewChange('subscription')}
              />
            )}
          </>
        )}

        {/* SUPREME ADMIN SIDEBAR - Specialized Modules */}
        {isAdminView && (
          <div className="flex flex-col animate-in slide-in-from-left duration-500">
             <div className="flex justify-center mb-6 px-2">
                <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-900/40 border border-orange-400/20">
                   <Shield size={24} />
                </div>
             </div>
             
             <SidebarItem
                icon={<Activity size={22} className="text-orange-500" />}
                label="Surveillance"
                onClick={() => window.dispatchEvent(new CustomEvent('setAdminTab', { detail: 'dashboard' }))}
             />
             <SidebarItem
                icon={<Store size={22} className="text-orange-500" />}
                label="Boutiques"
                onClick={() => window.dispatchEvent(new CustomEvent('setAdminTab', { detail: 'stores' }))}
             />
             <SidebarItem
                icon={<Users size={22} className="text-orange-500" />}
                label="Utilisateurs"
                onClick={() => window.dispatchEvent(new CustomEvent('setAdminTab', { detail: 'users' }))}
             />
             <SidebarItem
                icon={<Wallet size={22} className="text-orange-500" />}
                label="Transactions"
                onClick={() => window.dispatchEvent(new CustomEvent('setAdminTab', { detail: 'orders' }))}
             />
             <SidebarItem
                icon={<Settings size={22} className="text-orange-500" />}
                label="Paramètres"
                onClick={() => window.dispatchEvent(new CustomEvent('setAdminTab', { detail: 'system' }))}
             />
          </div>
        )}
      </div>

      <div className="pb-4 flex flex-col gap-2">
        {isAdminView && (
           <SidebarItem
             icon={<LayoutDashboard size={22} className="text-gray-500" />}
             label="Quitter"
             onClick={() => onViewChange('dashboard')}
           />
        )}
        
        {!isAdminView && !isSeller && (
          <SidebarItem
            id="tour-sidebar-settings"
            icon={<Settings size={22} />}
            label="Réglages"
            active={currentView === 'settings'}
            onClick={() => onViewChange('settings')}
          />
        )}
        
        {userRole === 'SUPER_ADMIN' && !isAdminView && (
          <SidebarItem
            id="tour-sidebar-admin"
            icon={<Shield size={22} className="text-[#f56b2a]" />}
            label="Admin"
            active={(currentView as string) === 'admin'}
            onClick={() => onViewChange('admin')}
          />
        )}

        {onLogout && (
          <SidebarItem
            icon={<LogOut size={22} className="text-red-400" />}
            label="Sortir"
            onClick={onLogout}
          />
        )}
      </div>
    </aside>
  );
};

export default Sidebar;

