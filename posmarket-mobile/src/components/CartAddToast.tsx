/**
 * Toast « Ajouté au panier » — copie mobile du toast du web (StorefrontView).
 *
 * Carte blanche en haut de l'écran (sous l'encoche) : vignette 48 px,
 * « AJOUTÉ AU PANIER » vert en capitales, nom du produit, prix en orange,
 * croix de fermeture, barre de progression 4 s et disparition automatique.
 * Partagée entre l'accueil (ajout depuis la grille) et la fiche produit
 * (ajout direct, feuille d'options, ajout gros).
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
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { CheckCircle2, Package, X } from 'lucide-react-native';
import { resolveImageUrl } from '@/api/client';
import { COLORS } from '@/theme';
import { formatCurrency } from '@/utils';

/** Durée d'affichage = 4 s, identique au web (barre « shrink 4s linear »). */
const TOAST_DURATION = 4000;

export interface CartAddToastData {
  name: string;
  price: number;
  image?: string | null;
}

interface CartAddToastContextValue {
  /** Affiche (ou relance) le toast « Ajouté au panier ». */
  show: (data: CartAddToastData) => void;
}

const CartAddToastContext = createContext<CartAddToastContextValue | null>(null);

export function CartAddToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<(CartAddToastData & { key: number }) | null>(null);

  const show = useCallback((data: CartAddToastData) => {
    // Le key force le remontage de la carte : chaque ajout relance
    // l'animation d'entrée et la barre de progression.
    setToast((prev) => ({ ...data, key: (prev?.key ?? 0) + 1 }));
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <CartAddToastContext.Provider value={value}>
      {children}
      {toast ? (
        <CartAddToastCard
          key={toast.key}
          data={toast}
          onDone={() => setToast(null)}
        />
      ) : null}
    </CartAddToastContext.Provider>
  );
}

/** Renvoie la fonction `show` : `showCartAddToast({ name, price, image })`. */
export function useCartAddToast(): (data: CartAddToastData) => void {
  const ctx = useContext(CartAddToastContext);
  if (!ctx) {
    throw new Error('useCartAddToast doit être utilisé dans un CartAddToastProvider');
  }
  return ctx.show;
}

function CartAddToastCard({
  data,
  onDone,
}: {
  data: CartAddToastData;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [imageFailed, setImageFailed] = useState(false);
  const [enter] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));
  const dismissedRef = useRef(false);

  const imageUrl = resolveImageUrl(data.image);
  const showImage = Boolean(imageUrl) && !imageFailed;

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    Animated.timing(enter, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      onDone();
    });
  }, [enter, onDone]);

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 240, useNativeDriver: true }).start();
    Animated.timing(progress, {
      toValue: 1,
      duration: TOAST_DURATION,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    const timer = setTimeout(dismiss, TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [enter, progress, dismiss]);

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] });
  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['100%', '0%'] });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.toast, { opacity: enter, transform: [{ translateY }], top: insets.top + 12 }]}
    >
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.thumb}>
            {showImage ? (
              <Image
                source={{ uri: imageUrl as string }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                alt=""
                accessible={false}
                onError={() => setImageFailed(true)}
              />
            ) : (
              <View style={styles.thumbFallback}>
                <Package size={18} color="#d1d5db" />
              </View>
            )}
          </View>
          <View style={styles.texts}>
            <View style={styles.titleRow}>
              <CheckCircle2 size={12} color="#22c55e" strokeWidth={3} />
              <Text style={styles.title}>Ajouté au panier</Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {data.name}
            </Text>
            <Text style={styles.price}>{formatCurrency(data.price)}</Text>
          </View>
          <Pressable
            style={styles.close}
            onPress={dismiss}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Fermer la notification"
          >
            <X size={16} color="#4b5563" />
          </Pressable>
        </View>
      </View>
      {/* Fine ligne de progression en bas (comme le web). */}
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: barWidth }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 16,
    zIndex: 1100,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    padding: 12,
    elevation: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 20 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    flexShrink: 0,
  },
  thumbFallback: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  title: {
    fontSize: 9,
    fontWeight: '800',
    color: '#16a34a',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  name: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
  },
  price: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.brand,
    marginTop: 2,
  },
  close: {
    padding: 5,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  track: {
    height: 2,
    backgroundColor: '#f3f4f6',
    marginTop: 12,
    overflow: 'hidden',
  },
  fill: {
    height: 2,
    backgroundColor: 'rgba(34,197,94,0.5)',
  },
});