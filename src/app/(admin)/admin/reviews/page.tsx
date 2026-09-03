'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Star,
  Search,
  Trash2,
  RefreshCcw,
  Package,
  Store
} from 'lucide-react';
import { getGlobalReviews, getAllStores, getGlobalProducts, deleteReview } from '@/app/actions/admin';
import Loader from '@/components/Loader';

interface ReviewRow {
  id: string;
  store_id?: string | null;
  product_id?: string | null;
  user_id?: string | null;
  author_name?: string | null;
  rating?: number | null;
  comment?: string | null;
  created_at?: string | null;
}

interface StoreRow { id: string; name?: string | null; }
interface ProductRow { id: string; name?: string | null; }

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<ReviewRow | null>(null);

  const fetchData = async () => {
    const [reviewsData, storesData, productsData] = await Promise.all([getGlobalReviews(500), getAllStores(), getGlobalProducts(1000)]);
    setReviews(reviewsData);
    setStores(storesData);
    setProducts(productsData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const storeMap = new Map(stores.map(s => [s.id, s]));
  const productMap = new Map(products.map(p => [p.id, p]));

  const filtered = reviews.filter(r => {
    const term = search.toLowerCase();
    const store = r.store_id ? storeMap.get(r.store_id) : undefined;
    const product = r.product_id ? productMap.get(r.product_id) : undefined;
    return !term ||
      r.author_name?.toLowerCase().includes(term) ||
      r.comment?.toLowerCase().includes(term) ||
      store?.name?.toLowerCase().includes(term) ||
      product?.name?.toLowerCase().includes(term);
  });

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
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tighter">Modération des Avis</h1>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Contrôle qualité du contenu client ({filtered.length})</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Chercher par auteur, commentaire, boutique, produit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-[480px] pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 placeholder:text-gray-300 text-sm font-bold text-gray-900 shadow-sm"
        />
      </div>

      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center text-gray-400 text-sm font-bold">Aucun avis trouvé</div>
        )}
        {filtered.map((r) => {
          const store = r.store_id ? storeMap.get(r.store_id) : undefined;
          const product = r.product_id ? productMap.get(r.product_id) : undefined;
          return (
            <div key={r.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 font-black">
                      {r.author_name?.[0]?.toUpperCase() || 'A'}
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900">{r.author_name || 'Anonyme'}</p>
                      <div className="flex items-center gap-2">
                        {renderStars(r.rating)}
                        <span className="text-[10px] font-bold text-gray-400">{r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : ''}</span>
                      </div>
                    </div>
                  </div>
                  {r.comment && (
                    <p className="text-sm text-gray-600 font-medium leading-relaxed bg-gray-50/50 rounded-2xl border border-gray-100 p-4">{r.comment}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[10px] font-bold text-gray-400">
                    {product && (
                      <span className="flex items-center gap-1"><Package size={11} className="text-[#f56b2a]" /> {product.name}</span>
                    )}
                    {store && (
                      <Link href={`/admin/stores/${store.id}`} className="flex items-center gap-1 hover:text-[#f56b2a] transition-colors">
                        <Store size={11} className="text-[#f56b2a]" /> {store.name}
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

      {confirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4 mx-auto">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-black text-gray-900 text-center mb-2">Supprimer cet avis ?</h3>
            <p className="text-sm text-gray-500 font-medium text-center mb-6">
              L&apos;avis de « {confirm.author_name || 'Anonyme'} » sera définitivement supprimé.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-3 rounded-xl text-sm font-black text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(confirm)}
                className="flex-1 py-3 rounded-xl text-sm font-black text-white bg-red-500 hover:bg-red-600 transition-all"
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
