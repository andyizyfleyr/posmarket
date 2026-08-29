'use client';

import React, { useState } from 'react';
import { useNavigate } from '@/components/RouterPolyfill';
import { useRouter as useNextRouter } from 'next/navigation';
import {
  ArrowLeft,
  RefreshCcw,
  Package,
  MapPin,
  Star,
  User,
  LogOut,
  AlertTriangle,
} from 'lucide-react';
import { useBuyerData } from '@/components/buyer/useBuyerData';
import { OrdersTab, ReviewTargetProduct } from '@/components/buyer/OrdersTab';
import { AddressesTab } from '@/components/buyer/AddressesTab';
import { ReviewsTab } from '@/components/buyer/ReviewsTab';
import { ProfileTab } from '@/components/buyer/ProfileTab';
import { AddressModal } from '@/components/buyer/AddressModal';
import { ReviewModal } from '@/components/buyer/ReviewModal';
import { Modal } from '@/components/buyer/Modal';
import {
  BuyerAddress,
  BuyerTabId,
  NotifyFn,
} from '@/components/buyer/accountTypes';
import { PanelSkeleton } from '@/components/buyer/accountUtils';

interface BuyerViewProps {
  user: { id?: string; name: string; email: string };
  accountTab?: string;
  onBack: () => void;
  notify?: NotifyFn;
  onLogout: () => void;
  onUserUpdate: (updates: { name: string }) => void;
}

const TABS: Array<{
  id: BuyerTabId;
  path: string;
  label: string;
  desc: string;
  icon: React.ElementType;
}> = [
  { id: 'orders', path: 'commandes', label: 'Commandes', desc: 'Historique et suivi de vos achats', icon: Package },
  { id: 'addresses', path: 'adresses', label: 'Adresses', desc: 'Vos adresses de livraison', icon: MapPin },
  { id: 'reviews', path: 'avis', label: 'Avis', desc: 'Vos avis publiés', icon: Star },
  { id: 'profile', path: 'profil', label: 'Profil', desc: 'Vos informations et sécurité', icon: User },
];

const TAB_FROM_PATH: Record<string, BuyerTabId> = {
  commandes: 'orders',
  adresses: 'addresses',
  avis: 'reviews',
  profil: 'profile',
};

const AVATAR_COLORS = [
  'from-[#f56b2a] to-orange-400',
  'from-sky-500 to-blue-400',
  'from-emerald-500 to-teal-400',
  'from-violet-500 to-purple-400',
];

const avatarInitial = (name: string) => (name || 'U')[0].toUpperCase();

export const BuyerView: React.FC<BuyerViewProps> = ({
  user,
  accountTab,
  onBack,
  notify,
  onLogout,
  onUserUpdate,
}) => {
  const navigate = useNavigate();
  const nextRouter = useNextRouter();
  const [activeTab, setActiveTab] = useState<BuyerTabId>(
    TAB_FROM_PATH[accountTab || 'commandes'] || 'orders',
  );
  const [addressModal, setAddressModal] = useState<{
    open: boolean;
    editing: BuyerAddress | null;
  }>({ open: false, editing: null });
  const [reviewTarget, setReviewTarget] = useState<
    (ReviewTargetProduct & { store_id: string }) | null
  >(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [prevAccountTab, setPrevAccountTab] = useState<string | undefined>(accountTab);

  const data = useBuyerData(notify);

  // Synchronise l'onglet actif avec l'URL (/mon-compte/...) sans effet :
  // ajustement pendant le rendu quand la prop change (pattern React officiel).
  if (accountTab !== prevAccountTab) {
    setPrevAccountTab(accountTab);
    const t = TAB_FROM_PATH[accountTab || 'commandes'];
    if (t) setActiveTab(t);
  }

  const showError = !!data.error && data.error !== dismissedError;

  const handleTabChange = (tab: BuyerTabId) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    const def = TABS.find((t) => t.id === tab);
    nextRouter.push(`/mon-compte/${def?.path || tab}`);
  };

  const handleDeleteAddress = async (id: string) => {
    setDeletingAddressId(id);
    await data.deleteAddress(id);
    setDeletingAddressId(null);
  };

  const handleReviewSubmit = async (rating: number, comment: string) => {
    if (!reviewTarget) return false;
    return data.submitReview(reviewTarget.store_id, reviewTarget.id, {
      rating,
      comment,
      author: user.name,
    });
  };

  const activeTabDef = TABS.find((t) => t.id === activeTab) || TABS[0];

  const panel = (() => {
    if (showError) {
      return (
        <div className="bg-red-50 border border-red-100 rounded-[24px] p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-red-600">Une erreur est survenue</p>
            <p className="text-[11px] font-bold text-red-400 mt-0.5">{data.error}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  setDismissedError(data.error ?? null);
                  data.refreshAll();
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider"
              >
                Réessayer
              </button>
              <button
                onClick={() => setDismissedError(data.error ?? null)}
                className="px-4 py-2 bg-white text-red-500 rounded-xl text-[10px] font-black uppercase tracking-wider border border-red-100"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'orders':
        return (
          <OrdersTab
            orders={data.orders}
            loading={data.loading}
            loadingMore={data.loadingMore}
            hasMoreOrders={data.hasMoreOrders}
            onLoadMore={data.loadMoreOrders}
            onReviewProduct={(product, storeId) =>
              setReviewTarget({ ...product, store_id: storeId })
            }
            onBrowse={() => navigate('/')}
          />
        );
      case 'addresses':
        return (
          <AddressesTab
            addresses={data.addresses}
            loading={data.loading}
            deletingId={deletingAddressId}
            onAdd={() => setAddressModal({ open: true, editing: null })}
            onEdit={(addr) => setAddressModal({ open: true, editing: addr })}
            onDelete={handleDeleteAddress}
          />
        );
      case 'reviews':
        return <ReviewsTab reviews={data.reviews} loading={data.loading} />;
      case 'profile':
        return (
          <ProfileTab
            user={user}
            notify={notify}
            onUserUpdate={(name) => {
              onUserUpdate({ name });
            }}
            onLogout={() => setShowLogoutModal(true)}
          />
        );
      default:
        return null;
    }
  })();

  const counts: Record<BuyerTabId, number> = {
    orders: data.totalOrders,
    addresses: data.addresses.length,
    reviews: data.reviews.length,
    profile: 0,
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 md:pb-8">
      {/* En-tête sticky */}
      <div className="bg-white/85 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-30 transition-all">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-gray-400 hover:text-[#f56b2a] active:scale-95 transition-transform"
            aria-label="Retour"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-base font-black text-[#002f34] tracking-tight">
            Mon compte
          </h1>
          <button
            onClick={data.refreshAll}
            className="p-2 text-gray-400 hover:text-[#f56b2a] active:scale-90 transition-transform"
            aria-label="Rafraîchir"
          >
            <RefreshCcw size={20} className={data.refreshing ? 'animate-spin text-[#f56b2a]' : ''} />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4 md:py-8">
        <div className="lg:grid lg:grid-cols-[290px_1fr] lg:gap-8">
          {/* ---- Colonne latérale ---- */}
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {/* Carte identité */}
            <div className="bg-white lg:bg-gradient-to-br lg:from-white lg:to-orange-50/40 rounded-[28px] p-5 md:p-6 border border-gray-100 shadow-sm relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-orange-100/50 rounded-full blur-2xl opacity-60 pointer-events-none hidden md:block" />
              <div className="relative z-10 flex items-center gap-4 lg:flex-col lg:gap-4 lg:text-center">
                <div
                  className={`w-14 h-14 lg:w-20 lg:h-20 bg-gradient-to-tr ${AVATAR_COLORS[0]} rounded-2xl lg:rounded-full flex items-center justify-center text-white text-xl lg:text-3xl font-black shadow-lg shadow-orange-200/50 ring-2 ring-white`}
                >
                  {avatarInitial(user.name)}
                </div>
                <div className="flex-1 min-w-0 lg:w-full">
                  <p className="text-base lg:text-xl font-black text-[#002f34] truncate tracking-tight">
                    {user.name}
                  </p>
                  <p className="text-[10px] lg:text-[11px] text-gray-400 font-bold mt-0.5 truncate">
                    {user.email}
                  </p>
                  {data.refreshing && (
                    <p className="text-[9px] text-[#f56b2a] font-bold mt-1 inline-flex items-center gap-1">
                      <RefreshCcw size={10} className="animate-spin" /> Synchronisation...
                    </p>
                  )}
                </div>
              </div>

              {/* Statistiques */}
              <div className="relative z-10 flex justify-center items-center gap-4 lg:gap-5 mt-4 pt-4 border-t border-gray-100/70">
                {[
                  { value: counts.orders, label: 'Commandes' },
                  { value: counts.reviews, label: 'Avis' },
                  { value: counts.addresses, label: 'Adresses' },
                ].map((s, i) => (
                  <React.Fragment key={s.label}>
                    {i > 0 && <div className="w-px h-5 bg-gray-100" />}
                    <div className="text-center">
                      <p className="text-xs lg:text-sm font-black text-[#002f34]">
                        {data.loading ? '–' : s.value}
                      </p>
                      <p className="text-[8px] lg:text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                        {s.label}
                      </p>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Navigation desktop */}
            <nav className="hidden lg:block space-y-2">
              {TABS.map((tab) => {
                const isActive = tab.id === activeTab;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-[20px] border transition-all active:scale-[0.98] ${
                      isActive
                        ? 'bg-[#f56b2a]/5 border-[#f56b2a]/20'
                        : 'bg-white border-gray-100 shadow-sm hover:border-gray-200'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isActive ? 'bg-[#f56b2a]/10 text-[#f56b2a]' : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-black text-[#002f34]">{tab.label}</p>
                      <p className="text-[10px] text-gray-400 font-bold truncate">{tab.desc}</p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-[#f56b2a]/10 text-[#f56b2a]' : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      {tab.id === 'profile' ? '' : counts[tab.id]}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* ---- Zone de contenu ---- */}
          <main className="mt-4 lg:mt-0">
            {/* Navigation mobile : tuiles onglets */}
            <div className="lg:hidden -mx-4 px-4 mb-4">
              <div className="grid grid-cols-4 gap-2">
                {TABS.map((tab) => {
                  const isActive = tab.id === activeTab;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all active:scale-95 ${
                        isActive
                          ? 'bg-[#f56b2a]/5 border-[#f56b2a]/20 text-[#f56b2a]'
                          : 'bg-white border-gray-100 shadow-sm text-gray-400'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="text-[9px] font-black uppercase tracking-wide">
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4 lg:hidden">
              <h2 className="text-lg font-black text-[#002f34] tracking-tight">
                {activeTabDef.label}
              </h2>
              <p className="text-[11px] text-gray-400 font-bold">{activeTabDef.desc}</p>
            </div>

            {data.loading ? <PanelSkeleton rows={3} /> : panel}
          </main>
        </div>
      </div>

      {/* ---- Modales ---- */}
      {addressModal.open && (
        <AddressModal
          address={addressModal.editing}
          onClose={() => setAddressModal({ open: false, editing: null })}
          onSave={data.saveAddress}
        />
      )}

      {reviewTarget && (
        <ReviewModal
          product={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmit={handleReviewSubmit}
        />
      )}

      {showLogoutModal && (
        <Modal
          title="Déconnexion"
          subtitle="Vous quittez votre compte"
          icon={<LogOut size={20} />}
          onClose={() => setShowLogoutModal(false)}
        >
          <div className="p-6">
            <p className="text-sm font-bold text-gray-500 leading-relaxed">
              Êtes-vous sûr de vouloir vous déconnecter de votre compte ?
            </p>
            <div className="space-y-3 mt-6">
              <button
                onClick={onLogout}
                className="w-full py-4 bg-red-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-red-100 active:scale-95 transition-all"
              >
                Oui, me déconnecter
              </button>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="w-full py-4 bg-gray-50 text-gray-400 rounded-2xl font-black text-sm active:scale-95 transition-all"
              >
                Annuler
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BuyerView;