'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Settings,
  Monitor,
  Clock,
  Globe,
  ChevronDown,
  Maximize2,
  Lock,
  DoorOpen,
  Store,
  Plus,
  LogOut,
  User as UserIcon,
  Trash2,
  HelpCircle,
  Shield
} from 'lucide-react';
import { useRouter } from '@/components/RouterPolyfill';
import { ViewType, StoreData, SubscriptionPlan, UserSubscription, StaffRole } from '@/types';
import { getDaysRemaining } from '@/utils';
import { useOnboarding } from './Onboarding/OnboardingContext';

interface NavbarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  stores?: StoreData[];
  currentStore?: StoreData;
  currentPlan?: SubscriptionPlan;
  onStoreChange?: (storeId: string) => void;
  onCreateStore?: (name: string, businessType: string) => void;
  onDeleteStore?: (id: string) => void;
  onLogout?: () => void;
  userEmail?: string;
  userSubscription?: UserSubscription;
  isOnline?: boolean;
  userRole?: StaffRole;
}

const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onViewChange,
  stores,
  currentStore,
  currentPlan,
  onStoreChange,
  onCreateStore,
  onDeleteStore,
  onLogout,
  userEmail,
  userSubscription,
  isOnline = true,
  userRole
}) => {
  const router = useRouter();
  const isSeller = userRole === 'SELLER';
  const [time, setTime] = useState(new Date().toLocaleTimeString('fr-FR'));
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [isCreatingStore, setIsCreatingStore] = useState(false);
  const [creationStep, setCreationStep] = useState<1 | 2>(1);
  const [newStoreType, setNewStoreType] = useState<'shopping' | 'food' | 'stay'>('shopping');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [demoSecondsLeft, setDemoSecondsLeft] = useState<number | null>(null);

  // Live countdown for demo subscriptions
  useEffect(() => {
    if (userSubscription?.duration === 'demo' && userSubscription.status === 'ACTIVE') {
      const updateCountdown = () => {
        const remaining = Math.max(0, Math.ceil((new Date(userSubscription.endDate).getTime() - Date.now()) / 1000));
        setDemoSecondsLeft(remaining);
      };
      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    } else {
      setDemoSecondsLeft(null);
    }
  }, [userSubscription?.duration, userSubscription?.endDate, userSubscription?.status]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('fr-FR', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getViewTitle = () => {
    switch (currentView) {
      case 'dashboard': return 'Tableau de Bord';
      case 'pos': return 'Point de Vente';
      case 'orders': return 'Commandes';
      case 'inventory': return 'Inventaire';
      case 'customers': return 'Clients';
      case 'reports': return 'Historique';
      case 'invoices': return 'Factures';
      case 'settings': return 'Réglages';
      case 'subscription': return 'Abonnement';
      case 'admin': return 'Administration Suprême';
      default: return 'Système PDV';
    }
  };

  const handleBack = () => {
    onViewChange('dashboard');
  };

  const handleSettings = () => {
    onViewChange('settings');
  };

  const { startTour } = useOnboarding();

  return (
    <nav className="h-14 md:h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-3 md:px-8 sticky top-0 z-[100] shadow-sm">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => {
            const target = currentStore?.slug || currentStore?.id;
            if (target) window.open(`/store/${target}`, '_blank');
          }}
          className="flex items-center gap-2 group transition-all"
          title="Voir ma boutique"
        >
          <div className="w-9 h-9 bg-[#f56b2a] rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-100 group-hover:scale-105 transition-transform">
            <Globe size={20} strokeWidth={3} />
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-black text-slate-900 tracking-tighter leading-none">MARKETPLACE</span>
            <span className="text-[9px] font-bold text-[#f56b2a] uppercase tracking-widest leading-none mt-0.5">Voir le site</span>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-2 md:gap-6">
        {/* Desktop: Help Button */}
        <button
          onClick={startTour}
          className="hidden md:flex p-2.5 text-gray-400 hover:text-[#f56b2a] hover:bg-orange-50 rounded-2xl transition-all border border-transparent hover:border-orange-100"
          title="Visite guidée"
        >
          <HelpCircle size={22} />
        </button>

        {stores && stores.length > 0 && currentStore && onStoreChange && (
          (isSeller && stores.length === 1) ? (
            /* SELLER with only 1 store: show store name as static badge */
            <div className="flex items-center gap-2 bg-gray-50 px-2 py-1.5 md:px-4 md:py-2 rounded-2xl border border-gray-200 shadow-sm" id="tour-navbar-store">
              <Store size={18} className="text-[#f56b2a]" />
              <div className="flex flex-col">
                <span className="hidden md:block text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Boutique Active</span>
                <span className="text-xs md:text-sm font-black text-gray-800 tracking-tight truncate max-w-[120px] md:max-w-[200px]">{currentStore?.settings?.name || 'Boutique'}</span>
              </div>
            </div>
          ) : (
            <div className="relative" id="tour-navbar-store">
              <button
                onClick={() => setShowStoreDropdown(!showStoreDropdown)}
                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-[22px] transition-all group"
              >
                <div className="w-8 h-8 md:w-10 md:h-10 bg-orange-50 text-[#f56b2a] rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                  <Store size={18} />
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-[10px] font-black text-[#f56b2a] uppercase tracking-widest leading-none mb-1">Boutique Active</p>
                  <h2 className="text-sm font-black text-gray-900 leading-none truncate max-w-[120px] md:max-w-[200px]">{currentStore?.settings?.name || 'Ma Boutique'}</h2>
                </div>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${showStoreDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showStoreDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowStoreDropdown(false)} />
                  <div className="fixed md:absolute left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0 top-20 md:top-full w-[calc(100%-2rem)] md:w-72 bg-white rounded-[28px] shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-4 px-2 pt-2">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Boutiques ({stores.length}/{currentPlan?.features?.maxStores || 3})</div>
                        <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
                          <Store size={14} className="text-[#f56b2a]" />
                        </div>
                      </div>
                      
                      <div className="space-y-1 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
                        {stores.map(store => (
                          <div key={store.id} className="flex items-center gap-1 group">
                            <button
                              onClick={() => {
                                onStoreChange?.(store.id);
                                setShowStoreDropdown(false);
                              }}
                              className={`flex-grow flex items-center justify-between px-4 py-3.5 rounded-[20px] transition-all ${currentStore.id === store.id ? 'bg-orange-50 text-[#f56b2a]' : 'hover:bg-gray-50 text-gray-700'}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${currentStore.id === store.id ? 'bg-white shadow-sm' : 'bg-gray-100 group-hover:bg-white'}`}>
                                  <Store size={14} />
                                </div>
                                <span className="text-sm font-black tracking-tight truncate">{store.settings?.name || 'Boutique'}</span>
                              </div>
                              {currentStore.id === store.id && <div className="w-2 h-2 rounded-full bg-[#f56b2a] shadow-lg shadow-orange-300" />}
                            </button>
                            
                            {stores.length > 1 && !isSeller && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onDeleteStore) onDeleteStore(store.id);
                                }}
                                className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {stores.length < (currentPlan?.features.maxStores || 0) && !isSeller && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          {isCreatingStore ? (
                        <div className="px-1 space-y-4">
                          {creationStep === 1 ? (
                            <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                              <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Étape 1: Nom</div>
                              <input
                                type="text"
                                className="w-full text-sm font-black px-5 py-4 rounded-[20px] bg-gray-50 border border-transparent outline-none focus:border-[#f56b2a] focus:bg-white transition-all text-gray-900 shadow-inner"
                                placeholder="Ex: Ma Boutique Amazon..."
                                value={newStoreName}
                                onChange={(e) => setNewStoreName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newStoreName.trim()) {
                                    setCreationStep(2);
                                  }
                                }}
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    if (newStoreName.trim()) setCreationStep(2);
                                  }}
                                  disabled={!newStoreName.trim()}
                                  className="flex-1 bg-[#f56b2a] text-white text-xs font-black py-3.5 rounded-[18px] hover:bg-[#d55a20] disabled:opacity-50 shadow-lg shadow-orange-100 transition-all active:scale-95"
                                >
                                  Continuer
                                </button>
                                <button
                                  onClick={() => {
                                    setIsCreatingStore(false);
                                    setNewStoreName('');
                                    setCreationStep(1);
                                  }}
                                  className="flex-1 bg-gray-100 text-gray-600 text-xs font-black py-3.5 rounded-[18px] hover:bg-gray-200 transition-all"
                                >
                                  Annuler
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                              <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Étape 2: Modèle</div>
                              <div className="grid grid-cols-1 gap-2">
                                {[
                                  { id: 'shopping', label: 'AMAZON', desc: 'Produits & E-commerce', icon: <ShoppingBag size={14} />, color: 'orange' },
                                  { id: 'food', label: 'UBEREATS', desc: 'Plats & Restauration', icon: <Clock size={14} />, color: 'yellow' },
                                  { id: 'stay', label: 'AIRBNB', desc: 'Logements & Séjours', icon: <DoorOpen size={14} />, color: 'blue' }
                                ].map(type => (
                                  <button
                                    key={type.id}
                                    onClick={() => {
                                      onCreateStore?.(newStoreName.trim(), type.id);
                                      setNewStoreName('');
                                      setIsCreatingStore(false);
                                      setCreationStep(1);
                                      setShowStoreDropdown(false);
                                    }}
                                    className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all hover:border-[#f56b2a] hover:bg-orange-50 group text-left`}
                                  >
                                    <div className={`w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-600 group-hover:text-[#f56b2a] group-hover:scale-110 transition-all`}>
                                      {type.icon}
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-black text-gray-900 tracking-tight leading-none mb-1">{type.label}</p>
                                      <p className="text-[9px] font-bold text-gray-400 leading-none">{type.desc}</p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => setCreationStep(1)}
                                className="w-full py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-all"
                              >
                                Retour au nom
                              </button>
                            </div>
                          )}
                        </div>
                          ) : (
                            <button
                              onClick={() => setIsCreatingStore(true)}
                              className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-[20px] text-white bg-[#f56b2a] font-black text-sm shadow-xl shadow-orange-100 hover:bg-[#d55a20] transition-all active:scale-[0.98]"
                            >
                              <Plus size={18} />
                              Nouveau Magasin
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        )}

        {!isSeller && (
          <button
            onClick={() => onViewChange('subscription')}
            className={`flex items-center gap-2 px-2 py-1.5 md:px-4 md:py-2 rounded-2xl border shadow-sm hover:bg-orange-100 transition-all active:scale-95 ${
              (demoSecondsLeft !== null && demoSecondsLeft <= 10) || demoSecondsLeft === 0
                ? 'text-red-500 bg-red-50 border-red-200 animate-pulse' 
                : 'text-[#f56b2a] bg-orange-50 border-orange-100'
            }`}
            title="Gérer l'abonnement"
          >
            <Clock size={16} />
            <span className="text-[9px] md:text-[11px] font-black uppercase tracking-wider">
              {userSubscription ? (
                demoSecondsLeft !== null 
                  ? (demoSecondsLeft <= 0 ? 'Expiré' : `${demoSecondsLeft}s`)
                  : userSubscription.tier === 'BASIC' 
                    ? 'Gratuit' 
                    : `${getDaysRemaining(userSubscription.endDate)}J restants`
              ) : '...'}
            </span>
          </button>
        )}

        <div className="flex items-center gap-4 md:gap-2 md:pl-6 md:border-l border-gray-100 relative">
          <button 
            onClick={() => {
              const target = currentStore?.slug || currentStore?.id;
              if (target) window.open(`/store/${target}`, '_blank');
            }}
            className="md:hidden w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 active:scale-90 transition-all"
            title="Voir la boutique"
          >
            <Globe size={20} />
          </button>

          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="w-8 h-8 md:w-12 md:h-12 rounded-2xl overflow-hidden border-2 border-white shadow-xl cursor-pointer hover:scale-105 transition-all active:scale-95 bg-white flex items-center justify-center group"
          >
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userEmail || 'Jacques'}`} alt="Avatar" className="w-full h-full object-cover" />
          </button>

          {showProfileDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfileDropdown(false)} />
              <div className="fixed md:absolute left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0 top-20 md:top-full w-[calc(100%-2rem)] md:w-64 bg-white rounded-[28px] shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="p-6 border-b border-gray-50 bg-gray-50/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white shadow-md">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userEmail || 'Jacques'}`} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-gray-900 leading-none truncate max-w-[120px]">{userEmail?.split('@')[0]}</span>
                      <span className={`text-[10px] font-bold mt-1 uppercase tracking-tight flex items-center gap-1.5 ${isOnline ? 'text-green-600' : 'text-red-500'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                        {isOnline ? 'En ligne' : 'Hors-ligne'}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 opacity-60">Abonnement Actif</div>
                  <div className="text-xs font-black text-[#f56b2a] flex items-center gap-1.5">
                    <Maximize2 size={12} />
                    {userSubscription?.tier === 'BASIC' ? 'Formule Gratuite' : `${currentPlan?.name}`}
                  </div>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => {
                      onViewChange('dashboard');
                      setShowProfileDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-gray-600 hover:bg-gray-50 transition-all text-sm font-bold"
                  >
                    <Monitor size={18} className="text-gray-400" />
                    Tableau de bord
                  </button>
                  {!isSeller && (
                    <button
                      onClick={() => {
                        onViewChange('settings');
                        setShowProfileDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-gray-600 hover:bg-gray-50 transition-all text-sm font-bold"
                    >
                      <UserIcon size={18} className="text-gray-400" />
                      Modifier le Profil
                    </button>
                  )}
                  {userRole === 'SUPER_ADMIN' && (
                    <button
                      onClick={() => {
                        onViewChange('admin');
                        setShowProfileDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-all text-sm font-black"
                    >
                      <Shield size={18} className="text-indigo-600" />
                      Administration
                    </button>
                  )}
                  <div className="h-px bg-gray-100 my-2 mx-2" />
                  <button
                    onClick={() => {
                      if (onLogout) onLogout();
                      setShowProfileDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-red-500 hover:bg-red-50 transition-all text-sm font-black"
                  >
                    <LogOut size={18} />
                    Déconnexion
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

