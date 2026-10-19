/**
 * Toasts globaux — copie mobile du `Toast` du web (StorefrontView).
 *
 * Mêmes contraintes que le web mobile : pleine largeur (marges 12 px), sous
 * l'encoche, empilés, disparition automatique au bout de 5 s, croix de
 * fermeture. Utilisés par le panier (code promo, article retiré) et, à terme,
 * par tous les écrans qui notifient (ajout au panier…).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { COLORS } from '@/theme';
import type { NotificationType, ToastNotification } from '@/types';

interface ToastContextValue {
  notify: (message: string, type?: NotificationType, title?: string) => void;
  toasts: ToastNotification[];
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/** Palette par type — mêmes tons Tailwind que le composant web. */
const TOAST_STYLES: Record<
  NotificationType,
  { bg: string; border: string; icon: LucideIcon; iconColor: string }
> = {
  success: { bg: '#ECFDF5', border: '#D1FAE5', icon: CheckCircle, iconColor: '#10B981' },
  error: { bg: '#FFF1F2', border: '#FFE4E6', icon: XCircle, iconColor: '#F43F5E' },
  warning: { bg: '#FFFBEB', border: '#FEF3C7', icon: AlertCircle, iconColor: '#F59E0B' },
  info: { bg: '#FFF7ED', border: '#FFEDD5', icon: Info, iconColor: COLORS.brand },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, type: NotificationType = 'info', title?: string) => {
      const id = Math.random().toString(36).slice(2, 11);
      setToasts((prev) => [...prev, { id, message, type, title }]);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ notify, toasts, removeToast }}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

/**
 * Pile de toasts, positionnée sous l'encoche.
 *
 * Rendue par `ToastProvider` **et** à l'intérieur des modales natives
 * (`AuthModal`, `SheetModal`, `ConfirmationModal`) : une modale React Native
 * est une fenêtre séparée qui passe au-dessus de la pile normale, où le
 * web superpose ses toasts (z-99999 > modale z-10000). Sans cette copie, un
 * message affiché pendant qu'une feuille est ouverte resterait invisible.
 */
export function ToastViewport() {
  const ctx = useContext(ToastContext);
  const insets = useSafeAreaInsets();
  if (!ctx) return null;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { top: insets.top + 14 }]}
    >
      {ctx.toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={ctx.removeToast} />
      ))}
    </View>
  );
}

function ToastItem({
  toast,
  onRemove,
}: {
  toast: ToastNotification;
  onRemove: (id: string) => void;
}) {
  const [anim] = useState(() => new Animated.Value(0));
  const palette = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
  const Icon = palette.icon;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onRemove(toast.id));
    }, 5000);
    return () => clearTimeout(timer);
  }, [anim, onRemove, toast.id]);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: palette.bg, borderColor: palette.border },
        {
          opacity: anim,
          transform: [
            {
              translateX: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [32, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.iconWrap}>
        <Icon size={24} color={palette.iconColor} />
      </View>
      <View style={styles.body}>
        {toast.title ? <Text style={styles.title}>{toast.title}</Text> : null}
        <Text style={styles.message}>{toast.message}</Text>
      </View>
      <Pressable
        onPress={() => onRemove(toast.id)}
        hitSlop={10}
        style={styles.close}
        accessibilityLabel="Fermer la notification"
      >
        <X size={16} color="#94A3B8" />
      </Pressable>
    </Animated.View>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 99999,
    // Passe au-dessus des feuilles modales (elevation 20) sur Android.
    elevation: 32,
    gap: 12,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    maxWidth: 384,
    width: '100%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  iconWrap: {
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 18,
  },
  close: {
    padding: 4,
    margin: -4,
  },
});
