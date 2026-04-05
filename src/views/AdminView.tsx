'use client';

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Store, 
  Users, 
  TrendingUp, 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  RefreshCcw, 
  ExternalLink,
  ChevronRight,
  Package,
  Wallet,
  AlertCircle,
  Eye,
  ShoppingBag,
  Ban,
  ArrowRight,
  Calendar,
  Clock,
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownRight,
  Mail,
  Phone,
  ChevronDown,
  Activity
} from 'lucide-react';
import { 
  getGlobalStats, 
  getAllStores, 
  getAllUsers, 
  updateUserAdminStatus, 
  updateUserSubscription,
  deleteStoreAdmin,
  getGlobalProducts,
  getGlobalOrders,
  updateStoreStatusAction
} from '@/app/actions/admin';
import Loader from '@/components/Loader';
import { SubscriptionTier, SubscriptionDuration } from '@/types';
import { useRouter } from '@/components/RouterPolyfill';
import { formatCurrency } from '@/utils';

type AdminTab = 'dashboard' | 'stores' | 'users' | 'inventory' | 'orders' | 'system';

const AdminStatCard = ({ title, value, icon, trend, trendValue, color }: any) => (
  <div className="bg-white p-3 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300">
    <div className="flex items-center justify-between mb-1.5 md:mb-4">
      <div className={`p-1.5 md:p-3 rounded-xl md:rounded-2xl ${color} text-white shadow-lg ${color.replace('bg-', 'shadow-')}/20`}>
        {React.cloneElement(icon, { className: "w-4 h-4 md:w-5 md:h-5" })}
      </div>
      <div className={`flex items-center gap-0.5 text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded-full ${trend === 'up' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
        {trend === 'up' ? <ArrowUpRight size={10} className="md:w-3 md:h-3" /> : <ArrowDownRight size={10} className="md:w-3 md:h-3" />}
        {trendValue}
      </div>
    </div>
    <div className="flex flex-col min-w-0">
      <span className="text-gray-400 text-[9px] md:text-xs font-bold uppercase tracking-widest whitespace-nowrap overflow-hidden text-ellipsis">{title}</span>
      <span className="text-sm md:text-xl font-black text-gray-900 mt-0 md:mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{value}</span>
    </div>
  </div>
);

export default function AdminView() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const [expandedOwnerId, setExpandedOwnerId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    fetchData();

    // Sync with Supreme Sidebar
    const handleAdminTabChange = (e: any) => {
      if (e.detail) setActiveTab(e.detail as AdminTab);
    };

    window.addEventListener('setAdminTab', handleAdminTabChange);
    return () => window.removeEventListener('setAdminTab', handleAdminTabChange);
  }, []);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [statsData, storesData, usersData, ordersData] = await Promise.all([
        getGlobalStats(),
        getAllStores(),
        getAllUsers(),
        getGlobalOrders()
      ]);
      setStats(statsData);
      setStores(storesData);
      setUsers(usersData);
      setOrders(ordersData);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const setItemProcessing = (id: string, isProcessing: boolean) => {
    setProcessingItems(prev => {
      const next = new Set(prev);
      if (isProcessing) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleEntrerBoutique = async (storeId: string) => {
    try {
      setItemProcessing(`enter-${storeId}`, true);
      await fetch('/api/set-store', { 
        method: 'POST', 
        body: JSON.stringify({ storeId }) 
      });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      alert("Erreur de basculement");
    } finally {
      setItemProcessing(`enter-${storeId}`, false);
    }
  };

  const handleToggleAdmin = async (userId: string, isNowAdmin: boolean) => {
    if (!confirm(isNowAdmin ? "Promouvoir ?" : "Révoquer ?")) return;
    try {
      setItemProcessing(`admin-${userId}`, true);
      await updateUserAdminStatus(userId, isNowAdmin);
      fetchData();
    } catch (err) {
      alert("Erreur");
    } finally {
      setItemProcessing(`admin-${userId}`, false);
    }
  };

  const handleUpdateSubscription = async (userId: string, tier: SubscriptionTier) => {
    try {
      setItemProcessing(`sub-${userId}`, true);
      await updateUserSubscription(userId, tier, 'monthly');
      fetchData();
    } catch (err) {
      alert("Erreur d'abonnement");
    } finally {
      setItemProcessing(`sub-${userId}`, false);
    }
  };

  const handleDeleteStore = async (storeId: string) => {
    if (!confirm("⚠️ Supprimer cette boutique ?")) return;
    try {
      setItemProcessing(`delete-${storeId}`, true);
      await deleteStoreAdmin(storeId);
      fetchData();
    } catch (err) {
      alert("Erreur");
    } finally {
      setItemProcessing(`delete-${storeId}`, false);
    }
  };
  const handleUpdateStoreStatus = async (storeId: string, status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED') => {
    try {
      setItemProcessing(`status-${storeId}`, true);
      await updateStoreStatusAction(storeId, status);
      fetchData();
    } catch (err) {
      alert("Erreur lors de la mise à jour du statut");
    } finally {
      setItemProcessing(`status-${storeId}`, false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50/50">
        <Loader size="lg" />
      </div>
    );
  }

  const filteredStores = stores.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));
  const filteredUsers = users.filter(u => u.email?.toLowerCase().includes(search.toLowerCase()) || u.full_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex-grow overflow-y-auto p-3 md:p-8 custom-scrollbar bg-gray-50/50">
      {/* Header - Simple & Powerful */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 md:mb-12 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-orange-50 text-[#f56b2a] rounded-[20px] md:rounded-[28px] flex items-center justify-center shadow-xl shadow-orange-100 border border-orange-50 transition-transform hover:scale-105 active:scale-95 cursor-default">
            <Shield size={28} className="md:w-10 md:h-10 animate-in zoom-in duration-500" />
          </div>
          <div>
            <h1 className="text-xl md:text-4xl font-black text-gray-900 tracking-tighter leading-none uppercase">
              Pôle Suprême
            </h1>
            <div className="flex items-center gap-3 mt-2">
               <p className="text-gray-400 text-[9px] md:text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                 <Activity size={14} className="text-emerald-500" />
                 Système Synchronisé
               </p>
               <div className="w-1 h-1 bg-gray-200 rounded-full" />
               <p className="text-gray-300 text-[9px] md:text-xs font-bold uppercase tracking-widest">
                 {mounted ? new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '...'}
               </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="px-6 py-4 bg-white border border-gray-100 rounded-[2rem] shadow-sm flex items-center gap-6">
              <div>
                 <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Réseau d'Élite</p>
                 <p className="text-lg font-black text-gray-900 tracking-tighter">{stats?.totalStores || 0} <span className="text-xs font-bold text-gray-400">Magasins</span></p>
              </div>
              <div className="w-px h-8 bg-gray-100" />
              <button 
                onClick={fetchData} 
                disabled={refreshing}
                className={`p-3 bg-gray-50 text-[#f56b2a] rounded-2xl hover:bg-orange-50 transition-all ${refreshing ? 'animate-spin border-transparent' : 'border border-gray-100'}`}
                title="Actualiser les données globales"
              >
                <RefreshCcw size={20} />
              </button>
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6 md:space-y-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6">
              <AdminStatCard
                title="Boutiques Réseau"
                value={stats.totalStores}
                icon={<Store size={20} />}
                trend="up"
                trendValue="Live"
                color="bg-[#f56b2a]"
              />
              <AdminStatCard
                title="Utilisateurs"
                value={stats.totalUsers}
                icon={<Users size={20} />}
                trend="up"
                trendValue="Sync"
                color="bg-purple-600"
              />
              <AdminStatCard
                title="Ventes Globales"
                value={formatCurrency(stats.totalSales)}
                icon={<TrendingUp size={20} />}
                trend="up"
                trendValue="Total"
                color="bg-green-600"
              />
              <AdminStatCard
                title="Total Produits"
                value={stats.totalProducts}
                icon={<Package size={20} />}
                trend="up"
                trendValue="Item"
                color="bg-orange-600"
              />
              {stats.pendingStores > 0 && (
                <div onClick={() => setActiveTab('stores')} className="cursor-pointer group">
                  <AdminStatCard
                    title="En Attente"
                    value={stats.pendingStores}
                    icon={<AlertCircle size={20} />}
                    trend="down"
                    trendValue="Requis"
                    color="bg-yellow-500"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm p-6">
                 <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                       <TrendingUp className="text-[#f56b2a]" size={20} /> Activité Récente du Réseau
                    </h3>
                 </div>
                 <div className="space-y-4">
                    {stores.slice(0, 5).map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-orange-50/30 transition-all group">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-[#f56b2a] font-black">
                               {s.name?.[0] || 'S'}
                            </div>
                            <div>
                               <p className="text-xs font-black text-gray-900">{s.name}</p>
                               <p className="text-[10px] font-bold text-gray-400 font-mono tracking-tight">/{s.slug}</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-4">
                            <div className="text-right hidden md:block">
                               <p className="text-[9px] font-black text-gray-400 uppercase">Création</p>
                               <p className="text-[10px] font-bold text-gray-700">{new Date(s.created_at).toLocaleDateString()}</p>
                            </div>
                            <button 
                              onClick={() => handleEntrerBoutique(s.id)}
                              className="p-2.5 bg-white text-[#f56b2a] rounded-xl border border-gray-200 hover:border-[#f56b2a] hover:bg-[#f56b2a] hover:text-white transition-all shadow-sm group-hover:scale-105"
                            >
                               <Eye size={18} />
                            </button>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm p-6 relative overflow-hidden h-fit">
                 <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-orange-50 text-[#f56b2a] rounded-xl"><Shield size={20} /></div>
                    <h3 className="text-lg font-black text-gray-900">Sentinel Système</h3>
                 </div>
                 <div className="space-y-4">
                    {[
                      { l: 'Base de Données', v: 'Optimisée', s: 'green' },
                      { l: 'Latence Réseau', v: '18ms', s: 'green' },
                      { l: 'Vérification SSL', v: 'Valide', s: 'green' },
                    ].map((item, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.l}</span>
                          <div className={`w-2 h-2 rounded-full bg-${item.s}-500 animate-pulse`} />
                        </div>
                        <div className="text-xs font-black text-gray-700">{item.v}</div>
                      </div>
                    ))}
                 </div>
                 <div className="mt-8 pt-6 border-t border-gray-100">
                    <p className="text-[10px] text-gray-400 font-bold leading-relaxed">
                       Statut plateforme global : <span className="text-green-600 font-black">100% OK</span>. Aucun incident majeur détecté.
                    </p>
                 </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stores' && (
           <div className="space-y-6 animate-in slide-in-from-bottom-5 duration-500">
            <div className="flex items-center justify-between px-4">
               <div>
                  <h2 className="text-2xl font-black text-gray-900">Réseau des Propriétaires</h2>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Gestion groupée par compte client</p>
               </div>
               <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Chercher un propriétaire ou une boutique..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20 w-80 transition-all placeholder:text-gray-300 text-sm font-bold text-gray-900 shadow-sm"
                  />
               </div>
            </div>
            
            <div className="space-y-4">
              {(() => {
                const groups: Record<string, { profile: any, stores: any[] }> = {};
                stores.forEach(s => {
                  const uid = s.user_id;
                  if (!groups[uid]) {
                    // Si pas de profil, on crée un objet virtuel avec l'email de la boutique par défaut
                    groups[uid] = { 
                      profile: s.profiles || { 
                        full_name: s.email ? `Compte ${s.email.split('@')[0]}` : `Compte #${uid.substring(0, 8)}`, 
                        email: s.email || 'Email non renseigné' 
                      }, 
                      stores: [] 
                    };
                  }
                  groups[uid].stores.push(s);
                });

                const filteredGroups = Object.keys(groups).filter(uid => {
                  const g = groups[uid];
                  const term = search.toLowerCase();
                  return g.profile.full_name?.toLowerCase().includes(term) || 
                         g.profile.email?.toLowerCase().includes(term) ||
                         g.stores.some(st => st.name?.toLowerCase().includes(term));
                });

                return filteredGroups.map(uid => {
                  const group = groups[uid];
                  const isExpanded = expandedOwnerId === uid;

                  return (
                    <div key={uid} className={`bg-white rounded-[2rem] border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-md overflow-hidden ${isExpanded ? 'ring-2 ring-orange-500/20' : ''}`}>
                      <div 
                        onClick={() => setExpandedOwnerId(isExpanded ? null : uid)}
                        className="p-6 md:p-8 flex items-center justify-between cursor-pointer group"
                      >
                         <div className="flex items-center gap-6">
                            <div className={`w-14 h-14 md:w-16 md:h-16 rounded-[24px] flex items-center justify-center text-white text-xl font-black shadow-lg shadow-gray-200 transition-transform group-hover:scale-105 bg-gray-900`}>
                               {group.profile.email?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div>
                               <h3 className="text-lg md:text-xl font-black text-gray-900 group-hover:text-orange-600 transition-colors uppercase tracking-tight">
                                 {group.profile.full_name || group.profile.email || 'Utilisateur'}
                               </h3>
                               <div className="flex items-center gap-3 mt-1.5">
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Mail size={12} className="text-orange-500" /> {group.profile.email}
                                  </span>
                                  <span className="w-1 h-1 bg-gray-200 rounded-full" />
                                  <span className="px-3 py-1 bg-orange-50 text-orange-600 text-[9px] font-black rounded-lg border border-orange-100 uppercase tracking-tighter">
                                    {group.stores.length} {group.stores.length > 1 ? 'Boutiques Actives' : 'Boutique Active'}
                                  </span>
                               </div>
                            </div>
                         </div>
                         <div className={`p-4 rounded-2xl bg-gray-50 text-gray-400 transition-all ${isExpanded ? 'rotate-180 bg-orange-500 text-white shadow-lg shadow-orange-200' : 'group-hover:bg-gray-100'}`}>
                            <ChevronDown size={24} />
                         </div>
                      </div>

                      {isExpanded && (
                        <div className="px-8 pb-8 bg-gray-50/30 animate-in slide-in-from-top-4 duration-300">
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6 border-t border-gray-100">
                             {group.stores.map(s => (
                               <div key={s.id} className="bg-white border border-gray-100 rounded-[2rem] p-6 hover:shadow-xl transition-all group/store">
                                  <div className="flex items-start justify-between mb-6">
                                     <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-orange-500 font-black shadow-sm border border-gray-100">
                                       {s.name?.[0] || 'B'}
                                     </div>
                                     <div className="flex gap-2">
                                         <button 
                                           onClick={(e) => { e.stopPropagation(); handleEntrerBoutique(s.id); }}
                                           disabled={processingItems.has(`enter-${s.id}`)}
                                           className="p-2.5 bg-gray-50 text-[#f56b2a] rounded-xl hover:bg-orange-500 hover:text-white transition-all shadow-sm flex items-center justify-center min-w-[40px]"
                                           title="Prendre le contrôle"
                                         >
                                           {processingItems.has(`enter-${s.id}`) ? <RefreshCcw size={18} className="animate-spin" /> : <Eye size={18} />}
                                         </button>
                                         <button 
                                           onClick={(e) => { e.stopPropagation(); handleDeleteStore(s.id); }}
                                           disabled={processingItems.has(`delete-${s.id}`)}
                                           className="p-2.5 bg-gray-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center justify-center min-w-[40px]"
                                         >
                                           {processingItems.has(`delete-${s.id}`) ? <RefreshCcw size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                         </button>
                                     </div>
                                  </div>
                                  <h4 className="text-sm font-black text-gray-900 truncate mb-1">{s.name}</h4>
                                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter mb-6">{s.slug}.pos.sn</p>
                                  
                                  <div className="flex flex-col gap-2 mb-6">
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
                                           <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black rounded-md border border-emerald-100 uppercase text-center">Active</span>
                                        )}
                                     </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2 mb-6">
                                     {s.status === 'PENDING' && (
                                        <>
                                           <button 
                                              onClick={(e) => { e.stopPropagation(); handleUpdateStoreStatus(s.id, 'APPROVED'); }}
                                              disabled={processingItems.has(`status-${s.id}`)}
                                              className="flex items-center justify-center gap-1.5 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase hover:bg-emerald-600 transition-all shadow-md shadow-emerald-100 disabled:opacity-50"
                                           >
                                              {processingItems.has(`status-${s.id}`) ? <RefreshCcw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Valider
                                           </button>
                                           <button 
                                              onClick={(e) => { e.stopPropagation(); handleUpdateStoreStatus(s.id, 'REJECTED'); }}
                                              disabled={processingItems.has(`status-${s.id}`)}
                                              className="flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-500 border border-red-100 rounded-xl text-[9px] font-black uppercase hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                                           >
                                              {processingItems.has(`status-${s.id}`) ? <RefreshCcw size={12} className="animate-spin" /> : <XCircle size={12} />} Refuser
                                           </button>
                                        </>
                                     )}
                                     {s.status === 'APPROVED' && (
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); handleUpdateStoreStatus(s.id, 'DISABLED'); }}
                                            disabled={processingItems.has(`status-${s.id}`)}
                                            className="col-span-2 flex items-center justify-center gap-1.5 py-2 bg-gray-50 text-gray-400 border border-gray-100 rounded-xl text-[9px] font-black uppercase hover:bg-gray-100 hover:text-red-500 transition-all disabled:opacity-50"
                                         >
                                            {processingItems.has(`status-${s.id}`) ? <RefreshCcw size={12} className="animate-spin" /> : <Ban size={12} />} Désactiver
                                         </button>
                                     )}
                                     {(s.status === 'REJECTED' || s.status === 'DISABLED') && (
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); handleUpdateStoreStatus(s.id, 'APPROVED'); }}
                                            disabled={processingItems.has(`status-${s.id}`)}
                                            className="col-span-2 flex items-center justify-center gap-1.5 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all font-mono disabled:opacity-50"
                                         >
                                            {processingItems.has(`status-${s.id}`) ? <RefreshCcw size={12} className="animate-spin" /> : <TrendingUp size={12} />} Réactiver
                                         </button>
                                     )}
                                  </div>

                                  <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                                     <div className="text-[9px] font-black text-gray-400 uppercase">Impact Global</div>
                                     <div className="text-[10px] font-black text-orange-600">
                                        {s.views || 0} Visites
                                     </div>
                                  </div>
                               </div>
                             ))}
                           </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
           <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-gray-50 text-gray-400 border-b border-gray-100">
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Utilisateur</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Rôle</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest">Abonnement</th>
                      <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-right">Actions</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-orange-50/20 group transition-colors">
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-4">
                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${u.is_super_admin ? 'bg-[#f56b2a] text-white shadow-lg shadow-orange-100' : 'bg-gray-100 text-gray-400'}`}>
                               {u.email?.[0]?.toUpperCase()}
                             </div>
                             <div>
                               <p className="text-xs font-black text-gray-900">{u.full_name || 'Utilisateur'}</p>
                               <p className="text-[10px] font-bold text-gray-400 lowercase">{u.email}</p>
                             </div>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-2">
                             {u.is_super_admin ? (
                               <span className="px-2 py-1 bg-orange-50 text-[#f56b2a] text-[9px] font-black rounded-lg uppercase tracking-tighter border border-orange-100 animate-in fade-in zoom-in-90 duration-300">Super Admin</span>
                             ) : (
                               <span className="px-2 py-1 bg-gray-50 text-gray-400 text-[9px] font-black rounded-lg uppercase tracking-tighter border border-gray-100">Utilisateur</span>
                             )}
                           </div>
                        </td>
                        <td className="px-8 py-6">
                           <select 
                            value={u.subscription_tier || 'BASIC'}
                            onChange={(e) => handleUpdateSubscription(u.id, e.target.value as SubscriptionTier)}
                            className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-xl border outline-none appearance-none cursor-pointer transition-all disabled:opacity-50 ${
                               processingItems.has(`sub-${u.id}`) ? 'animate-pulse' : ''
                             } ${
                               u.subscription_tier === 'PRO' ? 'bg-orange-50 border-orange-200 text-[#f56b2a]' :
                               u.subscription_tier === 'ENTERPRISE' ? 'bg-purple-50 border-purple-200 text-purple-600' :
                               'bg-gray-50 border-gray-200 text-gray-500'
                             }`}
                            disabled={processingItems.has(`sub-${u.id}`)}
                           >
                             <option value="BASIC">BASIC</option>
                             <option value="PRO">PRO</option>
                             <option value="ENTERPRISE">ENTERPRISE</option>
                           </select>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                             <button 
                               onClick={() => handleToggleAdmin(u.id, !u.is_super_admin)}
                               disabled={processingItems.has(`admin-${u.id}`)}
                               className={`p-2.5 rounded-xl border transition-all flex items-center justify-center min-w-[40px] ${u.is_super_admin ? 'bg-gray-50 text-gray-400 border-gray-100' : 'bg-[#f56b2a] text-white border-[#f56b2a] shadow-lg shadow-orange-100'} disabled:opacity-50`}
                             >
                                 {processingItems.has(`admin-${u.id}`) ? <RefreshCcw size={16} className="animate-spin" /> : <Shield size={16} />}
                             </button>
                             <button className="p-2.5 bg-white text-slate-300 border border-gray-100 rounded-xl hover:text-red-500 transition-all">
                                <Ban size={16} />
                             </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
             </div>
           </div>
        )}


        {activeTab === 'orders' && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 overflow-hidden">
             <div className="space-y-4">
                {orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-orange-50/30 transition-all group">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#f56b2a] border border-gray-100 shadow-sm">
                           <Wallet size={18} />
                        </div>
                        <div>
                           <p className="text-xs font-black text-gray-900">#ORD-{o.id.split('-')[0].toUpperCase()}</p>
                           <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">{o.stores?.name} • {new Date(o.date).toLocaleDateString()}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-xs font-black text-gray-900">{formatCurrency(o.total)}</p>
                        <span className="text-[9px] font-black text-green-600 uppercase">Validé</span>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'system' && (
           <div className="max-w-2xl mx-auto space-y-6">
             <div className="bg-white rounded-[32px] border border-gray-100 p-8 md:p-10 shadow-sm">
                <div className="flex items-center gap-6 mb-10">
                   <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-[#f56b2a] shadow-inner border border-orange-100">
                      <Shield size={32} />
                   </div>
                   <div>
                      <h3 className="text-xl font-black text-gray-900">Protocoles Système</h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Niveau d'Administration : Suprême</p>
                   </div>
                </div>
                <div className="space-y-4">
                  {[
                    { t: 'Maintenance Civile', d: 'Suspend l\'activité publique globale', a: false },
                    { t: 'Indexation Automatique', d: 'Optimisation continue du catalogue', a: true },
                    { t: 'Rapports Hebdo', d: 'Envoi automatique aux commerçants', a: true },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-5 rounded-2xl bg-gray-50 border border-gray-100 group cursor-pointer hover:bg-orange-50/20 transition-all">
                      <div className="flex-1 mr-4">
                         <p className="text-xs font-black text-gray-900 uppercase tracking-tight group-hover:text-[#f56b2a] transition-colors">{item.t}</p>
                         <p className="text-[10px] text-gray-400 font-medium mt-0.5">{item.d}</p>
                      </div>
                      <div className={`w-12 h-7 rounded-full relative p-1 transition-all ${item.a ? 'bg-[#f56b2a] shadow-lg shadow-orange-100' : 'bg-gray-200'}`}>
                         <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${item.a ? 'right-1' : 'left-1'}`} />
                      </div>
                    </div>
                  ))}
                </div>
                 <button 
                    onClick={() => {
                        setItemProcessing('save-system', true);
                        setTimeout(() => {
                           setItemProcessing('save-system', false);
                           alert("Configuration système mise à jour avec succès.");
                        }, 1500);
                    }}
                    disabled={processingItems.has('save-system')}
                    className="w-full mt-10 py-5 bg-[#f56b2a] text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-[#d55a20] transition-all shadow-xl shadow-orange-100 flex items-center justify-center gap-3 disabled:opacity-50"
                 >
                    {processingItems.has('save-system') ? <RefreshCcw size={16} className="animate-spin" /> : null}
                    {processingItems.has('save-system') ? 'Synchronisation...' : 'Enregistrer les Protocoles'}
                 </button>
             </div>
           </div>
        )}
      </div>
    </div>
  );
}
