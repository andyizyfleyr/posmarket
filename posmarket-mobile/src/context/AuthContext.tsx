/**
 * Connexion acheteur (AuthContext) — même parcours que le web : lien magique
 * par e-mail, sauf qu'ici le lien est échangé immédiatement côté serveur
 * contre le cookie de session (l'app ne peut pas ouvrir un lien reçu par
 * e-mail). La session est ensuite posée sur chaque appel API.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { fetchBuyerProfile, loginBuyer } from '@/api/client';
import { getSessionSync, loadSession, saveSession } from '@/api/session';
import { useToast } from '@/components/ToastProvider';
import { AuthModal } from '@/components/buyer/AuthModal';

const USER_KEY = 'posmarket_buyer_user';

export interface BuyerUser {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string | null;
}

export type AuthMode = 'login' | 'register';

interface LoginInput {
  email: string;
  name?: string;
  mode: AuthMode;
}

interface AuthContextValue {
  user: BuyerUser | null;
  /** `false` tant que la session locale n'a pas été relue. */
  isReady: boolean;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
  login: (input: LoginInput) => Promise<{ ok: boolean; sent?: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<BuyerUser>) => void;
  /** Session refusée par le serveur : on efface et on prévient. */
  sessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [user, setUser] = useState<BuyerUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const persistUser = useCallback((next: BuyerUser | null) => {
    setUser(next);
    if (next) {
      AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => {});
    } else {
      AsyncStorage.removeItem(USER_KEY).catch(() => {});
    }
  }, []);

  // Restauration de la session au démarrage (cache d'abord, serveur ensuite).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const session = await loadSession();
        if (!session) return;
        const raw = await AsyncStorage.getItem(USER_KEY);
        if (raw && active) {
          try {
            const parsed = JSON.parse(raw) as BuyerUser;
            if (parsed?.email) setUser(parsed);
          } catch {}
        }
        const res = await fetchBuyerProfile().catch(() => null);
        if (!active) return;
        if (res?.success && res.profile) {
          persistUser({
            id: user?.id,
            name: res.profile.fullName || res.profile.email?.split('@')[0] || 'Utilisateur',
            email: res.profile.email,
            phone: res.profile.phone || '',
            avatarUrl: res.profile.avatarUrl || null,
          });
        } else if (res && !res.success && res.error === 'Unauthorized') {
          await saveSession(null);
          persistUser(null);
        }
      } finally {
        if (active) setIsReady(true);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAuth = useCallback((mode: AuthMode = 'login') => {
    setAuthMode(mode);
    setIsAuthOpen(true);
  }, []);

  const closeAuth = useCallback(() => setIsAuthOpen(false), []);

  const login = useCallback(
    async (input: LoginInput) => {
      setIsSubmitting(true);
      try {
        const res = await loginBuyer(input);
        if (!res?.success) {
          return { ok: false, error: res?.error || 'Connexion impossible.' };
        }
        if (res.session?.value && res.user) {
          await saveSession(res.session);
          persistUser({
            id: res.user.id,
            name: res.user.name || input.name || input.email.split('@')[0],
            email: res.user.email || input.email,
            phone: res.user.phone || '',
            avatarUrl: res.user.avatarUrl ?? null,
          });
          void queryClient.invalidateQueries();
          return { ok: true, sent: false };
        }
        // Repli : l'e-mail de connexion a été envoyé, l'utilisateur clique dessus.
        return { ok: true, sent: true };
      } catch {
        return {
          ok: false,
          error: 'Connexion impossible. Vérifiez votre connexion Internet puis réessayez.',
        };
      } finally {
        setIsSubmitting(false);
      }
    },
    [persistUser, queryClient],
  );

  const logout = useCallback(async () => {
    await saveSession(null);
    persistUser(null);
    try {
      await AsyncStorage.multiRemove([
        'buyer_data_cache_v2',
        'buyer_profile_cache',
        'storefront_customer',
      ]);
    } catch {}
    void queryClient.removeQueries();
    notify('Déconnexion réussie', 'info');
  }, [notify, persistUser, queryClient]);

  const updateUser = useCallback(
    (patch: Partial<BuyerUser>) => {
      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );

  const sessionExpired = useCallback(() => {
    // Réponse refusée alors qu'aucune session n'est stockée : l'appel était
    // anonyme (écran compte ouvert sans connexion, requête partie avant la
    // connexion…). Il n'y a rien à expirer : on n'affiche rien et on ne purge
    // surtout pas la session qu'une connexion vient éventuellement de créer.
    if (!getSessionSync()) return;
    void saveSession(null);
    persistUser(null);
    AsyncStorage.multiRemove(['buyer_data_cache_v2', 'buyer_profile_cache']).catch(() => {});
    notify('Session expirée, veuillez vous reconnecter.', 'info', 'Connexion');
  }, [notify, persistUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isReady,
      openAuth,
      closeAuth,
      login,
      logout,
      updateUser,
      sessionExpired,
    }),
    [user, isReady, openAuth, closeAuth, login, logout, updateUser, sessionExpired],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal
        visible={isAuthOpen}
        mode={authMode}
        submitting={isSubmitting}
        onModeChange={setAuthMode}
        onClose={closeAuth}
        onSubmit={login}
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  }
  return context;
}
