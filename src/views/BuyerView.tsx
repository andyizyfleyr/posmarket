'use client';

import React, { useState, useEffect } from 'react';
import { useNavigate } from '@/components/RouterPolyfill';
import {
  ArrowLeft,
  RefreshCcw,
  Package,
  MapPin,
  Star,
  BellRing,
  User,
  LogOut,
  AlertTriangle,
} from 'lucide-react';
import { useBuyerData } from '@/components/buyer/useBuyerData';
import { OrdersTab, ReviewTargetProduct } from '@/components/buyer/OrdersTab';
import { AddressesTab } from '@/components/buyer/AddressesTab';
import { ReviewsTab } from '@/components/buyer/ReviewsTab';
import { NotificationsTab } from '@/components/buyer/NotificationsTab';
import { ProfileTab } from '@/components/buyer/ProfileTab';
import { AddressModal } from '@/components/buyer/AddressModal';
import { ReviewModal } from '@/components/buyer/ReviewModal';
import { Modal } from '@/components/buyer/Modal';
import ConfirmationModal from '@/components/ConfirmationModal';
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
  { id: 'addresses', path: 'adresses', label: 'Livraison', desc: 'Vos contacts de livraison', icon: MapPin },
  { id: 'reviews', path: 'avis', label: 'Avis', desc: 'Vos avis publiés', icon: Star },
  { id: 'notifications', path: 'notifications', label: 'Alertes', desc: 'WhatsApp et e-mail', icon: BellRing },
  { id: 'profile', path: 'profil', label: 'Profil', desc: 'Vos informations et sécurité', icon: User },
];

const TAB_FROM_PATH: Record<string, BuyerTabId> = {
  commandes: 'orders',
  adresses: 'addresses',
  avis: 'reviews',
  notifications: 'notifications',
  profil: 'profile',
};

const AVATAR_GRADIENT = 'from-brand to-orange-400';

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
  const [activeTab, setActiveTab] = useState<BuyerTabId>(() => {
    return TAB_FROM_PATH[accountTab || 'commandes'] || 'orders';
  });
  const [addressModal, setAddressModal] = useState<{
    open: boolean;
    editing: BuyerAddress | null;
  }>({ open: false, editing: null });
  const [reviewTarget, setReviewTarget] = useState<
    (ReviewTargetProduct & { store_id: string }) | null
  >(null);
const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [addressPendingDelete, setAddressPendingDelete] = useState<BuyerAddress | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  const data = useBuyerData(user, notify);

  // Synchronise l'onglet actif si accountTab change depuis l'extérieur (URL)
  useEffect(() => {
    const t = TAB_FROM_PATH[accountTab || 'commandes'];
    if (!t || t === activeTab) return;
    const id = window.setTimeout(() => setActiveTab(t), 0);
    return () => window.clearTimeout(id);
  }, [accountTab, activeTab]);

  // Synchronise l'onglet lors de la navigation navigateur (bouton Précédent / Suivant)
  useEffect(() => {
    const handlePopstate = () => {
      const match = window.location.pathname.split('/mon-compte/')[1]?.split('?')[0]?.split('/')[0];
      const targetTab = TAB_FROM_PATH[match || 'commandes'] || 'orders';
      setActiveTab(targetTab);
    };
    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, []);

const showError = !!data.error && data.error !== dismissedError;

  // Un nouvel essai repart d'un état non masqué : si la requête échoue encore avec le
  // même message, le bandeau doit réapparaître plutôt que de rester caché.
  const handleRetry = () => {
    setDismissedError(null);
    void data.refreshAll();
  };

  const handleTabChange = (tab: BuyerTabId) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    const def = TABS.find((t) => t.id === tab);
    const newPath = `/mon-compte/${def?.path || tab}`;
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', newPath);
    }
  };

  const handleDeleteAddress = async () => {
    if (!addressPendingDelete) return;
    setIsDeleting(true);
    const ok = await data.deleteAddress(addressPendingDelete.id);
    setIsDeleting(false);
    if (ok) setAddressPendingDelete(null);
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
<div className="bg-red-50 border border-red-200 rounded-card p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700">Une erreur est survenue</p>
            <p className="text-sm text-red-600 mt-0.5">{data.error}</p>
<div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={handleRetry}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold"
              >
                Réessayer
              </button>
              <button
                type="button"
                onClick={() => setDismissedError(data.error ?? null)}
                className="px-4 py-2 bg-white text-red-600 rounded-xl text-xs font-semibold border border-red-200"
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
            onAdd={() => setAddressModal({ open: true, editing: null })}
            onEdit={(addr) => setAddressModal({ open: true, editing: addr })}
            onDelete={(addr) => setAddressPendingDelete(addr)}
          />
        );
      case 'reviews':
        return <ReviewsTab reviews={data.reviews} loading={data.loading} />;
      case 'notifications':
        return <NotificationsTab notify={notify} />;
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
    notifications: 0,
    profile: 0,
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 md:pb-8">
      {/* En-tête sticky */}
      <div className="bg-white/85 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-30 transition-all">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-gray-400 hover:text-brand active:scale-95 transition-transform"
            aria-label="Retour"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-base font-bold text-ink tracking-tight">
            Mon compte
          </h1>
          <button
            onClick={data.refreshAll}
            className="p-2 text-gray-400 hover:text-brand active:scale-90 transition-transform"
            aria-label="Rafraîchir"
          >
            <RefreshCcw size={20} className={data.refreshing ? 'animate-spin text-brand' : ''} />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4 md:py-8">
        <div className="lg:grid lg:grid-cols-[290px_1fr] lg:gap-8">
          {/* ---- Colonne latérale ---- */}
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {/* Carte identité */}
<div className="bg-white rounded-panel p-5 md:p-6 border border-line shadow-sm relative overflow-hidden">
              <div className="relative z-10 flex items-center gap-4 lg:flex-col lg:gap-4 lg:text-center">
                <div
                  className={`w-14 h-14 lg:w-20 lg:h-20 bg-gradient-to-tr ${AVATAR_GRADIENT} rounded-2xl lg:rounded-full flex items-center justify-center text-white text-xl lg:text-3xl font-bold shadow-md shadow-orange-100 ring-2 ring-white`}
                >
                  {avatarInitial(user.name)}
                </div>
                <div className="flex-1 min-w-0 lg:w-full">
                  <p className="text-base lg:text-xl font-bold text-ink truncate tracking-tight">
                    {user.name}
                  </p>
                  <p className="text-xs lg:text-sm text-gray-500 font-medium mt-0.5 truncate">
                    {user.email}
                  </p>
                  {data.refreshing && (
                    <p className="text-xs text-brand font-semibold mt-1 inline-flex items-center gap-1" role="status">
                      <RefreshCcw size={12} className="animate-spin" aria-hidden="true" /> Synchronisation…
                    </p>
                  )}
                </div>
              </div>

              {/* Statistiques */}
              <div className="relative z-10 flex justify-center items-center gap-4 lg:gap-5 mt-4 pt-4 border-t border-line">
                {[
                  { value: counts.orders, label: 'Commandes' },
                  { value: counts.reviews, label: 'Avis' },
                  { value: counts.addresses, label: 'Adresses' },
                ].map((s, i) => (
                  <React.Fragment key={s.label}>
                    {i > 0 && <div className="w-px h-5 bg-line" />}
                    <div className="text-center">
                      <p className="text-xs lg:text-sm font-bold text-ink">
                        {data.loading ? '–' : s.value}
                      </p>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">
                        {s.label}
                      </p>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Navigation desktop */}
            <nav className="hidden lg:block space-y-2" role="tablist" aria-label="Sections du compte">
              {TABS.map((tab) => {
                const isActive = tab.id === activeTab;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`buyer-tab-${tab.id}`}
                    aria-selected={isActive}
                    aria-controls="buyer-tabpanel"
                    onClick={() => handleTabChange(tab.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-[20px] border transition-colors active:scale-[0.98] ${
                      isActive
                        ? 'bg-brand-soft border-brand/20'
                        : 'bg-white border-line shadow-sm hover:border-gray-200'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isActive ? 'bg-brand/10 text-brand' : 'bg-gray-50 text-gray-500'
                      }`}
                    >
                      <Icon size={18} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-bold text-ink">{tab.label}</p>
                      <p className="text-xs text-gray-500 font-medium truncate">{tab.desc}</p>
                    </div>
                    {counts[tab.id] > 0 && (
                      <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {counts[tab.id]}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="mt-4 lg:mt-0">
            {/* Navigation mobile : tuiles onglets */}
            <div className="lg:hidden -mx-4 px-4 mb-4">
              <div className="grid grid-cols-5 gap-2" role="tablist" aria-label="Sections du compte">
                {TABS.map((tab) => {
                  const isActive = tab.id === activeTab;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      id={`buyer-tab-m-${tab.id}`}
                      aria-selected={isActive}
                      aria-controls="buyer-tabpanel"
                      onClick={() => handleTabChange(tab.id)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-colors active:scale-95 ${
                        isActive
                          ? 'bg-brand-soft border-brand/20 text-brand'
                          : 'bg-white border-line shadow-sm text-gray-500'
                      }`}
                    >
                      <Icon size={20} aria-hidden="true" />
                      <span className="text-xs font-bold">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

<div className="mb-4 lg:hidden">
              <h2 className="text-lg font-bold text-ink tracking-tight">
                {activeTabDef.label}
              </h2>
              <p className="text-sm text-gray-500 font-medium">{activeTabDef.desc}</p>
            </div>

            <div id="buyer-tabpanel" role="tabpanel" aria-labelledby={`buyer-tab-${activeTab}`}>
              {data.loading ? <PanelSkeleton rows={3} /> : panel}
            </div>
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
          icon={<LogOut size={20} aria-hidden="true" />}
          onClose={() => setShowLogoutModal(false)}
        >
          <div className="p-6">
            <p className="text-sm text-gray-600 leading-relaxed">
              Voulez-vous vraiment vous déconnecter ?
            </p>
            <div className="space-y-3 mt-6">
              <button
                type="button"
                onClick={onLogout}
                className="w-full py-4 bg-red-600 text-white rounded-2xl font-semibold text-sm shadow-md shadow-red-100 transition-colors"
              >
                Oui, me déconnecter
              </button>
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="w-full py-4 bg-gray-50 text-gray-600 rounded-2xl font-semibold text-sm transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmationModal
        isOpen={!!addressPendingDelete}
        onClose={() => !isDeleting && setAddressPendingDelete(null)}
        onConfirm={handleDeleteAddress}
        title="Supprimer cette adresse"
        message={
          addressPendingDelete
            ? `« ${addressPendingDelete.name} » sera définitivement retirée de vos adresses de livraison.`
            : ''
        }
        confirmText="Supprimer"
        type="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default BuyerView;