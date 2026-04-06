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
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

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

  const { isOnline, isSlow } = useNetworkStatus();
  const [internalLoading, setInternalLoading] = useState(false);
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    if (userEmail) {
      // On initial mount, fetch all data to populate counts
      loadData(true);
    }
  }, [userEmail]);

  useEffect(() => {
    if (userEmail && activeTab) {
      // On tab change, refresh just that tab
      loadData(false);
    }
  }, [activeTab]);

  const loadData = async (forceAll = false) => {
    setLoading(true);
    setIsSlowConnection(false);
    
    // Set a timeout to detect slow connection (e.g., 3 seconds)
    const timer = setTimeout(() => {
      setIsSlowConnection(true);
    }, 3000);

    try {
      if (forceAll) {
        const [ordersRes, addressesRes, reviewsRes] = await Promise.all([
          fetchBuyerOrdersAction(),
          fetchBuyerAddressesAction(),
          fetchBuyerReviewsAction()
        ]);

        if (ordersRes.success && 'orders' in ordersRes) setOrders(ordersRes.orders || []);
        if (addressesRes.success && 'addresses' in addressesRes) setAddresses(addressesRes.addresses || []);
        if (reviewsRes.success && 'reviews' in reviewsRes) setReviews(reviewsRes.reviews || []);
      } else {
        // Just refresh the active tab
        if (activeTab === 'orders') {
          const res = await fetchBuyerOrdersAction();
          if (res.success && 'orders' in res) setOrders(res.orders || []);
        } else if (activeTab === 'addresses') {
          const res = await fetchBuyerAddressesAction();
          if (res.success && 'addresses' in res) setAddresses(res.addresses || []);
        } else if (activeTab === 'reviews') {
          const res = await fetchBuyerReviewsAction();
          if (res.success && 'reviews' in res) setReviews(res.reviews || []);
        }
      }
    } catch (err) {
      console.error("Fetch Error:", err);
      notify?.("Erreur de connexion au serveur", "error");
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setIsSlowConnection(false);
    }
  };

  const renderSkeleton = () => (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl h-32 border border-gray-100" />
      ))}
      {(isSlow || isSlowConnection || loading) && (
        <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 flex items-center gap-2">
          <Clock size={16} className="text-[#f56b2a] animate-pulse" />
          <p className="text-[10px] font-bold text-[#f56b2a] uppercase">Connexion lente ou chargement en cours...</p>
        </div>
      )}
    </div>
  );

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
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-[#f56b2a]">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-sm font-bold text-[#002f34]">Mon compte</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => loadData(true)} className="p-2 text-gray-400 hover:text-[#f56b2a]">
              <Clock size={20} className={loading ? "animate-spin" : ""} />
            </button>
            <button className="p-2 text-gray-400">
               <Bell size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto md:px-4 md:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          <div className="space-y-4">
            <div className="bg-white md:rounded-3xl p-4 md:p-6 border-b md:border border-gray-100 shadow-sm relative overflow-hidden">
              <div className="relative flex md:flex-col items-center gap-3 md:gap-4 md:text-center">
                <div className="w-12 h-12 md:w-20 md:h-20 bg-orange-100 rounded-2xl md:rounded-full flex items-center justify-center text-[#f56b2a] text-lg md:text-2xl font-bold">
                  {userEmail[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base md:text-lg font-bold text-[#002f34] truncate">{userEmail.split('@')[0]}</h2>
                  <p className="text-xs text-gray-500">{userEmail}</p>
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

            <div className="lg:hidden flex items-center gap-2 overflow-x-auto no-scrollbar px-4 pb-2 snap-x snap-mandatory">
              {[
                { id: 'orders', label: 'Commandes', icon: Package },
                { id: 'addresses', label: 'Adresses', icon: MapPin },
                { id: 'reviews', label: 'Avis', icon: Star },
                { id: 'profile', label: 'Profil', icon: User },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TabType)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl whitespace-nowrap text-xs font-bold transition-all border-2 snap-start active:scale-95 ${
                    activeTab === item.id 
                      ? 'bg-[#f56b2a] border-[#f56b2a] text-white shadow-lg shadow-orange-100' 
                      : 'bg-white border-gray-100 text-gray-500 shadow-sm active:bg-gray-50'
                  }`}
                >
                  <item.icon size={16} fill={activeTab === item.id ? "currentColor" : "none"} />
                  {item.label}
                </button>
              ))}
            </div>

            <div className="hidden lg:block space-y-1">
              {[
                { id: 'orders', label: 'Mes commandes', icon: Package },
                { id: 'addresses', label: 'Mes adresses', icon: MapPin },
                { id: 'reviews', label: 'Mes avis', icon: Star },
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

          <div className="lg:col-span-3 px-4 md:px-0">
            {activeTab === 'orders' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                <h2 className="text-base font-bold text-[#002f34] px-1">Mes commandes</h2>
                
                {loading ? renderSkeleton() : orders.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-xs">
                    {internalLoading ? "Chargement..." : "Aucune commande trouvée."}
                  </div>
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
                      <div className="px-3 py-2.5 bg-gray-50/20 flex items-center justify-between border-t border-gray-50 text-sm font-bold">
                         <span className="text-gray-400 text-xs">Total</span>
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
                {loading ? renderSkeleton() : (
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
                           <label className="text-[9px] text-gray-400 font-bold px-1">E-mail</label>
                           <div className="px-3 py-2.5 bg-gray-50 rounded-lg text-xs font-semibold text-gray-500 flex items-center gap-2">
                              <Mail size={14} /> {userEmail}
                           </div>
                         </div>
                         <button onClick={handleLogout} className="flex items-center gap-2 w-full py-4 px-4 bg-gray-900 text-white font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-all">
                            <ShieldCheck size={18} className="text-green-400" /> Changer le mot de passe
                         </button>
                         <button onClick={handleLogout} className="flex items-center gap-2 w-full py-4 px-4 bg-red-50 text-red-500 font-bold text-xs rounded-xl border border-red-100 active:bg-red-100">
                            <LogOut size={18} /> Se déconnecter
                         </button>
                       </div>
                  </div>
               </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-3 animate-in fade-in">
                <h2 className="text-base font-bold text-[#002f34] px-1">Mes avis</h2>
                {loading ? renderSkeleton() : reviews.length === 0 ? (
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

      {showAddressModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
           <div className="absolute inset-0 bg-[#002f34]/40 backdrop-blur-sm" onClick={() => setShowAddressModal(false)} />
           <div className="relative bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                <h3 className="text-sm font-bold text-[#002f34]">{editingAddress ? 'Modifier' : 'Ajouter'} une adresse</h3>
                <button onClick={() => setShowAddressModal(false)} className="p-2 text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
            </div>
            
            <form onSubmit={handleSaveAddress} className="p-6 space-y-4 overflow-y-auto">
                <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400">Label (ex: Maison, Bureau)</label>
                      <input name="name" defaultValue={editingAddress?.name} required className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm font-bold" />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400">Nom complet</label>
                      <input name="fullName" defaultValue={editingAddress?.full_name} required className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm font-bold" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400">Téléphone</label>
                        <input name="phone" defaultValue={editingAddress?.phone} required className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm font-bold" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400">Ville</label>
                        <input name="city" defaultValue={editingAddress?.city} required className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm font-bold" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400">Adresse exacte</label>
                      <input name="address" defaultValue={editingAddress?.address} required className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl text-sm font-bold" />
                    </div>

                    <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer" id="default-address-toggle">
                      <input type="checkbox" name="isDefault" defaultChecked={editingAddress?.is_default} className="w-5 h-5 rounded text-[#f56b2a]" />
                      <span className="text-xs font-bold text-gray-600">Définir par défaut</span>
                    </label>
                </div>

                <div className="flex gap-3 pt-2 shrink-0">
                    <button type="button" id="cancel-address-btn" onClick={() => setShowAddressModal(false)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-xl text-xs active:bg-gray-200">Annuler</button>
                    <button type="submit" id="save-address-btn" className="flex-[2] py-4 bg-[#f56b2a] text-white font-bold rounded-xl text-xs shadow-lg shadow-orange-100 active:scale-95 transition-all">Enregistrer</button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerView;
