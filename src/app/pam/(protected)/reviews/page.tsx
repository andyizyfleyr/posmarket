'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Star,
  Search,
  Trash2,
  RefreshCcw,
  Package,
  Store,
  CheckCircle2
} from 'lucide-react';
import { getGlobalReviews, getAllStores, getGlobalProducts, deleteReview } from '@/app/actions/admin';
import Loader from '@/components/Loader';
import Pagination from '@/components/Pagination';
import { maskName } from '@/utils';

interface ReviewRow {
  id: string;
  store_id?: string | null;
  product_id?: string | null;
  user_id?: string | null;
  author_name?: string | null;
  author_avatar?: string | null;
  rating?: number | null;
  comment?: string | null;
  created_at?: string | null;
  boosted?: boolean | null;
  seller_reply?: string | null;
}

interface StoreRow { id: string; name?: string | null; }
interface ProductRow { id: string; name?: string | null; }

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState<'ALL' | 'REAL' | 'BOOSTED'>('ALL');
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<ReviewRow | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const fetchData = async () => {
    const [reviewsData, storesData, productsData] = await Promise.all([getGlobalReviews(500), getAllStores(), getGlobalProducts(1000)]);
    setReviews(reviewsData);
    setStores(storesData);
    setProducts(productsData);
    setLoading(false);
  };

  useEffect(() => {
    // Premier chargement : etchData est aussi appelé par les actions.
    // On le décale d'un tick pour que le rendu initial ne soit pas suivi
    // d'un setState synchrone dans le même effet.
    void Promise.resolve().then(fetchData);
  }, []);

  const storeMap = new Map(stores.map(s => [s.id, s]));
  const productMap = new Map(products.map(p => [p.id, p]));

  const filtered = reviews.filter(r => {
    const term = search.toLowerCase();
    const store = r.store_id ? storeMap.get(r.store_id) : undefined;
    const product = r.product_id ? productMap.get(r.product_id) : undefined;
    const matchesOrigin =
      originFilter === 'ALL' ||
      (originFilter === 'BOOSTED' ? !!r.boosted : !r.boosted);
    const matchesSearch =
      !term ||
      r.author_name?.toLowerCase().includes(term) ||
      r.comment?.toLowerCase().includes(term) ||
      store?.name?.toLowerCase().includes(term) ||
      product?.name?.toLowerCase().includes(term);
    return matchesOrigin && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleDelete = async (review: ReviewRow) => {
    setConfirm(null);
    setProcessing(prev => new Set(prev).add(review.id));
    await deleteReview(review.id);
    setProcessing(prev => { const next = new Set(prev); next.delete(review.id); return next; });
    await fetchData();
  };

  const renderStars = (rating?: number | null) => {
    const r = rating || 0;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} size={12} className={i <= r ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center min-h-[60vh]"><Loader size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 uppercase tracking-tighter">Modération des Avis</h1>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mt-1">Contrôle qualité du contenu client ({filtered.length})</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Chercher par auteur, commentaire, boutique, produit..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 placeholder:text-gray-300 text-sm font-semibold text-gray-900 shadow-sm"
          />
        </div>
        <select
          value={originFilter}
          onChange={(e) => { setOriginFilter(e.target.value as 'ALL' | 'REAL' | 'BOOSTED'); setPage(1); }}
          className="px-4 py-3 bg-white border border-gray-100 rounded-2xl outline-none text-xs font-bold uppercase tracking-widest text-gray-600 cursor-pointer shadow-sm"
        >
          <option value="ALL">Toutes origines</option>
          <option value="REAL">Naturels</option>
          <option value="BOOSTED">Boostés</option>
        </select>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center text-gray-400 text-sm font-semibold">Aucun avis trouvé</div>
        )}
        {paginated.map((r) => {
          const store = r.store_id ? storeMap.get(r.store_id) : undefined;
          const product = r.product_id ? productMap.get(r.product_id) : undefined;
          return (
            <div key={r.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold flex-shrink-0 overflow-hidden">
                        {r.author_avatar ? (
                          <img
                            src={r.author_avatar}
                            alt=""
                            className="w-full h-full object-cover rounded-xl"
                          />
                        ) : (
                          r.author_name?.[0]?.toUpperCase() || 'A'
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900">{maskName(r.author_name)}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {renderStars(r.rating)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-0.5">
                      <span className="text-[10px] font-semibold text-gray-400">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                      </span>
                      <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-medium">
                        <CheckCircle2 size={10} className="text-emerald-500" />
                        <span>Avis vérifié</span>
                      </div>
                      {r.boosted && (
                        <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[8px] font-bold rounded border border-purple-100 uppercase">
                          Boosté
                        </span>
                      )}
                    </div>
                  </div>
                  {r.comment && (
                    <p className="text-sm text-gray-600 font-normal leading-relaxed bg-gray-50/50 rounded-2xl border border-gray-100 p-4">{r.comment}</p>
                  )}
                  {r.seller_reply && (
                    <div className="mt-2 ml-4 pl-3 border-l-2 border-brand/40 bg-orange-50/40 rounded-r-xl px-3 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-brand mb-0.5">Réponse du vendeur</p>
                      <p className="text-xs text-gray-600 font-normal leading-relaxed">{r.seller_reply}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[10px] font-semibold text-gray-400">
                    {product && (
                      <span className="flex items-center gap-1"><Package size={11} className="text-brand" /> {product.name}</span>
                    )}
                    {store && (
                      <Link href={`/pam/stores/${store.id}`} className="flex items-center gap-1 hover:text-brand transition-colors">
                        <Store size={11} className="text-brand" /> {store.name}
                      </Link>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setConfirm(r)}
                  disabled={processing.has(r.id)}
                  className="p-2.5 bg-white text-slate-300 border border-gray-100 rounded-xl hover:text-red-500 hover:border-red-200 transition-all disabled:opacity-50 flex-shrink-0"
                  title="Supprimer l'avis"
                >
                  {processing.has(r.id) ? <RefreshCcw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Pagination total={filtered.length} page={safePage} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {confirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4 mx-auto">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Supprimer cet avis ?</h3>
            <p className="text-sm text-gray-500 font-normal text-center mb-6">
              L&apos;avis de « {confirm.author_name || 'Anonyme'} » sera définitivement supprimé.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(confirm)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-all"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
