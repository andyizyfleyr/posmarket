'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Store,
  Search,
  Eye,
  Trash2,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  Ban,
  ChevronDown,
  Mail,
  Phone,
  TrendingUp
} from 'lucide-react';
import {
  getAllStores,
  updateStoreStatusAction,
  deleteStoreAdmin,
  getAllUsers
} from '@/app/actions/admin';
import Loader from '@/components/Loader';
import { formatNumber } from '@/utils';

type StoreStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED';
type StatusFilter = 'ALL' | StoreStatus;

interface StoreRow {
  id: string;
  name?: string | null;
  slug?: string | null;
  email?: string | null;
  phone?: string | null;
  user_id?: string | null;
  status?: string | null;
  views?: number | null;
  business_type?: string | null;
  created_at?: string | null;
}

interface ProfileRow {
  id: string;
  email?: string | null;
  full_name?: string | null;
}

export default function AdminStoresPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState<{ type: 'delete' | 'status'; id: string; status?: StoreStatus } | null>(null);

  const fetchData = async () => {
    const [storesData, usersData] = await Promise.all([getAllStores(), getAllUsers()]);
    setStores(storesData);
    setUsers(usersData);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const setProcessingId = (id: string, on: boolean) => {
    setProcessing(prev => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };

  const handleStatus = async (storeId: string, status: StoreStatus) => {
    setConfirmOpen(null);
    setProcessingId(`status-${storeId}`, true);
    await updateStoreStatusAction(storeId, status);
    setProcessingId(`status-${storeId}`, false);
    await fetchData();
  };

  const handleDelete = async (storeId: string) => {
    setConfirmOpen(null);
    setProcessingId(`delete-${storeId}`, true);
    await deleteStoreAdmin(storeId);
    setProcessingId(`delete-${storeId}`, false);
    await fetchData();
  };

  const userMap = new Map(users.map(u => [u.id, u]));

  const filtered = stores.filter(s => {
    const term = search.toLowerCase();
    const owner = s.user_id ? userMap.get(s.user_id) : undefined;
    const matchesSearch = !term ||
      s.name?.toLowerCase().includes(term) ||
      s.slug?.toLowerCase().includes(term) ||
      owner?.email?.toLowerCase().includes(term) ||
      owner?.full_name?.toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const groups: Record<string, { owner: ProfileRow; stores: StoreRow[] }> = {};
  filtered.forEach(s => {
    const owner = s.user_id && userMap.get(s.user_id);
    const uid = s.user_id || 'unknown';
    if (!groups[uid]) {
      groups[uid] = {
        owner: owner || {
          id: uid,
          email: s.email || 'Email non renseigné',
          full_name: s.email ? `Compte ${s.email.split('@')[0]}` : `Compte #${uid.substring(0, 8)}`
        },
        stores: []
      };
    }
    groups[uid].stores.push(s);
  });

  if (loading) {
    return <div className="flex-1 flex items-center justify-center min-h-[60vh]"><Loader size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tighter">Boutiques</h1>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Gestion groupée par compte propriétaire</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Chercher un propriétaire ou une boutique..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 placeholder:text-gray-300 text-sm font-bold text-gray-900 shadow-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-4 py-3 bg-white border border-gray-100 rounded-2xl outline-none text-xs font-black uppercase tracking-widest text-gray-600 cursor-pointer shadow-sm"
        >
          <option value="ALL">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="APPROVED">Actives</option>
          <option value="REJECTED">Refusées</option>
          <option value="DISABLED">Désactivées</option>
        </select>
      </div>

      <div className="space-y-4">
        {Object.keys(groups).length === 0 && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center text-gray-400 text-sm font-bold">
            Aucune boutique trouvée
          </div>
        )}
        {Object.keys(groups).map((uid) => {
          const group = groups[uid];
          const isExpanded = expandedUserId === uid;
          return (
            <div key={uid} className={`bg-white rounded-3xl border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-md overflow-hidden ${isExpanded ? 'ring-2 ring-orange-500/20' : ''}`}>
              <div
                onClick={() => setExpandedUserId(isExpanded ? null : uid)}
                className="p-6 flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg bg-gray-900 group-hover:scale-105 transition-transform">
                    {group.owner.full_name?.[0]?.toUpperCase() || group.owner.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 group-hover:text-orange-600 transition-colors uppercase tracking-tight">
                      {group.owner.full_name || group.owner.email || 'Utilisateur'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Mail size={12} className="text-orange-500" /> {group.owner.email}
                      </span>
                      <span className="px-3 py-1 bg-orange-50 text-orange-600 text-[9px] font-black rounded-lg border border-orange-100 uppercase">
                        {group.stores.length} boutique(s)
                      </span>
                    </div>
                  </div>
                </div>
                <div className={`p-4 rounded-2xl bg-gray-50 text-gray-400 transition-all ${isExpanded ? 'rotate-180 bg-orange-500 text-white shadow-lg shadow-orange-200' : 'group-hover:bg-gray-100'}`}>
                  <ChevronDown size={22} />
                </div>
              </div>

              {isExpanded && (
                <div className="px-6 pb-6 bg-gray-50/30 animate-in slide-in-from-top-4 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-6 border-t border-gray-100">
                    {group.stores.map(s => (
                      <div key={s.id} className="bg-white border border-gray-100 rounded-3xl p-6 hover:shadow-xl transition-all">
                        <div className="flex items-start justify-between mb-5">
                          <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-orange-500 font-black shadow-sm border border-gray-100">
                            <Store size={22} />
                          </div>
                          <div className="flex gap-2">
                            <Link
                              href={`/admin/stores/${s.id}`}
                              className="p-2.5 bg-gray-50 text-[#f56b2a] rounded-xl hover:bg-orange-500 hover:text-white transition-all shadow-sm flex items-center justify-center min-w-[40px]"
                              title="Voir les détails"
                            >
                              <Eye size={18} />
                            </Link>
                            <button
                              onClick={() => setConfirmOpen({ type: 'delete', id: s.id })}
                              disabled={processing.has(`delete-${s.id}`)}
                              className="p-2.5 bg-gray-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center justify-center min-w-[40px] disabled:opacity-50"
                              title="Supprimer"
                            >
                              {processing.has(`delete-${s.id}`) ? <RefreshCcw size={18} className="animate-spin" /> : <Trash2 size={18} />}
                            </button>
                          </div>
                        </div>
                        <h4 className="text-sm font-black text-gray-900 truncate mb-1">{s.name || 'Sans nom'}</h4>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter mb-5">/{s.slug}</p>
                        <div className="flex flex-col gap-2 mb-5">
                          {s.email && <div className="flex items-center gap-2 text-[9px] font-bold text-gray-400 truncate"><Mail size={10} /> {s.email}</div>}
                          {s.phone && <div className="flex items-center gap-2 text-[9px] font-bold text-gray-400"><Phone size={10} /> {s.phone}</div>}
                          <div className="flex items-center gap-2 mt-1">
                            {s.status === 'PENDING' ? (
                              <span className="px-2 py-0.5 bg-yellow-50 text-yellow-600 text-[8px] font-black rounded-md border border-yellow-100 uppercase animate-pulse">En attente</span>
                            ) : s.status === 'REJECTED' ? (
                              <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[8px] font-black rounded-md border border-red-100 uppercase">Refusée</span>
                            ) : s.status === 'DISABLED' ? (
                              <span className="px-2 py-0.5 bg-gray-50 text-gray-400 text-[8px] font-black rounded-md border border-gray-100 uppercase">Désactivée</span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black rounded-md border border-emerald-100 uppercase">Active</span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 mb-5">
                          {s.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => setConfirmOpen({ type: 'status', id: s.id, status: 'APPROVED' })}
                                disabled={processing.has(`status-${s.id}`)}
                                className="flex items-center justify-center gap-1.5 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase hover:bg-emerald-600 transition-all shadow-md shadow-emerald-100 disabled:opacity-50"
                              >
                                <CheckCircle2 size={12} /> Valider
                              </button>
                              <button
                                onClick={() => setConfirmOpen({ type: 'status', id: s.id, status: 'REJECTED' })}
                                disabled={processing.has(`status-${s.id}`)}
                                className="flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-500 border border-red-100 rounded-xl text-[9px] font-black uppercase hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                              >
                                <XCircle size={12} /> Refuser
                              </button>
                            </>
                          )}
                          {(s.status === 'REJECTED' || s.status === 'DISABLED') && (
                            <button
                              onClick={() => setConfirmOpen({ type: 'status', id: s.id, status: 'APPROVED' })}
                              disabled={processing.has(`status-${s.id}`)}
                              className="flex items-center justify-center gap-1.5 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-50"
                            >
                              <TrendingUp size={12} /> Réactiver
                            </button>
                          )}
                          {s.status === 'APPROVED' && (
                            <button
                              onClick={() => setConfirmOpen({ type: 'status', id: s.id, status: 'DISABLED' })}
                              disabled={processing.has(`status-${s.id}`)}
                              className="flex items-center justify-center gap-1.5 py-2 bg-gray-50 text-gray-400 border border-gray-100 rounded-xl text-[9px] font-black uppercase hover:bg-gray-100 hover:text-red-500 transition-all disabled:opacity-50"
                            >
                              <Ban size={12} /> Désactiver
                            </button>
                          )}
                        </div>

                        <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                          <span className="text-[9px] font-black text-gray-400 uppercase">Impact</span>
                          <span className="text-[10px] font-black text-orange-600">{formatNumber(Number(s.views) || 0)} visites</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-gray-900 mb-2">
              {confirmOpen.type === 'delete' ? 'Supprimer cette boutique ?' : 'Confirmer le changement de statut'}
            </h3>
            <p className="text-sm text-gray-500 font-medium mb-6">
              {confirmOpen.type === 'delete'
                ? 'Toutes les données associées (produits, commandes, clients) seront définitivement supprimées. Cette action est irréversible.'
                : 'Voulez-vous vraiment changer le statut de cette boutique ?'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(null)}
                className="flex-1 py-3 rounded-xl text-sm font-black text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={() => confirmOpen.type === 'delete'
                  ? handleDelete(confirmOpen.id)
                  : handleStatus(confirmOpen.id, confirmOpen.status!)
                }
                className={`flex-1 py-3 rounded-xl text-sm font-black text-white transition-all ${
                  confirmOpen.type === 'delete' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#f56b2a] hover:bg-[#d55a20]'
                }`}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
