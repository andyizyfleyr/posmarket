/**
 * Coquille de l'espace vendeur — copie fidèle du couple
 * `MainLayout` + `LayoutClientWrapper` du web (rendu mobile) :
 * navbar en haut, contenu, barre d'onglets en bas, et les écrans de blocage
 * (abonnement requis, vérification de compte, aucune boutique).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, Stack, usePathname, useRouter, type Href } from 'expo-router';
import { Store } from 'lucide-react-native';
import { SellerProvider, useSeller } from '@/context/SellerContext';
import { SellerNavbar } from '@/components/seller/SellerNavbar';
import { SellerBottomNav, type SellerView } from '@/components/seller/SellerBottomNav';
import { SellerNoStore } from '@/components/seller/SellerNoStore';
import { StoreVerification, SubscriptionRequired } from '@/components/seller/SellerGates';
import ConfirmationModal from '@/components/ConfirmationModal';
import { ToastViewport } from '@/components/ToastProvider';
import { COLORS } from '@/theme';

export default function SellerLayout() {
  return (
    <SellerProvider>
      <SellerShell />
    </SellerProvider>
  );
}

/** Écrans autorisés hors vérification de boutique (comme le web). */
const VERIFICATION_EXEMPT: SellerView[] = ['settings', 'subscription'];

function SellerShell() {
  const seller = useSeller();
  const router = useRouter();
  const pathname = usePathname();

  const currentView = useMemo<SellerView>(() => {
    const segments = pathname.split('/').filter(Boolean);
    return (segments[1] as SellerView) || 'dashboard';
  }, [pathname]);

  const [storeIdToDelete, setStoreIdToDelete] = useState<string | null>(null);
  const [savingVerification, setSavingVerification] = useState(false);

  // Un vendeur n'a pas accès aux réglages ni aux rapports.
  const restricted =
    seller.role === 'SELLER' && (currentView === 'settings' || currentView === 'reports');

  const handleStoreChange = useCallback(
    (id: string) => {
      void seller.switchStore(id);
    },
    [seller],
  );

  const handleDeleteStore = useCallback((id: string) => {
    setStoreIdToDelete(id);
  }, []);

  const confirmDeleteStore = useCallback(async () => {
    if (!storeIdToDelete) return;
    const id = storeIdToDelete;
    await seller.deleteStore(id);
    setStoreIdToDelete(null);
  }, [seller, storeIdToDelete]);

  const handleLogout = useCallback(async () => {
    await seller.logout();
    router.replace('/login');
  }, [router, seller]);

  const handleCreateStore = useCallback(
    (name: string, businessType: 'shopping' | 'food') => seller.createStore(name, businessType),
    [seller],
  );

  const handleSaveVerification = useCallback(
    async (fields: { email: string; phone: string; address: string; description: string }) => {
      if (!seller.currentStore) return;
      setSavingVerification(true);
      try {
        await seller.updateStoreSettings(seller.currentStore.id, {
          ...(seller.currentStore.settings || {}),
          ...fields,
        });
      } finally {
        setSavingVerification(false);
      }
    },
    [seller],
  );

  // ── Gardes ────────────────────────────────────────────────────────
  if (!seller.isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.brand} />
      </View>
    );
  }

  if (!seller.user) {
    return <Redirect href="/login" />;
  }

  if (restricted) {
    return <Redirect href="/seller/dashboard" />;
  }

  if (seller.forbidden) {
    const isBuyer = seller.forbiddenSpace === 'buyer';
    return (
      <View style={styles.gate}>
        <View style={styles.gateCard}>
          <View style={styles.gateIcon}>
            <Store size={30} color={COLORS.brand} />
          </View>
          <Text style={styles.gateTitle}>Espace vendeur</Text>
          <Text style={styles.gateText}>
            {isBuyer
              ? 'Cette session est associée à un compte acheteur. Connectez-vous avec un compte commerçant pour accéder à l’espace vendeur.'
              : 'Ce compte ne peut pas accéder à l’espace vendeur.'}
          </Text>
          <Pressable
            style={styles.gatePrimary}
            onPress={() => router.replace(isBuyer ? '/account' : '/')}
          >
            <Text style={styles.gatePrimaryText}>
              {isBuyer ? 'Aller à mon compte' : "Retour à l'accueil"}
            </Text>
          </Pressable>
          <Pressable style={styles.gateSecondary} onPress={handleLogout}>
            <Text style={styles.gateSecondaryText}>Se déconnecter</Text>
          </Pressable>
        </View>
        <ToastViewport />
      </View>
    );
  }

  // Aucune boutique : écran de bienvenue (NoStoreFound).
  if (seller.stores.length === 0) {
    if (currentView === 'settings') {
      return <Redirect href="/seller/dashboard" />;
    }
    return (
      <View style={styles.shell}>
        <SellerNoStore onSubmit={handleCreateStore} />
        <ToastViewport />
      </View>
    );
  }

  // Abonnement requis (sauf sur la page abonnement elle-même).
  if (currentView !== 'subscription' && !seller.subscriptionValid) {
    return (
      <View style={styles.shell}>
        <SubscriptionRequired
          onSeeOffers={() => router.replace('/seller/subscription')}
        />
        <ToastViewport />
      </View>
    );
  }

  // Boutique en attente de validation ou refusée.
  const store = seller.currentStore;
  const needsVerification =
    store &&
    (store.status === 'PENDING' || store.status === 'REJECTED') &&
    !VERIFICATION_EXEMPT.includes(currentView);

  if (needsVerification && store) {
    return (
      <View style={styles.shell}>
        <StoreVerification
          store={store}
          infoComplete={Boolean(
            store.settings?.email &&
              store.settings?.phone &&
              store.settings?.address &&
              store.settings?.description,
          )}
          saving={savingVerification}
          onSave={handleSaveVerification}
          onOpenSettings={() => router.replace('/seller/settings')}
        />
        <ToastViewport />
      </View>
    );
  }

  const storeToDeleteName =
    seller.stores.find((item) => item.id === storeIdToDelete)?.settings?.name ||
    seller.stores.find((item) => item.id === storeIdToDelete)?.name ||
    'cette boutique';

  return (
    <View style={styles.shell}>
      <SellerNavbar
        stores={seller.stores}
        currentStore={seller.currentStore}
        currentPlan={seller.plan}
        userSubscription={seller.subscription}
        userEmail={seller.user?.email || ''}
        userAvatarUrl={seller.user?.avatarUrl}
        userRole={seller.role}
        onStoreChange={handleStoreChange}
        onDeleteStore={handleDeleteStore}
        onCreateStore={() => router.push('/seller/new-store')}
        onViewChange={(view) => router.push(`/seller/${view}` as Href)}
        onOpenStorefront={() => {
          const slug = seller.currentStore?.slug || seller.currentStore?.id;
          if (slug) router.push(`/store/${slug}`);
        }}
        onLogout={handleLogout}
      />

      <View style={styles.content}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#FFFFFF' },
          }}
        />
      </View>

      <SellerBottomNav
        currentView={currentView}
        userRole={seller.role}
        onViewChange={(view) => router.replace(`/seller/${view}` as Href)}
      />

      <ConfirmationModal
        isOpen={storeIdToDelete !== null}
        onClose={() => setStoreIdToDelete(null)}
        onConfirm={confirmDeleteStore}
        title="Supprimer la boutique ?"
        message={`Êtes-vous sûr de vouloir supprimer définitivement "${storeToDeleteName}" ? Toutes les données associées (produits, ventes, factures) seront perdues.`}
        confirmText="Supprimer la boutique"
        type="danger"
      />

      <ToastViewport />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  gateCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  gateIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  gateText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  gatePrimary: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gatePrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  gateSecondary: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
});
