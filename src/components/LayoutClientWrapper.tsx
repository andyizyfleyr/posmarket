'use client';

import React, { useState, useCallback, useTransition } from 'react';
import MainLayout from '@/components/MainLayout';
import { StoreData, StaffRole, SubscriptionPlan, UserSubscription, ViewType, ToastNotification, NotificationType } from '@/types';
import { useRouter, usePathname } from '@/components/RouterPolyfill';
import { quickDeleteStoreAction, clearStoreCookieAction } from '@/app/actions/store';
import ConfirmationModal from '@/components/ConfirmationModal';
import { ConfirmProvider } from '@/context/ConfirmContext';

interface FlutterWindow {
  FlutterNotifications?: { postMessage: (message: string) => void };
  restoreSession?: (sessionJson: string) => Promise<void>;
}

export default function LayoutClientWrapper({
  children,
  stores,
  currentStore,
  currentPlan,
  userEmail,
  userAvatarUrl,
  userSubscription,
  currentUserRole
}: {
  children: React.ReactNode;
  stores: StoreData[];
  currentStore: StoreData;
  currentPlan: SubscriptionPlan;
  userEmail: string;
  userAvatarUrl?: string | null;
  userSubscription: UserSubscription;
  currentUserRole: StaffRole;
}) {
  const router = useRouter();
  /*
   * Navigation entre vues.
   *
   * `loading.tsx` ne couvre QUE le premier chargement d'une route : entre deux
   * vues déjà visitées, Next restaure un arbre préchargé et `loading.tsx` ne
   * s'affiche jamais. Rien n'indiquait donc qu'un clic avait été pris en
   * compte pendant l'attente du serveur — d'où l'impression de « clics mous ».
   *
   * `useTransition` expose exactement cette attente, sans écran blanc : le
   * contenu précédent reste affiché, et une barre de progression discrète
   * s'affiche en haut pendant que la nouvelle vue se prépare.
   */
  const [isNavigating, startNavigation] = useTransition();
  const pathname = usePathname();

  // Extract ViewType from pathname
  const currentView = (pathname.split('/')[1] || 'dashboard') as ViewType;

  const [toastNotifications, setToastNotifications] = useState<ToastNotification[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const isOnline = true;

  const notify = useCallback((message: string, type: NotificationType = 'info', title?: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToastNotifications(prev => [...prev, { id, message, type, title }]);
  }, []);
  
  // Notify Flutter App if we are running inside the WebView
  React.useEffect(() => {
    const flutterWindow = window as unknown as FlutterWindow;

    // Le pont de session ne sert QUE dans la WebView Flutter. Le module
    // `@/supabase` (polyfill de server actions) est donc importé à la demande :
    // auparavant il entrait dans le bundle de toutes les pages vendeur, même
    // dans un navigateur classique où il ne servait à rien.
    flutterWindow.restoreSession = async (sessionJson: string) => {
      try {
        const session = JSON.parse(sessionJson);
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        await supabase.auth.setSession(session);
        // Refresh the page to apply changes
        router.refresh();
      } catch (err) {
        console.error('Error restoring session:', err);
      }
    };

    const bridge = flutterWindow.FlutterNotifications;
    if (!bridge) return;

    // 1. Request session from mobile app on startup
    bridge.postMessage('requestSession');

    // 2. Sync the web session back to the mobile app
    void (async () => {
      try {
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const { data: { user } } = await supabase.auth.getUser();

        if (session) {
          bridge.postMessage(`setSession:${JSON.stringify(session)}`);
        }
        if (user?.id) {
          bridge.postMessage(`subscribe:${user.id}`);
        } else if (currentStore?.id) {
          bridge.postMessage(`subscribe:${currentStore.id}`);
        }
      } catch (err) {
        console.error('Error syncing session:', err);
      }
    })();
  }, [currentStore?.id, router]);

  // Prevent bfcache restoration on back button after logout
  React.useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Avoid reload if an overlay is open (to prevent closing pop-ups)
        const hasOpenOverlay = !!document.querySelector(
          '[data-no-pull-refresh], [role="dialog"], [aria-modal="true"]'
        );
        if (!hasOpenOverlay) {
          window.location.reload();
        }
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const flutterWindow = window as unknown as FlutterWindow;
      if (typeof window !== 'undefined' && flutterWindow.FlutterNotifications) {
        if (currentStore?.id) {
          flutterWindow.FlutterNotifications.postMessage(`unsubscribe:${currentStore.id}`);
        }
        flutterWindow.FlutterNotifications.postMessage(`clearSession`);
      }

      // Clear client storage
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}

      const { logoutAction } = await import('@/app/actions/auth');
      await logoutAction();
      await clearStoreCookieAction();

      // Replace current history entry with /login to avoid back navigation loop
      window.location.replace('/login');
    } catch (e) {
      console.error('Logout error:', e);
      window.location.replace('/login');
    }
  };

  const handleStoreChange = async (id: string) => {
    try {
      const res = await fetch('/api/set-store', { method: 'POST', body: JSON.stringify({ storeId: id }) });
      if (!res.ok) {
        notify('Erreur lors du changement de boutique', 'error');
        return;
      }
      router.refresh();
    } catch {
      notify('Erreur réseau lors du changement de boutique', 'error');
    }
  };

  const [storeIdToDelete, setStoreIdToDelete] = useState<string | null>(null);

  const handleDeleteStore = async (id: string) => {
    setStoreIdToDelete(id);
  };

  const confirmDeleteStore = async () => {
    if (!storeIdToDelete) return;
    const id = storeIdToDelete;

    try {
      setIsSaving(true);
      const result = await quickDeleteStoreAction(id);

      if (result.success) {
        // If we deleted the current store, switch to another one
        if (currentStore?.id === id) {
          const otherStore = stores.find(s => s.id !== id);
          if (otherStore) {
            await fetch('/api/set-store', {
              method: 'POST',
              body: JSON.stringify({ storeId: otherStore.id })
            });
          }
        }
        notify('Boutique supprimée avec succès', 'success');
        router.refresh();
      } else {
        notify(result.error || 'Erreur lors de la suppression', 'error');
      }
    } catch (err) {
      console.error('Error deleting store:', err);
      notify('Erreur lors de la suppression de la boutique', 'error');
    } finally {
      setIsSaving(false);
      setStoreIdToDelete(null);
    }
  };

  const isSubscriptionValid = (userSubscription.tier === 'STARTER' || userSubscription.tier === 'PRO' || userSubscription.tier === 'ENTERPRISE') && 
    userSubscription.status === 'ACTIVE' && 
    new Date(userSubscription.endDate) > new Date();

  const storeToDeleteName = stores.find(s => s.id === storeIdToDelete)?.name || 'cette boutique';

  return (
    <ConfirmProvider>
      <MainLayout
        currentUserRole={currentUserRole}
        currentView={currentView}
        isSubscriptionValid={isSubscriptionValid}
        onViewChange={(view) => startNavigation(() => router.push(`/${view}`))}
        onLogout={handleLogout}
        stores={stores}
        currentStore={currentStore}
        currentPlan={currentPlan}
        onStoreChange={handleStoreChange}
        onDeleteStore={handleDeleteStore}
        userEmail={userEmail}
            userAvatarUrl={userAvatarUrl}
        userSubscription={userSubscription}
        isOnline={isOnline}
        toastNotifications={toastNotifications}
        removeToast={(id) => setToastNotifications(prev => prev.filter(n => n.id !== id))}
        isSaving={isSaving}
        isNavigating={isNavigating}
      >
        {/* We pass a context provider here to easily send 'notify' to children without Prop Drilling */}
        {children}
      </MainLayout>

      {/* Delete Store Custom Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!storeIdToDelete}
        onClose={() => setStoreIdToDelete(null)}
        onConfirm={confirmDeleteStore}
        title="Supprimer la boutique ?"
        message={`Êtes-vous sûr de vouloir supprimer définitivement "${storeToDeleteName}" ? Toutes les données associées (produits, ventes, factures) seront perdues.`}
        confirmText="Supprimer la boutique"
        type="danger"
        isLoading={isSaving}
      />
    </ConfirmProvider>
  );
}

