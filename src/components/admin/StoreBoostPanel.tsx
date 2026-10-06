'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Eye, Package, ShoppingBag, Loader2, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { boostStoreViewsAction, boostStoreOrdersAction } from '@/app/actions/admin';

type Busy = null | 'views-store' | 'views-products' | 'orders';
type Feedback = { type: 'ok' | 'err'; text: string } | null;

const inputClass =
  'w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all';
const labelClass = 'block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5';
const primaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-brand hover:bg-[#d55a20] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm';

export default function StoreBoostPanel({
  storeId,
  productCount,
}: {
  storeId: string;
  productCount: number;
}) {
  const router = useRouter();
  const [views, setViews] = useState(100);
  const [orderCount, setOrderCount] = useState(5);
  const [spreadDays, setSpreadDays] = useState(30);
  const [busy, setBusy] = useState<Busy>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

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
            : `+${res.amount} vues réparties sur ${productCount} produit(s).`,
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
        text: `${res.created} commande(s) générée(s) sur ${spreadDays} jours pour un total de ${new Intl.NumberFormat('fr-FR').format(res.revenue || 0)} FCFA.`,
      });
      router.refresh();
    } catch {
      setFeedback({ type: 'err', text: 'Erreur serveur lors de la génération des commandes.' });
    } finally {
      setBusy(null);
    }
  };

  const noProduct = productCount === 0;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="p-3 bg-orange-50 text-brand rounded-2xl">
          <Zap size={20} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Booster les statistiques</h2>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">
            Vues et ventes artificielles — le stock du vendeur n&apos;est jamais modifié.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
              value={views}
              onChange={(e) => setViews(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
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
            >
              {busy === 'views-store' ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
              Boutique
            </button>
            <button
              type="button"
              onClick={() => handleViews('products')}
              disabled={busy !== null || noProduct}
              className={primaryButtonClass}
              title={noProduct ? 'Aucun produit dans cette boutique' : 'Répartir les vues sur les produits'}
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
                value={orderCount}
                onChange={(e) => setOrderCount(Math.min(50, Math.max(1, Math.floor(Number(e.target.value) || 1))))}
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
                onChange={(e) => setSpreadDays(Number(e.target.value))}
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
          >
            {busy === 'orders' ? <Loader2 size={13} className="animate-spin" /> : <ShoppingBag size={13} />}
            Générer {orderCount} commande{orderCount > 1 ? 's' : ''}
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

      <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-gray-400 font-medium">
        <Info size={14} className="shrink-0 mt-0.5 text-gray-300" />
        <span>
          Les commandes générées sont créées comme « Livrée » (client de passage), étalées aléatoirement sur la
          période choisie, avec les prix réels des produits. Elles apparaissent dans la liste des commandes du
          vendeur, sans jamais décrémenter son stock.
        </span>
      </p>
    </div>
  );
}
