'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  RotateCcw,
  Mail,
  Phone,
  Calendar,
  ChevronRight,
  AlertTriangle,
  ShieldCheck,
  Package
} from 'lucide-react';
import {
  getAllStores,
  updateStoreStatusAction,
  deleteStoreAdmin,
  deleteStoresBulk,
  getAllUsers,
  getAllStoreProductCounts
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
  address?: string | null;
  ninea?: string | null;
}

interface ProfileRow {
  id: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
}

interface OwnerStores {
  owner: ProfileRow;
  stores: StoreRow[];
}

const STATUS_META: Record<string, { label: string; classes: string; dot: string }> = {
  PENDING: { label: 'En attente', classes: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', dot: 'bg-amber-500' },
  APPROVED: { label: 'Active', classes: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  REJECTED: { label: 'Refusée', classes: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200', dot: 'bg-rose-500' },
  DISABLED: { label: 'Désactivée', classes: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200', dot: 'bg-slate-400' },
};

function StatusBadge({ status }: { status?: string | null }) {
  const meta = STATUS_META[status || ''] ?? STATUS_META.DISABLED;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function Avatar({ name, email }: { name?: string | null; email?: string | null }) {
  const letter = (name?.[0] || email?.[0] || 'U').toUpperCase();
  return (
    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#f56b2a] to-orange-600 flex items-center justify-center text-white font-black text-lg shrink-0 shadow-sm">
      {letter}
    </div>
  );
}

export default function AdminStoresPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState<{ type: 'delete' | 'deleteBulk' | 'status'; id: string; status?: StoreStatus } | null>(null);
  const [expandedOwners, setExpandedOwners] = useState<Set<string>>(new Set());
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const fetchData = async () => {
    const [storesData, usersData, counts] = await Promise.all([
      getAllStores(),
      getAllUsers(),
      getAllStoreProductCounts()
    ]);
    setStores(storesData);
    setUsers(usersData);
    setProductCounts(counts);
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

  const handleBulkDeleteStores = async () => {
    const ids = Array.from(selected);
    setConfirmOpen(null);
    setBulkBusy(true);
    await deleteStoresBulk(ids);
    setSelected(new Set());
    setBulkBusy(false);
    await fetchData();
  };

  const toggleRow = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const counts = useMemo(() => ({
    total: stores.length,
    pending: stores.filter(s => s.status === 'PENDING').length,
    approved: stores.filter(s => s.status === 'APPROVED').length,
    disabled: stores.filter(s => s.status === 'DISABLED').length,
  }), [stores]);

  const { filtered, groups } = useMemo(() => {
    const term = search.toLowerCase().trim();
    const result = stores.filter(s => {
      const owner = s.user_id ? userMap.get(s.user_id) : undefined;
      const matchesSearch = !term ||
        s.name?.toLowerCase().includes(term) ||
        s.slug?.toLowerCase().includes(term) ||
        s.email?.toLowerCase().includes(term) ||
        owner?.email?.toLowerCase().includes(term) ||
        owner?.full_name?.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    const grouped: Record<string, OwnerStores> = {};
    result.forEach(s => {
      const uid = s.user_id || 'unknown';
      const owner = s.user_id ? userMap.get(s.user_id) : undefined;
      if (!grouped[uid]) {
        grouped[uid] = {
          owner: owner || {
            id: uid,
            email: s.email || `Compte #${uid.substring(0, 8)}`,
            full_name: s.email ? `Compte ${s.email.split('@')[0]}` : undefined
          },
          stores: []
        };
      }
      grouped[uid].stores.push(s);
    });
    return { filtered: result, groups: Object.values(grouped) };
  }, [stores, search, statusFilter, userMap]);

  const toggleOwner = (uid: string) => {
    setExpandedOwners(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center min-h-[60vh]"><Loader size="lg" /></div>;
  }

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Boutiques</h1>
          <p className="text-sm text-gray-500 mt-1">Gestion globale des boutiques de la plateforme, regroupées par propriétaire.</p>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'Total', value: counts.total, icon: <Store size={18} />, color: 'text-gray-700 bg-gray-100', ring: 'ring-gray-200' },
          { label: 'En attente', value: counts.pending, icon: <AlertTriangle size={18} />, color: 'text-amber-600 bg-amber-50', ring: 'ring-amber-200' },
          { label: 'Actives', value: counts.approved, icon: <ShieldCheck size={18} />, color: 'text-emerald-600 bg-emerald-50', ring: 'ring-emerald-200' },
          { label: 'Désactivées', value: counts.disabled, icon: <Ban size={18} />, color: 'text-slate-600 bg-slate-100', ring: 'ring-slate-200' },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => setStatusFilter(s.label === 'Total' ? 'ALL' : s.label === 'En attente' ? 'PENDING' : s.label === 'Actives' ? 'APPROVED' : 'DISABLED' as StatusFilter)}
            className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5 text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${statusFilter === (s.label === 'Total' ? 'ALL' : s.label === 'En attente' ? 'PENDING' : s.label === 'Actives' ? 'APPROVED' : 'DISABLED') ? 'ring-2 ring-[#f56b2a]/30' : ''}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color} mb-3`}>{s.icon}</div>
            <p className="text-2xl font-black text-gray-900">{s.value}</p>
            <p className="text-xs font-bold text-gray-400 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Barre de filtres */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher une boutique, un slug, un email ou un propriétaire…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#f56b2a] placeholder:text-gray-400 text-sm font-medium text-gray-900 shadow-sm transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none text-sm font-bold text-gray-700 cursor-pointer shadow-sm md:w-52"
        >
          <option value="ALL">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="APPROVED">Actives</option>
          <option value="REJECTED">Refusées</option>
          <option value="DISABLED">Désactivées</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-orange-50/60 border border-orange-100 rounded-2xl px-4 py-3">
          <p className="text-sm font-black text-gray-700">
            {selected.size} boutique{selected.size > 1 ? 's' : ''} sélectionnée{selected.size > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-all"
            >
              Désélectionner
            </button>
            <button
              onClick={() => setConfirmOpen({ type: 'deleteBulk', id: '' })}
              disabled={bulkBusy}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black text-white transition-all disabled:opacity-60 ${bulkBusy ? 'bg-red-400' : 'bg-red-500 hover:bg-red-600'}`}
            >
              {bulkBusy ? <RefreshCcw size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Supprimer
            </button>
          </div>
        </div>
      )}

      {/* Résultat */}
      {groups.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 mx-auto bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mb-4"><Store size={28} /></div>
          <p className="text-gray-900 font-black text-lg">Aucune boutique trouvée</p>
          <p className="text-sm text-gray-500 mt-1">Essayez de modifier votre recherche ou vos filtres.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(group => {
            const uid = group.owner.id;
            const expanded = expandedOwners.has(uid);
            const pendingCount = group.stores.filter(s => s.status === 'PENDING').length;
            return (
              <div key={uid} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                {/* En-tête propriétaire */}
                <div className="bg-gradient-to-br from-gray-50 to-white px-5 md:px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Avatar name={group.owner.full_name} email={group.owner.email} />
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-gray-900 truncate">
                        {group.owner.full_name || 'Compte propriétaire'}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-500 font-medium truncate flex items-center gap-1.5">
                          <Mail size={14} className="text-gray-400" /> {group.owner.email}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm font-bold text-gray-700 ring-1 ring-gray-200">
                      <Store size={14} className="text-[#f56b2a]" />
                      {group.stores.length} boutique{group.stores.length > 1 ? 's' : ''}
                    </span>
                    {pendingCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm font-bold ring-1 ring-amber-200">
                        <AlertTriangle size={14} /> {pendingCount} en attente
                      </span>
                    )}
                    <button
                      onClick={() => toggleOwner(uid)}
                      className="p-2 text-gray-400 hover:text-[#f56b2a] transition-colors"
                      aria-label={expanded ? 'Réduire' : 'Déplier'}
                    >
                      <ChevronRight size={20} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Boutiques */}
                {expanded && (
                  <div className="divide-y divide-gray-100 border-t border-gray-100">
                    {group.stores.map(s => {
                      const statusBusy = processing.has(`status-${s.id}`);
                      const deleteBusy = processing.has(`delete-${s.id}`);
                      return (
                        <div key={s.id} className={`px-5 md:px-6 py-5 transition-colors ${selected.has(s.id) ? 'bg-orange-50/60' : 'hover:bg-gray-50/50'}`}>
                          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                            <input
                              type="checkbox"
                              checked={selected.has(s.id)}
                              onChange={() => toggleRow(s.id)}
                              className="w-4 h-4 mt-1 accent-[#f56b2a] cursor-pointer shrink-0"
                              aria-label={`Sélectionner ${s.name || s.id}`}
                            />
                            {/* Infos boutique */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#f56b2a] shrink-0">
                                  <Store size={20} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Link href={`/pam/stores/${s.id}`} className="text-base font-black text-gray-900 hover:text-[#f56b2a] transition-colors truncate">
                                      {s.name || 'Boutique sans nom'}
                                    </Link>
                                    <StatusBadge status={s.status} />
                                    {s.business_type && (
                                      <span className="text-[11px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
                                        {s.business_type === 'food' ? 'Alimentation' : 'Shopping'}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-400 font-mono mt-0.5">/{s.slug}</p>
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[13px] text-gray-500">
                                    {s.email && <span className="flex items-center gap-1.5 truncate"><Mail size={14} className="text-gray-400 shrink-0" /> {s.email}</span>}
                                    {s.phone && <span className="flex items-center gap-1.5"><Phone size={14} className="text-gray-400 shrink-0" /> {s.phone}</span>}
                                    {s.created_at && <span className="flex items-center gap-1.5"><Calendar size={14} className="text-gray-400 shrink-0" /> {new Date(s.created_at).toLocaleDateString('fr-FR')}</span>}
                                  </div>
                                  <div className="flex items-center gap-2 mt-3">
                                    <span className="text-sm font-bold text-orange-600 flex items-center gap-1.5">
                                      <Eye size={14} /> {formatNumber(Number(s.views) || 0)} visites
                                    </span>
                                    <span className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                                      <Package size={14} className="text-[#f56b2a]" /> {formatNumber(productCounts[s.id] || 0)} produit{(productCounts[s.id] || 0) > 1 ? 's' : ''}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-stretch lg:w-40 shrink-0">
                              {s.status === 'PENDING' && (
                                <>
                                  <button
                                    onClick={() => setConfirmOpen({ type: 'status', id: s.id, status: 'APPROVED' })}
                                    disabled={statusBusy}
                                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all shadow-sm disabled:opacity-50"
                                  >
                                    {statusBusy ? <RefreshCcw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Approuver
                                  </button>
                                  <button
                                    onClick={() => setConfirmOpen({ type: 'status', id: s.id, status: 'REJECTED' })}
                                    disabled={statusBusy}
                                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold ring-1 ring-rose-200 hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50"
                                  >
                                    <XCircle size={15} /> Refuser
                                  </button>
                                </>
                              )}
                              {(s.status === 'REJECTED' || s.status === 'DISABLED') && (
                                <button
                                  onClick={() => setConfirmOpen({ type: 'status', id: s.id, status: 'APPROVED' })}
                                  disabled={statusBusy}
                                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold ring-1 ring-emerald-200 hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-50"
                                >
                                  {statusBusy ? <RefreshCcw size={15} className="animate-spin" /> : <RotateCcw size={15} />} Réactiver
                                </button>
                              )}
                              {s.status === 'APPROVED' && (
                                <button
                                  onClick={() => setConfirmOpen({ type: 'status', id: s.id, status: 'DISABLED' })}
                                  disabled={statusBusy}
                                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white text-slate-500 rounded-xl text-sm font-bold ring-1 ring-slate-200 hover:bg-slate-100 hover:text-slate-700 transition-all disabled:opacity-50"
                                >
                                  {statusBusy ? <RefreshCcw size={15} className="animate-spin" /> : <Ban size={15} />} Désactiver
                                </button>
                              )}
                              <div className="flex gap-2 lg:w-full">
                                <Link
                                  href={`/pam/stores/${s.id}`}
                                  className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white text-[#f56b2a] rounded-xl text-sm font-bold ring-1 ring-orange-200 hover:bg-[#f56b2a] hover:text-white transition-all"
                                >
                                  <Eye size={15} /> Détails
                                </Link>
                                <button
                                  onClick={() => setConfirmOpen({ type: 'delete', id: s.id })}
                                  disabled={deleteBusy}
                                  className="inline-flex items-center justify-center px-3 py-2 bg-white text-rose-500 rounded-xl ring-1 ring-rose-200 hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50"
                                  title="Supprimer"
                                >
                                  {deleteBusy ? <RefreshCcw size={15} className="animate-spin" /> : <Trash2 size={15} />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!expanded && (
                  <div className="px-5 md:px-6 py-3 border-t border-gray-100 bg-gray-50/40 text-[13px] text-gray-400 font-medium">
                    {group.stores.length} boutique{group.stores.length > 1 ? 's' : ''} — cliquer pour afficher le détail
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modale de confirmation */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-gray-900 mb-2">
              {confirmOpen.type === 'delete' ? 'Supprimer cette boutique ?' : confirmOpen.type === 'deleteBulk' ? `Supprimer ${selected.size} boutique${selected.size > 1 ? 's' : ''} ?` : 'Confirmer le changement de statut'}
            </h3>
            <p className="text-sm text-gray-500 font-medium mb-6">
              {confirmOpen.type === 'delete'
                ? 'Toutes les données associées (produits, commandes, clients) seront définitivement supprimées. Cette action est irréversible.'
                : confirmOpen.type === 'deleteBulk'
                  ? `Les ${selected.size} boutique${selected.size > 1 ? 's' : ''} sélectionnée${selected.size > 1 ? 's' : ''} et toutes leurs données seront définitivement supprimées. Cette action est irréversible.`
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
                  : confirmOpen.type === 'deleteBulk'
                    ? handleBulkDeleteStores()
                    : handleStatus(confirmOpen.id, confirmOpen.status!)
                }
                className={`flex-1 py-3 rounded-xl text-sm font-black text-white transition-all ${
                  confirmOpen.type === 'delete' || confirmOpen.type === 'deleteBulk' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#f56b2a] hover:bg-[#d55a20]'
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
