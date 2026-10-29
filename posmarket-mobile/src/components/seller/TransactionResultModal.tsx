/**
 * Modale de résultat de transaction — copie fidèle de
 * `src/components/TransactionResultModal.tsx` du web (rendu mobile) :
 * barre dégradée en haut, pastille animée, encadré montant, boutons.
 */

import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Loader2,
  MessageCircle,
  RefreshCw,
  X,
} from 'lucide-react-native';
import { COLORS } from '@/theme';
import { formatCurrency } from '@/utils';

export type TransactionModalStatus = 'success' | 'error' | 'cancelled' | 'loading';

export interface TransactionModalData {
  status: TransactionModalStatus;
  title?: string;
  message?: string;
  amount?: number;
  currency?: string;
  tier?: string;
  duration?: string;
  transactionId?: string;
  reference?: string;
  provider?: 'fedapay' | 'kkiapay' | 'feexpay' | 'saspay';
  date?: Date | string;
}

interface TransactionResultModalProps {
  isOpen: boolean;
  data: TransactionModalData | null;
  onClose: () => void;
  onRetry?: () => void;
}

const BAR_GRADIENTS: Record<TransactionModalStatus, readonly [string, string, string]> = {
  success: ['#34D399', '#14B8A6', '#059669'],
  error: ['#EF4444', '#F43F5E', '#DC2626'],
  cancelled: ['#FBBF24', '#F97316', '#D97706'],
  loading: ['#60A5FA', '#6366F1', '#2563EB'],
};

const TITLE_COLORS: Record<TransactionModalStatus, string> = {
  success: '#047857',
  error: '#DC2626',
  cancelled: '#B45309',
  loading: '#1D4ED8',
};

export function TransactionResultModal({
  isOpen,
  data,
  onClose,
  onRetry,
}: TransactionResultModalProps) {
  // Valeur animée stable (état paresseux : jamais réinitialisée par un rendu).
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!isOpen || data?.status !== 'loading') return;
    spin.setValue(0);
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [isOpen, data?.status, spin]);

  if (!isOpen || !data) return null;

  const {
    status,
    title,
    message,
    amount,
    currency = 'FCFA',
    tier,
    duration,
  } = data;

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ScrollView
          contentContainerStyle={styles.overlayScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Barre décorative */}
            <LinearGradient
              colors={[...BAR_GRADIENTS[status]] as const}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.topBar}
            />

            {status !== 'loading' ? (
              <Pressable
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityLabel="Fermer"
              >
                <X size={18} color="#94A3B8" />
              </Pressable>
            ) : null}

            <View style={styles.body}>
              {/* Pastille animée */}
              <View style={styles.iconWrap}>
                {status === 'success' ? (
                  <>
                    <View style={[styles.waveLarge, { backgroundColor: 'rgba(16,185,129,0.10)' }]} />
                    <View style={[styles.waveSmall, { backgroundColor: 'rgba(16,185,129,0.20)' }]} />
                    <Particle style={{ top: -8, left: -8, backgroundColor: '#34D399' }} />
                    <Particle style={{ top: -12, right: 0, backgroundColor: '#FBBF24' }} />
                    <Particle style={{ bottom: 0, left: -12, backgroundColor: '#2DD4BF' }} />
                    <Particle style={{ bottom: 4, right: -8, backgroundColor: '#6EE7B7' }} />
                  </>
                ) : null}
                {status === 'error' ? (
                  <>
                    <View style={[styles.waveLarge, { backgroundColor: 'rgba(239,68,68,0.10)' }]} />
                    <View style={[styles.waveSmall, { backgroundColor: 'rgba(239,68,68,0.20)' }]} />
                  </>
                ) : null}
                {status === 'cancelled' ? (
                  <>
                    <View style={[styles.waveLarge, { backgroundColor: 'rgba(245,158,11,0.10)' }]} />
                    <View style={[styles.waveSmall, { backgroundColor: 'rgba(245,158,11,0.20)' }]} />
                  </>
                ) : null}

                {status === 'loading' ? (
                  <Animated.View style={[styles.loadingRing, { transform: [{ rotate }] }]}>
                    <Loader2 size={32} color="#2563EB" />
                  </Animated.View>
                ) : (
                  <LinearGradient
                    colors={
                      status === 'success'
                        ? ['#059669', '#2DD4BF']
                        : status === 'error'
                          ? ['#DC2626', '#FB7185']
                          : ['#D97706', '#FB923C']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.badgeOuter}
                  >
                    <View
                      style={[
                        styles.badgeInner,
                        {
                          backgroundColor:
                            status === 'success'
                              ? '#10B981'
                              : status === 'error'
                                ? '#EF4444'
                                : '#F59E0B',
                        },
                      ]}
                    >
                      {status === 'success' ? (
                        <Check size={38} color="#FFFFFF" strokeWidth={3.5} />
                      ) : status === 'error' ? (
                        <X size={38} color="#FFFFFF" strokeWidth={3.5} />
                      ) : (
                        <AlertTriangle size={36} color="#FFFFFF" strokeWidth={2.8} />
                      )}
                    </View>
                  </LinearGradient>
                )}
              </View>

              {/* Titre */}
              <Text style={[styles.title, { color: TITLE_COLORS[status] }]}>
                {title ||
                  (status === 'success'
                    ? 'Paiement Réussi !'
                    : status === 'error'
                      ? 'Paiement Échoué'
                      : status === 'cancelled'
                        ? 'Paiement Annulé'
                        : 'Vérification en cours...')}
              </Text>

              {/* Message */}
              <Text style={styles.message}>
                {message ||
                  (status === 'success'
                    ? 'Votre abonnement a été activé avec succès. Toutes vos fonctionnalités sont prêtes.'
                    : status === 'error'
                      ? "La transaction n'a pas pu être validée par l'opérateur."
                      : status === 'cancelled'
                        ? "Vous avez annulé la session de paiement. Aucun montant n'a été débité."
                        : 'Confirmation de votre transaction en cours auprès de la passerelle de paiement...')}
              </Text>

              {/* Montant */}
              {typeof amount === 'number' && amount > 0 ? (
                <View style={styles.amountBox}>
                  <Text style={styles.amountLabel}>Montant Total</Text>
                  <View style={styles.amountRow}>
                    <Text style={styles.amountValue}>
                      {formatCurrency(amount).replace(/\s*FCFA/i, '').trim()}
                    </Text>
                    <Text style={styles.amountCurrency}>{currency}</Text>
                  </View>
                  {tier ? (
                    <View style={styles.tierBadge}>
                      <Text style={styles.tierText}>Formule {tier}</Text>
                      <Text style={styles.tierDot}>•</Text>
                      <Text style={styles.tierText}>
                        {duration === 'annual'
                          ? 'Annuel'
                          : duration === 'quarterly'
                            ? 'Trimestriel'
                            : 'Mensuel'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Actions */}
              <View style={styles.actions}>
                {status === 'success' ? (
                  <Pressable onPress={onClose} style={styles.primaryBtn}>
                    <Text style={styles.primaryText}>Accéder à mon espace</Text>
                    <ArrowRight size={16} color="#FFFFFF" />
                  </Pressable>
                ) : null}

                {status === 'error' || status === 'cancelled' ? (
                  <>
                    {onRetry ? (
                      <Pressable onPress={onRetry} style={styles.primaryBtn}>
                        <RefreshCw size={16} color="#FFFFFF" />
                        <Text style={styles.primaryText}>Réessayer le paiement</Text>
                      </Pressable>
                    ) : null}
                    <View style={styles.secondaryRow}>
                      <Pressable
                        onPress={() =>
                          void Linking.openURL(
                            "https://wa.me/?text=Bonjour%20PosMarket%2C%20j%27ai%20besoin%20d%27assistance%20pour%20mon%20paiement%20d%27abonnement.",
                          )
                        }
                        style={styles.whatsappBtn}
                      >
                        <MessageCircle size={14} color="#059669" />
                        <Text style={styles.whatsappText}>Aide WhatsApp</Text>
                      </Pressable>
                      <Pressable onPress={onClose} style={styles.closeSecondary}>
                        <Text style={styles.closeSecondaryText}>Fermer</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Particle({ style }: { style: object }) {
  return <View style={[styles.particle, style]} />;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  overlayScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  topBar: { height: 8, width: '100%' },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    borderRadius: 999,
    zIndex: 10,
  },
  body: {
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: 96,
    height: 96,
  },
  waveLarge: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  waveSmall: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInner: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  loadingRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EFF6FF',
    borderWidth: 4,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
    textAlign: 'center',
  },
  message: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
    marginBottom: 24,
  },
  amountBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#94A3B8',
    marginBottom: 2,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  amountValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  amountCurrency: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tierBadge: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(254,215,170,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(253,186,116,0.6)',
  },
  tierText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  tierDot: {
    fontSize: 11,
    color: '#FB923C',
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: COLORS.brand,
    shadowColor: COLORS.brand,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  whatsappBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  whatsappText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  closeSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  closeSecondaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
});
