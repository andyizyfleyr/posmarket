'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Eye, Package, ShoppingBag, Star, Loader2, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { boostStoreViewsAction, boostStoreOrdersAction, boostStoreReviewsAction } from '@/app/actions/admin';
import { formatCurrency } from '@/utils';

type Busy = null | 'views-store' | 'views-products' | 'orders' | 'reviews';
type Feedback = { type: 'ok' | 'err'; text: string } | null;

const inputClass =
  'w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all';
const labelClass = 'block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5';
const primaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-brand hover:bg-[#d55a20] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm';

/** Bornes alignées sur les clamps serveur (100000 vues / 50 commandes / 50 avis). */
const clampViews = (raw: string) => Math.min(100000, Math.max(1, Math.floor(Number(raw) || 1)));
const clampCount = (raw: string) => Math.min(50, Math.max(1, Math.floor(Number(raw) || 1)));

export default function StoreBoostPanel({
  storeId,
  productCount,
}: {
  storeId: string;
  productCount: number;
}) {
  const router = useRouter();
  const [viewsText, setViewsText] = useState('100');
  const [orderText, setOrderText] = useState('5');
  const [reviewText, setReviewText] = useState('5');
  const [spreadDays, setSpreadDays] = useState(30);
  const [busy, setBusy] = useState<Busy>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const views = clampViews(viewsText);
  const orderCount = clampCount(orderText);
  const reviewCount = clampCount(reviewText);

  const handleViews = async (scope: 'store' | 'products') => {
    const key: Busy = scope === 'store' ? 'views-store' : 'views-products';
    setBusy(key);
    setFeedback(null);
    try {
      const res = await boostStoreViewsAction(storeId, views, scope);
      if (!res.success) {
        setFeedback({ type: 'err', text: res.error || 'Erreur lors du boost des vues.' });
        return;
      }
      setFeedback({
        type: 'ok',
        text:
          scope === 'store'
            ? `+${res.amount} vues ajoutées à la boutique.`
            : `+${res.amount} vues réparties sur ${res.products ?? productCount} produit(s).`,
      });
      router.refresh();
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
      const res = await boostStoreOrdersAction(storeId, orderCount, spreadDays);
      if (!res.success) {
        setFeedback({ type: 'err', text: res.error || 'Erreur lors de la génération des commandes.' });
        return;
      }
      setFeedback({
        type: 'ok',
        text: `${res.created} commande(s) générée(s) sur ${spreadDays} jours pour un total de ${formatCurrency(res.revenue || 0)}.`,
      });
      router.refresh();
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
      const res = await boostStoreReviewsAction(storeId, reviewCount, spreadDays);
      if (!res.success) {
        setFeedback({ type: 'err', text: res.error || 'Erreur lors de la génération des avis.' });
        return;
      }
      setFeedback({
        type: 'ok',
        text: `${res.created} avis générés sur ${spreadDays} jours (moyenne ${res.average}/5 sur les avis créés).`,
      });
      router.refresh();
    } catch {
      setFeedback({ type: 'err', text: 'Erreur serveur lors de la génération des avis.' });
    } finally {
      setBusy(null);
    }
  };

  const noProduct = productCount === 0;
  const disabledReason = 'Aucun produit dans cette boutique';

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-start gap-3 mb-5">
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
              onChange={(e) => {
                setViewsText(e.target.value);
                setFeedback(null);
              }}
              onBlur={() => setViewsText(String(clampViews(viewsText)))}
              className={inputClass}
              disabled={busy !== null}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleViews('store')}
              disabled={busy !== null}
              className={primaryButtonClass}
              title="Ajouter des vues à la boutique"
            >
              {busy === 'views-store' ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
              Boutique
            </button>
            <button
              type="button"
              onClick={() => handleViews('products')}
              disabled={busy !== null || noProduct}
              className={primaryButtonClass}
              title={noProduct ? disabledReason : 'Répartir les vues sur les produits'}
            >
              {busy === 'views-products' ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
              Produits
            </button>
          </div>
        </div>

        {/* Ventes / commandes */}
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
          <div className="flex items-center gap-2">
            <ShoppingBag size={14} className="text-brand" />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ventes / Commandes</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                onChange={(e) => {
                  setOrderText(e.target.value);
                  setFeedback(null);
                }}
                onBlur={() => setOrderText(String(clampCount(orderText)))}
                className={inputClass}
                disabled={busy !== null}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="boost-spread">
                Sur (jours)
              </label>
              <select
                id="boost-spread"
                value={spreadDays}
                onChange={(e) => {
                  setSpreadDays(Number(e.target.value));
                  setFeedback(null);
                }}
                className={inputClass}
                disabled={busy !== null}
              >
                <option value={7}>7 jours</option>
                <option value={30}>30 jours</option>
                <option value={90}>90 jours</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOrders}
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
              onChange={(e) => {
                setReviewText(e.target.value);
                setFeedback(null);
              }}
              onBlur={() => setReviewText(String(clampCount(reviewText)))}
              className={inputClass}
              disabled={busy !== null}
            />
          </div>

          <button
            type="button"
            onClick={handleReviews}
            disabled={busy !== null || noProduct}
            className={`${primaryButtonClass} w-full`}
            title={noProduct ? disabledReason : 'Générer des avis produits'}
          >
            {busy === 'reviews' ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
            Générer {reviewCount} avis
          </button>

          <p className="text-[10px] text-gray-400 font-semibold leading-relaxed">
            Répartis sur les mêmes {spreadDays} jours, notés majoritairement 4 et 5.
          </p>
        </div>
      </div>

      {noProduct && (
        <p className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-amber-600">
          <AlertCircle size={14} className="shrink-0" />
          Ajoutez d&apos;abord des produits à cette boutique : commandes, avis et vues produits sont désactivés.
        </p>
      )}

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

      <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-gray-400 font-medium">
        <Info size={14} className="shrink-0 mt-0.5 text-gray-300" />
        <span>
          Les commandes générées sont créées comme « Livrée » (client de passage), étalées aléatoirement sur la
          période choisie, avec les prix réels des produits — jamais avant la création de la boutique ou du produit.
          Elles apparaissent dans la liste des commandes du vendeur, sans jamais décrémenter son stock. Les avis
          générés sont attribués à des clients de passage et recalculent la moyenne des produits.
        </span>
      </p>
    </div>
  );
}
