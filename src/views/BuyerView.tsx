'use client';

import React, { useState, useEffect } from 'react';
import { 
  Package, MapPin, User, Star, ChevronRight, 
  Clock, CheckCircle2, Truck, AlertCircle, ShoppingBag, 
  Plus, Edit2, Trash2, Home, Briefcase, Bell, LogOut, 
  ArrowLeft, X, Phone, Mail, MessageCircle, ShieldCheck
} from 'lucide-react';
import { formatCurrency } from '@/utils';
import { 
  fetchBuyerOrdersAction, 
  fetchBuyerAddressesAction, 
  saveBuyerAddressAction, 
  deleteBuyerAddressAction,
  fetchBuyerReviewsAction
} from '@/app/actions/marketplace';
import { NotificationType } from '@/types';

interface BuyerViewProps {
  userEmail: string;
  onBack: () => void;
  notify: (msg: string, type: NotificationType) => void;
  onLogout: () => void;
}

type TabType = 'orders' | 'addresses' | 'profile' | 'reviews';

export const BuyerView: React.FC<BuyerViewProps> = ({ userEmail, onBack, notify, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'orders') {
        const res = await fetchBuyerOrdersAction();
        if (res.success) setOrders(res.orders || []);
      } else if (activeTab === 'addresses') {
        const res = await fetchBuyerAddressesAction();
        if (res.success) setAddresses(res.addresses || []);
      } else if (activeTab === 'reviews') {
        const res = await fetchBuyerReviewsAction();
        if (res.success) setReviews(res.reviews || []);
      }
    } catch (err) {
      console.error('Error loading buyer data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      id: editingAddress?.id,
      name: formData.get('name'),
      fullName: formData.get('fullName'),
      phone: formData.get('phone'),
      address: formData.get('address'),
      city: formData.get('city'),
      isDefault: formData.get('isDefault') === 'on'
    };

    const res = await saveBuyerAddressAction(data);
    if (res.success) {
      notify('Adresse enregistrée', 'success');
      setShowAddressModal(false);
      loadData();
    } else {
      console.error('Save address error:', res.error);
      notify(res.error || 'Erreur', 'error');
    }
  };

  const handleLogout = async () => {
    onLogout();
  };

  const handleDeleteAddress = async (id: string) => {
    if (confirm('Supprimer cette adresse ?')) {
      const res = await deleteBuyerAddressAction(id);
      if (res.success) {
        notify('Adresse supprimée', 'info');
        loadData();
      } else {
        console.error('Delete address error:', res.error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-700';
      case 'READY': return 'bg-blue-100 text-blue-700';
      case 'PENDING': return 'bg-amber-100 text-amber-700';
      case 'SHIPPED': return 'bg-purple-100 text-purple-700';
      case 'CANCELLED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 size={12} />;
      case 'SHIPPED': return <Truck size={12} />;
      case 'PENDING': return <Clock size={12} />;
      default: return <AlertCircle size={12} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 md:pb-12">
      {/* Small compact Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-[#f56b2a]">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-sm font-bold text-[#002f34]">Mon Compte</h1>
          <button className="p-2 text-gray-400">
             <Bell size={20} />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto md:px-4 md:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Sidebar / Profile Header */}
          <div className="space-y-4">
            <div className="bg-white md:rounded-3xl p-4 md:p-6 border-b md:border border-gray-100 shadow-sm relative overflow-hidden">
              <div className="relative flex md:flex-col items-center gap-3 md:gap-4 md:text-center">
                <div className="w-12 h-12 md:w-20 md:h-20 bg-orange-100 rounded-2xl md:rounded-full flex items-center justify-center text-[#f56b2a] text-lg md:text-2xl font-bold">
                  {userEmail[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm md:text-base font-bold text-[#002f34] truncate">{userEmail.split('@')[0]}</h2>
                  <p className="text-[10px] text-gray-500">{userEmail}</p>
                  <div className="flex md:justify-center items-center gap-3 mt-2">
                    <div className="text-center">
                       <p className="text-xs font-bold text-[#002f34]">{orders.length}</p>
                       <p className="text-[9px] text-gray-400">Commandes</p>
                    </div>
                    <div className="w-px h-5 bg-gray-100" />
                    <div className="text-center">
                       <p className="text-xs font-bold text-[#002f34]">{reviews.length}</p>
                       <p className="text-[9px] text-gray-400">Avis</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Mobile Nav */}
            <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar px-4 pb-2 -mx-4">
              {[
                { id: 'orders', label: 'Commandes', icon: Package },
                { id: 'addresses', label: 'Adresses', icon: MapPin },
                { id: 'reviews', label: 'Avis', icon: Star },
                { id: 'profile', label: 'Profil', icon: User },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TabType)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl whitespace-nowrap text-[10px] font-bold transition-all border ${
                    activeTab === item.id 
                      ? 'bg-[#f56b2a] border-[#f56b2a] text-white' 
                      : 'bg-white border-gray-100 text-gray-500 shadow-sm'
                  }`}
                >
                  <item.icon size={12} fill={activeTab === item.id ? "currentColor" : "none"} />
                  {item.label}
                </button>
              ))}
            </div>

            {/* Desktop Nav */}
            <div className="hidden lg:block space-y-1">
              {[
                { id: 'orders', label: 'Mes Commandes', icon: Package },
                { id: 'addresses', label: 'Mes Adresses', icon: MapPin },
                { id: 'reviews', label: 'Mes Avis', icon: Star },
                { id: 'profile', label: 'Paramètres', icon: User },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TabType)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-xs font-bold ${
                    activeTab === item.id 
                      ? 'bg-gray-900 text-white translate-x-1' 
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <item.icon size={16} fill={activeTab === item.id ? "white" : "none"} />
                  {item.label}
                </button>
              ))}
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-500 text-xs font-bold hover:bg-red-50 mt-4 transition-all">
                <LogOut size={16} />
                Déconnexion
              </button>
            </div>
          </div>

          {/* Main Space */}
          <div className="lg:col-span-3 px-4 md:px-0">
            {activeTab === 'orders' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                <h2 className="text-base font-bold text-[#002f34] px-1">Mes Commandes</h2>
                
                {loading ? (
                  <div className="py-12 flex justify-center"><div className="w-6 h-6 border-2 border-orange-200 border-t-[#f56b2a] rounded-full animate-spin" /></div>
                ) : orders.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-xs">Aucune commande.</div>
                ) : (
                  orders.map((order) => (
                    <div key={order.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all">
                      <div className="p-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/10">
                        <div className="flex items-center gap-2">
                           <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm border border-gray-50">
                              <Package className="text-[#f56b2a]" size={16} />
                           </div>
                           <div>
                             <p className="text-[9px] text-gray-400 font-bold">#{order.id.slice(-6)} • {new Date(order.date).toLocaleDateString()}</p>
                             <p className="text-xs font-bold text-[#002f34]">{Array.isArray(order.stores) ? order.stores[0]?.name : order.stores?.name}</p>
                           </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-[9px] font-bold flex items-center gap-1 ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          {order.status === 'COMPLETED' ? 'Livré' : 'Attente'}
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        {order.order_items?.map((item: any) => {
                          const product = Array.isArray(item.products) ? item.products[0] : item.products;
                          return (
                            <div key={item.id} className="flex gap-3 items-center">
                              <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden">
                                 <img src={product?.image} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1">
                                 <p className="text-xs font-semibold text-[#002f34] truncate">{product?.name}</p>
                                 <p className="text-[10px] text-gray-400">{item.quantity} x {formatCurrency(item.price)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="px-3 py-2 bg-gray-50/20 flex items-center justify-between border-t border-gray-50 text-xs font-bold">
                         <span className="text-gray-400 text-[10px]">Total</span>
                         <span className="text-[#002f34]">{formatCurrency(order.total)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'addresses' && (
              <div className="space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-base font-bold text-[#002f34]">Adresses</h2>
                  <button onClick={() => { setEditingAddress(null); setShowAddressModal(true); }} className="px-3 py-1.5 bg-[#f56b2a] text-white rounded-lg text-[10px] font-bold">+ Ajouter</button>
                </div>
                {loading ? <div className="py-12 flex justify-center">...</div> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {addresses.map((addr) => (
                      <div key={addr.id} className={`bg-white p-3.5 rounded-2xl border ${addr.is_default ? 'border-[#f56b2a] shadow-md' : 'border-gray-100 shadow-sm'}`}>
                         <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                               <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                                  {addr.name === 'Maison' ? <Home size={14} /> : <Briefcase size={14} />}
                               </div>
                               <p className="font-bold text-[#002f34] text-xs">{addr.name}</p>
                            </div>
                            <div className="flex gap-1.5">
                               <button onClick={() => { setEditingAddress(addr); setShowAddressModal(true); }} className="p-1 px-2 text-gray-400"><Edit2 size={12} /></button>
                               <button onClick={() => handleDeleteAddress(addr.id)} className="p-1 px-2 text-red-500/50"><Trash2 size={12} /></button>
                            </div>
                         </div>
                         <p className="text-[11px] font-semibold text-gray-900">{addr.full_name}</p>
                         <p className="text-[10px] text-gray-500 mt-0.5">{addr.address}, {addr.city}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'profile' && (
               <div className="space-y-3 animate-in fade-in">
                  <h2 className="text-base font-bold text-[#002f34] px-1">Profil & Paramètres</h2>
                  <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-4">
                       <div className="flex items-center gap-3">
                         <div className="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center text-[#f56b2a] text-xl font-bold">
                           {userEmail[0].toUpperCase()}
                         </div>
                         <button className="px-4 py-1.5 border border-gray-200 rounded-lg text-[10px] font-bold">Photo</button>
                       </div>
                       <div className="space-y-3">
                         <div className="space-y-1">
                           <label className="text-[9px] text-gray-400 font-bold uppercase tracking-widest px-1">E-mail</label>
                           <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-xs font-semibold text-gray-500 flex items-center gap-2">
                              <Mail size={14} /> {userEmail}
                           </div>
                         </div>
                         <button className="flex items-center gap-2 w-full py-3 px-4 bg-gray-900 text-white font-bold text-[10px] rounded-xl">
                            <ShieldCheck size={14} className="text-green-400" /> Changer le mot de passe
                         </button>
                         <button onClick={handleLogout} className="flex items-center gap-2 w-full py-3 px-4 bg-red-50 text-red-500 font-bold text-[10px] rounded-xl border border-red-100">
                            <LogOut size={14} /> Se déconnecter
                         </button>
                       </div>
                  </div>
               </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-3 animate-in fade-in">
                <h2 className="text-base font-bold text-[#002f34] px-1">Mes Avis</h2>
                {loading ? <div className="py-12 flex justify-center">...</div> : reviews.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-xs">Aucun avis publié.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {reviews.map((rev) => {
                      const product = Array.isArray(rev.products) ? rev.products[0] : rev.products;
                      const store = Array.isArray(rev.stores) ? rev.stores[0] : rev.stores;
                      return (
                        <div key={rev.id} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                           <div className="flex gap-3 mb-2">
                             <div className="w-10 h-10 bg-gray-50 rounded-lg overflow-hidden border border-gray-100">
                               <img src={product?.image} className="w-full h-full object-cover" />
                             </div>
                             <div className="flex-1">
                                <p className="text-[8px] text-gray-400 font-bold uppercase">{store?.name || 'Boutique'}</p>
                                <p className="text-xs font-bold text-[#002f34] truncate">{product?.name}</p>
                                <div className="flex gap-0.5 mt-0.5">
                                   {[...Array(5)].map((_, i) => (
                                     <Star key={i} size={10} fill={i < rev.rating ? "#fbbf24" : "none"} className={i < rev.rating ? "text-amber-400" : "text-gray-200"} />
                                   ))}
                                </div>
                             </div>
                           </div>
                           <p className="text-[11px] text-gray-600 bg-gray-50/50 p-2.5 rounded-lg italic">"{rev.comment}"</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
           <div className="absolute inset-0 bg-[#002f34]/40 backdrop-blur-sm" onClick={() => setShowAddressModal(false)} />
           <div className="relative bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#002f34]">{editingAddress ? 'Modifier' : 'Ajouter'} une adresse</h3>
                <button onClick={() => setShowAddressModal(false)} className="text-gray-400"><X size={20} /></button>
              </div>
              
              <form onSubmit={handleSaveAddress} className="p-4 space-y-3">
                 <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 px-1">Label</label>
                      <input name="name" defaultValue={editingAddress?.name} required className="w-full px-3 py-2 bg-gray-50 border-none rounded-lg text-xs font-bold" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 px-1">Nom Complet</label>
                      <input name="fullName" defaultValue={editingAddress?.full_name} required className="w-full px-3 py-2 bg-gray-50 border-none rounded-lg text-xs font-bold" />
                   </div>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 px-1">Téléphone</label>
                    <input name="phone" defaultValue={editingAddress?.phone} required className="w-full px-3 py-2 bg-gray-50 border-none rounded-lg text-xs font-bold" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 px-1">Adresse</label>
                    <input name="address" defaultValue={editingAddress?.address} required className="w-full px-3 py-2 bg-gray-50 border-none rounded-lg text-xs font-bold" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 px-1">Ville</label>
                    <input name="city" defaultValue={editingAddress?.city} required className="w-full px-3 py-2 bg-gray-50 border-none rounded-lg text-xs font-bold" />
                 </div>
                 <label className="flex items-center gap-2 cursor-pointer py-1">
                    <input type="checkbox" name="isDefault" defaultChecked={editingAddress?.is_default} className="w-4 h-4 rounded text-[#f56b2a]" />
                    <span className="text-[11px] font-bold text-[#002f34]">Adresse par défaut</span>
                 </label>
                 <div className="flex gap-2 pt-2">
                   <button type="button" onClick={() => setShowAddressModal(false)} className="flex-1 py-3 text-gray-400 font-bold text-xs">Annuler</button>
                   <button type="submit" className="flex-2 px-6 py-3 bg-[#f56b2a] text-white font-bold rounded-xl text-xs">Enregistrer</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};
