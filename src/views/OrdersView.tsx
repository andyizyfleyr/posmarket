'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
    ShoppingBag,
    Search,
    Filter,
    ChevronRight,
    Clock,
    CheckCircle2,
    User,
    CreditCard,
    Package,
    ArrowLeft,
    X,
    Truck,
    AlertCircle,
    Loader2,
    Trash2,
    Calendar,
    Zap,
    Store
} from 'lucide-react';
import { Order, CartItem, StaffPermissions, StaffRole } from '@/types';
import { formatCurrency } from '@/utils';
import { fetchOrderItems } from '../hooks/useSupabaseData';
import { updateOrderStatusAction, deleteOrderAction, bulkUpdateOrderStatusAction, bulkDeleteOrdersAction, getOrdersAction } from '@/app/actions/orders';
import { useRouter } from '@/components/RouterPolyfill';
import { Plus } from 'lucide-react';

interface OrdersViewProps {
    orders: Order[];
    currentStoreId?: string;
    permissions?: StaffPermissions;
    userRole?: StaffRole;
}

const OrdersView: React.FC<OrdersViewProps> = ({ 
    orders: initialOrders, 
    currentStoreId,
    permissions, 
    userRole 
}) => {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [localOrders, setLocalOrders] = useState<Order[]>(initialOrders || []);
    const [offset, setOffset] = useState(initialOrders?.length || 0);
    const [hasMore, setHasMore] = useState((initialOrders?.length || 0) === 10);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [selectedOrderItems, setSelectedOrderItems] = useState<CartItem[]>([]);
    const [loadingOrderItems, setLoadingOrderItems] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'COMPLETED' | 'PENDING' | 'READY'>('ALL');
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const [selectedVertical, setSelectedVertical] = useState<'all' | 'shopping' | 'food' | 'stay'>('all');
    const [isSearching, setIsSearching] = useState(false);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' | null }>({ message: '', type: null });

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast({ message: '', type: null }), 3000);
    };

    // Search and filter effect
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (currentStoreId) {
                setIsSearching(true);
                const res = await getOrdersAction(currentStoreId, 0, 10, searchTerm, filterStatus);
                if (res.success && res.orders) {
                    setLocalOrders(res.orders as any);
                    setOffset(res.orders.length);
                    setHasMore(res.hasMore || false);
                    setSelectedOrderIds([]); // Reset selection when filter changes
                }
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, filterStatus, currentStoreId]);

    // Sync with server-side refresh
    useEffect(() => {
        setLocalOrders(initialOrders);
        setOffset(initialOrders.length);
        setHasMore((initialOrders.length || 0) >= 10);
    }, [initialOrders]);

    const handleLoadMore = async () => {
        if (isLoadingMore || !hasMore || !currentStoreId) return;
        setIsLoadingMore(true);
        const res = await getOrdersAction(currentStoreId, offset, 10, searchTerm, filterStatus);
        if (res.success && res.orders) {
            setLocalOrders(prev => [...prev, ...(res.orders as any)]);
            setOffset(prev => prev + (res.orders?.length || 0));
            setHasMore(res.hasMore || false);
        }
        setIsLoadingMore(false);
    };

    useEffect(() => {
        if (selectedOrder) {
            setLoadingOrderItems(true);
            setSelectedOrderItems(selectedOrder.items || []);
            fetchOrderItems(selectedOrder.id).then(items => {
                setSelectedOrderItems(items as any);
                setLoadingOrderItems(false);
            });
        }
        return () => setSelectedOrderItems([]);
    }, [selectedOrder?.id]);

    const filteredOrders = useMemo(() => {
        return localOrders.filter(order => {
            if (selectedVertical === 'all') return true;
            
            // Infer vertical from items if not present on order
            const items = order.items || [];
            if (items.length === 0) return true;
            
            // Check the first item's product businessType
            const vertical = items[0]?.product?.businessType || 
                            (items[0]?.product?.mainCategory === 'Restauration & Livraison Rapide' ? 'food' : 
                             items[0]?.product?.mainCategory === 'Séjours, Expériences & Immobilier' ? 'stay' : 'shopping');
                             
            return vertical === selectedVertical;
        });
    }, [localOrders, selectedVertical]);

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'COMPLETED': return 'bg-green-500 text-white';
            case 'PENDING': return 'bg-orange-500 text-white';
            case 'READY': return 'bg-yellow-400 text-yellow-900';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getStatusLabel = (status?: string) => {
        switch (status) {
            case 'COMPLETED': return 'Terminée';
            case 'PENDING': return 'En attente';
            case 'READY': return 'Prête';
            default: return 'Payée';
        }
    };

    const handleUpdateStatus = async (orderId: string, status: any) => {
        const result = await updateOrderStatusAction(orderId, status);
        if (result.success) {
            router.refresh();
            showToast(`Statut mis à jour en "${getStatusLabel(status)}"`, 'success');
            if (selectedOrder?.id === orderId) {
                setSelectedOrder(prev => prev ? { ...prev, status: status as Order['status'] } : null);
            }
        } else {
            showToast(result.error || "Erreur de mise à jour", 'error');
        }
    };

    const handleDelete = async (orderId: string) => {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette commande ?')) {
            const result = await deleteOrderAction(orderId);
            if (result.success) {
                router.refresh();
                showToast("Commande supprimée", 'info');
                if (selectedOrder?.id === orderId) setSelectedOrder(null);
            } else {
                showToast(result.error || "Erreur de suppression", 'error');
            }
        }
    };

    const handleBulkUpdateStatus = async (status: string) => {
        const result = await bulkUpdateOrderStatusAction(selectedOrderIds, status);
        if (result.success) {
            router.refresh();
            showToast(`${selectedOrderIds.length} commandes mises à jour`, 'success');
            setSelectedOrderIds([]);
        } else {
            showToast(result.error || "Erreur lors de la mise à jour groupée", 'error');
        }
    };

    const handleBulkDelete = async () => {
        if (confirm(`Êtes-vous sûr de vouloir supprimer ${selectedOrderIds.length} commandes ?`)) {
            const result = await bulkDeleteOrdersAction(selectedOrderIds);
            if (result.success) {
                router.refresh();
                showToast(`${selectedOrderIds.length} commandes supprimées`, 'info');
                setSelectedOrderIds([]);
            } else {
                showToast(result.error || "Erreur lors de la suppression groupée", 'error');
            }
        }
    };

    return (
        <div className="flex-grow overflow-hidden flex flex-col p-3 md:p-8 bg-gray-50/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 md:mb-8 gap-3 md:gap-4">
                <div className="whitespace-nowrap overflow-hidden">
                    <h1 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight truncate">Commandes</h1>
                    <div className="flex items-center gap-2 mt-1 md:mt-2">
                         {[
                            { id: 'all', label: 'Toutes', icon: Package, color: 'gray' },
                            { id: 'shopping', label: 'Amazon', icon: ShoppingBag, color: 'orange' },
                            { id: 'food', label: 'UberEats', icon: Zap, color: 'yellow' },
                            { id: 'stay', label: 'Airbnb', icon: Store, color: 'blue' }
                        ].map(v => (
                            <button
                                key={v.id}
                                onClick={() => setSelectedVertical(v.id as any)}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black transition-all border-2 ${selectedVertical === v.id ? `bg-${v.color}-500 border-${v.color}-500 text-white` : 'bg-white border-gray-100 text-gray-400'}`}
                            >
                                <v.icon size={12} /> {v.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative flex-grow md:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            value={searchTerm}
                            placeholder="Chercher une commande..."
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-64 pl-9 pr-4 py-1.5 md:py-2 bg-white border border-gray-100 rounded-lg md:rounded-xl text-xs md:text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 transition-all"
                        />
                    </div>
                    <button className="p-2 bg-white border border-gray-100 rounded-lg md:rounded-xl text-gray-400 hover:text-[#f56b2a] shadow-sm transition-colors relative">
                        {isSearching ? <Loader2 size={18} className="animate-spin text-[#f56b2a]" /> : <Filter size={18} className="md:w-5 md:h-5" />}
                    </button>
                </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-3xl shadow-sm flex-grow overflow-hidden flex flex-col">
                <div className="p-3 md:p-4 border-b border-gray-50 flex items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setFilterStatus('ALL')}
                        className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black transition-all whitespace-nowrap ${filterStatus === 'ALL' ? 'bg-[#f56b2a] text-white shadow-lg shadow-orange-100' : 'text-gray-400 hover:text-gray-900'}`}
                    >
                        Toutes ({localOrders.length})
                    </button>
                    <button
                        onClick={() => setFilterStatus('PENDING')}
                        className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black transition-all whitespace-nowrap ${filterStatus === 'PENDING' ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'text-gray-400 hover:text-gray-900'}`}
                    >
                        Attente ({localOrders.filter(o => o.status === 'PENDING').length})
                    </button>
                    <button
                        onClick={() => setFilterStatus('READY' as any)}
                        className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black transition-all whitespace-nowrap ${filterStatus === 'READY' ? 'bg-yellow-400 text-yellow-900 shadow-lg shadow-yellow-100' : 'text-gray-400 hover:text-gray-900'}`}
                    >
                        Prêtes ({localOrders.filter(o => o.status === 'READY').length})
                    </button>
                    <button
                        onClick={() => setFilterStatus('COMPLETED')}
                        className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black transition-all whitespace-nowrap ${filterStatus === 'COMPLETED' ? 'bg-green-500 text-white shadow-lg shadow-green-100' : 'text-gray-400 hover:text-gray-900'}`}
                    >
                        Terminées ({localOrders.filter(o => o.status === 'COMPLETED').length})
                    </button>
                </div>

                {/* Barre d'action de sélection groupée */}
                <div className="bg-gray-50 border-b border-gray-100 p-2 md:p-3 px-3 md:px-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 md:gap-3">
                        <input 
                            type="checkbox"
                            checked={filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length}
                            onChange={(e) => {
                                if (e.target.checked) setSelectedOrderIds(filteredOrders.map(o => o.id));
                                else setSelectedOrderIds([]);
                            }}
                            className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#f56b2a] border-gray-300 rounded focus:ring-[#f56b2a] cursor-pointer"
                        />
                        <span className="text-[10px] md:text-xs font-bold text-gray-500 whitespace-nowrap">
                            {selectedOrderIds.length > 0 ? `${selectedOrderIds.length} sélectionnés` : 'Tout choisir'}
                        </span>
                    </div>
 
                    {selectedOrderIds.length > 0 && (
                        <div className="flex items-center gap-1.5 md:gap-2">
                            <button 
                                onClick={() => handleBulkUpdateStatus('PENDING')}
                                className="px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[10px] md:text-xs font-black transition-colors shadow-sm whitespace-nowrap"
                            >
                                Attente
                            </button>
                            <button 
                                onClick={() => handleBulkUpdateStatus('READY')}
                                className="px-2.5 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-lg text-[10px] md:text-xs font-black transition-colors shadow-sm whitespace-nowrap"
                            >
                                Prêtes
                            </button>
                            <button 
                                onClick={() => handleBulkUpdateStatus('COMPLETED')}
                                className="px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-[10px] md:text-xs font-black transition-colors shadow-sm whitespace-nowrap"
                            >
                                Terminées
                            </button>
                            <button 
                                onClick={handleBulkDelete}
                                className="px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 rounded-lg text-[10px] md:text-xs font-black transition-colors shadow-sm whitespace-nowrap flex items-center gap-1"
                            >
                                <Trash2 size={12} /> Supprimer
                            </button>
                        </div>
                    )}
                </div>

                <div className="overflow-y-auto flex-grow custom-scrollbar">
                    {filteredOrders.length > 0 ? (
                        <>
                        <div className="divide-y divide-gray-50">
                            {filteredOrders.map(order => (
                                    <div
                                        key={order.id}
                                        onClick={() => setSelectedOrder(order)}
                                        className={`p-2.5 md:p-6 hover:bg-gray-50 transition-colors cursor-pointer group flex items-center gap-2 md:gap-3 ${selectedOrderIds.includes(order.id) ? 'bg-orange-50/30' : ''}`}
                                    >
                                        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="checkbox"
                                                checked={selectedOrderIds.includes(order.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedOrderIds([...selectedOrderIds, order.id]);
                                                    else setSelectedOrderIds(selectedOrderIds.filter(id => id !== order.id));
                                                }}
                                                className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#f56b2a] border-gray-300 rounded focus:ring-[#f56b2a] cursor-pointer"
                                            />
                                        </div>
                                        <div className="w-7 h-7 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-orange-50 text-[#f56b2a] flex items-center justify-center shadow-sm flex-shrink-0">
                                            <ShoppingBag size={14} className="md:hidden" />
                                            <ShoppingBag size={24} className="hidden md:block" />
                                        </div>
 
                                        <div className="flex-grow min-w-0 flex items-center justify-between gap-2 overflow-hidden">
                                            <div className="flex flex-col gap-1.5 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] md:text-sm font-black text-gray-900 whitespace-nowrap">#{order.id.slice(-6).toUpperCase()}</span>
                                                    <span className="text-[9px] md:text-xs font-bold text-gray-500 truncate max-w-[120px] md:max-w-none whitespace-nowrap">
                                                        {order.customer?.name || 'Passage'}
                                                    </span>
                                                    <span className={`text-[7px] md:text-[8px] font-black px-1.5 py-0.5 rounded whitespace-nowrap tracking-wider ${order.type === 'PICKUP' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                                        {order.type === 'PICKUP' ? 'WEB' : 'POS'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[9px] md:text-[10px] font-bold text-gray-400">
                                                    <span className="flex items-center gap-1"><Calendar size={10} className="md:w-3 md:h-3 text-[#f56b2a]" /> {new Date(order.date).toLocaleDateString('fr-FR')}</span>
                                                    <span className="flex items-center gap-1"><Clock size={10} className="md:w-3 md:h-3 text-gray-400" /> {new Date(order.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
 
                                            <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                                                <div className="text-right">
                                                    <div className="text-[11px] md:text-sm font-black text-[#f56b2a] whitespace-nowrap">
                                                        {formatCurrency(order.total)}
                                                    </div>
                                                    <span className={`md:hidden text-[7px] font-black px-1 py-0.5 rounded-full uppercase tracking-tighter whitespace-nowrap ${getStatusColor(order.status || 'READY')}`}>
                                                        {getStatusLabel(order.status || 'READY')}
                                                    </span>
                                                </div>
                                                
                                                <div className="hidden md:block text-right">
                                                    <div className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${getStatusColor(order.status || 'READY')}`}>
                                                        {getStatusLabel(order.status || 'READY')}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 font-bold uppercase">{order.paymentMethod}</div>
                                                </div>
                                                
                                                <ChevronRight className="text-gray-300 group-hover:text-[#f56b2a] transition-colors md:w-4 md:h-4" size={14} />
                                            </div>
                                        </div>
                                    </div>
                            ))}
                        </div>

                        {/* Pagination Load More */}
                        {hasMore && (
                            <div className="p-4 md:p-6 flex justify-center border-t border-gray-50 bg-gray-50/5">
                                <button
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-100 rounded-xl shadow-sm text-xs font-black text-gray-500 hover:text-[#f56b2a] hover:border-orange-100 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isLoadingMore ? (
                                        <Loader2 size={14} className="animate-spin text-[#f56b2a]" />
                                    ) : (
                                        <Plus size={14} className="text-[#f56b2a]" />
                                    )}
                                    {isLoadingMore ? 'Chargement...' : 'Voir plus de commandes'}
                                </button>
                            </div>
                        )}
                        
                        {!hasMore && localOrders.length > 5 && (
                            <div className="p-6 text-center text-gray-400 text-[10px] font-black uppercase tracking-widest opacity-50 border-t border-gray-50 bg-gray-50/5">
                                Fin de liste
                            </div>
                        )}
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-20 text-center gap-4">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                                <ShoppingBag size={40} className="text-gray-200" />
                            </div>
                            <div>
                                <p className="text-lg font-black text-gray-900 leading-tight">Aucune commande trouvée</p>
                                <p className="text-xs text-gray-500 mt-1">Ajustez vos filtres ou effectuez une nouvelle recherche.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Détails de commande sidebar/modal style - Legacy Design */}
            {selectedOrder && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white h-full md:h-auto md:max-h-[85vh] w-full md:max-w-xl md:rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-500 overflow-hidden">
                        <div className="p-4 md:p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                            <div className="flex items-center gap-3 md:gap-4">
                                <button onClick={() => setSelectedOrder(null)} className="md:hidden p-1.5 -ml-1 text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></button>
                                <div>
                                    <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight whitespace-nowrap">Commande #{selectedOrder.id.slice(-6).toUpperCase()}</h2>
                                    <div className="flex items-center flex-wrap gap-1.5 md:gap-2 mt-1">
                                        <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${getStatusColor(selectedOrder.status || 'READY')}`}>
                                            {getStatusLabel(selectedOrder.status || 'READY')}
                                        </div>
                                        <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] md:text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${selectedOrder.type === 'PICKUP' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {selectedOrder.type === 'PICKUP' ? 'Marketplace' : 'Boutique'}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] md:text-xs font-bold text-gray-500 whitespace-nowrap">
                                            <Clock size={10} className="md:w-3 md:h-3" />
                                            {new Date(selectedOrder.date).toLocaleDateString('fr-FR')} à {new Date(selectedOrder.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="hidden md:block p-2 text-gray-400 hover:text-red-500 transition-colors"><X size={24} /></button>
                        </div>

                        <div className="flex-grow overflow-y-auto p-4 md:p-8 custom-scrollbar">
                            <div className="space-y-6 md:space-y-8">
                                {/* Client Info */}
                                <div className="space-y-3 md:space-y-4">
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Client</h3>
                                    <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-[#f56b2a] text-white flex items-center justify-center font-black text-lg md:text-xl">
                                            {selectedOrder.customer?.name?.charAt(0) || '?'}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-black text-gray-900 truncate">{selectedOrder.customer?.name || 'Client de passage'}</div>
                                            <div className="text-[10px] md:text-xs text-gray-500 truncate">{selectedOrder.customer?.email || 'Sans email'}</div>
                                            {selectedOrder.customer?.phone && <div className="text-[10px] md:text-xs text-gray-500 mt-0.5">{selectedOrder.customer.phone}</div>}
                                        </div>
                                    </div>
                                </div>
 
                                {/* Items */}
                                <div className="space-y-3 md:space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Articles ({loadingOrderItems ? '...' : selectedOrderItems.length})</h3>
                                    </div>
                                    {loadingOrderItems ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="animate-spin text-[#f56b2a]" size={20} />
                                        </div>
                                    ) : (
                                    <div className="space-y-2 md:space-y-3">
                                        {selectedOrderItems.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-3 md:gap-4 p-2 md:p-3 border border-gray-50 rounded-xl md:rounded-2xl hover:bg-gray-50/50 transition-colors">
                                                <div className="w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-xl overflow-hidden border border-gray-100 flex-shrink-0">
                                                    <img src={item.product.image} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex-grow min-w-0">
                                                    <div className="text-xs md:text-sm font-black text-gray-900 truncate">{item.product.name}</div>
                                                    <div className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase mt-0.5">{item.quantity} {item.product.unit || 'unité(s)'}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs md:text-sm font-black text-gray-900">{formatCurrency(item.quantity * (item.product.price || 0))}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    )}
                                </div>

                                {/* Payment Info */}
                                <div className="space-y-3 md:space-y-4">
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Paiement</h3>
                                    <div className="bg-gray-50 p-4 md:p-6 rounded-2xl border border-gray-100 space-y-3 md:space-y-4">
                                        <div className="flex justify-between items-center text-xs md:text-sm pt-3 md:pt-4 border-t border-gray-200">
                                            <span className="font-bold text-gray-400 uppercase tracking-widest text-[10px]">Total</span>
                                            <span className="text-xl md:text-2xl font-black text-[#f56b2a]">{formatCurrency(selectedOrder.total)}</span>
                                        </div>
                                        { (selectedOrder.discountAmount || 0) > 0 && (
                                            <div className="flex justify-between items-center text-xs md:text-sm text-green-600 bg-green-50/50 p-2 rounded-lg">
                                                <span className="font-bold text-[10px] uppercase">Remise appliquée</span>
                                                <span className="font-black">-{formatCurrency(selectedOrder.discountAmount || 0)}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5 mt-3 md:mt-4 text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                            <CreditCard size={12} className="md:w-[14px] md:h-[14px]" /> Mode: <span className="text-gray-900">{selectedOrder.paymentMethod}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
 
                        <div className="p-4 md:p-6 bg-white border-t border-gray-100 grid grid-cols-2 gap-3 md:gap-4">
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="py-3 md:py-4 px-4 md:px-6 bg-white border border-gray-200 rounded-xl md:rounded-2xl font-black text-gray-600 hover:bg-gray-50 transition-all flex items-center justify-center gap-2 text-xs md:text-sm shadow-sm whitespace-nowrap"
                            >
                                <AlertCircle size={16} className="md:w-[18px] md:h-[18px]" /> Fermer
                            </button>
                            <button
                                onClick={() => {
                                    handleUpdateStatus(selectedOrder.id, 'COMPLETED');
                                    setSelectedOrder(null);
                                }}
                                className="py-3 md:py-4 px-4 md:px-6 bg-[#f56b2a] text-white rounded-xl md:rounded-2xl font-black hover:bg-[#d55a20] shadow-xl shadow-orange-100 transition-all flex items-center justify-center gap-2 text-xs md:text-sm whitespace-nowrap"
                            >
                                <CheckCircle2 size={16} className="md:w-[18px] md:h-[18px]" /> {selectedOrder.status === 'COMPLETED' ? 'Terminé' : 'Valider'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Toast Notification */}
            {toast.type && (
                <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5 duration-300 flex items-center gap-3 border ${
                    toast.type === 'success' ? 'bg-green-600 text-white border-green-500' : 
                    toast.type === 'error' ? 'bg-red-600 text-white border-red-500' : 'bg-gray-800 text-white border-gray-700'
                }`}>
                    {toast.type === 'success' ? <CheckCircle2 size={18} /> : toast.type === 'error' ? <AlertCircle size={18} /> : <ShoppingBag size={18} />}
                    <span className="text-sm font-black tracking-tight">{toast.message}</span>
                </div>
            )}
        </div>
    );
};

export default OrdersView;
