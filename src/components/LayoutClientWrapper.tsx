'use client';

import React, { useState, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import { StoreData, StaffRole, SubscriptionPlan, UserSubscription, ViewType, ToastNotification, NotificationType } from '@/types';
import { useRouter, usePathname } from '@/components/RouterPolyfill';
import { createClient } from '@/utils/supabase/client';
import { quickCreateStoreAction, quickDeleteStoreAction, clearStoreCookieAction } from '@/app/actions/store';

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
  userSubscription,
  currentUserRole
}: {
  children: React.ReactNode;
  stores: StoreData[];
  currentStore: StoreData;
  currentPlan: SubscriptionPlan;
  userEmail: string;
  userSubscription: UserSubscription;
  currentUserRole: StaffRole;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // Extract ViewType from pathname
  const currentView = (pathname.split('/')[1] || 'dashboard') as ViewType;

  const [toastNotifications, setToastNotifications] = useState<ToastNotification[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const isOnline = true;
  
  // Notify Flutter App if we are running inside the WebView
  React.useEffect(() => {
    const supabase = createClient();
    const flutterWindow = window as unknown as FlutterWindow;

    flutterWindow.restoreSession = async (sessionJson: string) => {
      try {
        const session = JSON.parse(sessionJson);
        await supabase.auth.setSession(session);
        // Refresh the page to apply changes
        router.refresh();
      } catch (err) {
        console.error('Error restoring session:', err);
      }
    };

    const syncSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();

      if (flutterWindow.FlutterNotifications) {
        if (session) {
          flutterWindow.FlutterNotifications.postMessage(`setSession:${JSON.stringify(session)}`);
        }
        if (user?.id) {
          flutterWindow.FlutterNotifications.postMessage(`subscribe:${user.id}`);
        } else if (currentStore?.id) {
          flutterWindow.FlutterNotifications.postMessage(`subscribe:${currentStore.id}`);
        }
      }
    };

    // 2. Request session from mobile app on startup
    if (flutterWindow.FlutterNotifications) {
       flutterWindow.FlutterNotifications.postMessage('requestSession');
    }

    syncSession();
  }, [currentStore?.id, router]);

  const notify = useCallback((message: string, type: NotificationType = 'info', title?: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToastNotifications(prev => [...prev, { id, message, type, title }]);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    const flutterWindow = window as unknown as FlutterWindow;
    if (typeof window !== 'undefined' && flutterWindow.FlutterNotifications) {
      if (currentStore?.id) {
        flutterWindow.FlutterNotifications.postMessage(`unsubscribe:${currentStore.id}`);
      }
      flutterWindow.FlutterNotifications.postMessage(`clearSession`);
    }
    await supabase.auth.signOut();
    await clearStoreCookieAction();
    router.push('/login');
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

  const handleCreateStore = async (name: string, businessType: string) => {
    if (!name.trim()) return;

    try {
      setIsSaving(true);
      const result = await quickCreateStoreAction(name.trim(), businessType);

      if (result.success && result.store) {
        // Switch to the newly created store
        await fetch('/api/set-store', {
          method: 'POST',
          body: JSON.stringify({ storeId: result.store.id })
        });
        notify('Boutique créée avec succès !', 'success');
        router.push('/dashboard');
        router.refresh();
      } else {
        notify(result.error || 'Erreur lors de la création de la boutique', 'error');
      }
    } catch (err) {
      console.error('Error creating store:', err);
      notify('Erreur lors de la création de la boutique', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStore = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette boutique ? Toutes les données associées seront perdues.')) {
      return;
    }

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
    }
  };

  const isSubscriptionValid = (userSubscription.tier === 'STARTER' || userSubscription.tier === 'PRO' || userSubscription.tier === 'ENTERPRISE') && 
    userSubscription.status === 'ACTIVE' && 
    new Date(userSubscription.endDate) > new Date();

  return (
    <MainLayout
      currentUserRole={currentUserRole}
      currentView={currentView}
      isSubscriptionValid={isSubscriptionValid}
      onViewChange={(view) => router.push(`/${view}`)}
      onLogout={handleLogout}
      stores={stores}
      currentStore={currentStore}
      currentPlan={currentPlan}
      onStoreChange={handleStoreChange}
      onCreateStore={handleCreateStore}
      onDeleteStore={handleDeleteStore}
      userEmail={userEmail}
      userSubscription={userSubscription}
      isOnline={isOnline}
      toastNotifications={toastNotifications}
      removeToast={(id) => setToastNotifications(prev => prev.filter(n => n.id !== id))}
      isSaving={isSaving}
    >
      {/* We pass a context provider here to easily send 'notify' to children without Prop Drilling */}
      {children}
    </MainLayout>
  );
}

