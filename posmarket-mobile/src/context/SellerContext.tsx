/**
 * Espace vendeur — contexte de coquille.
 *
 * Reproduit le rôle du couple `(app)/layout.tsx` + `LayoutClientWrapper` du
 * web : boutiques (possédées + équipe), boutique courante (cookie), rôle,
 * permissions, abonnement (validité), et les actions de session.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchSellerBootstrap,
  loginSeller,
  sellerStoreAction,
  type SellerPlan,
  type SellerRole,
  type SellerStore,
  type SellerSubscription,
  type SellerUser,
} from '@/api/seller';
import { loadSession, saveSession } from '@/api/session';
import { useToast } from '@/components/ToastProvider';

/** Boutique courante (cookie `currentStoreId` côté serveur). */
const STORE_ID_KEY = 'posmarket_seller_store_id';
const USER_KEY = 'posmarket_seller_user';

export interface LoginSellerInput {
  email: string;
  name?: string;
  mode: 'login' | 'register';
}

interface SellerContextValue {
  user: SellerUser | null;
  stores: SellerStore[];
  currentStore: SellerStore | null;
  currentStoreId: string | null;
  role: SellerRole;
  permissions: Record<string, boolean>;
  subscription: SellerSubscription | null;
  plan: SellerPlan | null;
  subscriptionValid: boolean;
  /** `false` tant que la session et le bootstrap n'ont pas été résolus. */
  isReady: boolean;
  /** Session valide mais espace interdit (compte acheteur/administrateur). */
  forbidden: boolean;
  /** Espace de la session refusée (`buyer`, `admin`, …). */
  forbiddenSpace: string | null;
  login: (
    input: LoginSellerInput,
  ) => Promise<{ ok: boolean; sent?: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchStore: (id: string) => Promise<void>;
  /** Crée une boutique puis la sélectionne (comme `quickCreateStoreAction`). */
  createStore: (
    name: string,
    businessType: 'shopping' | 'food',
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Supprime une boutique (jamais la dernière). */
  deleteStore: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** Enregistre les réglages d'une boutique. */
  updateStoreSettings: (
    storeId: string,
    settings: Record<string, unknown>,
  ) => Promise<{ ok: boolean; error?: string }>;
  refresh: () => Promise<void>;
  /** Session refusée par le serveur : on efface et on prévient. */
  sessionExpired: () => void;
}

const SellerContext = createContext<SellerContextValue | null>(null);

export function SellerProvider({ children }: { children: React.ReactNode }) {
  const { notify } = useToast();

  const [user, setUser] = useState<SellerUser | null>(null);
  const [stores, setStores] = useState<SellerStore[]>([]);
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [role, setRole] = useState<SellerRole>('OWNER');
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [subscription, setSubscription] = useState<SellerSubscription | null>(null);
  const [plan, setPlan] = useState<SellerPlan | null>(null);
  const [subscriptionValid, setSubscriptionValid] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [forbiddenSpace, setForbiddenSpace] = useState<string | null>(null);

  /** Boutique demandée (mémoire + stockage) pour les appels suivants. */
  const storeIdRef = useRef<string | null>(null);

  const applyBootstrap = useCallback((res: Awaited<ReturnType<typeof fetchSellerBootstrap>>) => {
    if (!res?.success) return false;
    const resolvedStoreId = res.currentStoreId || null;
    storeIdRef.current = resolvedStoreId;
    setUser(res.user || null);
    setStores(res.stores || []);
    setCurrentStoreId(resolvedStoreId);
    setRole(res.role || 'OWNER');
    setPermissions(res.permissions || {});
    setSubscription(res.subscription || null);
    setPlan(res.plan || null);
    setSubscriptionValid(Boolean(res.subscriptionValid));
    AsyncStorage.setItem(STORE_ID_KEY, resolvedStoreId || '').catch(() => {});
    if (res.user) {
      AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user)).catch(() => {});
    }
    return true;
  }, []);

  const reset = useCallback(() => {
    setUser(null);
    setStores([]);
    setCurrentStoreId(null);
    setRole('OWNER');
    setPermissions({});
    setSubscription(null);
    setPlan(null);
    setSubscriptionValid(false);
    setForbidden(false);
    setForbiddenSpace(null);
    storeIdRef.current = null;
  }, []);

  /** Recharge le bootstrap (après connexion, changement de boutique…). */
  const refresh = useCallback(async () => {
    const res = await fetchSellerBootstrap(storeIdRef.current).catch(() => null);
    if (!res) return;
    if (res.success) {
      setForbidden(false);
      setForbiddenSpace(null);
      applyBootstrap(res);
      return;
    }
    if (res.error === 'Forbidden') {
      setForbidden(true);
      setForbiddenSpace(res.space || null);
      return;
    }
    if (res.error === 'Unauthorized') {
      await saveSession(null);
      reset();
    }
  }, [applyBootstrap, reset]);

  // Restauration au démarrage : session locale puis bootstrap serveur.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const session = await loadSession();
        if (!session) return;
        const [storedStoreId, rawUser] = await Promise.all([
          AsyncStorage.getItem(STORE_ID_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (!active) return;
        storeIdRef.current = storedStoreId || null;
        if (rawUser) {
          try {
            const parsed = JSON.parse(rawUser) as SellerUser;
            if (parsed?.email) setUser(parsed);
          } catch {}
        }
        await refresh();
      } finally {
        if (active) setIsReady(true);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (input: LoginSellerInput) => {
      try {
        const res = await loginSeller(input);
        if (!res?.success) {
          return { ok: false, error: res?.error || 'Connexion impossible.' };
        }
        if (res.session?.value && res.user) {
          await saveSession(res.session);
          setForbidden(false);
          await refresh();
          return { ok: true, sent: false };
        }
        // Repli : l'e-mail de connexion a été envoyé, l'utilisateur clique dessus.
        return { ok: true, sent: true };
      } catch {
        return {
          ok: false,
          error: 'Connexion impossible. Vérifiez votre connexion Internet puis réessayez.',
        };
      }
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await saveSession(null);
    try {
      await AsyncStorage.multiRemove([STORE_ID_KEY, USER_KEY]);
    } catch {}
    reset();
    notify('Déconnexion réussie', 'info');
  }, [notify, reset]);

  const switchStore = useCallback(
    async (id: string) => {
      storeIdRef.current = id;
      await AsyncStorage.setItem(STORE_ID_KEY, id).catch(() => {});
      await refresh();
    },
    [refresh],
  );

  const createStore = useCallback(
    async (name: string, businessType: 'shopping' | 'food') => {
      const res = await sellerStoreAction({ action: 'create', name, businessType }).catch(
        () => null,
      );
      if (!res) return { ok: false, error: 'Erreur de connexion serveur' };
      if (!res.success || !res.store?.id) {
        return { ok: false, error: res.error || 'Une erreur est survenue' };
      }
      await switchStore(res.store.id);
      return { ok: true };
    },
    [switchStore],
  );

  const deleteStore = useCallback(
    async (id: string) => {
      const res = await sellerStoreAction({ action: 'delete', storeId: id }).catch(() => null);
      if (!res?.success) {
        const error = res?.error || 'Erreur lors de la suppression';
        notify(error, 'error');
        return { ok: false, error };
      }
      // La boutique supprimée était la courante : on bascule sur une autre.
      if (storeIdRef.current === id) {
        const other = stores.find((store) => store.id !== id);
        if (other) await switchStore(other.id);
      }
      notify('Boutique supprimée avec succès', 'success');
      await refresh();
      return { ok: true };
    },
    [notify, refresh, stores, switchStore],
  );

  const updateStoreSettings = useCallback(
    async (storeId: string, settings: Record<string, unknown>) => {
      const res = await sellerStoreAction({ action: 'settings', storeId, settings }).catch(
        () => null,
      );
      if (!res) return { ok: false, error: 'Erreur de connexion serveur' };
      if (!res.success) return { ok: false, error: res.error || 'Enregistrement impossible.' };
      await refresh();
      return { ok: true };
    },
    [refresh],
  );

  const sessionExpired = useCallback(() => {
    void saveSession(null);
    reset();
    notify('Session expirée, veuillez vous reconnecter.', 'info', 'Connexion');
  }, [notify, reset]);

  const currentStore = useMemo(
    () => stores.find((store) => store.id === currentStoreId) || null,
    [stores, currentStoreId],
  );

  const value = useMemo<SellerContextValue>(
    () => ({
      user,
      stores,
      currentStore,
      currentStoreId,
      role,
      permissions,
      subscription,
      plan,
      subscriptionValid,
      isReady,
      forbidden,
      forbiddenSpace,
      login,
      logout,
      switchStore,
      createStore,
      deleteStore,
      updateStoreSettings,
      refresh,
      sessionExpired,
    }),
    [
      user,
      stores,
      currentStore,
      currentStoreId,
      role,
      permissions,
      subscription,
      plan,
      subscriptionValid,
      isReady,
      forbidden,
      forbiddenSpace,
      login,
      logout,
      switchStore,
      createStore,
      deleteStore,
      updateStoreSettings,
      refresh,
      sessionExpired,
    ],
  );

  return <SellerContext.Provider value={value}>{children}</SellerContext.Provider>;
}

export function useSeller(): SellerContextValue {
  const context = useContext(SellerContext);
  if (!context) {
    throw new Error('useSeller doit être utilisé dans <SellerProvider>');
  }
  return context;
}
