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
  'w-full bg-white border border-line-strong rounded-lg px-2.5 py-2 text-xs font-bold text-ink placeholder:text-gray-300 focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/10 transition-all';
const labelClass = 'block text-[9px] font-bold text-gray-400 uppercase tracking-[0.16em]';
const hintClass = 'text-[9px] font-semibold text-gray-400 leading-snug';
const primaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-2.5 shadow-md shadow-brand/20 transition-all hover:brightness-[1.05] active:scale-[.98]';
const dangerButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-extrabold uppercase tracking-wider px-3 py-2 transition-all active:scale-[.98]';
const secondaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand/30 bg-brand-soft text-brand hover:bg-brand-tint disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-extrabold uppercase tracking-wider px-3 py-2.5 transition-all active:scale-[.98]';
const ghostChipClass =
  'inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-line text-[9px] font-bold uppercase tracking-wider text-gray-500';

/** Tonalités d'accent par carte (icône + pastille). */
const TONE = {
  views: 'bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-100',
  orders: 'bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-100',
  reviews: 'bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100',
} as const;

const fmtDay = (value: string) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—';

/** Bornes alignées sur les clamps serveur (1 000 000 vues / 500 commandes / 500 avis). */
const clampViews = (raw: string) => Math.min(1_000_000, Math.max(1, Math.floor(Number(raw) || 1)));
const clampCount = (raw: string) => Math.min(500, Math.max(1, Math.floor(Number(raw) || 1)));

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

/**
 * Contrôle client du JSON d'avis personnalisés (le serveur refait la même
 * validation, plus stricte). Renvoie le nombre d'avis détectés ou l'erreur.
 */
const previewCustomJson = (raw: string): { count: number; error: string | null } => {
  const text = raw.trim();
  if (!text) return { count: 0, error: null };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { count: 0, error: 'JSON invalide : vérifiez la syntaxe (guillemets, virgules).' };
  }
  if (!Array.isArray(data)) return { count: 0, error: 'Le JSON doit être un tableau : [ { … }, { … } ].' };
  if (data.length === 0) return { count: 0, error: 'Le tableau d’avis est vide.' };
  if (data.length > 500) return { count: 0, error: `${data.length} avis : maximum 500 par envoi.` };

  for (let i = 0; i < data.length; i += 1) {
    const n = i + 1;
    const item = data[i] as Record<string, unknown> | null;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { count: 0, error: `Avis n°${n} : objet { … } attendu.` };
    }
    const comment = typeof item.comment === 'string' ? item.comment.trim() : '';
    if (!comment) return { count: 0, error: `Avis n°${n} : champ "comment" obligatoire.` };
    if (comment.length > 2000) return { count: 0, error: `Avis n°${n} : commentaire trop long (2000 max).` };
    if (item.rating !== undefined && item.rating !== null) {
      const rating = Number(item.rating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return { count: 0, error: `Avis n°${n} : "rating" doit être un nombre entre 1 et 5.` };
      }
    }
    const date = item.date ?? item.createdAt;
    if (typeof date === 'string' && date.trim() && Number.isNaN(Date.parse(date))) {
      return { count: 0, error: `Avis n°${n} : "date" invalide (ISO attendu, ex. 2025-08-12).` };
    }
    const avatar = item.avatar ?? item.authorAvatar;
    if (typeof avatar === 'string' && avatar.trim() && !/^https?:\/\//i.test(avatar.trim())) {
      return { count: 0, error: `Avis n°${n} : "avatar" doit être une URL http(s).` };
    }
  }
  return { count: data.length, error: null };
};

const JSON_EXAMPLE = `[
  { "rating": 5, "comment": "Produit impeccable, livraison en 2 jours.", "author": "Awa D.", "reply": "Merci pour votre retour !" },
  { "rating": 4, "comment": "Très bon rapport qualité/prix, je recommande.", "author": "Moussa B.", "date": "2025-09-12" }
]`;

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
  const [viewsPeriod, setViewsPeriod] = useState<Period>('30');
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
  const [reviewMode, setReviewMode] = useState<'auto' | 'custom'>('auto');
  const [customJson, setCustomJson] = useState('');

  const [target, setTarget] = useState<string>(''); // '' = tous les produits
  const [busy, setBusy] = useState<Busy>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirming, setConfirming] = useState<null | { title: string; detail: string; label: string; run: () => Promise<void> }>(null);
  const [confirmingUnboost, setConfirmingUnboost] = useState(false);

  const views = clampViews(viewsText);
  const orderCount = clampCount(orderText);
  const reviewCount = clampCount(reviewText);
  const isCustomReview = reviewMode === 'custom';
  const jsonPreview = isCustomReview ? previewCustomJson(customJson) : { count: 0, error: null as string | null };
  /** En mode JSON : tableau non vide, valide, et produit ciblé obligatoire. */
  const customReady = isCustomReview && jsonPreview.count > 0 && !jsonPreview.error && !!target;
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

  /**
   * Période des vues : fenêtre de crédit ÉTALÉE à partir d'aujourd'hui
   * (les vues sont un compteur cumulatif, on ne peut pas les « créer » dans le
   * passé comme les commandes/avis). Une plage personnalisée reste libre.
   */
  const syncViewsPeriod = (p: Period) => {
    setViewsPeriod(p);
    setFeedback(null);
    if (p !== 'custom') {
      const start = new Date();
      setViewsFrom(isoDay(start));
      setViewsTo(isoDay(addDays(start, Number(p))));
    }
  };

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
          ? `${res.amount} vues programmée(s) du ${new Date(res.from!).toLocaleDateString('fr-FR')} au ${new Date(res.to!).toLocaleDateString('fr-FR')} — créditées progressivement à chaque visite de l'admin.`
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
      const res = await boostStoreReviewsAction(
        storeId,
        isCustomReview ? jsonPreview.count : reviewCount,
        days,
        {
          productId,
          range: rangeOf(reviewPeriod, reviewFrom, reviewTo),
          ratingProfile,
          ...(isCustomReview ? { customJson } : {}),
        }
      );
      if (!res.success) {
        setFeedback({ type: 'err', text: res.error || 'Erreur lors de la génération des avis.' });
        return;
      }
      setFeedback({
        type: 'ok',
        text: isCustomReview
          ? `${res.created} avis personnalisés importés sur ${days} jours (moyenne ${res.average}/5).`
          : `${res.created} avis générés sur ${days} jours (moyenne ${res.average}/5 sur les avis créés).`,
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

  /** Libellé de champ + contrôle, espacement homogène partout. */
  const field = (label: string, id: string, control: React.ReactNode, hint?: React.ReactNode) => (
    <div>
      <label className={`${labelClass} mb-1.5`} htmlFor={id}>
        {label}
      </label>
      {control}
      {hint ? <div className="mt-1">{hint}</div> : null}
    </div>
  );

  const targetSelect = (id: string, opts?: { required?: boolean }) => {
    const missing = !!opts?.required && !target;
    return field(
      'Produit ciblé',
      id,
      <select
        id={id}
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
      </select>,
      <p className={`${hintClass} ${missing ? 'text-amber-600' : ''}`}>
        {missing
          ? 'Produit obligatoire : un avis personnalisé porte sur un produit précis.'
          : target
            ? 'Ciblage : un seul produit.'
            : 'Ciblage : l’ensemble du catalogue de la boutique.'}
      </p>
    );
  };

  /**
   * Champ nombre + raccourcis de valeur (presets) et affichage de la borne.
   * `unit` est un suffixe visuel (« vues », « commandes »…).
   */
  const numberField = (cfg: {
    id: string;
    label: string;
    unit: string;
    value: string;
    onChange: (v: string) => void;
    clamp: (raw: string) => number;
    max: number;
    presets: number[];
  }) => (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <label className={labelClass} htmlFor={cfg.id}>
          {cfg.label}
        </label>
        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-300">
          1 – {cfg.max.toLocaleString('fr-FR')}
        </span>
      </div>
      <div className="relative">
        <input
          id={cfg.id}
          type="number"
          min={1}
          max={cfg.max}
          value={cfg.value}
          onChange={(e) => {
            cfg.onChange(e.target.value);
            setFeedback(null);
          }}
          onBlur={() => cfg.onChange(String(cfg.clamp(cfg.value)))}
          className={`${inputClass} pr-20 text-sm`}
          disabled={busy !== null}
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wider text-gray-300">
          {cfg.unit}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {cfg.presets.map((p) => {
          const active = String(p) === cfg.value;
          return (
            <button
              key={p}
              type="button"
              disabled={busy !== null}
              onClick={() => {
                cfg.onChange(String(p));
                setFeedback(null);
              }}
              className={`px-2 py-0.5 rounded-md border text-[9px] font-bold transition-all ${
                active
                  ? 'bg-brand-soft border-brand/40 text-brand'
                  : 'bg-white border-line text-gray-500 hover:border-brand/40 hover:text-brand'
              }`}
            >
              {p.toLocaleString('fr-FR')}
            </button>
          );
        })}
      </div>
    </div>
  );

  /**
   * Contrôle de période segmenté (pills) + rappel textuel de ce qu'il implique.
   * `past`  → commandes / avis : dates reculées dans le passé.
   * `future`→ vues : fenêtre de crédit étalée à partir d'aujourd'hui.
   */
  const periodControl = (
    id: string,
    value: Period,
    onChange: (value: Period) => void,
    from: string,
    to: string,
    setFrom: (v: string) => void,
    setTo: (v: string) => void,
    variant: 'past' | 'future' = 'past'
  ) => {
    const options: Array<{ value: Period; label: string }> = [
      { value: '7', label: '7 j' },
      { value: '30', label: '30 j' },
      { value: '90', label: '90 j' },
      { value: 'custom', label: 'Perso' },
    ];
    const helper =
      value === 'custom'
        ? `${variant === 'future' ? 'Crédit' : 'Dates'} du ${fmtDay(from)} au ${fmtDay(to)}`
        : variant === 'future'
          ? `Crédit étalé sur ${value} jours, à partir d’aujourd’hui`
          : `Réparties sur les ${value} derniers jours`;

    return (
      <div>
        <span className={`${labelClass} mb-1.5`} id={`${id}-label`}>
          Période
        </span>
        <div className="grid grid-cols-4 gap-0.5 rounded-lg border border-line bg-gray-50 p-0.5">
          {options.map((opt) => {
            const active = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={busy !== null}
                aria-pressed={active}
                aria-labelledby={`${id}-label`}
                onClick={() => {
                  onChange(opt.value);
                  setFeedback(null);
                }}
                className={`rounded-md px-1 py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                  active
                    ? 'bg-white text-ink shadow-sm ring-1 ring-black/5'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className={`${hintClass} mt-1`}>{helper}</p>
        {value === 'custom' && (
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <div>
              <label className={`${labelClass} mb-1.5`} htmlFor={`${id}-from`}>
                Du
              </label>
              <input
                id={`${id}-from`}
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setFeedback(null);
                }}
                className={inputClass}
                disabled={busy !== null}
              />
            </div>
            <div>
              <label className={`${labelClass} mb-1.5`} htmlFor={`${id}-to`}>
                Au
              </label>
              <input
                id={`${id}-to`}
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => {
                  setTo(e.target.value);
                  setFeedback(null);
                }}
                className={inputClass}
                disabled={busy !== null}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="bg-white rounded-3xl border border-line shadow-sm overflow-hidden">
      {/* ── En-tête ─────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-orange-600 text-white shadow-md shadow-brand/25">
            <Zap size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold uppercase tracking-tight text-ink">
              Booster les statistiques
            </h2>
            <p className="mt-0.5 text-[11px] font-medium text-gray-400">
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
      </header>

      {/* ── Barre d'état : quotas restants + programmé ───────────── */}
      {state && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-[#fbfbfc] px-4 py-2.5 sm:px-5">
          <span className={ghostChipClass}>
            <History size={10} className="text-brand" />
            {state.logs.length} passage{state.logs.length > 1 ? 's' : ''}
          </span>
          <span className={ghostChipClass}>
            Vues 24 h&nbsp;: <b className="text-ink">{state.quota.views.toLocaleString('fr-FR')}</b>
            <span className="font-medium text-gray-300">restantes</span>
          </span>
          <span className={ghostChipClass}>
            Commandes 24 h&nbsp;: <b className="text-ink">{state.quota.orders}</b>
            <span className="font-medium text-gray-300">restantes</span>
          </span>
          <span className={ghostChipClass}>
            Avis 24 h&nbsp;: <b className="text-ink">{state.quota.reviews}</b>
            <span className="font-medium text-gray-300">restants</span>
          </span>
          {state.pendingViews > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-sky-600">
              <Calendar size={10} />
              {state.pendingViews.toLocaleString('fr-FR')} vues programmées
            </span>
          )}
        </div>
      )}

      {stateError && (
        <p className="flex items-center gap-2 border-b border-line bg-amber-50/60 px-4 py-2 text-[10px] font-semibold text-amber-700 sm:px-5">
          <AlertCircle size={12} className="shrink-0" />
          {stateError}
        </p>
      )}

      <div className="px-4 py-4 sm:px-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* ── Vues ───────────────────────────────────────────── */}
          <article className="flex flex-col rounded-2xl border border-line p-4">
            <div className="mb-3.5 flex items-center gap-2.5">
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${TONE.views}`}>
                <Eye size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-tight text-ink">Vues</p>
                <p className="text-[10px] font-medium text-gray-400">Boutique & fiches produit</p>
              </div>
            </div>

            <div className="space-y-3">
              {numberField({
                id: 'boost-views',
                label: 'Nombre de vues',
                unit: 'vues',
                value: viewsText,
                onChange: setViewsText,
                clamp: clampViews,
                max: 1000000,
                presets: [1000, 10000, 100000, 1000000],
              })}

              {targetSelect('boost-views-target')}

              <div>
                <span className={`${labelClass} mb-1.5`}>Créditation</span>
                <div className="grid grid-cols-2 gap-0.5 rounded-lg border border-line bg-gray-50 p-0.5">
                  {[false, true].map((mode) => (
                    <button
                      key={String(mode)}
                      type="button"
                      onClick={() => {
                        setViewsSpread(mode);
                        if (mode) syncViewsPeriod(viewsPeriod);
                        else setFeedback(null);
                      }}
                      disabled={busy !== null}
                      className={`rounded-md px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                        viewsSpread === mode
                          ? 'bg-white text-ink shadow-sm ring-1 ring-black/5'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {mode ? 'Étaler' : 'Immédiat'}
                    </button>
                  ))}
                </div>
                <p className={`${hintClass} mt-1`}>
                  {viewsSpread
                    ? 'Crédit progressif, jour après jour.'
                    : 'Toutes les vues sont créditées tout de suite.'}
                </p>
              </div>

              {viewsSpread &&
                periodControl(
                  'boost-views-period',
                  viewsPeriod,
                  syncViewsPeriod,
                  viewsFrom,
                  viewsTo,
                  setViewsFrom,
                  setViewsTo,
                  'future'
                )}
            </div>

            <div className="mt-auto grid grid-cols-2 gap-1.5 pt-4">
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
                disabled={busy !== null || !!target}
                className={primaryButtonClass}
                title={target ? 'Un produit ciblé est sélectionné : passez en « Tous les produits » pour booster la boutique' : 'Ajouter des vues à la boutique'}
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
                className={secondaryButtonClass}
                title={noProduct ? disabledReason : 'Répartir les vues sur les produits'}
              >
                {busy === 'views-products' ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
                Produits
              </button>
            </div>

            {noProduct && (
              <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[9px] font-semibold text-amber-700">
                <AlertCircle size={12} className="shrink-0" /> {disabledReason}
              </p>
            )}
          </article>

        {/* ── Commandes ────────────────────────────────────────── */}
        <article className="flex flex-col rounded-2xl border border-line p-4">
          <div className="mb-3.5 flex items-center gap-2.5">
            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${TONE.orders}`}>
              <ShoppingBag size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-tight text-ink">Commandes</p>
              <p className="text-[10px] font-medium text-gray-400">Ventes livrées fictives</p>
            </div>
          </div>

          <div className="space-y-3">
            {numberField({
              id: 'boost-orders',
              label: 'Nombre de commandes',
              unit: 'commandes',
              value: orderText,
              onChange: setOrderText,
              clamp: clampCount,
              max: 500,
              presets: [10, 50, 100, 500],
            })}

            {targetSelect('boost-order-target')}

            {periodControl('boost-order-period', orderPeriod, (v) => setOrderPeriod(v), orderFrom, orderTo, setOrderFrom, setOrderTo)}
          </div>

          <div className="mt-auto pt-4">
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
              className={`${primaryButtonClass} w-full py-2.5`}
              title={noProduct ? disabledReason : 'Générer des commandes livrées'}
            >
              {busy === 'orders' ? <Loader2 size={13} className="animate-spin" /> : <ShoppingBag size={13} />}
              Générer {orderCount} commande{orderCount > 1 ? 's' : ''}
            </button>
          </div>

          {noProduct && (
            <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[9px] font-semibold text-amber-700">
              <AlertCircle size={12} className="shrink-0" /> {disabledReason}
            </p>
          )}
        </article>

        {/* ── Avis ─────────────────────────────────────────────── */}
        <article className="flex flex-col rounded-2xl border border-line p-4">
          <div className="mb-3.5 flex items-center gap-2.5">
            <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${TONE.reviews}`}>
              <Star size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-tight text-ink">Avis</p>
              <p className="text-[10px] font-medium text-gray-400">Notes & commentaires clients</p>
            </div>
          </div>

          <div className="space-y-3">
            {field(
              'Source des avis',
              'boost-review-mode',
              <div className="grid grid-cols-2 gap-0.5 rounded-lg border border-line bg-gray-50 p-0.5">
                {([
                  ['auto', 'Générés'],
                  ['custom', 'JSON perso'],
                ] as const).map(([value, label]) => {
                  const active = reviewMode === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={busy !== null}
                      aria-pressed={active}
                      onClick={() => {
                        setReviewMode(value);
                        setFeedback(null);
                      }}
                      className={`rounded-md px-1 py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                        active ? 'bg-white text-ink shadow-sm ring-1 ring-black/5' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>,
              <p className={hintClass}>
                {isCustomReview
                  ? 'Vos propres avis collés en JSON, appliqués au produit ciblé.'
                  : 'Avis fabriqués : auteur, commentaire et note tirés au sort.'}
              </p>
            )}

            {isCustomReview ? (
              <>
                {field(
                  'Avis JSON',
                  'boost-reviews-json',
                  <textarea
                    id="boost-reviews-json"
                    rows={7}
                    value={customJson}
                    spellCheck={false}
                    placeholder={JSON_EXAMPLE}
                    onChange={(e) => {
                      setCustomJson(e.target.value);
                      setFeedback(null);
                    }}
                    disabled={busy !== null}
                    className={`${inputClass} min-h-[7.5rem] resize-y font-mono text-[10px] leading-relaxed`}
                  />,
                  jsonPreview.error ? (
                    <p className="flex items-start gap-1.5 text-[9px] font-semibold text-red-500">
                      <AlertCircle size={11} className="mt-px shrink-0" /> {jsonPreview.error}
                    </p>
                  ) : jsonPreview.count > 0 ? (
                    <p className="flex items-center gap-1.5 text-[9px] font-semibold text-emerald-600">
                      <CheckCircle2 size={11} className="shrink-0" /> {jsonPreview.count} avis détecté(s) — prêt à
                      importer.
                    </p>
                  ) : (
                    <p className={hintClass}>
                      Champs possibles : rating (1-5, défaut 5), comment (obligatoire), author, avatar, reply, date.
                    </p>
                  )
                )}
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    setCustomJson(JSON_EXAMPLE);
                    setFeedback(null);
                  }}
                  className={ghostChipClass}
                >
                  Insérer un exemple
                </button>
              </>
            ) : (
              <>
                {numberField({
                  id: 'boost-reviews',
                  label: 'Nombre d’avis',
                  unit: 'avis',
                  value: reviewText,
                  onChange: setReviewText,
                  clamp: clampCount,
                  max: 500,
                  presets: [10, 50, 100, 500],
                })}

                {field(
                  'Profil de notes',
                  'boost-rating',
                  <select
                    id="boost-rating"
                    value={ratingProfile}
                    onChange={(e) => {
                      setRatingProfile(e.target.value as RatingProfile);
                      setFeedback(null);
                    }}
                    className={inputClass}
                    disabled={busy !== null}
                  >
                    <option value="top">{RATING_PROFILE_LABELS.top}</option>
                    <option value="mixed">{RATING_PROFILE_LABELS.mixed}</option>
                    <option value="realistic">{RATING_PROFILE_LABELS.realistic}</option>
                  </select>
                )}
              </>
            )}

            {targetSelect('boost-review-target', { required: isCustomReview })}

            {periodControl('boost-review-period', reviewPeriod, (v) => setReviewPeriod(v), reviewFrom, reviewTo, setReviewFrom, setReviewTo)}
          </div>

          <div className="mt-auto pt-4">
            <button
              type="button"
              onClick={() =>
                request(
                  isCustomReview ? 'Importer des avis JSON' : 'Générer des avis',
                  isCustomReview
                    ? `${jsonPreview.count} avis personnalisés appliqués au produit ciblé, étalé(s) sur ${periodDays(reviewPeriod, reviewFrom, reviewTo)} jours — notes, auteurs et dates de votre JSON sont conservés.`
                    : `${reviewCount} avis ${productId ? 'pour le produit ciblé' : ''} étalé(s) sur ${periodDays(reviewPeriod, reviewFrom, reviewTo)} jours, profil « ${RATING_PROFILE_LABELS[ratingProfile]} ». ~40 % recevront une réponse du vendeur.`,
                  isCustomReview ? 'Importer' : 'Générer',
                  async () => { setConfirming(null); await handleReviews(); }
                )
              }
              disabled={busy !== null || noProduct || (isCustomReview && !customReady)}
              className={`${primaryButtonClass} w-full py-2.5`}
              title={
                noProduct
                  ? disabledReason
                  : isCustomReview && !customReady
                    ? !target
                      ? 'Sélectionnez le produit ciblé'
                      : jsonPreview.error || jsonPreview.count === 0
                        ? 'Collez un tableau JSON d’avis valide'
                        : 'Avis JSON non valide'
                    : 'Générer des avis produits'
              }
            >
              {busy === 'reviews' ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
              {isCustomReview ? `Importer ${jsonPreview.count} avis` : `Générer ${reviewCount} avis`}
            </button>
          </div>

          {noProduct && (
            <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[9px] font-semibold text-amber-700">
              <AlertCircle size={12} className="shrink-0" /> {disabledReason}
            </p>
          )}
        </article>
        </div>

        {/* ── Retour d'action ──────────────────────────────────── */}
        {feedback && (
          <div
            className={`mt-4 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[11px] font-semibold ${
              feedback.type === 'ok'
                ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                : 'border-red-100 bg-red-50 text-red-600'
            }`}
          >
            {feedback.type === 'ok' ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}
      </div>

      {/* ── Journal ─────────────────────────────────────────────── */}
      {state && state.logs.length > 0 && (
        <div className="border-t border-line">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-[#fbfbfc] px-4 py-2.5 sm:px-5">
            <p className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.16em] text-gray-500">
              <History size={11} className="text-brand" /> Journal des boosts
            </p>
            <span className="text-[9px] font-semibold text-gray-300">
              {state.logs.length} dernières actions
            </span>
          </div>
          <ul className="divide-y divide-line px-4 sm:px-5">
            {state.logs.map((log, index) => (
              <li key={log.id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${index === 0 ? 'bg-brand' : 'bg-gray-300'}`}
                  />
                  <span className="truncate text-[11px] font-semibold text-gray-600">
                    {log.action === 'unboost'
                      ? 'Déboost complet'
                      : `Boost · ${ACTION_LABELS[log.action] || log.action}`}
                  </span>
                  {log.amount > 0 && (
                    <span className="shrink-0 rounded-md bg-brand-soft px-1.5 py-0.5 text-[9px] font-extrabold text-brand">
                      +{log.amount.toLocaleString('fr-FR')}
                    </span>
                  )}
                </span>
                <time
                  className="shrink-0 text-[10px] font-medium text-gray-400"
                  dateTime={new Date(log.createdAt).toISOString()}
                >
                  {new Date(log.createdAt).toLocaleString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Note de bas de panneau ──────────────────────────────── */}
      <div className="border-t border-line bg-[#fbfbfc] px-4 py-3 sm:px-5">
        <p className="flex items-start gap-2 text-[10px] font-medium leading-relaxed text-gray-400">
          <Info size={12} className="mt-0.5 shrink-0 text-gray-300" />
          <span>
            Les commandes générées sont créées comme « Livrée » (client de passage), étalées aléatoirement sur la
            période choisie, avec les prix réels des produits — jamais avant la création de la boutique ou du produit.
            Elles apparaissent dans la liste des commandes du vendeur, sans jamais décrémenter son stock, et déclenchent
            une notification WhatsApp récapitulative — jamais d&apos;email. Les avis générés sont attribués à des clients
            de passage et recalculent la moyenne des produits ; en mode « JSON perso », ce sont vos propres avis
            (note, auteur, réponse, date) appliqués au produit ciblé. Un quota par 24 h limite les applications ; les
            vues étalées sont créditées progressivement au fil des visites de l&apos;admin ; « Débooster » retire tout ce
            qui a été fabriqué et recalcule les agrégats.
          </span>
        </p>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-in zoom-in-95 rounded-3xl bg-white p-6 shadow-2xl duration-200">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand to-orange-600 text-white shadow-md shadow-brand/25">
              <Target size={20} />
            </div>
            <h3 className="mb-1.5 text-center text-sm font-extrabold uppercase tracking-tight text-ink">
              {confirming.title}
            </h3>
            <p className="mb-5 text-center text-xs font-medium leading-relaxed text-gray-500">{confirming.detail}</p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="flex-1 rounded-xl border border-line bg-white py-2.5 text-xs font-bold text-gray-500 transition-all hover:bg-gray-50 active:scale-[.98]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void confirming.run()}
                className="flex-1 rounded-xl bg-gradient-to-r from-brand to-orange-600 py-2.5 text-xs font-extrabold text-white shadow-md shadow-brand/25 transition-all hover:brightness-105 active:scale-[.98]"
              >
                {confirming.label}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmingUnboost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm animate-in zoom-in-95 rounded-3xl bg-white p-6 shadow-2xl duration-200">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-red-500 ring-1 ring-inset ring-red-100">
              <Undo2 size={20} />
            </div>
            <h3 className="mb-1.5 text-center text-sm font-extrabold uppercase tracking-tight text-ink">
              Débooster cette boutique ?
            </h3>
            <p className="mb-5 text-center text-xs font-medium leading-relaxed text-gray-500">
              Toutes les commandes, avis et vues fabriqués par ce panneau seront supprimés, les échéanciers annulés et
              les moyennes recalculées. Les données réelles ne sont pas touchées.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmingUnboost(false)}
                className="flex-1 rounded-xl border border-line bg-white py-2.5 text-xs font-bold text-gray-500 transition-all hover:bg-gray-50 active:scale-[.98]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void handleUnboost()}
                className="flex-1 rounded-xl bg-gradient-to-r from-red-500 to-red-600 py-2.5 text-xs font-extrabold text-white shadow-md shadow-red-500/25 transition-all hover:brightness-105 active:scale-[.98]"
              >
                Débooster
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
