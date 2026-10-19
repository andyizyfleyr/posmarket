/**
 * Abonnement vendeur — copie fidèle de `SubscriptionView` +
 * `SubscriptionClientWrapper` du web (rendu mobile < 768 px).
 *
 * Adaptations mobiles assumées :
 * - les widgets de paiement des opérateurs (SDK JavaScript navigateur) sont
 *   chargés dans une WebView (`payment-html.ts`), puis le résultat est
 *   confirmé côté serveur comme au web ;
 * - « Trimestriel » / « Annuel » ouvrent WhatsApp (comme `window.open`) ;
 * - l'état de l'abonnement vient du bootstrap vendeur (`useSeller`) et est
 *   rafraîchi après chaque mutation (`onRefresh` ≡ `router.refresh()`).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import {
  Award,
  Check,
  Info,
  Shield,
  Star,
  Users,
  X,
  Zap,
} from 'lucide-react-native';
import { COLORS } from '@/theme';
import { formatCurrency, getDaysRemaining } from '@/utils';
import {
  confirmSubscriptionPayment,
  createSubscriptionPayment,
  fetchSubscriptionPaymentConfig,
  type PaymentProvider,
  type SubscriptionDuration,
  type SubscriptionPaymentConfig,
  type SubscriptionSnapshot,
} from '@/api/seller-subscription';
import { API_BASE_URL } from '@/api/client';
import {
  SUBSCRIPTION_PLANS,
  getSubscriptionPlan,
  type SubscriptionPlan,
} from './subscription/plans';
import { buildPaymentHtml } from './subscription/payment-html';
import {
  TransactionResultModal,
  type TransactionModalData,
} from './TransactionResultModal';

interface SellerSubscriptionViewProps {
  subscription: SubscriptionSnapshot;
  userRole: string;
  onRefresh: () => Promise<void> | void;
  onUnauthorized: () => void;
}

const PLAN_ICONS = {
  STARTER: { Icon: Star, color: '#16A34A', background: '#F0FDF4' },
  PRO: { Icon: Award, color: COLORS.brand, background: '#FFF7ED' },
  ENTERPRISE: { Icon: Zap, color: '#9333EA', background: '#FAF5FF' },
} as const;

const PROVIDER_NAMES: Record<PaymentProvider, string> = {
  kkiapay: 'Kkiapay',
  fedapay: 'FedaPay',
  feexpay: 'FeexPay',
};

/** Montant de la formule selon la durée choisie. */
function planAmount(
  tier: SubscriptionPlan['tier'],
  duration: SubscriptionDuration,
): number {
  const plan = getSubscriptionPlan(tier);
  if (!plan) return 0;
  if (duration === 'quarterly') return plan.priceQuarterly;
  if (duration === 'annual') return plan.priceAnnual;
  return plan.priceMonthly;
}

export function SellerSubscriptionView({
  subscription,
  userRole,
  onRefresh,
  onUnauthorized,
}: SellerSubscriptionViewProps) {
  const isSeller = userRole === 'SELLER';
  const isExpired = new Date(subscription.endDate) < new Date();
  const currentTierIsActive = subscription.status === 'ACTIVE' && !isExpired;
  const currentTierPlan = getSubscriptionPlan(subscription.tier);
  const hasActivePlan = !!currentTierPlan && currentTierIsActive;
  const daysLeft = getDaysRemaining(subscription.endDate);

  const [config, setConfig] = useState<SubscriptionPaymentConfig | null>(null);
  const [duration, setDuration] = useState<SubscriptionDuration>(
    (subscription.duration as SubscriptionDuration) || 'monthly',
  );
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [modalData, setModalData] = useState<TransactionModalData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<{
    tier: SubscriptionPlan['tier'];
    duration: SubscriptionDuration;
  } | null>(null);
  const [paymentHtml, setPaymentHtml] = useState<string | null>(null);
  // Facture courante (confirmation après retour du guichet).
  const [pendingTransaction, setPendingTransaction] = useState<string | null>(null);

  const expiredRef = useRef(false);
  const handleUnauthorized = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    onUnauthorized();
  }, [onUnauthorized]);

  useEffect(() => {
    let active = true;
    fetchSubscriptionPaymentConfig()
      .then((res) => {
        if (!active) return;
        if (res.success) setConfig(res);
        else if (res.error === 'Unauthorized') handleUnauthorized();
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [handleUnauthorized]);

  /** Tirer vers le bas : recharge l'état d'abonnement et la config de paiement. */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetchSubscriptionPaymentConfig().catch(() => null);
      if (res?.success) setConfig(res);
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const plans = useMemo(
    () => [
      SUBSCRIPTION_PLANS.STARTER,
      SUBSCRIPTION_PLANS.PRO,
      SUBSCRIPTION_PLANS.ENTERPRISE,
    ],
    [],
  );

  // Économies dynamiques par formule (comme le web).
  const savings = useMemo(() => {
    const result: Record<
      string,
      { quarterly: number; annual: number; quarterlyPct: number; annualPct: number }
    > = {};
    plans.forEach((plan) => {
      const monthlyCost = plan.priceMonthly;
      const quarterlyCost = plan.priceQuarterly;
      const annualCost = plan.priceAnnual;
      const quarterlySave = monthlyCost * 3 - quarterlyCost;
      const quarterlyPct = Math.round((quarterlySave / (monthlyCost * 3)) * 100);
      const annualSave = monthlyCost * 12 - annualCost;
      const annualPct = Math.round((annualSave / (monthlyCost * 12)) * 100);
      result[plan.tier] = { quarterly: quarterlySave, annual: annualSave, quarterlyPct, annualPct };
    });
    return result;
  }, [plans]);

  const openModal = useCallback((data: TransactionModalData) => {
    setModalData(data);
    setIsModalOpen(true);
  }, []);

  const providerOf = useCallback(
    (): PaymentProvider => config?.provider || 'kkiapay',
    [config],
  );

  /** Confirmation serveur après retour du guichet (par opérateur). */
  const confirmPayment = useCallback(
    async (
      provider: PaymentProvider,
      transactionId: string,
      reference: string,
      amount: number,
      tier: SubscriptionPlan['tier'],
      duration: SubscriptionDuration,
    ) => {
      try {
        const confirm = await confirmSubscriptionPayment(transactionId, reference);
        if (confirm.error === 'Unauthorized') {
          handleUnauthorized();
          return;
        }
        if (confirm.success) {
          openModal({
            status: 'success',
            title: 'Paiement Réussi !',
            message: `Votre abonnement ${tier} (${
              duration === 'annual'
                ? 'Annuel'
                : duration === 'quarterly'
                  ? 'Trimestriel'
                  : 'Mensuel'
            }) ${provider === 'kkiapay' ? 'est activé.' : 'est désormais actif.'}`,
            amount,
            currency: 'FCFA',
            tier,
            duration,
            transactionId,
            reference,
            provider,
            date: new Date(),
          });
          void onRefresh();
        } else {
          openModal({
            status: 'error',
            title: 'Paiement Non Confirmé',
            message:
              confirm.error ||
              `Le paiement n'a pas pu être validé par ${PROVIDER_NAMES[provider]}.`,
            amount,
            currency: 'FCFA',
            tier,
            duration,
            transactionId,
            reference,
            provider,
            date: new Date(),
          });
          void onRefresh();
        }
      } catch {
        openModal({
          status: 'error',
          title: 'Erreur de Confirmation',
          message:
            provider === 'kkiapay'
              ? 'Une erreur est survenue lors de la confirmation du paiement Kkiapay.'
              : 'Une erreur est survenue lors de la validation de votre paiement.',
          amount,
          tier,
          duration,
          transactionId,
          provider,
          date: new Date(),
        });
      }
    },
    [handleUnauthorized, onRefresh, openModal],
  );

  const handlePaymentMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let payload: { type?: string; reference?: string; message?: string } = {};
      try {
        payload = JSON.parse(event.nativeEvent.data) as typeof payload;
      } catch {
        return;
      }
      const provider = providerOf();
      const attempt = lastAttempt;
      const amount = attempt ? planAmount(attempt.tier, attempt.duration) : 0;

      if (payload.type === 'module-missing') {
        setPaymentHtml(null);
        const messages: Record<PaymentProvider, string> = {
          kkiapay: 'Le module de paiement Kkiapay est encore en cours de chargement.',
          fedapay:
            'Le module de paiement FedaPay est encore en cours de chargement. Veuillez patienter un instant et réessayer.',
          feexpay:
            'Le module de paiement FeexPay est encore en cours de chargement. Veuillez patienter un instant et réessayer.',
        };
        openModal({
          status: 'error',
          title: 'Module en Chargement',
          message: messages[provider],
          tier: attempt?.tier,
          duration: attempt?.duration,
          amount,
          date: new Date(),
        });
        return;
      }

      if (payload.type === 'success') {
        setPaymentHtml(null);
        if (!attempt || !config || !pendingTransaction) return;
        const reference = String(payload.reference || '').trim();
        if (!reference && (provider === 'fedapay' || provider === 'feexpay')) {
          openModal({
            status: 'error',
            title: 'Référence Introuvable',
            message: `Impossible de récupérer l'identifiant de transaction ${PROVIDER_NAMES[provider]}.`,
            amount,
            tier: attempt.tier,
            duration: attempt.duration,
            provider,
            date: new Date(),
          });
          return;
        }
        void confirmPayment(
          provider,
          pendingTransaction,
          reference,
          amount,
          attempt.tier,
          attempt.duration,
        );
        return;
      }

      if (payload.type === 'cancelled') {
        setPaymentHtml(null);
        openModal(
          provider === 'kkiapay'
            ? {
                status: 'cancelled',
                title: 'Paiement Interrompu',
                message: "La session de paiement Kkiapay a été annulée ou n'a pas abouti.",
                amount,
                tier: attempt?.tier,
                duration: attempt?.duration,
                provider,
                date: new Date(),
              }
            : {
                status: 'cancelled',
                title: 'Paiement Annulé',
                message:
                  'Vous avez fermé le guichet de paiement sans finaliser la transaction.',
                amount,
                tier: attempt?.tier,
                duration: attempt?.duration,
                provider,
                date: new Date(),
              },
        );
        return;
      }

      // Échec opérateur.
      setPaymentHtml(null);
      openModal(
        provider === 'kkiapay'
          ? {
              status: 'cancelled',
              title: 'Paiement Interrompu',
              message: "La session de paiement Kkiapay a été annulée ou n'a pas abouti.",
              amount,
              tier: attempt?.tier,
              duration: attempt?.duration,
              provider,
              date: new Date(),
            }
          : {
              status: 'error',
              title: 'Paiement Non Abouti',
              message: payload.message || 'La transaction a été refusée ou interrompue.',
              amount,
              tier: attempt?.tier,
              duration: attempt?.duration,
              provider,
              date: new Date(),
            },
      );
    },
    [config, confirmPayment, lastAttempt, openModal, pendingTransaction, providerOf],
  );

  /**
   * Flux de paiement mensuel : facture PENDING puis guichet de l'opérateur
   * configuré (voir `handlePay` du wrapper web).
   */
  const handlePay = useCallback(
    async (tier: SubscriptionPlan['tier'], payDuration: SubscriptionDuration) => {
      setLastAttempt({ tier, duration: payDuration });

      const res = await createSubscriptionPayment(tier, payDuration);
      if (res.error === 'Unauthorized') {
        handleUnauthorized();
        return;
      }
      if (!res.success) {
        openModal({
          status: 'error',
          title: 'Initialisation Échouée',
          message: res.error || 'Impossible de créer la facture de paiement.',
          tier,
          duration: payDuration,
          date: new Date(),
        });
        return;
      }
      if (!res.transactionId || !res.amount) {
        openModal({
          status: 'error',
          title: 'Facture Invalide',
          message: 'Les données de transaction sont incomplètes.',
          tier,
          duration: payDuration,
          date: new Date(),
        });
        return;
      }
      if (!config) return;

      const provider = config.provider;

      if (provider === 'feexpay') {
        if (!config.feexpayShopId || !config.feexpayApiKey) {
          openModal({
            status: 'error',
            title: 'Configuration Manquante',
            message: "Le paiement FeexPay n'est pas configuré par l'administrateur.",
            tier,
            duration: payDuration,
            amount: res.amount,
            date: new Date(),
          });
          return;
        }
      } else if (provider === 'fedapay') {
        if (!config.fedapayPublicKey) {
          openModal({
            status: 'error',
            title: 'Configuration Manquante',
            message: "Le paiement FedaPay n'est pas configuré par l'administrateur.",
            tier,
            duration: payDuration,
            amount: res.amount,
            date: new Date(),
          });
          return;
        }
      } else if (!config.kkiapayPublicKey) {
        openModal({
          status: 'error',
          title: 'Configuration Manquante',
          message: "Le paiement Kkiapay n'est pas configuré par l'administrateur.",
          tier,
          duration: payDuration,
          amount: res.amount,
          date: new Date(),
        });
        return;
      }

      // La facture courante est stockée pour la confirmation au retour du guichet.
      setPendingTransaction(res.transactionId);

      setPaymentHtml(
        buildPaymentHtml({
          provider,
          amount: res.amount,
          transactionId: res.transactionId,
          tier,
          duration: payDuration,
          userName: config.userName,
          userEmail: config.userEmail,
          userPhone: config.userPhone,
          kkiapayPublicKey: config.kkiapayPublicKey,
          kkiapayEnv: config.kkiapayEnv,
          fedapayPublicKey: config.fedapayPublicKey,
          fedapayEnv: config.fedapayEnv,
          feexpayShopId: config.feexpayShopId,
          feexpayApiKey: config.feexpayApiKey,
          feexpayEnv: config.feexpayEnv,
        }),
      );
    },
    [config, handleUnauthorized, openModal],
  );

  // Transaction courante (confirmation après retour du guichet).
  const handleSubscribe = useCallback(
    async (plan: SubscriptionPlan) => {
      if (hasActivePlan && plan.tier === currentTierPlan?.tier) return;

      if (duration !== 'monthly') {
        const price = duration === 'quarterly' ? plan.priceQuarterly : plan.priceAnnual;
        const durationLabel = duration === 'quarterly' ? 'Trimestriel' : 'Annuel';
        const message = `Bonjour l'équipe PosMarket, je souhaite souscrire à la formule ${plan.name} (${durationLabel}) au tarif de ${formatCurrency(price)}.`;
        void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
        return;
      }

      setLoading(plan.tier);
      try {
        await handlePay(plan.tier, duration);
      } finally {
        setLoading(null);
      }
    },
    [currentTierPlan?.tier, duration, handlePay, hasActivePlan],
  );

  const getButtonText = (plan: SubscriptionPlan) => {
    if (loading === plan.tier) return 'Traitement...';
    if (isSeller) return 'Accès Restreint';
    if (hasActivePlan && plan.tier === currentTierPlan?.tier) return 'Plan Actuel';
    if (currentTierPlan?.tier === plan.tier && isExpired) return 'Réactiver';
    if (duration !== 'monthly') return 'Contactez-nous';
    return hasActivePlan ? `Passer à ${plan.name}` : `Choisir ${plan.name}`;
  };

  const closePayment = useCallback(
    (provider: PaymentProvider) => {
      setPaymentHtml(null);
      openModal(
        provider === 'kkiapay'
          ? {
              status: 'cancelled',
              title: 'Paiement Interrompu',
              message: "La session de paiement Kkiapay a été annulée ou n'a pas abouti.",
              tier: lastAttempt?.tier,
              duration: lastAttempt?.duration,
              provider,
              date: new Date(),
            }
          : {
              status: 'cancelled',
              title: 'Paiement Annulé',
              message: 'Vous avez fermé le guichet de paiement sans finaliser la transaction.',
              tier: lastAttempt?.tier,
              duration: lastAttempt?.duration,
              provider,
              date: new Date(),
            },
      );
    },
    [lastAttempt?.duration, lastAttempt?.tier, openModal],
  );

  const statusTone = isExpired
    ? 'expired'
    : !hasActivePlan
      ? 'none'
      : daysLeft <= 7
        ? 'soon'
        : 'active';

  const statusStyles = {
    expired: { background: '#FEF2F2', border: '#FEE2E2', pill: '#FEE2E2', pillColor: '#EF4444' },
    none: { background: '#FFF7ED', border: '#FFEDD5', pill: '#FFEDD5', pillColor: '#F97316' },
    soon: { background: '#FFFBEB', border: '#FEF3C7', pill: '#FEF3C7', pillColor: '#D97706' },
    active: { background: '#FFFFFF', border: '#E2E8F0', pill: '#DCFCE7', pillColor: '#16A34A' },
  }[statusTone];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.brand}
            colors={[COLORS.brand]}
          />
        }
      >
        {/* Abonnement actuel */}
        <View style={styles.statusCardWrap}>
          <View
            style={[
              styles.statusCard,
              { backgroundColor: statusStyles.background, borderColor: statusStyles.border },
            ]}
          >
            <View style={styles.statusRow}>
              <View style={styles.statusLeft}>
                <View style={[styles.statusIcon, { backgroundColor: statusStyles.pill }]}>
                  {!hasActivePlan ? (
                    <Info size={20} color={statusStyles.pillColor} />
                  ) : isExpired ? (
                    <X size={20} color={statusStyles.pillColor} />
                  ) : (
                    <Shield size={20} color={statusStyles.pillColor} />
                  )}
                </View>
                <View>
                  <Text style={styles.statusLabel}>Abonnement actuel</Text>
                  <Text
                    style={[styles.statusPlan, isExpired && { color: '#DC2626' }]}
                  >
                    {currentTierPlan?.name || 'Aucun'}
                    {isExpired ? ' (Expiré)' : ''}
                  </Text>
                </View>
              </View>
              {hasActivePlan ? (
                <View style={styles.statusRight}>
                  <Text style={styles.statusExpiresLabel}>Expire dans</Text>
                  <Text
                    style={[
                      styles.statusDays,
                      daysLeft <= 7 && { color: '#D97706' },
                    ]}
                  >
                    {daysLeft}j
                  </Text>
                </View>
              ) : !isExpired ? (
                <View style={styles.noPlanBadge}>
                  <Text style={styles.noPlanText}>Aucun abonnement actif</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Choisissez votre formule</Text>
          <Text style={styles.headerSubtitle}>
            Des fonctionnalités adaptées à la taille de votre commerce.
          </Text>

          {isSeller ? (
            <View style={styles.sellerNotice}>
              <Users size={20} color={COLORS.brand} />
              <Text style={styles.sellerNoticeText}>
                En tant que vendeur, l&apos;abonnement est géré par le propriétaire de la
                boutique.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Sélecteur de durée */}
        <View style={styles.durationWrap}>
          <View style={styles.durationPill}>
            {(
              [
                { value: 'monthly' as const, label: 'Mensuel' },
                { value: 'quarterly' as const, label: 'Trimestriel' },
                { value: 'annual' as const, label: 'Annuel' },
              ] as const
            ).map((option) => {
              const active = duration === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setDuration(option.value)}
                  style={[styles.durationBtn, active && styles.durationBtnActive]}
                >
                  <Text
                    style={[styles.durationText, active && styles.durationTextActive]}
                  >
                    {option.label}
                  </Text>
                  {option.value === 'annual' && duration !== 'annual' && savings.PRO ? (
                    <View style={styles.savingBadge}>
                      <Text style={styles.savingBadgeText}>
                        -{savings.PRO.annualPct}%
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Grille des formules */}
        <View style={styles.plansGrid}>
          {plans.map((plan) => {
            const isCurrent = hasActivePlan && currentTierPlan?.tier === plan.tier;
            const price =
              duration === 'monthly'
                ? plan.priceMonthly
                : duration === 'quarterly'
                  ? plan.priceQuarterly
                  : plan.priceAnnual;
            const isDowngrade =
              hasActivePlan &&
              plans.findIndex((p) => p.tier === plan.tier) <
                plans.findIndex((p) => p.tier === currentTierPlan?.tier);
            const displayPrice = price > 0 ? formatCurrency(price) : 'Gratuit';
            const iconData = PLAN_ICONS[plan.tier];
            const planSaving = savings[plan.tier];
            const isBestValue = plan.tier === 'PRO';
            const disabled = (isCurrent && !isExpired) || loading !== null || isSeller;

            return (
              <View
                key={plan.tier}
                style={[
                  styles.planCard,
                  isCurrent && !isExpired ? styles.planCardCurrent : styles.planCardPlain,
                ]}
              >
                {isCurrent && !isExpired ? (
                  <View style={styles.planBadgeWrap}>
                    <View style={[styles.planBadge, { backgroundColor: COLORS.brand }]}>
                      <Text style={styles.planBadgeText}>Actuel</Text>
                    </View>
                  </View>
                ) : null}
                {isBestValue && !isCurrent ? (
                  <View style={styles.planBadgeWrap}>
                    <View style={[styles.planBadge, { backgroundColor: '#0F172A' }]}>
                      <Text style={styles.planBadgeText}>Populaire</Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.planHeader}>
                  <View style={styles.planTitleRow}>
                    <View style={[styles.planIcon, { backgroundColor: iconData.background }]}>
                      <iconData.Icon size={18} color={iconData.color} />
                    </View>
                    <Text style={styles.planName}>{plan.name}</Text>
                  </View>
                  <Text style={styles.planDescription}>{plan.description}</Text>
                </View>

                <View style={styles.priceBlock}>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceValue}>{displayPrice}</Text>
                    {price > 0 ? (
                      <Text style={styles.priceSuffix}>
                        /{duration === 'monthly' ? 'mois' : duration === 'quarterly' ? '3 mois' : 'an'}
                      </Text>
                    ) : null}
                  </View>
                  {duration !== 'monthly' && price > 0 && planSaving ? (
                    <Text style={styles.savingText}>
                      Vous économisez{' '}
                      {formatCurrency(
                        duration === 'quarterly' ? planSaving.quarterly : planSaving.annual,
                      )}{' '}
                      vs mensuel
                    </Text>
                  ) : null}
                </View>

                <View style={styles.limitsBlock}>
                  <View style={styles.limitRow}>
                    <Check size={14} color="#22C55E" />
                    <Text style={styles.limitText}>
                      <Text style={styles.limitValue}>
                        {plan.features.maxStores === 999 ? 'Illimité' : plan.features.maxStores}
                      </Text>{' '}
                      boutique{plan.features.maxStores > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.limitRow}>
                    <Check size={14} color="#22C55E" />
                    <Text style={styles.limitText}>
                      <Text style={styles.limitValue}>
                        {plan.features.maxProducts === 999999
                          ? 'Illimité'
                          : plan.features.maxProducts}
                      </Text>{' '}
                      produit{plan.features.maxProducts > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.featuresBlock}>
                  {[
                    { label: 'Point de Vente (POS)', included: true },
                    { label: 'Gestion stocks & clients', included: true },
                    { label: 'Boutique en ligne', included: plan.features.enableStorefront },
                    { label: 'Rapports avancés', included: plan.features.enableAdvancedReports },
                    {
                      label: 'Tickets personnalisés',
                      included: plan.features.enableCustomReceipts,
                    },
                  ].map((feature) => (
                    <View key={feature.label} style={styles.featureRow}>
                      {feature.included ? (
                        <Check size={12} color="#22C55E" />
                      ) : (
                        <X size={12} color="#CBD5E1" />
                      )}
                      <Text
                        style={[
                          styles.featureText,
                          !feature.included && styles.featureTextMuted,
                        ]}
                      >
                        {feature.label}
                      </Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  onPress={() => void handleSubscribe(plan)}
                  disabled={disabled}
                  style={[
                    styles.ctaBtn,
                    isCurrent && !isExpired
                      ? styles.ctaCurrent
                      : isSeller
                        ? styles.ctaSeller
                        : isDowngrade
                          ? styles.ctaDowngrade
                          : styles.ctaPrimary,
                  ]}
                >
                  {loading === plan.tier ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={[styles.ctaText, styles.ctaTextPrimary]}>Activation...</Text>
                    </>
                  ) : (
                    <Text
                      style={[
                        styles.ctaText,
                        isCurrent && !isExpired
                          ? styles.ctaTextDisabled
                          : isSeller
                            ? styles.ctaTextSeller
                            : isDowngrade
                              ? styles.ctaTextDowngrade
                              : styles.ctaTextPrimary,
                      ]}
                    >
                      {getButtonText(plan)}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Guichet de paiement (WebView) */}
      <Modal
        visible={paymentHtml !== null}
        animationType="slide"
        onRequestClose={() => closePayment(providerOf())}
      >
        <View style={styles.webviewScreen}>
          <View style={styles.webviewHeader}>
            <Text style={styles.webviewTitle}>
              Paiement {PROVIDER_NAMES[providerOf()]}
            </Text>
            <Pressable
              onPress={() => closePayment(providerOf())}
              style={styles.webviewClose}
              accessibilityLabel="Fermer"
            >
              <X size={18} color="#475569" />
            </Pressable>
          </View>
          {paymentHtml ? (
            <WebView
              source={{ html: paymentHtml, baseUrl: API_BASE_URL }}
              originWhitelist={['*']}
              onMessage={handlePaymentMessage}
              javaScriptEnabled
              domStorageEnabled
              style={styles.webview}
            />
          ) : null}
        </View>
      </Modal>

      <TransactionResultModal
        isOpen={isModalOpen}
        data={modalData}
        onClose={() => {
          setIsModalOpen(false);
          void onRefresh();
        }}
        onRetry={
          lastAttempt
            ? () => {
                setIsModalOpen(false);
                void handlePay(lastAttempt.tier, lastAttempt.duration);
              }
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },

  statusCardWrap: { width: '100%', maxWidth: 672, marginBottom: 24 },
  statusCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLabel: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  statusPlan: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  statusRight: { alignItems: 'flex-end' },
  statusExpiresLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  statusDays: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  noPlanBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  noPlanText: { fontSize: 12, fontWeight: '600', color: '#EA580C' },

  header: { alignItems: 'center', marginBottom: 24, width: '100%', maxWidth: 672 },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  sellerNotice: {
    marginTop: 24,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: 448,
  },
  sellerNoticeText: { flex: 1, fontSize: 12, color: '#475569' },

  durationWrap: { marginBottom: 32 },
  durationPill: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
  },
  durationBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    position: 'relative',
  },
  durationBtnActive: {
    backgroundColor: COLORS.brand,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  durationText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  durationTextActive: { color: '#FFFFFF' },
  savingBadge: {
    position: 'absolute',
    top: -10,
    right: -6,
    backgroundColor: '#EF4444',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  savingBadgeText: { fontSize: 7, fontWeight: '700', color: '#FFFFFF' },

  plansGrid: { width: '100%', maxWidth: 1024, gap: 16, marginBottom: 32 },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  planCardPlain: {
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  planCardCurrent: {
    borderColor: COLORS.brand,
    borderWidth: 2,
    shadowColor: COLORS.brand,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  planBadgeWrap: {
    position: 'absolute',
    top: -12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  planBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  planBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  planHeader: { marginBottom: 16, paddingTop: 8 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  planIcon: {
    padding: 8,
    borderRadius: 8,
  },
  planName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  planDescription: { fontSize: 12, color: '#94A3B8' },

  priceBlock: { marginBottom: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  priceValue: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  priceSuffix: { fontSize: 12, color: '#94A3B8' },
  savingText: { fontSize: 10, fontWeight: '600', color: '#16A34A', marginTop: 4 },

  limitsBlock: { gap: 10, marginBottom: 20 },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  limitText: { fontSize: 12, color: '#475569' },
  limitValue: { fontWeight: '600', color: '#0F172A' },

  featuresBlock: { gap: 8, marginBottom: 20, flexGrow: 1 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 11, color: '#475569' },
  featureTextMuted: { color: '#CBD5E1' },

  ctaBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaPrimary: { backgroundColor: COLORS.brand },
  ctaCurrent: { backgroundColor: '#F1F5F9' },
  ctaSeller: { backgroundColor: '#F8FAFC' },
  ctaDowngrade: { backgroundColor: '#F1F5F9' },
  ctaText: { fontSize: 12, fontWeight: '700' },
  ctaTextPrimary: { color: '#FFFFFF' },
  ctaTextDisabled: { color: '#94A3B8' },
  ctaTextSeller: { color: '#CBD5E1' },
  ctaTextDowngrade: { color: '#475569' },

  webviewScreen: { flex: 1, backgroundColor: '#FFFFFF' },
  webviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  webviewTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  webviewClose: { padding: 6 },
  webview: { flex: 1, backgroundColor: '#F8FAFC' },
});
