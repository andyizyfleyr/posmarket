'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  Search,
  Trash2,
  RefreshCcw,
  AlertTriangle
} from 'lucide-react';
import { getGlobalProducts, getAllStores, deleteProduct } from '@/app/actions/admin';
import Loader from '@/components/Loader';
import Pagination from '@/components/Pagination';
import { formatCurrency } from '@/utils';

interface ProductRow {
  id: string;
  store_id?: string | null;
  name?: string | null;
  price?: string | null;
  stock?: number | null;
  is_online?: boolean | null;
  views?: number | null;
  created_at?: string | null;
}

interface StoreRow {
  id: string;
  name?: string | null;
}

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<ProductRow | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const fetchData = async () => {
    const [productsData, storesData] = await Promise.all([getGlobalProducts(500), getAllStores()]);
    setProducts(productsData);
    setStores(storesData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const storeMap = new Map(stores.map(s => [s.id, s]));

  const filtered = products.filter(p => {
    const term = search.toLowerCase();
    const store = p.store_id ? storeMap.get(p.store_id) : undefined;
    return !term ||
      p.name?.toLowerCase().includes(term) ||
      store?.name?.toLowerCase().includes(term);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleDelete = async (product: ProductRow) => {
    setConfirm(null);
    setProcessing(prev => new Set(prev).add(product.id));
    await deleteProduct(product.id);
    setProcessing(prev => { const next = new Set(prev); next.delete(product.id); return next; });
    await fetchData();
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center min-h-[60vh]"><Loader size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tighter">Inventaire Global</h1>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Surveillance et modération des produits ({filtered.length})</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Chercher un produit ou une boutique..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 placeholder:text-gray-300 text-sm font-bold text-gray-900 shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-400 border-b border-gray-100">
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest">Produit</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest">Boutique</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest">Prix</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest">Stock</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.map((p) => {
                const store = p.store_id ? storeMap.get(p.store_id) : undefined;
                const lowStock = (p.stock ?? 0) <= 5;
                return (
                  <tr key={p.id} className="hover:bg-orange-50/20 group transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center text-[#f56b2a]">
                          <Package size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-gray-900 truncate max-w-[220px]">{p.name || 'Sans nom'}</p>
                          <p className="text-[9px] font-bold text-gray-400">#{p.id.split('-')[0]?.toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {store ? (
                        <Link href={`/pam/stores/${store.id}`} className="text-xs font-black text-[#f56b2a] hover:underline">{store.name}</Link>
                      ) : <span className="text-xs text-gray-400 font-bold">—</span>}
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-xs font-black text-gray-900">{formatCurrency(parseFloat(p.price ?? '') || 0)}</p>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${
                        lowStock ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-500 border-gray-100'
                      }`}>
                        {lowStock && <AlertTriangle size={10} />}
                        {p.stock ?? 0} en stock
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={() => setConfirm(p)}
                        disabled={processing.has(p.id)}
                        className="p-2.5 bg-white text-slate-300 border border-gray-100 rounded-xl hover:text-red-500 hover:border-red-200 transition-all disabled:opacity-50"
                        title="Supprimer le produit"
                      >
                        {processing.has(p.id) ? <RefreshCcw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination total={filtered.length} page={safePage} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {confirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4 mx-auto">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-black text-gray-900 text-center mb-2">Supprimer ce produit ?</h3>
            <p className="text-sm text-gray-500 font-medium text-center mb-6">
              « {confirm.name} » sera définitivement supprimé du catalogue. Cette action est irréversible.
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
