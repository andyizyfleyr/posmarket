'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Wallet,
  Search,
  Eye
} from 'lucide-react';
import { getGlobalOrders, getAllStores } from '@/app/actions/admin';
import Loader from '@/components/Loader';
import { formatCurrency } from '@/utils';

interface OrderRow {
  id: string;
  store_id?: string | null;
  total?: string | null;
  subtotal?: string | null;
  status?: string | null;
  type?: string | null;
  payment_method?: string | null;
  date?: string | Date | null;
  created_at?: string | Date | null;
  buyer_email?: string | null;
}

interface StoreRow {
  id: string;
  name?: string | null;
  slug?: string | null;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const fetchData = async () => {
    const [ordersData, storesData] = await Promise.all([getGlobalOrders(), getAllStores()]);
    setOrders(ordersData);
    setStores(storesData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const storeMap = new Map(stores.map(s => [s.id, s]));

  const filtered = orders.filter(o => {
    const term = search.toLowerCase();
    const store = o.store_id ? storeMap.get(o.store_id) : undefined;
    const matchesSearch = !term ||
      o.id?.toLowerCase().includes(term) ||
      store?.name?.toLowerCase().includes(term) ||
      o.buyer_email?.toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusBadge = (status?: string | null) => {
    switch (status) {
      case 'PENDING': return <span className="px-2 py-0.5 bg-yellow-50 text-yellow-600 text-[8px] font-black rounded-md border border-yellow-100 uppercase">En attente</span>;
      case 'READY': return <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black rounded-md border border-blue-100 uppercase">Prête</span>;
      case 'COMPLETED': return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black rounded-md border border-emerald-100 uppercase">Validée</span>;
      default: return <span className="px-2 py-0.5 bg-gray-50 text-gray-500 text-[8px] font-black rounded-md border border-gray-100 uppercase">{status || '—'}</span>;
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center min-h-[60vh]"><Loader size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tighter">Transactions</h1>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Toutes les commandes de la plateforme ({orders.length})</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Chercher une commande, une boutique, un client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 placeholder:text-gray-300 text-sm font-bold text-gray-900 shadow-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-white border border-gray-100 rounded-2xl outline-none text-xs font-black uppercase tracking-widest text-gray-600 cursor-pointer shadow-sm"
        >
          <option value="ALL">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="READY">Prête</option>
          <option value="COMPLETED">Validée</option>
        </select>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 && (
          <div className="p-12 text-center text-gray-400 text-sm font-bold">Aucune commande trouvée</div>
        )}
        <div className="space-y-4 p-6">
          {filtered.map((o) => {
            const store = o.store_id ? storeMap.get(o.store_id) : undefined;
            const date = o.date || o.created_at;
            return (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-orange-50/30 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#f56b2a] border border-gray-100 shadow-sm">
                    <Wallet size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-gray-900">#{o.id.split('-')[0]?.toUpperCase()}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">
                      {store?.name || 'Boutique inconnue'} • {date && new Date(date).toLocaleDateString('fr-FR')}
                    </p>
                    {o.buyer_email && (
                      <p className="text-[9px] font-bold text-gray-300 lowercase mt-0.5">{o.buyer_email}</p>
                    )}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-xs font-black text-gray-900">{formatCurrency(parseFloat(o.total ?? '') || 0)}</p>
                  {statusBadge(o.status)}
                </div>
                <Eye size={16} className="text-gray-300 group-hover:text-[#f56b2a] transition-colors" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
