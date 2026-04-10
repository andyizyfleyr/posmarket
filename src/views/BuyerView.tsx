'use client';

import React, { useState, useEffect } from 'react';
import { 
  Package, MapPin, User, Star, ChevronRight, 
  Clock, CheckCircle2, Truck, AlertCircle, ShoppingBag, 
  Plus, Edit2, Trash2, Home, Briefcase, Bell, LogOut, 
  ArrowLeft, X, Phone, Mail, MessageCircle, ShieldCheck,
  ArrowRight
} from 'lucide-react';
import Button from '@/components/Button';
import { formatCurrency } from '@/utils';
import { 
  fetchBuyerOrdersAction, 
  fetchBuyerAddressesAction, 
  saveBuyerAddressAction, 
  deleteBuyerAddressAction,
  fetchBuyerReviewsAction,
  saveProductReviewAction
} from '@/app/actions/marketplace';
import { NotificationType } from '@/types';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface BuyerViewProps {
  userEmail: string;
  onBack: () => void;
  notify?: (message: string, type: 'success' | 'error' | 'info' | 'warning', title?: string) => void;
  onLogout: () => void;
  cachedData?: any;
  onUpdateCache?: (data: any) => void;
}

type TabType = 'orders' | 'addresses' | 'reviews' | 'profile';

export const BuyerView: React.FC<BuyerViewProps> = ({ userEmail, onBack, notify, onLogout, cachedData, onUpdateCache }) => {
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [orders, setOrders] = useState<any[]>(cachedData?.orders || []);
  const [addresses, setAddresses] = useState<any[]>(cachedData?.addresses || []);
  const [reviews, setReviews] = useState<any[]>(cachedData?.reviews || []);
  const [loading, setLoading] = useState(!cachedData);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);

  const { isOnline, isSlow } = useNetworkStatus();
  const [internalLoading, setInternalLoading] = useState(false);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState({ rating: 5, comment: '', product: null as any });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isDeletingAddress, setIsDeletingAddress] = useState(false);
  const [orderPage, setOrderPage] = useState(1);
  const [hasMoreOrders, setHasMoreOrders] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);

  // Handle initial data fetch and subsequent tab changes
  useEffect(() => {
    if (userEmail) {
      const isInitialMount = !orders.length && !addresses.length && !reviews.length;
      loadData(isInitialMount);
    }
  }, [userEmail, activeTab]);

  const loadData = async (forceAll = false) => {
    setLoading(true);
    setInternalLoading(true);
    setIsSlowConnection(false);
    
    try {
      // Manual timeout promise
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 10000)
      );

      // Race against timeout
      const loadPromise = (async () => {
        if (forceAll) {
          const [ordersRes, addressesRes, reviewsRes] = await Promise.all([
            fetchBuyerOrdersAction(1, 3), // Initial batch of 3
            fetchBuyerAddressesAction(),
            fetchBuyerReviewsAction()
          ]);

          if (ordersRes.success && 'orders' in ordersRes) {
            setOrders(ordersRes.orders || []);
            setTotalOrders(ordersRes.totalCount || 0);
            setHasMoreOrders((ordersRes.orders?.length || 0) < (ordersRes.totalCount || 0));
          } else if (ordersRes.error === 'Unauthorized') {
             notify?.("Veuillez vous reconnecter pour voir vos données", "info");
          }
          
          if (addressesRes.success && 'addresses' in addressesRes) setAddresses(addressesRes.addresses || []);
          if (reviewsRes.success && 'reviews' in reviewsRes) setReviews(reviewsRes.reviews || []);
        } else {
          if (activeTab === 'orders') {
            const res = await fetchBuyerOrdersAction(1, 3);
            if (res.success && 'orders' in res) {
              setOrders(res.orders || []);
              setTotalOrders(res.totalCount || 0);
              setHasMoreOrders((res.orders?.length || 0) < (res.totalCount || 0));
            } else if (res.error === 'Unauthorized') {
               notify?.("Veuillez vous reconnecter", "info");
            }
          } else if (activeTab === 'addresses') {
            const res = await fetchBuyerAddressesAction();
            if (res.success && 'addresses' in res) setAddresses(res.addresses || []);
          } else if (activeTab === 'reviews') {
            const res = await fetchBuyerReviewsAction();
            if (res.success && 'reviews' in res) setReviews(res.reviews || []);
          }
        }
      })();

      await Promise.race([loadPromise, timeoutPromise]);
    } catch (err: any) {
      console.error("Erreur de chargement:", err);
      if (err.message === 'TIMEOUT') {
        setIsSlowConnection(true);
      } else {
        notify?.("Erreur lors de la récupération des données", "error");
      }
    } finally {
      setLoading(false);
      setInternalLoading(false);
      
      // Update cache
      if (onUpdateCache) {
        onUpdateCache({
            orders: forceAll ? orders : (activeTab === 'orders' ? orders : cachedData?.orders),
            addresses: forceAll ? addresses : (activeTab === 'addresses' ? addresses : cachedData?.addresses),
            reviews: forceAll ? reviews : (activeTab === 'reviews' ? reviews : cachedData?.reviews)
        });
      }
    }

  };

  const loadMoreOrders = async () => {
    if (loadingMore || !hasMoreOrders) return;
    
    setLoadingMore(true);
    const nextPage = orderPage + 1;
    
    try {
      const res = await fetchBuyerOrdersAction(nextPage, 3);
      if (res.success && res.orders) {
        setOrders(prev => [...prev, ...res.orders!]);
        setOrderPage(nextPage);
        setHasMoreOrders((orders.length + res.orders.length) < (res.totalCount || 0));
      }
    } catch (err) {
      console.error("Load more error:", err);
    } finally {
      setLoadingMore(false);
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
    setIsSavingAddress(true);
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

    try {
      const res = await saveBuyerAddressAction(data);
      if (res.success) {
        notify?.('Adresse enregistrée', 'success');
        setShowAddressModal(false);
        loadData();
      } else {
        console.error('Save address error:', res.error);
        notify?.(res.error || 'Erreur', 'error');
      }
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleLogout = async () => {
    onLogout();
  };

  const handleDeleteAddress = async (id: string) => {
    if (confirm('Supprimer cette adresse ?')) {
      const res = await deleteBuyerAddressAction(id);
      if (res.success) {
        notify?.('Adresse supprimée', 'info');
        loadData();
      } else {
        console.error('Delete address error:', res.error);
      }
    }
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewData.product) return;
    
    setIsSubmittingReview(true);
    try {
      const res = await saveProductReviewAction(
        reviewData.product.store_id, 
        reviewData.product.id, 
        { rating: reviewData.rating, comment: reviewData.comment, author: userEmail.split('@')[0] }
      );
      
      if (res.success) {
        notify?.("Avis publié avec succès !", "success");
        setShowReviewModal(false);
        setReviewData({ rating: 5, comment: '', product: null });
        loadData(true); // Refresh all data to update review counts/list
      } else {
        notify?.(res.error || "Erreur lors de la publication", "error");
      }
    } catch (err) {
      notify?.("Erreur de connexion", "error");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const getStatusInfo = (status: string, businessType?: string) => {
    const isStay = businessType === 'stay';
    const isFood = businessType === 'food';

    switch (status) {
      case 'COMPLETED': 
        return { 
          label: isStay ? 'Terminé' : isFood ? 'Dégusté' : 'Livré', 
          color: 'bg-green-100 text-green-700', 
          icon: <CheckCircle2 size={12} /> 
        };
      case 'READY': 
        return { 
          label: isFood ? 'Prêt' : 'Prêt pour retrait', 
          color: 'bg-blue-100 text-blue-700', 
          icon: <Clock size={12} /> 
        };
      case 'SHIPPED': 
        return { 
          label: isFood ? 'En cours de livraison' : 'Expédié', 
          color: 'bg-purple-100 text-purple-700', 
          icon: <Truck size={12} /> 
        };
      case 'PENDING': 
        return { 
          label: isStay ? 'Réservé' : isFood ? 'En cuisine' : 'En attente', 
          color: 'bg-amber-100 text-amber-700', 
          icon: <Clock size={12} /> 
        };
      case 'CANCELLED': 
        return { 
          label: 'Annulé', 
          color: 'bg-red-100 text-red-700', 
          icon: <X size={12} /> 
        };
      default: 
        return { 
          label: 'Statut inconnu', 
          color: 'bg-gray-100 text-gray-700', 
          icon: <AlertCircle size={12} /> 
        };
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 md:pb-12">
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-30 transition-all">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-[#f56b2a] active:scale-95 transition-transform">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-base font-black text-[#002f34] tracking-tight">Mon compte</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => loadData(true)} className="p-2 text-gray-400 hover:text-[#f56b2a] active:scale-95 transition-transform">
              <Clock size={22} className={loading ? "animate-spin" : ""} />
            </button>
            <button className="p-2 text-gray-400">
               <Bell size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto md:px-4 md:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          <div className="space-y-5">
            <div className="bg-gradient-to-br from-white to-orange-50/40 md:rounded-[32px] p-5 md:p-8 border-b md:border border-gray-100 shadow-sm relative overflow-hidden group">
              {/* Decorative background elements */}
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-orange-100/50 rounded-full blur-2xl opacity-60 pointer-events-none" />
              <div className="absolute -left-8 -bottom-8 w-24 h-24 bg-blue-100/40 rounded-full blur-xl opacity-60 pointer-events-none" />
              
              <div className="relative flex md:flex-col items-center gap-4 md:gap-5 md:text-center z-10">
                <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-tr from-[#f56b2a] to-orange-400 rounded-[20px] md:rounded-full flex items-center justify-center text-white text-2xl md:text-3xl font-black shadow-xl shadow-orange-200/50 ring-4 ring-white">
                  {userEmail[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg md:text-2xl font-black text-[#002f34] truncate tracking-tight">{userEmail.split('@')[0]}</h2>
                  <p className="text-xs text-gray-500 font-semibold mt-0.5">{userEmail}</p>
                  <div className="flex md:justify-center items-center gap-3 mt-2">
                    <div className="text-center">
                       <p className="text-xs font-bold text-[#002f34]">{totalOrders}</p>
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

            <div className="lg:hidden flex items-center gap-2 overflow-x-auto px-4 pb-3 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {[
                { id: 'orders', label: 'Commandes', icon: Package },
                { id: 'addresses', label: 'Adresses', icon: MapPin },
                { id: 'reviews', label: 'Avis', icon: Star },
                { id: 'profile', label: 'Profil', icon: User },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TabType)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-2xl whitespace-nowrap text-xs font-black transition-all snap-start active:scale-95 ${
                    activeTab === item.id 
                      ? 'bg-[#002f34] text-white shadow-xl shadow-gray-900/10' 
                      : 'bg-white text-gray-500 shadow-sm border border-gray-100 active:bg-gray-50 hover:bg-gray-50'
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
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <h2 className="text-lg font-black text-[#002f34] px-1 tracking-tight">Mes commandes</h2>
                
                {loading ? renderSkeleton() : orders.length === 0 ? (
                  <div className="bg-white rounded-[32px] p-10 text-center text-gray-400 border border-gray-100 shadow-sm">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5">
                      <Package className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="text-base font-black text-gray-600 tracking-tight">Aucune commande trouvée</p>
                    <p className="text-xs font-medium mt-2">Vos commandes apparaîtront ici une fois validées.</p>
                  </div>
                ) : (
                  orders.map((order) => (
                    <div key={order.id} className="bg-white rounded-[28px] border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300">
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
                        <div className={`px-2 py-1 rounded-full text-[9px] font-bold flex items-center gap-1 ${getStatusInfo(order.status, Array.isArray(order.order_items) ? order.order_items[0]?.products?.business_type : undefined).color}`}>
                          {getStatusInfo(order.status, Array.isArray(order.order_items) ? order.order_items[0]?.products?.business_type : undefined).icon}
                          {getStatusInfo(order.status, Array.isArray(order.order_items) ? order.order_items[0]?.products?.business_type : undefined).label}
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        {order.order_items?.map((item: any) => {
                          const product = Array.isArray(item.products) ? item.products[0] : item.products;
                          const isStay = product?.business_type === 'stay';
                          
                          // Calculate duration info for stays
                          let stayInfo = null;
                          if (isStay && item.check_in && item.check_out) {
                            const now = new Date();
                            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                            
                            const [yStart, mStart, dStart] = item.check_in.split('-').map(Number);
                            const start = new Date(yStart, mStart - 1, dStart);
                            
                            const [yEnd, mEnd, dEnd] = item.check_out.split('-').map(Number);
                            const end = new Date(yEnd, mEnd - 1, dEnd);
                            
                            const totalNights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                            const remainingNights = Math.max(0, Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
                            const daysUntilStart = Math.max(0, Math.round((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

                            const isPast = today > end;
                            const isFuture = today < start;
                            const isOngoing = today >= start && today <= end;
                            
                            stayInfo = { totalNights, remainingNights, daysUntilStart, isPast, isFuture, isOngoing, start, end };
                          }

                          return (
                            <div key={item.id} className="group/item border-b border-gray-50 last:border-0 pb-3 last:pb-0">
                              <div className="flex gap-3 items-center justify-between mb-2">
                                <div className="flex gap-3 items-center flex-1 min-w-0">
                                  <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                                    <img src={product?.image} className="w-full h-full object-cover" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-[#002f34] truncate">{product?.name}</p>
                                    <p className="text-[10px] text-gray-400">
                                       {isStay ? `${stayInfo?.totalNights} nuits` : `${item.quantity} x ${formatCurrency(item.price)}`}
                                    </p>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => {
                                    setReviewData({ 
                                      rating: 5, 
                                      comment: '', 
                                      product: { ...product, store_id: order.store_id, business_type: product?.business_type } 
                                    });
                                    setShowReviewModal(true);
                                  }}
                                  className="shrink-0 px-3 py-1.5 bg-gray-50 hover:bg-[#f56b2a] hover:text-white text-[#f56b2a] rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                                >
                                  Laisser un avis
                                </button>
                              </div>
                              
                              {isStay && item.check_in && (
                                <div className="ml-[52px] bg-gray-50/50 rounded-xl p-2.5 space-y-2">
                                  <div className="flex items-center justify-between text-[10px] font-bold">
                                     <div className="flex items-center gap-1.5 text-gray-500">
                                        <Clock size={12} />
                                        <span>Du {stayInfo?.start?.toLocaleDateString('fr-FR')} au {stayInfo?.end?.toLocaleDateString('fr-FR')}</span>
                                     </div>
                                     {stayInfo?.isOngoing && (
                                       <span className="text-[#f56b2a] animate-pulse">En cours</span>
                                     )}
                                  </div>
                                  
                                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                     <div 
                                       className="h-full bg-[#f56b2a] transition-all duration-1000" 
                                       style={{ 
                                         width: stayInfo?.isPast ? '100%' : stayInfo?.isFuture ? '0%' : `${((stayInfo?.totalNights! - stayInfo?.remainingNights!) / stayInfo?.totalNights!) * 100}%` 
                                       }} 
                                     />
                                  </div>
                                  
                                  <div className="flex justify-between text-[9px] font-black uppercase tracking-tighter">
                                     <span className="text-gray-400">{stayInfo?.isPast ? 'Terminé' : stayInfo?.isFuture ? 'À venir' : 'Séjour en cours'}</span>
                                     <span className="text-[#f56b2a]">
                                       {stayInfo?.isPast 
                                         ? 'Déjà passé' 
                                         : stayInfo?.isFuture 
                                           ? `Dans ${stayInfo?.daysUntilStart} jour${(stayInfo?.daysUntilStart || 0) > 1 ? 's' : ''}` 
                                           : `${stayInfo?.remainingNights} nuit${(stayInfo?.remainingNights || 0) > 1 ? 's' : ''} restante${(stayInfo?.remainingNights || 0) > 1 ? 's' : ''}`}
                                     </span>
                                  </div>
                                </div>
                              )}
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

                {hasMoreOrders && orders.length > 0 && (
                  <div className="pt-4 flex justify-center">
                    <Button 
                      onClick={loadMoreOrders} 
                      loading={loadingMore}
                      variant="outline"
                      size="sm"
                      className="rounded-full px-8 text-[10px] font-black uppercase tracking-widest border-gray-200"
                    >
                      Voir plus de commandes
                    </Button>
                  </div>
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
                    <Button type="button" variant="outline" onClick={() => setShowAddressModal(false)} fullWidth>Annuler</Button>
                    <Button type="submit" loading={isSavingAddress} fullWidth className="flex-[2]">Enregistrer</Button>
                </div>
            </form>
          </div>
        </div>
      )}
      {showReviewModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4">
           <div className="absolute inset-0 bg-[#002f34]/60 backdrop-blur-md" onClick={() => !isSubmittingReview && setShowReviewModal(false)} />
           <div className="relative bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white relative">
                  <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center text-[#f56b2a] mr-3">
                    <Star size={20} fill="currentColor" />
                  </div>
                  <div className="flex-1">
                      <h3 className="text-sm font-black text-[#002f34] uppercase tracking-tight">
                        {reviewData.product?.business_type === 'stay' ? 'Noter votre séjour' : 
                         reviewData.product?.business_type === 'food' ? 'Noter votre repas' : 
                         'Noter le produit'}
                      </h3>
                      <p className="text-[10px] text-gray-400 font-bold truncate max-w-[200px]">{reviewData.product?.name}</p>
                  </div>
                  <button onClick={() => setShowReviewModal(false)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={20} />
                  </button>
              </div>
              
              <form onSubmit={handleSaveReview} className="p-8 space-y-8">
                  <div className="flex flex-col items-center gap-4 py-4 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Votre note</p>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewData({ ...reviewData, rating: star })}
                            className="p-1 transition-transform active:scale-90"
                          >
                            <Star 
                              size={32} 
                              fill={star <= reviewData.rating ? "#fbbf24" : "none"} 
                              className={star <= reviewData.rating ? "text-amber-400 drop-shadow-md" : "text-gray-200"} 
                              strokeWidth={star <= reviewData.rating ? 0 : 2}
                            />
                          </button>
                        ))}
                      </div>
                      <p className="text-xs font-black text-[#f56b2a] uppercase tracking-widest">
                        {reviewData.rating === 5 ? 'Excellent !' : reviewData.rating >= 4 ? 'Très bien' : reviewData.rating >= 3 ? 'Bien' : 'Moyen'}
                      </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Commentaire</label>
                    <textarea 
                       required
                       placeholder={
                         reviewData.product?.business_type === 'stay' ? "Comment s'est passé votre séjour ?" :
                         reviewData.product?.business_type === 'food' ? "Comment était votre repas ?" :
                         "Partagez votre expérience avec ce produit..."
                       }
                       value={reviewData.comment}
                       onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                       className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold min-h-[120px] focus:ring-2 focus:ring-[#f56b2a]/20 transition-all no-global-border resize-none"
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    loading={isSubmittingReview}
                    variant="secondary"
                    fullWidth
                    size="lg"
                    icon={<ArrowRight size={16} />}
                    iconPosition="right"
                  >
                    Publier mon avis
                  </Button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};


export default BuyerView;
