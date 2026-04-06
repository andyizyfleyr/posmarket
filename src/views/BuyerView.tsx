'use client';

import React, { useState, useEffect } from 'react';
import { 
  Package, MapPin, User, Star, ChevronRight, 
  Clock, CheckCircle2, Truck, AlertCircle, ShoppingBag, 
  Plus, Edit2, Trash2, Home, Briefcase, Bell, LogOut, ArrowLeft, X
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

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Dashboard Menu (Desktop) */}
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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${
                  activeTab === item.id 
                    ? 'bg-[#f56b2a] text-white shadow-lg shadow-[#f56b2a]/20' 
                    : 'text-gray-500 hover:bg-white hover:text-[#f56b2a]'
                }`}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            ))}
            
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 font-semibold hover:bg-red-50 transition-all mt-8">
              <LogOut size={20} />
              Déconnexion
            </button>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            
            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-[#002f34] mb-6">Mes Commandes</h2>
                
                {loading ? (
                  <div className="p-12 text-center text-gray-400">Chargement...</div>
                ) : orders.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border border-gray-100">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ShoppingBag size={32} className="text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-medium">Vous n'avez pas encore passé de commande.</p>
                    <button onClick={onBack} className="mt-6 px-6 py-2.5 bg-[#f56b2a] text-white rounded-full font-bold">
                       Faire mes achats
                    </button>
                  </div>
                ) : (
                  orders.map((order) => (
                    <div key={order.id} className="bg-white rounded-[28px] border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all">
                      <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                              <Package className="text-[#f56b2a]" size={20} />
                           </div>
                           <div>
                             <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Commande #{order.id.slice(-6)}</p>
                             <p className="text-sm font-bold text-[#002f34]">{new Date(order.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
                           </div>
                        </div>
                        <div className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          {order.status === 'COMPLETED' ? 'Livrée' : order.status === 'SHIPPED' ? 'En livraison' : 'En attente'}
                        </div>
                      </div>
                      
                      <div className="p-5 space-y-4">
                        {order.order_items?.map((item: any) => (
                          <div key={item.id} className="flex gap-4">
                            <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                               <img src={item.products?.image} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className="text-sm font-bold text-[#002f34] line-clamp-1">{item.products?.name}</p>
                               <p className="text-xs text-gray-400 mt-1">Qté: {item.quantity} • {formatCurrency(item.price)}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="px-5 py-4 bg-gray-50/30 flex items-center justify-between">
                         <p className="text-sm text-gray-500 font-medium">Boutique: <span className="text-[#f56b2a] font-bold">{order.stores?.name}</span></p>
                         <p className="text-lg font-black text-[#002f34]">{formatCurrency(order.total)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Addresses Tab */}
            {activeTab === 'addresses' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-[#002f34]">Adresses de livraison</h2>
                  <button 
                    onClick={() => { setEditingAddress(null); setShowAddressModal(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-[#f56b2a] font-bold text-sm hover:border-[#f56b2a] transition-all"
                  >
                    <Plus size={18} />
                    Ajouter
                  </button>
                </div>

                {loading ? (
                  <div className="p-12 text-center text-gray-400">Chargement...</div>
                ) : addresses.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 text-gray-400">
                    Aucune adresse enregistrée.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {addresses.map((addr) => (
                      <div key={addr.id} className={`bg-white p-5 rounded-[28px] border transition-all ${addr.is_default ? 'border-[#f56b2a] ring-1 ring-[#f56b2a]/10' : 'border-gray-100 hover:border-gray-200'}`}>
                         <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                               {addr.name === 'Maison' ? <Home size={18} className="text-blue-500" /> : <Briefcase size={18} className="text-amber-500" />}
                               <p className="font-bold text-[#002f34]">{addr.name}</p>
                               {addr.is_default && <span className="bg-orange-50 text-[#f56b2a] text-[9px] px-2 py-0.5 rounded-full font-black uppercase">Défaut</span>}
                            </div>
                            <div className="flex gap-1">
                               <button onClick={() => { setEditingAddress(addr); setShowAddressModal(true); }} className="p-1.5 text-gray-400 hover:text-blue-500"><Edit2 size={16} /></button>
                               <button onClick={() => handleDeleteAddress(addr.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                            </div>
                         </div>
                         <p className="text-sm font-bold text-[#002f34] mb-1">{addr.full_name}</p>
                         <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{addr.address}, {addr.city}</p>
                         <p className="text-xs text-gray-400 mt-2 font-bold">{addr.phone}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
               <div className="space-y-6">
                  <h2 className="text-xl font-bold text-[#002f34] mb-6">Mon Profil</h2>
                  <div className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm">
                     <div className="flex flex-col items-center mb-8">
                       <div className="w-24 h-24 bg-gradient-to-br from-[#f56b2a] to-[#ff8c51] rounded-full flex items-center justify-center text-white text-3xl font-black mb-4 shadow-xl shadow-orange-200">
                          {userEmail[0].toUpperCase()}
                       </div>
                       <p className="text-lg font-black text-[#002f34]">{userEmail}</p>
                       <p className="text-sm text-gray-400">Membre depuis {new Date().getFullYear()}</p>
                     </div>
                     
                     <div className="space-y-4">
                       <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                         <p className="text-[10px] text-gray-400 font-black uppercase mb-1">E-mail de connexion</p>
                         <p className="text-sm font-bold text-[#002f34]">{userEmail}</p>
                       </div>
                       
                       <button className="w-full py-4 text-[#f56b2a] font-black text-sm hover:bg-orange-50 rounded-2xl transition-all">
                          Changer mon mot de passe
                       </button>
                     </div>
                  </div>
               </div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-[#002f34] mb-6">Mes Avis</h2>
                {loading ? (
                  <div className="p-12 text-center text-gray-400">Chargement...</div>
                ) : reviews.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 text-gray-400">
                    Vous n'avez pas encore laissé d'avis.
                  </div>
                ) : (
                  reviews.map((rev) => (
                    <div key={rev.id} className="bg-white p-5 rounded-[28px] border border-gray-100">
                       <div className="flex gap-4 mb-4">
                         <div className="w-12 h-12 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0">
                           <img src={rev.products?.image} className="w-full h-full object-cover" />
                         </div>
                         <div>
                            <p className="text-sm font-bold text-[#002f34]">{rev.products?.name}</p>
                            <div className="flex gap-0.5 mt-1">
                               {[...Array(5)].map((_, i) => (
                                 <Star key={i} size={14} className={i < rev.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"} />
                               ))}
                            </div>
                         </div>
                       </div>
                       <p className="text-sm text-gray-600 bg-gray-50/50 p-4 rounded-xl italic leading-relaxed">"{rev.comment}"</p>
                       <p className="text-[10px] text-gray-400 mt-3 font-bold">Publié le {new Date(rev.created_at).toLocaleDateString()}</p>
                    </div>
                  ))
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
