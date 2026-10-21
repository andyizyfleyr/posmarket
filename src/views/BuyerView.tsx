'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  LayoutDashboard,
  Store as StoreIcon,
  ChevronRight,
} from 'lucide-react';
import { useBuyerData } from '@/components/buyer/useBuyerData';
import { OrdersTab, ReviewTargetProduct } from '@/components/buyer/OrdersTab';
import { OrderCard } from '@/components/buyer/OrderCard';
import { StoresTab } from '@/components/buyer/StoresTab';
import { AddressesTab } from '@/components/buyer/AddressesTab';
import { ReviewsTab } from '@/components/buyer/ReviewsTab';
import { NotificationsTab } from '@/components/buyer/NotificationsTab';
import { ProfileTab } from '@/components/buyer/ProfileTab';
import { AddressModal } from '@/components/buyer/AddressModal';
import { ReviewModal } from '@/components/buyer/ReviewModal';
import { Modal } from '@/components/buyer/Modal';
import ConfirmationModal from '@/components/ConfirmationModal';
import { useReorder } from '@/hooks/useReorder';
import {
  BuyerAddress,
  BuyerTabId,
  NotifyFn,
} from '@/components/buyer/accountTypes';
import { PanelSkeleton } from '@/components/buyer/accountUtils';

interface BuyerViewProps {
  user: { id?: string; name: string; email: string; avatarUrl?: string | null };
  accountTab?: string;
  onBack: () => void;
  notify?: NotifyFn;
  onLogout: () => void;
  onUserUpdate: (updates: { name: string; avatarUrl?: string | null }) => void;
}

interface TabDef {
  id: BuyerTabId;
  path: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  /** Libellé utilisé par la tuile de raccourci de l'aperçu. */
  tileLabel?: string;
}

const ALL_TABS: TabDef[] = [
  {
    id: 'overview',
    path: 'apercu',
    label: 'Aperçu',
    desc: 'Votre espace en un coup d’œil',
    icon: LayoutDashboard,
  },
  {
    id: 'orders',
    path: 'commandes',
    label: 'Commandes',
    desc: 'Historique et suivi de vos achats',
    icon: Package,
    tileLabel: 'Mes commandes',
  },
  {
    id: 'addresses',
    path: 'adresses',
    label: 'Livraison',
    desc: 'Vos contacts de livraison',
    icon: MapPin,
  },
  {
    id: 'reviews',
    path: 'avis',
    label: 'Avis',
    desc: 'Vos avis publiés',
    icon: Star,
    tileLabel: 'Mes avis',
  },
  {
    id: 'stores',
    path: 'boutiques',
    label: 'Boutiques',
    desc: 'Boutiques chez lesquelles vous avez commandé',
    icon: StoreIcon,
    tileLabel: 'Mes boutiques',
  },
  {
    id: 'notifications',
    path: 'notifications',
    label: 'Alertes',
    desc: 'WhatsApp et e-mail',
    icon: BellRing,
  },
  {
    id: 'profile',
    path: 'profil',
    label: 'Profil',
    desc: 'Vos informations et sécurité',
    icon: User,
    tileLabel: 'Mon profil',
  },
];

/**
 * Onglets « Alertes » et « Livraison » masqués dans la navigation : les pages
 * restent montées et accessibles via /mon-compte/notifications et
 * /mon-compte/adresses, seules les entrées de menu disparaissent. Les retirer
 * aussi de `ALL_TABS` comme de `TAB_FROM_PATH` les rendrait inaccessibles.
 */
const HIDDEN_TAB_IDS: BuyerTabId[] = ['notifications', 'addresses'];

const TABS = ALL_TABS.filter((t) => !HIDDEN_TAB_IDS.includes(t.id));

const TAB_FROM_PATH: Record<string, BuyerTabId> = {
  apercu: 'overview',
  overview: 'overview',
  commandes: 'orders',
  orders: 'orders',
  adresses: 'addresses',
  addresses: 'addresses',
  avis: 'reviews',
  reviews: 'reviews',
  boutiques: 'stores',
  stores: 'stores',
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
    return TAB_FROM_PATH[accountTab || 'apercu'] || 'overview';
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
  const { reorder, pendingOrderId } = useReorder(notify);

  /**
   * Lien profond : `/mon-compte/commandes?order=<id>` ouvre la commande
   * ciblée, la met en évidence et défile jusqu'à elle.
   */
  const [targetOrderId, setTargetOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const orderId = new URLSearchParams(window.location.search).get('order');
    if (!orderId) return;
    // L.state est applique apres l'hydratation : la lecture de l'URL ne doit
    // pas provoquer de difference entre le HTML rendu et le client.
    const id = window.setTimeout(() => {
      setTargetOrderId(orderId);
      setActiveTab('orders');
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Défilement vers la commande ciblée, une fois la liste rendue.
  useEffect(() => {
    if (!targetOrderId || data.loading) return;
    const element = document.getElementById(`order-${targetOrderId}`);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [targetOrderId, data.loading, data.orders.length]);

  // Synchronise l'onglet actif si accountTab change depuis l'extérieur (URL)
  useEffect(() => {
    if (targetOrderId) return;
    const t = TAB_FROM_PATH[accountTab || 'apercu'];
    if (!t || t === activeTab) return;
    const id = window.setTimeout(() => setActiveTab(t), 0);
    return () => window.clearTimeout(id);
  }, [accountTab, activeTab, targetOrderId]);

  // Synchronise l'onglet lors de la navigation navigateur (bouton Précédent / Suivant)
  useEffect(() => {
    const handlePopstate = () => {
      const match = window.location.pathname.split('/mon-compte/')[1]?.split('?')[0]?.split('/')[0];
      const targetTab = TAB_FROM_PATH[match || 'apercu'] || 'overview';
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
    // La commande mise en évidence n'a de sens que dans l'onglet Commandes.
    if (tab !== 'orders') setTargetOrderId(null);
    setActiveTab(tab);
    const def = ALL_TABS.find((t) => t.id === tab);
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

  const { submitReview } = data;

  const handleReviewSubmit = useCallback(
    async (rating: number, comment: string) => {
      if (!reviewTarget) return false;
      return submitReview(reviewTarget.store_id, reviewTarget.id, {
        rating,
        comment,
        author: user.name,
      });
    },
    [submitReview, reviewTarget, user.name],
  );

  // Stable : évite de recréer la modale d'avis (et son piégeage de focus) à
  // chaque render de l'espace acheteur.
  const closeReviewModal = useCallback(() => setReviewTarget(null), []);

  const activeTabDef = ALL_TABS.find((t) => t.id === activeTab) || ALL_TABS[0];

  /** Boutiques distinctes chez lesquelles l'acheteur a commandé. */
  const followedStoresCount = useMemo(() => {
    const ids = new Set<string>();
    for (const order of data.orders) {
      const id = order.store_id || order.stores?.[0]?.name || '';
      if (id) ids.add(id);
    }
    return ids.size;
  }, [data.orders]);

  const counts: Record<BuyerTabId, number> = {
    overview: 0,
    orders: data.totalOrders,
    addresses: data.addresses.length,
    reviews: data.reviews.length,
    stores: followedStoresCount,
    notifications: 0,
    profile: 0,
  };

  /** Tuiles de raccourci de l'aperçu. */
  const tiles = useMemo(
    () =>
      TABS.filter((t) => t.id !== 'overview').map((tab) => {
        const hint =
          tab.id === 'orders'
            ? `${counts.orders} au total`
            : tab.id === 'reviews'
              ? `${counts.reviews} publié${counts.reviews > 1 ? 's' : ''}`
              : tab.id === 'stores'
                ? `${counts.stores} boutique${counts.stores > 1 ? 's' : ''}`
                : 'Infos et sécurité';
        return { id: tab.id, label: tab.tileLabel || tab.label, hint, icon: tab.icon };
      }),
    [counts.orders, counts.reviews, counts.stores],
  );

  const recentOrders = useMemo(() => data.orders.slice(0, 3), [data.orders]);

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
      case 'overview':
        return (
          <div className="space-y-5">
            {/* Tuiles de raccourci */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {tiles.map((tile) => {
                const Icon = tile.icon;
                return (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => handleTabChange(tile.id)}
                    className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-gray-100 bg-white p-3.5 text-center shadow-sm transition-all hover:border-brand/40 hover:shadow-md active:scale-[0.98]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-brand">
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <span className="text-[11px] font-bold text-gray-900">{tile.label}</span>
                    <span className="text-[9.5px] font-medium text-gray-400">{tile.hint}</span>
                  </button>
                );
              })}
            </div>

            {/* Dernières commandes */}
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold tracking-tight text-gray-900">
                  Dernières commandes
                </h2>
                <button
                  type="button"
                  onClick={() => handleTabChange('orders')}
                  className="flex items-center gap-0.5 text-[11px] font-bold text-brand transition-opacity active:opacity-60"
                >
                  Tout voir
                  <ChevronRight size={13} strokeWidth={3} />
                </button>
              </div>

              {data.loading && recentOrders.length === 0 ? (
                <PanelSkeleton rows={2} />
              ) : recentOrders.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
                  <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-orange-50 text-brand">
                    <Package size={20} aria-hidden="true" />
                  </span>
                  <p className="text-xs font-semibold text-gray-500">
                    Vos commandes terminées ou annulées apparaîtront ici.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="mt-4 rounded-full bg-brand px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition-opacity active:opacity-80"
                  >
                    Découvrir les boutiques
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onPress={() => {
                        setTargetOrderId(order.id);
                        handleTabChange('orders');
                      }}
                      onReorder={() => void reorder(order)}
                      reorderDisabled={pendingOrderId === order.id}
                      cardId={`order-${order.id}`}
                      highlight={targetOrderId === order.id}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        );
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
            onReorder={(order) => void reorder(order)}
            pendingOrderId={pendingOrderId}
            highlightOrderId={targetOrderId}
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
      case 'stores':
        return <StoresTab orders={data.orders} loading={data.loading} />;
      case 'notifications':
        return <NotificationsTab notify={notify} />;
      case 'profile':
        return (
          <ProfileTab
            user={user}
            notify={notify}
            onUserUpdate={(updates) => {
              onUserUpdate(updates);
            }}
            onLogout={() => setShowLogoutModal(true)}
          />
        );
      default:
        return null;
    }
  })();

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
          <div className="text-center">
            <h1 className="text-base font-bold text-ink tracking-tight">Mon compte</h1>
            <p className="hidden text-[10px] font-semibold uppercase tracking-widest text-gray-400 sm:block">
              Espace client
            </p>
          </div>
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
          {/* ---- Colonne latérale (bureau) ---- */}
          <aside className="hidden lg:block space-y-4 lg:sticky lg:top-20 lg:self-start">
            {/* Carte identité */}
            <div className="bg-white rounded-panel p-5 md:p-6 border border-line shadow-sm relative overflow-hidden">
              <div className="relative z-10 flex items-center gap-4 lg:flex-col lg:gap-4 lg:text-center">
                <div
                  className={`w-14 h-14 lg:w-20 lg:h-20 bg-gradient-to-tr ${AVATAR_GRADIENT} rounded-2xl lg:rounded-full flex items-center justify-center text-white text-xl lg:text-3xl font-bold shadow-md shadow-orange-100 ring-2 ring-white`}
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    avatarInitial(user.name)
                  )}
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
                  { value: counts.stores, label: 'Boutiques' },
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

            {/* Navigation bureau */}
            <nav className="space-y-2" role="tablist" aria-label="Sections du compte">
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
            {/* En-tête de section (mobile) : on revient à l'aperçu */}
            {activeTab !== 'overview' && (
              <div className="mb-4 flex items-start gap-3 lg:hidden">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-brand">
                  {React.createElement(activeTabDef.icon, { size: 16, 'aria-hidden': true })}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-bold text-ink tracking-tight">
                    {activeTabDef.label}
                  </h2>
                  <p className="text-sm text-gray-500 font-medium">{activeTabDef.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleTabChange('overview')}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-500 transition-colors active:scale-95"
                >
                  <LayoutDashboard size={12} aria-hidden="true" />
                  Aperçu
                </button>
              </div>
            )}

            <div id="buyer-tabpanel" role="tabpanel" aria-labelledby={`buyer-tab-${activeTab}`}>
              {data.loading && activeTab !== 'overview' ? <PanelSkeleton rows={3} /> : panel}
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
          onClose={closeReviewModal}
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
