'use client';

import React, { useState, useCallback } from 'react';
import MainLayout from '@/components/MainLayout';
import { StoreData, StaffRole, SubscriptionPlan, UserSubscription } from '@/types';
import { useRouter, usePathname } from '@/components/RouterPolyfill';
import { createClient } from '@/utils/supabase/client';
import { quickCreateStoreAction, quickDeleteStoreAction, clearStoreCookieAction } from '@/app/actions/store';

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
  const currentView = (pathname.split('/')[1] || 'dashboard') as any;

  const [toastNotifications, setToastNotifications] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const notify = useCallback((message: string, type = 'info', title?: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToastNotifications(prev => [...prev, { id, message, type, title }]);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    await clearStoreCookieAction();
    router.push('/login');
  };

  const handleStoreChange = async (id: string) => {
    // Save to cookie via server action or API
    fetch('/api/set-store', { method: 'POST', body: JSON.stringify({ storeId: id }) })
      .then(() => router.refresh());
  };

  const handleCreateStore = async (name: string) => {
    if (!name.trim()) return;

    try {
      setIsSaving(true);
      const result = await quickCreateStoreAction(name.trim());

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

  const isSubscriptionValid = (userSubscription.tier === 'PRO' || userSubscription.tier === 'ENTERPRISE') && 
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

