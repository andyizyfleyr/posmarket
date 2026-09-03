'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Store
} from 'lucide-react';
import { getGlobalInvoices, getAllStores } from '@/app/actions/admin';
import Loader from '@/components/Loader';
import Pagination from '@/components/Pagination';
import { formatCurrency } from '@/utils';

interface InvoiceRow {
  id: string;
  store_id?: string | null;
  invoice_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  total?: string | null;
  status?: string | null;
  date?: string | Date | null;
  created_at?: string | Date | null;
}

interface StoreRow { id: string; name?: string | null; }

const statusStyles: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-500 border-gray-100',
  SENT: 'bg-blue-50 text-blue-600 border-blue-100',
  PAID: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  OVERDUE: 'bg-red-50 text-red-600 border-red-100',
};

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  const fetchData = async () => {
    const [invoicesData, storesData] = await Promise.all([getGlobalInvoices(500), getAllStores()]);
    setInvoices(invoicesData);
    setStores(storesData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const storeMap = new Map(stores.map(s => [s.id, s]));

  const filtered = invoices.filter(inv => {
    const term = search.toLowerCase();
    const store = inv.store_id ? storeMap.get(inv.store_id) : undefined;
    const matchesSearch = !term ||
      inv.invoice_number?.toLowerCase().includes(term) ||
      inv.customer_name?.toLowerCase().includes(term) ||
      inv.customer_email?.toLowerCase().includes(term) ||
      store?.name?.toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center min-h-[60vh]"><Loader size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tighter">Facturation Global</h1>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Toutes les factures de la plateforme ({filtered.length})</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Chercher par numéro, client, boutique..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 placeholder:text-gray-300 text-sm font-bold text-gray-900 shadow-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-3 bg-white border border-gray-100 rounded-2xl outline-none text-xs font-black uppercase tracking-widest text-gray-600 cursor-pointer shadow-sm"
        >
          <option value="ALL">Tous les statuts</option>
          <option value="DRAFT">Brouillon</option>
          <option value="SENT">Envoyée</option>
          <option value="PAID">Payée</option>
          <option value="OVERDUE">En retard</option>
        </select>
      </div>

      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center text-gray-400 text-sm font-bold">Aucune facture trouvée</div>
        )}
        {paginated.map((inv) => {
          const store = inv.store_id ? storeMap.get(inv.store_id) : undefined;
          const date = inv.date || inv.created_at;
          return (
            <div key={inv.id} className="flex items-center justify-between p-5 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-orange-50 rounded-xl flex items-center justify-center text-[#f56b2a] border border-orange-100">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-xs font-black text-gray-900">#{inv.invoice_number || inv.id.split('-')[0]?.toUpperCase()}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">
                    {store?.name || 'Boutique inconnue'} • {inv.customer_name || inv.customer_email || 'Client inconnu'}
                  </p>
                  {date && <p className="text-[9px] font-bold text-gray-300 mt-0.5">{new Date(date).toLocaleDateString('fr-FR')}</p>}
                </div>
              </div>
              <div className="text-right space-y-1">
                <p className="text-sm font-black text-gray-900">{formatCurrency(parseFloat(inv.total ?? '') || 0)}</p>
                <span className={`inline-block px-2 py-0.5 rounded-md text-[8px] font-black uppercase border ${
                  (inv.status && statusStyles[inv.status]) || 'bg-gray-50 text-gray-500 border-gray-100'
                }`}>
                  {inv.status || '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Pagination total={filtered.length} page={safePage} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </div>
  );
}
