'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap,
  Eye,
  Package,
  ShoppingBag,
  Star,
  Loader2,
  Info,
  CheckCircle2,
  AlertCircle,
  Undo2,
  Calendar,
  History,
  Target,
} from 'lucide-react';
import {
  boostStoreViewsAction,
  boostStoreOrdersAction,
  boostStoreReviewsAction,
  unboostStoreAction,
  getBoostStateAction,
} from '@/app/actions/admin';
import { formatCurrency } from '@/utils';

type Busy = null | 'views-store' | 'views-products' | 'orders' | 'reviews' | 'unboost';
type Feedback = { type: 'ok' | 'err'; text: string } | null;
type RatingProfile = 'top' | 'mixed' | 'realistic';
type Period = '7' | '30' | '90' | 'custom';

type BoostState = {
  logs: Array<{ id: string; action: string; amount: number; createdAt: string | Date }>;
  quota: { views: number; orders: number; reviews: number };
  pendingViews: number;
  schedules: Array<{ id: string; scope: string; total: number; applied: number; startDate: string | Date; endDate: string | Date }>;
};

const inputClass =
  'w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all';
const labelClass = 'block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5';
const primaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-brand hover:bg-[#d55a20] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm';
const dangerButtonClass =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95';

/** Bornes alignées sur les clamps serveur (100000 vues / 50 commandes / 50 avis). */
const clampViews = (raw: string) => Math.min(100000, Math.max(1, Math.floor(Number(raw) || 1)));
const clampCount = (raw: string) => Math.min(50, Math.max(1, Math.floor(Number(raw) || 1)));

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

const ACTION_LABELS: Record<string, string> = {
  views: 'Vues',
  orders: 'Commandes',
  reviews: 'Avis',
  unboost: 'Déboost',
};

const RATING_PROFILE_LABELS: Record<RatingProfile, string> = {
  top: 'Lancement (5★ dominants)',
  mixed: 'Équilibré (4-5★ majoritaires)',
  realistic: 'Réaliste (notes mélangées)',
};

const periodDays = (period: Period, from: string, to: string) => {
  if (period !== 'custom') return Number(period);
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 30;
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
};

const rangeOf = (period: Period, from: string, to: string) =>
  period === 'custom' && from && to ? { from, to } : undefined;

export default function StoreBoostPanel({
  storeId,
  productCount,
  products = [],
}: {
  storeId: string;
  productCount: number;
  products?: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();

  const [state, setState] = useState<BoostState | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);

  const [viewsText, setViewsText] = useState('100');
  const [viewsSpread, setViewsSpread] = useState(false);
  const today = isoDay(new Date());
  const [viewsFrom, setViewsFrom] = useState(today);
  const [viewsTo, setViewsTo] = useState(isoDay(addDays(new Date(), 30)));

  const [orderText, setOrderText] = useState('5');
  const [reviewText, setReviewText] = useState('5');
  const [orderPeriod, setOrderPeriod] = useState<Period>('30');
  const [reviewPeriod, setReviewPeriod] = useState<Period>('30');
  const [orderFrom, setOrderFrom] = useState(isoDay(addDays(new Date(), -30)));
  const [orderTo, setOrderTo] = useState(today);
  const [reviewFrom, setReviewFrom] = useState(isoDay(addDays(new Date(), -30)));
  const [reviewTo, setReviewTo] = useState(today);
  const [ratingProfile, setRatingProfile] = useState<RatingProfile>('mixed');

  const [target, setTarget] = useState<string>(''); // '' = tous les produits
  const [busy, setBusy] = useState<Busy>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirming, setConfirming] = useState<null | { title: string; detail: string; label: string; run: () => Promise<void> }>(null);
  const [confirmingUnboost, setConfirmingUnboost] = useState(false);

  const views = clampViews(viewsText);
  const orderCount = clampCount(orderText);
  const reviewCount = clampCount(reviewText);
  const noProduct = productCount === 0;
  const disabledReason = 'Aucun produit vendable dans cette boutique';
  const productId = target || null;

  const loadState = async () => {
    try {
      const res = await getBoostStateAction(storeId);
      if (!res.success) {
        setStateError(res.error || 'État indisponible.');
        return;
      }
      setStateError(null);
      setState({
        logs: res.logs || [],
        quota: res.quota || { views: 0, orders: 0, reviews: 0 },
        pendingViews: res.pendingViews || 0,
        schedules: res.schedules || [],
      });
    } catch {
      setStateError('Impossible de charger l\'état du boost.');
    }
  };

  useEffect(() => {
    void Promise.resolve().then(loadState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const refresh = async () => {
    await loadState();
    router.refresh();
  };

  const request = (title: string, detail: string, label: string, run: () => Promise<void>) =>
    setConfirming({ title, detail, label, run });

  const handleViews = async (scope: 'store' | 'products') => {
    setBusy(scope === 'store' ? 'views-store' : 'views-products');
    setFeedback(null);
    try {
      const res = await boostStoreViewsAction(storeId, views, scope, {
        productId: scope === 'products' ? productId : null,
        spread: viewsSpread ? { from: viewsFrom, to: viewsTo } : undefined,
      });
      if (!res.success) {
        setFeedback({ type: 'err', text: res.error || 'Erreur lors du boost des vues.' });
        return;
      }
      setFeedback({
        type: 'ok',
        text: res.scheduled
          ? `${res.amount} vues programmée(s) du ${new Date(res.from!).toLocaleDateString('fr-FR')} au ${new Date(res.to!).toLocaleDateString('fr-FR')} — appliquées à chaque ouverture de ce panneau.`
          : scope === 'store'
            ? `+${res.amount} vues ajoutées à la boutique.`
            : `+${res.amount} vues réparties sur ${res.products ?? productCount} produit(s).`,
      });
      await refresh();
    } catch {
      setFeedback({ type: 'err', text: 'Erreur serveur lors du boost des vues.' });
    } finally {
      setBusy(null);
    }
  };

  const handleOrders = async () => {
    setBusy('orders');
    setFeedback(null);
    try {
      const days = periodDays(orderPeriod, orderFrom, orderTo);
      const res = await boostStoreOrdersAction(storeId, orderCount, days, {
        productId,
        range: rangeOf(orderPeriod, orderFrom, orderTo),
      });
      if (!res.success) {
        setFeedback({ type: 'err', text: res.error || 'Erreur lors de la génération des commandes.' });
        return;
      }
      setFeedback({
        type: 'ok',
        text: `${res.created} commande(s) générée(s) sur ${days} jours pour un total de ${formatCurrency(res.revenue || 0)}.`,
      });
      await refresh();
    } catch {
      setFeedback({ type: 'err', text: 'Erreur serveur lors de la génération des commandes.' });
    } finally {
      setBusy(null);
    }
  };

  const handleReviews = async () => {
    setBusy('reviews');
    setFeedback(null);
    try {
      const days = periodDays(reviewPeriod, reviewFrom, reviewTo);
      const res = await boostStoreReviewsAction(storeId, reviewCount, days, {
        productId,
        range: rangeOf(reviewPeriod, reviewFrom, reviewTo),
        ratingProfile,
      });
      if (!res.success) {
        setFeedback({ type: 'err', text: res.error || 'Erreur lors de la génération des avis.' });
        return;
      }
      setFeedback({
        type: 'ok',
        text: `${res.created} avis générés sur ${days} jours (moyenne ${res.average}/5 sur les avis créés).`,
      });
      await refresh();
    } catch {
      setFeedback({ type: 'err', text: 'Erreur serveur lors de la génération des avis.' });
    } finally {
      setBusy(null);
    }
  };

  const handleUnboost = async () => {
    setConfirmingUnboost(false);
    setBusy('unboost');
    setFeedback(null);
    try {
      const res = await unboostStoreAction(storeId);
      if (!res.success) {
        setFeedback({ type: 'err', text: res.error || 'Erreur lors du déboost.' });
        return;
      }
      const r = res.removed || { orders: 0, reviews: 0, views: 0 };
      setFeedback({
        type: 'ok',
        text: `Déboost effectué : ${r.orders} commande(s), ${r.reviews} avis et ${r.views} vue(s) retirés, agrégats recalculés.`,
      });
      await refresh();
    } catch {
      setFeedback({ type: 'err', text: 'Erreur serveur lors du déboost.' });
    } finally {
      setBusy(null);
    }
  };

  const targetSelect = (
    <div>
      <label className={labelClass} htmlFor="boost-target">
        Produit ciblé
      </label>
      <select
        id="boost-target"
        value={target}
        onChange={(e) => {
          setTarget(e.target.value);
          setFeedback(null);
        }}
        className={inputClass}
        disabled={busy !== null || noProduct}
      >
        <option value="">Tous les produits ({productCount})</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );

  const periodSelect = (
    id: string,
    value: Period,
    onChange: (value: Period) => void,
    from: string,
    to: string,
    setFrom: (v: string) => void,
    setTo: (v: string) => void
  ) => (
    <div className="space-y-2">
      <div>
        <label className={labelClass} htmlFor={id}>
          Période
        </label>
        <select
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value as Period);
            setFeedback(null);
          }}
          className={inputClass}
          disabled={busy !== null}
        >
          <option value="7">7 derniers jours</option>
          <option value="30">30 derniers jours</option>
          <option value="90">90 derniers jours</option>
          <option value="custom">Plage personnalisée…</option>
        </select>
      </div>
      {value === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass} htmlFor={`${id}-from`}>Du</label>
            <input
              id={`${id}-from`}
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => { setFrom(e.target.value); setFeedback(null); }}
              className={inputClass}
              disabled={busy !== null}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`${id}-to`}>Au</label>
            <input
              id={`${id}-to`}
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => { setTo(e.target.value); setFeedback(null); }}
              className={inputClass}
              disabled={busy !== null}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-orange-50 text-brand rounded-2xl">
            <Zap size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Booster les statistiques</h2>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">
              Vues, ventes et avis artificiels — le stock du vendeur n&apos;est jamais modifié.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmingUnboost(true)}
          disabled={busy !== null}
          className={dangerButtonClass}
          title="Supprimer toutes les données fabriquées par ce panneau et recalculer les agrégats"
        >
          {busy === 'unboost' ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
          Débooster
        </button>
      </div>

      {state && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg text-[9px] font-bold uppercase tracking-widest text-gray-500">
            <History size={11} className="text-brand" />
            {state.logs.length} dernier(s) passage(s)
          </span>
          <span className="px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg text-[9px] font-bold uppercase tracking-widest text-gray-500">
            Vues 24 h : {state.quota.views.toLocaleString('fr-FR')}
          </span>
          <span className="px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg text-[9px] font-bold uppercase tracking-widest text-gray-500">
            Commandes 24 h : {state.quota.orders}
          </span>
          <span className="px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg text-[9px] font-bold uppercase tracking-widest text-gray-500">
            Avis 24 h : {state.quota.reviews}
          </span>
          {state.pendingViews > 0 && (
            <span className="px-2.5 py-1 bg-blue-50 border border-blue-100 rounded-lg text-[9px] font-bold uppercase tracking-widest text-blue-600">
              {state.pendingViews.toLocaleString('fr-FR')} vues programmées
            </span>
          )}
        </div>
      )}

      {stateError && (
        <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold text-amber-600">
          <AlertCircle size={14} className="shrink-0" />
          {stateError}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {/* Vues */}
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-brand" />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vues</p>
          </div>

          <div>
            <label className={labelClass} htmlFor="boost-views">
              Nombre de vues
            </label>
            <input
              id="boost-views"
              type="number"
              min={1}
              max={100000}
              value={viewsText}
              onChange={(e) => { setViewsText(e.target.value); setFeedback(null); }}
              onBlur={() => setViewsText(String(clampViews(viewsText)))}
              className={inputClass}
              disabled={busy !== null}
            />
          </div>

          <div>
            <span className={labelClass}>Créditation</span>
            <div className="grid grid-cols-2 gap-2">
              {[false, true].map((mode) => (
                <button
                  key={String(mode)}
                  type="button"
                  onClick={() => { setViewsSpread(mode); setFeedback(null); }}
                  disabled={busy !== null}
                  className={`px-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${
                    viewsSpread === mode
                      ? 'bg-brand text-white border-brand shadow-sm'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-brand/40'
                  }`}
                >
                  {mode ? <span className="inline-flex items-center gap-1"><Calendar size={11} />Étaler</span> : 'Immédiat'}
                </button>
              ))}
            </div>
          </div>

          {viewsSpread && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass} htmlFor="boost-views-from">Du</label>
                <input
                  id="boost-views-from"
                  type="date"
                  value={viewsFrom}
                  max={viewsTo || undefined}
                  onChange={(e) => { setViewsFrom(e.target.value); setFeedback(null); }}
                  className={inputClass}
                  disabled={busy !== null}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="boost-views-to">Au</label>
                <input
                  id="boost-views-to"
                  type="date"
                  value={viewsTo}
                  min={viewsFrom || undefined}
                  onChange={(e) => { setViewsTo(e.target.value); setFeedback(null); }}
                  className={inputClass}
                  disabled={busy !== null}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                request(
                  `Booster les vues de la boutique`,
                  `${views.toLocaleString('fr-FR')} vue(s) ${viewsSpread ? `étalée(s) du ${new Date(viewsFrom).toLocaleDateString('fr-FR')} au ${new Date(viewsTo).toLocaleDateString('fr-FR')}` : 'ajoutée(s) immédiatement'} sur la boutique.`,
                  'Confirmer',
                  async () => { setConfirming(null); await handleViews('store'); }
                )
              }
              disabled={busy !== null}
              className={primaryButtonClass}
              title="Ajouter des vues à la boutique"
            >
              {busy === 'views-store' ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
              Boutique
            </button>
            <button
              type="button"
              onClick={() =>
                request(
                  'Booster les vues produits',
                  `${views.toLocaleString('fr-FR')} vue(s) ${viewsSpread ? `étalée(s) du ${new Date(viewsFrom).toLocaleDateString('fr-FR')} au ${new Date(viewsTo).toLocaleDateString('fr-FR')}` : 'réparties immédiatement'} ${productId ? 'sur le produit ciblé' : `sur ${productCount} produit(s)`}.`,
                  'Confirmer',
                  async () => { setConfirming(null); await handleViews('products'); }
                )
              }
              disabled={busy !== null || noProduct}
              className={primaryButtonClass}
              title={noProduct ? disabledReason : 'Répartir les vues sur les produits'}
            >
              {busy === 'views-products' ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
              Produits
            </button>
          </div>

          {noProduct && (
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-600">
              <AlertCircle size={12} className="shrink-0" /> {disabledReason}
            </p>
          )}
        </div>

        {/* Ventes / commandes */}
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
          <div className="flex items-center gap-2">
            <ShoppingBag size={14} className="text-brand" />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ventes / Commandes</p>
          </div>

          <div>
            <label className={labelClass} htmlFor="boost-orders">
              Commandes
            </label>
            <input
              id="boost-orders"
              type="number"
              min={1}
              max={50}
              value={orderText}
              onChange={(e) => { setOrderText(e.target.value); setFeedback(null); }}
              onBlur={() => setOrderText(String(clampCount(orderText)))}
              className={inputClass}
              disabled={busy !== null}
            />
          </div>

          {targetSelect}

          {periodSelect('boost-order-period', orderPeriod, (v) => setOrderPeriod(v), orderFrom, orderTo, setOrderFrom, setOrderTo)}

          <button
            type="button"
            onClick={() =>
              request(
                'Générer des commandes',
                `${orderCount} commande(s) « Livrée » ${productId ? 'pour le produit ciblé' : ''} étalée(s) sur ${periodDays(orderPeriod, orderFrom, orderTo)} jours. Le stock du vendeur n'est pas touché.`,
                'Générer',
                async () => { setConfirming(null); await handleOrders(); }
              )
            }
            disabled={busy !== null || noProduct}
            className={`${primaryButtonClass} w-full`}
            title={noProduct ? disabledReason : 'Générer des commandes livrées'}
          >
            {busy === 'orders' ? <Loader2 size={13} className="animate-spin" /> : <ShoppingBag size={13} />}
            Générer {orderCount} commande{orderCount > 1 ? 's' : ''}
          </button>
        </div>

        {/* Avis */}
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
          <div className="flex items-center gap-2">
            <Star size={14} className="text-brand" />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avis</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="boost-reviews">
                Nombre d&apos;avis
              </label>
              <input
                id="boost-reviews"
                type="number"
                min={1}
                max={50}
                value={reviewText}
                onChange={(e) => { setReviewText(e.target.value); setFeedback(null); }}
                onBlur={() => setReviewText(String(clampCount(reviewText)))}
                className={inputClass}
                disabled={busy !== null}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="boost-rating">
                Notes
              </label>
              <select
                id="boost-rating"
                value={ratingProfile}
                onChange={(e) => { setRatingProfile(e.target.value as RatingProfile); setFeedback(null); }}
                className={inputClass}
                disabled={busy !== null}
              >
                <option value="top">{RATING_PROFILE_LABELS.top}</option>
                <option value="mixed">{RATING_PROFILE_LABELS.mixed}</option>
                <option value="realistic">{RATING_PROFILE_LABELS.realistic}</option>
              </select>
            </div>
          </div>

          {targetSelect}

          {periodSelect('boost-review-period', reviewPeriod, (v) => setReviewPeriod(v), reviewFrom, reviewTo, setReviewFrom, setReviewTo)}

          <button
            type="button"
            onClick={() =>
              request(
                'Générer des avis',
                `${reviewCount} avis ${productId ? 'pour le produit ciblé' : ''} étalé(s) sur ${periodDays(reviewPeriod, reviewFrom, reviewTo)} jours, profil « ${RATING_PROFILE_LABELS[ratingProfile]} ». ~40 % recevront une réponse du vendeur.`,
                'Générer',
                async () => { setConfirming(null); await handleReviews(); }
              )
            }
            disabled={busy !== null || noProduct}
            className={`${primaryButtonClass} w-full`}
            title={noProduct ? disabledReason : 'Générer des avis produits'}
          >
            {busy === 'reviews' ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
            Générer {reviewCount} avis
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`mt-4 flex items-start gap-2 p-4 rounded-2xl border text-xs font-semibold ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
              : 'bg-red-50 text-red-600 border-red-100'
          }`}
        >
          {feedback.type === 'ok' ? (
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {state && state.logs.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            <History size={12} className="text-brand" /> Journal des boosts
          </p>
          <ul className="space-y-1">
            {state.logs.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-3 text-[11px] font-semibold text-gray-500">
                <span className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[9px] font-bold uppercase tracking-wider text-gray-500">
                    {ACTION_LABELS[log.action] || log.action}
                  </span>
                  {log.amount > 0 && <span className="text-gray-700">+{log.amount.toLocaleString('fr-FR')}</span>}
                </span>
                <span className="text-gray-400">
                  {new Date(log.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-gray-400 font-medium">
        <Info size={14} className="shrink-0 mt-0.5 text-gray-300" />
        <span>
          Les commandes générées sont créées comme « Livrée » (client de passage), étalées aléatoirement sur la
          période choisie, avec les prix réels des produits — jamais avant la création de la boutique ou du produit.
          Elles apparaissent dans la liste des commandes du vendeur, sans jamais décrémenter son stock, et déclenchent
          une notification récapitulative unique. Les avis générés sont attribués à des clients de passage et
          recalculent la moyenne des produits. Un quota par 24 h limite les applications ; « Débooster » retire tout ce
          qui a été fabriqué et recalcule les agrégats.
        </span>
      </p>

      {confirming && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 text-brand flex items-center justify-center mb-4 mx-auto">
              <Target size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">{confirming.title}</h3>
            <p className="text-sm text-gray-500 font-normal text-center mb-6">{confirming.detail}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void confirming.run()}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-brand hover:bg-[#d55a20] transition-all"
              >
                {confirming.label}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmingUnboost && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4 mx-auto">
              <Undo2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Débooster cette boutique ?</h3>
            <p className="text-sm text-gray-500 font-normal text-center mb-6">
              Toutes les commandes, avis et vues fabriqués par ce panneau seront supprimés, les échéanciers annulés et
              les moyennes recalculées. Les données réelles ne sont pas touchées.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmingUnboost(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void handleUnboost()}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-all"
              >
                Débooster
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
