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
}

type TabType = 'orders' | 'addresses' | 'profile' | 'reviews';

export const BuyerView: React.FC<BuyerViewProps> = ({ userEmail, onBack, notify }) => {
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
      notify('Adresse enregistrée avec succès', 'success');
      setShowAddressModal(false);
      loadData();
    } else {
      notify(res.error || 'Erreur lors de l\'enregistrement', 'error');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (confirm('Supprimer cette adresse ?')) {
      const res = await deleteBuyerAddressAction(id);
      if (res.success) {
        notify('Adresse supprimée', 'info');
        loadData();
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
      case 'COMPLETED': return <CheckCircle2 size={14} />;
      case 'SHIPPED': return <Truck size={14} />;
      case 'PENDING': return <Clock size={14} />;
      default: return <AlertCircle size={14} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 md:pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-[#f56b2a] transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-[#002f34]">Mon Compte</h1>
          <button className="p-2 text-gray-400">
             <Bell size={22} />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto md:px-4 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Sidebar / Profile Header */}
          <div className="space-y-6">
            {/* Premium Profile Card (Mobile & Desktop) */}
            <div className="bg-white md:rounded-[32px] p-6 md:p-8 border-b md:border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-700" />
              <div className="relative flex md:flex-col items-center gap-4 md:gap-6 md:text-center">
                <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br from-[#f56b2a] to-[#ff8c51] rounded-2xl md:rounded-full flex items-center justify-center text-white text-xl md:text-3xl font-black shadow-xl shadow-orange-200">
                  {userEmail[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg md:text-xl font-black text-[#002f34] truncate">{userEmail.split('@')[0]}</h2>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{userEmail}</p>
                  <div className="flex md:justify-center items-center gap-4 mt-2">
                    <div className="text-center">
                       <p className="text-xs font-black text-[#002f34]">{orders.length}</p>
                       <p className="text-[10px] text-gray-400 uppercase font-black">Orders</p>
                    </div>
                    <div className="w-px h-6 bg-gray-100" />
                    <div className="text-center">
                       <p className="text-xs font-black text-[#002f34]">{reviews.length}</p>
                       <p className="text-[10px] text-gray-400 uppercase font-black">Reviews</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Tab Switcher - Horizontal Scroll */}
            <div className="lg:hidden flex items-center gap-2 overflow-x-auto no-scrollbar px-4 pb-2 -mx-4 mask-fade-right">
              {[
                { id: 'orders', label: 'Commandes', icon: Package },
                { id: 'addresses', label: 'Adresses', icon: MapPin },
                { id: 'reviews', label: 'Avis', icon: Star },
                { id: 'profile', label: 'Profil', icon: User },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TabType)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl whitespace-nowrap font-black text-[11px] uppercase tracking-wider transition-all border-2 ${
                    activeTab === item.id 
                      ? 'bg-[#f56b2a] border-[#f56b2a] text-white shadow-lg shadow-orange-100' 
                      : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
                  }`}
                >
                  <item.icon size={16} fill={activeTab === item.id ? "currentColor" : "none"} />
                  {item.label}
                </button>
              ))}
            </div>

            {/* Desktop Side Menu */}
            <div className="hidden lg:block space-y-2">
              {[
                { id: 'orders', label: 'Mes Commandes', icon: Package },
                { id: 'addresses', label: 'Adresses de livraison', icon: MapPin },
                { id: 'reviews', label: 'Mes Avis', icon: Star },
                { id: 'profile', label: 'Mon Profil', icon: User },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TabType)}
                  className={`w-full flex items-center gap-3 px-6 py-4 rounded-[20px] transition-all font-black text-sm ${
                    activeTab === item.id 
                      ? 'bg-gray-900 text-white shadow-xl translate-x-2' 
                      : 'text-gray-500 hover:bg-white hover:text-gray-900 border border-transparent hover:border-gray-100'
                  }`}
                >
                  <item.icon size={20} fill={activeTab === item.id ? "white" : "none"} />
                  {item.label}
                </button>
              ))}
              
              <button className="w-full flex items-center gap-3 px-6 py-4 rounded-[20px] text-red-500 font-black text-sm hover:bg-red-50 transition-all mt-8 border border-transparent hover:border-red-100">
                <LogOut size={20} />
                Déconnexion
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3 px-4 md:px-0">
            
            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-black text-[#002f34] tracking-tight">Historique des Commandes</h2>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">{orders.length} Commandes</p>
                </div>
                
                {loading ? (
                  <div className="flex flex-col items-center justify-center p-20 gap-4">
                    <div className="w-10 h-10 border-4 border-[#f56b2a]/20 border-t-[#f56b2a] rounded-full animate-spin" />
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Chargement...</p>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="bg-white rounded-[32px] p-12 text-center border border-gray-100 shadow-sm">
                    <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <ShoppingBag size={40} className="text-gray-200" />
                    </div>
                    <p className="text-gray-900 font-black text-lg mb-2">Aucune commande</p>
                    <p className="text-gray-500 text-sm font-medium mb-8">Il semblerait que vous n'ayez pas encore passé de commande.</p>
                    <button onClick={onBack} className="px-10 py-4 bg-gray-900 text-white rounded-2xl font-black text-sm hover:bg-[#f56b2a] transition-all shadow-xl shadow-gray-200 active:scale-95">
                       Commencer mes achats
                    </button>
                  </div>
                ) : (
                  orders.map((order) => (
                    <div key={order.id} className="bg-white rounded-[28px] border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                      <div className="p-4 md:p-5 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-50">
                              <Package className="text-[#f56b2a]" size={20} />
                           </div>
                           <div>
                             <div className="flex items-center gap-2">
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider">#{order.id.slice(-6)}</p>
                                <div className={`w-1 h-1 rounded-full bg-gray-300`} />
                                <p className="text-[10px] text-gray-500 font-black">{new Date(order.date).toLocaleDateString('fr-FR')}</p>
                             </div>
                             <p className="text-sm font-black text-[#002f34] flex items-center gap-1.5">
                               {order.stores?.name}
                               <ChevronRight size={14} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
                             </p>
                           </div>
                        </div>
                        <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          {order.status === 'COMPLETED' ? 'Livré' : order.status === 'SHIPPED' ? 'En cours' : 'Attente'}
                        </div>
                      </div>
                      
                      <div className="p-4 md:p-5 space-y-4">
                        {order.order_items?.map((item: any) => (
                          <div key={item.id} className="flex gap-4 items-center">
                            <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 border border-gray-50">
                               <img src={item.products?.image} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className="text-sm font-bold text-[#002f34] line-clamp-1">{item.products?.name}</p>
                               <p className="text-xs text-gray-400 font-black mt-0.5">
                                 <span className="text-[#f56b2a]">{item.quantity}x</span> • {formatCurrency(item.price)}
                               </p>
                            </div>
                          </div>
                        ))}
                      </div>
 
                      <div className="px-4 py-4 md:px-5 md:py-4 bg-gray-50/50 flex items-center justify-between border-t border-gray-50">
                         <div className="flex items-center gap-2 text-gray-400 group-hover:text-[#f56b2a] transition-colors cursor-pointer">
                            <Clock size={14} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Détails de la commande</span>
                         </div>
                         <p className="text-xl font-black text-gray-900 tracking-tight">{formatCurrency(order.total)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
 
            {/* Addresses Tab */}
            {activeTab === 'addresses' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-[#002f34] tracking-tight">Adresses de livraison</h2>
                  <button 
                    onClick={() => { setEditingAddress(null); setShowAddressModal(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#f56b2a] rounded-xl text-white font-black text-xs hover:bg-[#d55a20] transition-all shadow-lg shadow-orange-100 active:scale-95"
                  >
                    <Plus size={16} strokeWidth={3} />
                    Ajouter
                  </button>
                </div>
 
                {loading ? (
                  <div className="flex flex-col items-center justify-center p-20 gap-4">
                    <div className="w-10 h-10 border-4 border-[#f56b2a]/20 border-t-[#f56b2a] rounded-full animate-spin" />
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Chargement...</p>
                  </div>
                ) : addresses.length === 0 ? (
                  <div className="bg-white rounded-[32px] p-12 text-center border border-gray-100 shadow-sm text-gray-400">
                    <MapPin size={40} className="mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-black uppercase tracking-widest">Aucune adresse enregistrée</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {addresses.map((addr) => (
                      <div key={addr.id} className={`bg-white p-6 rounded-[32px] border transition-all relative group ${addr.is_default ? 'border-[#f56b2a] shadow-lg shadow-orange-50' : 'border-gray-100 hover:border-orange-100 hover:shadow-md'}`}>
                         <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                               <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${addr.name === 'Maison' ? 'bg-blue-50 text-blue-500' : 'bg-amber-50 text-amber-500'}`}>
                                  {addr.name === 'Maison' ? <Home size={20} /> : <Briefcase size={20} />}
                               </div>
                               <div>
                                  <p className="font-black text-[#002f34] text-sm">{addr.name}</p>
                                  {addr.is_default && <span className="bg-[#f56b2a] text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Défaut</span>}
                               </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button onClick={() => { setEditingAddress(addr); setShowAddressModal(true); }} className="p-2 bg-gray-50 text-gray-400 hover:text-blue-500 rounded-lg transition-colors"><Edit2 size={14} /></button>
                               <button onClick={() => handleDeleteAddress(addr.id)} className="p-2 bg-gray-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={14} /></button>
                            </div>
                         </div>
                         <div className="space-y-1">
                            <p className="text-sm font-black text-gray-900">{addr.full_name}</p>
                            <p className="text-xs text-gray-500 leading-relaxed font-medium">{addr.address}, {addr.city}</p>
                            <div className="flex items-center gap-2 mt-3 p-2 bg-gray-50 rounded-xl w-fit">
                               <Phone size={12} className="text-gray-400" />
                               <span className="text-[10px] text-gray-800 font-black">{addr.phone}</span>
                            </div>
                         </div>
                         
                         {/* Action for mobile as hover is not available */}
                         <div className="md:hidden flex gap-3 mt-5 pt-5 border-t border-gray-50">
                            <button onClick={() => { setEditingAddress(addr); setShowAddressModal(true); }} className="flex-1 py-3 bg-gray-50 rounded-xl text-xs font-black text-gray-600 flex items-center justify-center gap-2"><Edit2 size={12} /> Éditer</button>
                            <button onClick={() => handleDeleteAddress(addr.id)} className="flex-1 py-3 bg-red-50 rounded-xl text-xs font-black text-red-500 flex items-center justify-center gap-2"><Trash2 size={12} /> Supprimer</button>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
 
            {/* Profile Tab */}
            {activeTab === 'profile' && (
               <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                  <h2 className="text-xl font-black text-[#002f34] tracking-tight">Paramètres du Profil</h2>
                  <div className="bg-white rounded-[32px] p-6 md:p-10 border border-gray-100 shadow-sm relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50/30 rounded-full blur-3xl -mr-32 -mt-32" />
                     
                     <div className="relative space-y-8">
                       <div className="flex items-center gap-6">
                         <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-[#f56b2a] to-[#ff8c51] rounded-[28px] flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-orange-100">
                           {userEmail[0].toUpperCase()}
                         </div>
                         <div>
                            <button className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-black hover:bg-[#f56b2a] transition-all">
                               Changer la photo
                            </button>
                            <p className="text-[10px] text-gray-400 font-black uppercase mt-2 tracking-widest">JPEG, PNG ou WebP. Max 2MB.</p>
                         </div>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-1.5">
                           <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest ml-2">E-mail</label>
                           <div className="px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-500 flex items-center gap-3">
                              <Mail size={18} />
                              {userEmail}
                           </div>
                         </div>
                         <div className="space-y-1.5">
                           <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest ml-2">Téléphone (Optionnel)</label>
                           <div className="px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 flex items-center gap-3 group focus-within:bg-white focus-within:border-[#f56b2a] transition-all">
                              <Phone size={18} className="text-gray-400 group-focus-within:text-[#f56b2a]" />
                              <input type="tel" placeholder="Ex: 77 000 00 00" className="bg-transparent border-none focus:ring-0 w-full p-0 h-auto font-black placeholder:font-bold placeholder:text-gray-300" />
                           </div>
                         </div>
                       </div>
                       
                       <div className="pt-6 border-t border-gray-50">
                          <button className="flex items-center gap-3 w-full py-4 px-6 bg-gradient-to-r from-gray-900 to-gray-800 text-white font-black text-sm rounded-2xl hover:shadow-xl hover:shadow-gray-200 transition-all active:scale-95 group">
                             <ShieldCheck size={20} className="text-green-400" />
                             Changer le mot de passe
                             <ChevronRight size={18} className="ml-auto text-gray-500 group-hover:translate-x-1 transition-transform" />
                          </button>
                       </div>
                       
                       <div className="pt-4">
                          <button className="flex items-center gap-3 w-full py-4 px-6 bg-red-50 text-red-500 font-black text-sm rounded-2xl hover:bg-red-100 transition-all active:scale-95 border border-red-100/50">
                             <LogOut size={20} />
                             Se déconnecter
                          </button>
                       </div>
                     </div>
                  </div>
               </div>
            )}
 
            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-[#002f34] tracking-tight">Mes Avis & Évaluations</h2>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">{reviews.length} Avis</p>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center p-20 gap-4">
                    <div className="w-10 h-10 border-4 border-[#f56b2a]/20 border-t-[#f56b2a] rounded-full animate-spin" />
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Chargement...</p>
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="bg-white rounded-[32px] p-12 text-center border border-gray-100 shadow-sm text-gray-400">
                    <Star size={40} className="mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-black uppercase tracking-widest">Aucun avis publié</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {reviews.map((rev) => (
                      <div key={rev.id} className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                         <div className="flex gap-4 mb-5 pb-5 border-b border-gray-50">
                           <div className="w-16 h-16 bg-gray-50 rounded-[18px] overflow-hidden flex-shrink-0 border border-gray-100">
                             <img src={rev.products?.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">{rev.stores?.name || 'Boutique'}</p>
                              <p className="text-sm font-black text-[#002f34] line-clamp-1 truncate">{rev.products?.name}</p>
                              <div className="flex gap-1 mt-1.5">
                                 {[...Array(5)].map((_, i) => (
                                   <Star key={i} size={14} fill={i < rev.rating ? "#fbbf24" : "none"} className={i < rev.rating ? "text-amber-400" : "text-gray-200"} />
                                 ))}
                              </div>
                           </div>
                         </div>
                         <div className="relative">
                            <div className="absolute -left-2 -top-2 text-gray-100">
                               <MessageCircle size={32} />
                            </div>
                            <p className="text-sm text-gray-600 font-medium leading-relaxed bg-gray-50/50 p-5 rounded-2xl italic relative z-10">
                              "{rev.comment}"
                            </p>
                         </div>
                         <div className="flex items-center justify-between mt-4 px-2">
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Publié le {new Date(rev.created_at).toLocaleDateString()}</p>
                            <button className="text-[10px] font-black text-[#f56b2a] uppercase tracking-widest hover:underline">Modifier l'avis</button>
                         </div>
                      </div>
                    ))}
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
           <div className="relative bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-[#002f34]">{editingAddress ? 'Modifier' : 'Ajouter'} une adresse</h3>
                <button onClick={() => setShowAddressModal(false)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><X size={24} /></button>
              </div>
              
              <form onSubmit={handleSaveAddress} className="p-6 space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-400 px-1">Label (ex: Maison)</label>
                      <input name="name" defaultValue={editingAddress?.name} required className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#f56b2a] text-sm font-bold" />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-400 px-1">Nom Complet</label>
                      <input name="fullName" defaultValue={editingAddress?.full_name} required className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#f56b2a] text-sm font-bold" />
                   </div>
                 </div>
                 
                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 px-1">Téléphone</label>
                    <input name="phone" defaultValue={editingAddress?.phone} required className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#f56b2a] text-sm font-bold" />
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 px-1">Adresse</label>
                    <input name="address" defaultValue={editingAddress?.address} required className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#f56b2a] text-sm font-bold" />
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-400 px-1">Ville</label>
                    <input name="city" defaultValue={editingAddress?.city} required className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#f56b2a] text-sm font-bold" />
                 </div>

                 <label className="flex items-center gap-3 cursor-pointer p-2">
                    <input type="checkbox" name="isDefault" defaultChecked={editingAddress?.is_default} className="w-5 h-5 rounded-lg text-[#f56b2a] focus:ring-[#f56b2a]" />
                    <span className="text-sm font-bold text-[#002f34]">Définir comme adresse par défaut</span>
                 </label>

                 <div className="flex gap-3 pt-4">
                   <button type="button" onClick={() => setShowAddressModal(false)} className="flex-1 py-4 text-gray-400 font-bold hover:bg-gray-50 rounded-2xl transition-all">Annuler</button>
                   <button type="submit" className="flex-2 px-8 py-4 bg-[#f56b2a] text-white font-black rounded-2xl shadow-lg shadow-[#f56b2a]/20 active:scale-[0.98] transition-all">
                      Enregistrer
                   </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};
