'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  RefreshCcw,
  Shield,
  Eye,
  Trash2
} from 'lucide-react';
import {
  getAllUsers,
  updateUserAdminStatus,
  updateUserSubscription,
  deleteUser,
  deleteUsersBulk
} from '@/app/actions/admin';
import Loader from '@/components/Loader';
import Pagination from '@/components/Pagination';
import { SubscriptionTier } from '@/types';

interface UserRow {
  id: string;
  email?: string | null;
  full_name?: string | null;
  is_super_admin?: boolean | null;
  subscription_tier?: string | null;
  subscription_status?: string | null;
  created_at?: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ id: string; name: string; action: 'admin' | 'revoke' | 'delete' | 'deleteBulk' } | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const fetchData = async () => {
    const data = await getAllUsers();
    setUsers(data);
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

  const handleToggleAdmin = async (userId: string, isNowAdmin: boolean, name: string) => {
    setConfirm({ id: userId, name, action: isNowAdmin ? 'admin' : 'revoke' });
  };

  const handleDeleteUser = async (userId: string) => {
    setConfirm(null);
    setProcessingId(`delete-${userId}`, true);
    await deleteUser(userId);
    setProcessingId(`delete-${userId}`, false);
    await fetchData();
  };

  const filtered = users.filter(u => {
    const term = search.toLowerCase();
    return !term || u.email?.toLowerCase().includes(term) || u.full_name?.toLowerCase().includes(term);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pageIds = paginated.map(u => u.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id));

  const toggleRow = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach(id => next.delete(id));
      else pageIds.forEach(id => next.add(id));
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    setConfirm(null);
    setBulkBusy(true);
    await deleteUsersBulk(ids);
    setSelected(new Set());
    setBulkBusy(false);
    setPage(1);
    await fetchData();
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center min-h-[60vh]"><Loader size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 uppercase tracking-tighter">Utilisateurs</h1>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Gestion des comptes de la plateforme</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Chercher un utilisateur..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full md:w-96 pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 placeholder:text-gray-300 text-sm font-bold text-gray-900 shadow-sm"
        />
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-orange-50/60 border border-orange-100 rounded-2xl px-4 py-3">
          <p className="text-sm font-black text-gray-700">
            {selected.size} élément{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-all"
            >
              Désélectionner
            </button>
            <button
              onClick={() => setConfirm({ id: '', name: `${selected.size} utilisateur${selected.size > 1 ? 's' : ''}`, action: 'deleteBulk' })}
              disabled={bulkBusy}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black text-white transition-all disabled:opacity-60 ${bulkBusy ? 'bg-red-400' : 'bg-red-500 hover:bg-red-600'}`}
            >
              {bulkBusy ? <RefreshCcw size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Supprimer
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-400 border-b border-gray-100">
                <th className="px-4 py-5 w-12">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                    className="w-4 h-4 accent-[#f56b2a] cursor-pointer"
                    aria-label="Tout sélectionner"
                  />
                </th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest">Utilisateur</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Rôle</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Abonnement</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.map((u) => (
                <tr key={u.id} className={`transition-colors ${selected.has(u.id) ? 'bg-orange-50/40' : 'hover:bg-orange-50/20 group'}`}>
                  <td className="px-4 py-6">
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggleRow(u.id)}
                      className="w-4 h-4 accent-[#f56b2a] cursor-pointer"
                      aria-label={`Sélectionner ${u.email || u.id}`}
                    />
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${u.is_super_admin ? 'bg-[#f56b2a] text-white shadow-lg shadow-orange-100' : 'bg-gray-100 text-gray-400'}`}>
                        {u.email?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-900">{u.full_name || 'Utilisateur'}</p>
                        <p className="text-[10px] font-bold text-gray-400 lowercase">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    {u.is_super_admin ? (
                      <span className="px-2 py-1 bg-orange-50 text-[#f56b2a] text-[9px] font-black rounded-lg uppercase tracking-tighter border border-orange-100">Super Admin</span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-50 text-gray-400 text-[9px] font-black rounded-lg uppercase tracking-tighter border border-gray-100">Utilisateur</span>
                    )}
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                      <select
                        value={u.subscription_tier || 'PRO'}
                        onChange={async (e) => {
                          setProcessingId(`sub-${u.id}`, true);
                          await updateUserSubscription(u.id, e.target.value as SubscriptionTier, 'monthly');
                          setProcessingId(`sub-${u.id}`, false);
                          await fetchData();
                        }}
                        disabled={processing.has(`sub-${u.id}`)}
                        className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-xl border outline-none appearance-none cursor-pointer transition-all disabled:opacity-50 ${
                          u.subscription_tier === 'STARTER' ? 'bg-green-50 border-green-200 text-green-600' :
                          u.subscription_tier === 'PRO' ? 'bg-orange-50 border-orange-200 text-[#f56b2a]' :
                          u.subscription_tier === 'ENTERPRISE' ? 'bg-purple-50 border-purple-200 text-purple-600' :
                          'bg-gray-50 border-gray-200 text-gray-500'
                        }`}
                      >
                        <option value="STARTER">STARTER</option>
                        <option value="PRO">PRO</option>
                        <option value="ENTERPRISE">ENTERPRISE</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                      <Link
                        href={`/pam/users/${u.id}`}
                        className="p-2.5 rounded-xl border border-gray-100 bg-white text-gray-400 hover:text-[#f56b2a] hover:border-orange-200 transition-all flex items-center justify-center min-w-[40px]"
                        title="Voir le profil"
                      >
                        <Eye size={16} />
                      </Link>
                      <button
                        onClick={() => handleToggleAdmin(u.id, !u.is_super_admin, u.full_name || u.email || '')}
                        disabled={processing.has(`admin-${u.id}`)}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-center min-w-[40px] disabled:opacity-50 ${
                          u.is_super_admin ? 'bg-gray-50 text-gray-400 border-gray-100' : 'bg-[#f56b2a] text-white border-[#f56b2a] shadow-lg shadow-orange-100'
                        }`}
                        title={u.is_super_admin ? 'Révoquer les droits admin' : 'Promouvoir super admin'}
                      >
                        {processing.has(`admin-${u.id}`) ? <RefreshCcw size={16} className="animate-spin" /> : <Shield size={16} />}
                      </button>
                      <button
                        onClick={() => setConfirm({ id: u.id, name: u.full_name || u.email || 'Utilisateur', action: 'delete' })}
                        disabled={processing.has(`delete-${u.id}`)}
                        className="p-2.5 bg-white text-slate-300 border border-gray-100 rounded-xl hover:text-red-500 hover:border-red-200 transition-all flex items-center justify-center min-w-[40px] disabled:opacity-50"
                        title="Supprimer le compte"
                      >
                        {processing.has(`delete-${u.id}`) ? <RefreshCcw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination total={filtered.length} page={safePage} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {confirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto
              ${confirm.action === 'admin' ? 'bg-orange-50 text-[#f56b2a]' : confirm.action === 'revoke' ? 'bg-gray-50 text-gray-500' : 'bg-red-50 text-red-500'}">
              {confirm.action === 'delete' || confirm.action === 'deleteBulk' ? <Trash2 size={24} /> : confirm.action === 'revoke' ? <Shield size={24} /> : <Shield size={24} />}
            </div>
            <h3 className="text-lg font-black text-gray-900 text-center mb-2">
              {confirm.action === 'admin' ? 'Promouvoir super admin ?' : confirm.action === 'revoke' ? 'Révoquer les droits admin ?' : confirm.action === 'deleteBulk' ? `Supprimer ${confirm.name} ?` : 'Supprimer ce compte ?'}
            </h3>
            <p className="text-sm text-gray-500 font-medium text-center mb-6">
              {confirm.action === 'deleteBulk'
                ? `Les comptes sélectionnés et toutes leurs boutiques et données seront définitivement supprimés. Action irréversible.`
                : confirm.action === 'delete'
                  ? `Toutes les boutiques et données de « ${confirm.name} » seront supprimées. Action irréversible.`
                  : confirm.action === 'revoke'
                    ? `« ${confirm.name} » perdra ses droits d'administration.`
                    : `« ${confirm.name} » recevra les droits d'administration de la plateforme.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-3 rounded-xl text-sm font-black text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  const c = confirm;
                  setConfirm(null);
                  if (c.action === 'deleteBulk') {
                    await handleBulkDelete();
                  } else if (c.action === 'delete') {
                    await handleDeleteUser(c.id);
                  } else {
                    setProcessingId(`admin-${c.id}`, true);
                    await updateUserAdminStatus(c.id, c.action === 'admin');
                    setProcessingId(`admin-${c.id}`, false);
                    await fetchData();
                  }
                }}
                className={`flex-1 py-3 rounded-xl text-sm font-black text-white transition-all ${
                  confirm.action === 'delete' || confirm.action === 'deleteBulk' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#f56b2a] hover:bg-[#d55a20]'
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
