'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/supabase';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Plus,
  Mail,
  Phone,
  History,
  MoreVertical,
  Star,
  X,
  Edit,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2
} from 'lucide-react';
import { Customer, StaffRole, StaffPermissions } from '@/types';
import { formatCurrency } from '@/utils';
import { getCustomersAction } from '@/app/actions/customers';

interface CustomersViewProps {
  customers: Customer[];
  onSaveCustomer?: (customer: any) => Promise<any>;
  onDeleteCustomer?: (id: string) => Promise<any>;
  onBulkDeleteCustomers?: (ids: string[]) => Promise<any>;
  userRole?: StaffRole;
  permissions: StaffPermissions;
  currentStoreId?: string;
}

const CustomersView: React.FC<CustomersViewProps> = ({
  customers: initialCustomers,
  onSaveCustomer,
  onDeleteCustomer,
  onBulkDeleteCustomers,
  userRole,
  permissions,
  currentStoreId
}) => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(initialCustomers || []);
  const [offset, setOffset] = useState(initialCustomers?.length || 0);
  const [hasMore, setHasMore] = useState((initialCustomers?.length || 0) === 10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [activeSegment, setActiveSegment] = useState<'all' | 'vip' | 'inactive'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Customer; direction: 'asc' | 'desc' }>({
    key: 'totalSpent',
    direction: 'desc'
  });

  // Search effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
        if (currentStoreId) {
            const res = await getCustomersAction(currentStoreId, 0, 10, searchTerm);
            if (res.success && res.customers) {
                setLocalCustomers(res.customers as any);
                setOffset(res.customers.length);
                setHasMore(res.hasMore || false);
            }
        }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, currentStoreId]);

  // Sync with server updates
  useEffect(() => {
    setLocalCustomers(initialCustomers);
    setOffset(initialCustomers.length);
    setHasMore((initialCustomers.length || 0) >= 10);
  }, [initialCustomers]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || !currentStoreId) return;
    setIsLoadingMore(true);
    const res = await getCustomersAction(currentStoreId, offset, 10, searchTerm);
    if (res.success && res.customers) {
        setLocalCustomers(prev => [...prev, ...(res.customers as any)]);
        setOffset(prev => prev + (res.customers?.length || 0));
        setHasMore(res.hasMore || false);
    }
    setIsLoadingMore(false);
  };

  const isSeller = userRole === 'SELLER';

  const getSegment = (customer: Customer) => {
    const isVIP = (customer.totalSpent || 0) >= 500000;
    const lastOrder = customer.lastOrderDate ? new Date(customer.lastOrderDate) : null;
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const isInactive = lastOrder && lastOrder < oneMonthAgo;

    return { isVIP, isInactive };
  };

  // Form state
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    phone: '',
    totalSpent: 0,
    ordersCount: 0
  });

  const filteredCustomers = useMemo(() => {
    let result = [...localCustomers].filter(c => {
      if (activeSegment === 'all') return true;
      const { isVIP, isInactive } = getSegment(c);
      if (activeSegment === 'vip') return isVIP;
      if (activeSegment === 'inactive') return isInactive;
      return true;
    });

    // Client sorting on current page is OK for simple UI but maybe we should paginate on server with sorting?
    // For now keep client sorting for the loaded batch as requested.

    // Sorting logic
    result.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === undefined || bValue === undefined) return 0;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }

      const numA = Number(aValue) || 0;
      const numB = Number(bValue) || 0;

      return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
    });

    return result;
  }, [localCustomers, searchTerm, activeSegment, sortConfig]);

  const handleSort = (key: keyof Customer) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const getSortIcon = (key: keyof Customer) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-gray-300" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-[#f56b2a]" /> : <ArrowDown size={14} className="text-[#f56b2a]" />;
  };

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData(customer);
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '',
        phone: '',
        totalSpent: 0,
        ordersCount: 0
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Voulez-vous vraiment supprimer ce client ?')) {
      if (onDeleteCustomer) {
        await onDeleteCustomer(id);
      } else {
        const { error } = await supabase.from('customers').delete().eq('id', id);
        if (error) alert("Erreur lors de la suppression");
        router.refresh();
      }
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (onBulkDeleteCustomers) {
      await onBulkDeleteCustomers(Array.from(selectedIds));
    } else {
      const { error } = await supabase.from('customers').delete().in('id', Array.from(selectedIds));
      if (error) alert("Erreur lors de la suppression");
      router.refresh();
    }
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCustomers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCustomers.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const customerData: any = editingCustomer ? { ...editingCustomer, ...formData } : formData;
      const dbCustomer = {
        ...(customerData.id && { id: customerData.id }),
        store_id: currentStoreId || (localCustomers[0] as any)?.store_id,
        name: customerData.name,
        phone: customerData.phone,
        address: customerData.address,
        total_spent: customerData.totalSpent || 0,
        orders_count: customerData.ordersCount || 0
      };

      if (onSaveCustomer) {
        await onSaveCustomer(customerData);
      } else {
        const { error } = await supabase.from('customers').upsert(dbCustomer);
        if (error) throw error;
        router.refresh();
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-grow overflow-hidden flex flex-col p-3 md:p-8 bg-gray-50/30">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-8 gap-3 md:gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight whitespace-nowrap">Clients</h1>
            <p className="text-gray-500 text-[10px] md:text-sm mt-0.5 md:mt-1 truncate">{localCustomers.length} clients enregistrés.</p>
          </div>
          {selectedIds.size > 0 && permissions.canManageCustomers && !isSeller && (
            <div className="flex items-center gap-2 animate-in slide-in-from-left-4 duration-300">
              <div className="h-8 w-px bg-gray-200 mx-1 md:mx-2 hidden md:block" />
              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-black border border-red-100 hover:bg-red-100 transition-all shadow-sm"
              >
                <Trash2 size={14} /> Supprimer ({selectedIds.size})
              </button>
            </div>
          )}
        </div>
        {permissions.canManageCustomers && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 md:px-6 md:py-3 bg-[#f56b2a] text-white rounded-xl md:rounded-2xl text-xs md:text-sm font-black hover:bg-[#d55a20] transition-all shadow-lg shadow-orange-100 whitespace-nowrap"
          >
            <Plus size={16} className="md:w-[18px] md:h-[18px]" /> Nouveau Client
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4 md:mb-6 overflow-x-auto pb-1.5 md:pb-2 no-scrollbar">
        {[
          { id: 'all', label: 'Tous', count: localCustomers.length },
          { id: 'vip', label: 'VIP', count: localCustomers.filter(c => getSegment(c).isVIP).length },
          { id: 'inactive', label: 'Inactifs', count: localCustomers.filter(c => getSegment(c).isInactive).length },
        ].map(segment => (
          <button
            key={segment.id}
            onClick={() => {
                setActiveSegment(segment.id as any);
                setSelectedIds(new Set());
            }}
            className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-xs font-black transition-all whitespace-nowrap border ${activeSegment === segment.id ? 'bg-[#f56b2a] border-[#f56b2a] text-white shadow-lg shadow-orange-100' : 'bg-white border-gray-100 text-gray-500 hover:border-orange-200'}`}
          >
            {segment.label} ({segment.count})
          </button>
        ))}
      </div>

      {/* Mobile Sorting Selector */}
      <div className="flex md:hidden items-center gap-2 mb-4 px-1 overflow-x-auto no-scrollbar">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Trier par:</span>
        <button 
          onClick={() => handleSort('totalSpent')} 
          className={`px-3 py-1.5 rounded-lg text-[9px] font-black whitespace-nowrap border ${sortConfig.key === 'totalSpent' ? 'bg-orange-50 border-orange-200 text-[#f56b2a]' : 'bg-white border-gray-100 text-gray-500'}`}
        >
          Dépensé {sortConfig.key === 'totalSpent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          onClick={() => handleSort('ordersCount')} 
          className={`px-3 py-1.5 rounded-lg text-[9px] font-black whitespace-nowrap border ${sortConfig.key === 'ordersCount' ? 'bg-orange-50 border-orange-200 text-[#f56b2a]' : 'bg-white border-gray-100 text-gray-500'}`}
        >
          Commandes {sortConfig.key === 'ordersCount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          onClick={() => handleSort('name')} 
          className={`px-3 py-1.5 rounded-lg text-[9px] font-black whitespace-nowrap border ${sortConfig.key === 'name' ? 'bg-orange-50 border-orange-200 text-[#f56b2a]' : 'bg-white border-gray-100 text-gray-500'}`}
        >
          Nom {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl shadow-sm flex-grow overflow-hidden flex flex-col">
        <div className="p-3 md:p-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="relative max-w-md flex-grow">
            <Search size={16} className="absolute left-3 top-2.5 md:top-3 text-gray-400 md:w-[18px] md:h-[18px]" />
            <input
              type="text"
              value={searchTerm}
              placeholder="Rechercher..."
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-2 md:py-2.5 bg-gray-50 border border-gray-100 rounded-lg md:rounded-xl text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20"
            />
          </div>
          <div className="md:hidden flex items-center gap-2">
            <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-gray-300 text-[#f56b2a] focus:ring-[#f56b2a]"
                checked={filteredCustomers.length > 0 && selectedIds.size === filteredCustomers.length}
                onChange={toggleSelectAll}
            />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Tout</span>
          </div>
        </div>

        <div className="overflow-y-auto flex-grow custom-scrollbar">
          <div className="block md:table w-full">
            <div className="hidden md:table-header-group bg-gray-50/80 backdrop-blur text-gray-400 uppercase text-[10px] font-bold tracking-widest sticky top-0 z-10">
              <div className="table-row">
                <div className="table-cell px-6 py-4 w-10">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 text-[#f56b2a] focus:ring-[#f56b2a]"
                      checked={filteredCustomers.length > 0 && selectedIds.size === filteredCustomers.length}
                      onChange={toggleSelectAll}
                    />
                </div>
                <div className="table-cell px-6 py-4">
                  <button onClick={() => handleSort('name')} className="flex items-center gap-2 hover:text-gray-900 transition-colors">
                    Client {getSortIcon('name')}
                  </button>
                </div>
                <div className="table-cell px-6 py-4">Coordonnées</div>
                <div className="table-cell px-6 py-4">
                  <button onClick={() => handleSort('ordersCount')} className="flex items-center gap-2 hover:text-gray-900 transition-colors">
                    Nb Commandes {getSortIcon('ordersCount')}
                  </button>
                </div>
                <div className="table-cell px-6 py-4">
                  <button onClick={() => handleSort('totalSpent')} className="flex items-center gap-2 hover:text-gray-900 transition-colors">
                    Total Dépensé {getSortIcon('totalSpent')}
                  </button>
                </div>
                <div className="table-cell px-6 py-4 text-right">Actions</div>
              </div>
            </div>
            <div className="block md:table-row-group divide-y divide-gray-100">
              {filteredCustomers.map(customer => (
                <div key={customer.id} className={`block md:table-row transition-colors group ${selectedIds.has(customer.id) ? 'bg-orange-50/60' : 'hover:bg-orange-50/30'}`}>
                  <div className="hidden md:table-cell px-6 py-4 w-10">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300 text-[#f56b2a] focus:ring-[#f56b2a]"
                        checked={selectedIds.has(customer.id)}
                        onChange={() => toggleSelect(customer.id)}
                      />
                  </div>
                  <div className="block md:table-cell px-2 md:px-6 py-1.5 md:py-4">
                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                      <div className="flex items-center gap-2 min-w-0 flex-grow">
                        <div className="md:hidden">
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-gray-300 text-[#f56b2a] focus:ring-[#f56b2a]"
                                checked={selectedIds.has(customer.id)}
                                onChange={() => toggleSelect(customer.id)}
                            />
                        </div>
                        <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl bg-[#f56b2a] text-white flex items-center justify-center font-black text-[10px] md:text-sm shadow-sm md:shadow-lg md:shadow-orange-100 flex-shrink-0">
                          {customer.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="min-w-0 flex flex-col">
                          <div className="font-bold text-[10px] md:text-sm text-gray-900 flex items-center gap-1.5 truncate whitespace-nowrap">
                            <span className="truncate">{customer.name}</span>
                            <div className="flex gap-1 flex-shrink-0">
                              {getSegment(customer).isVIP && (
                                <Star size={10} className="fill-yellow-500 text-yellow-500 md:hidden" />
                              )}
                              {getSegment(customer).isVIP && (
                                <span className="hidden md:flex bg-yellow-50 text-yellow-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase items-center gap-1">
                                  <Star size={10} className="fill-yellow-600" /> VIP
                                </span>
                              )}
                              {getSegment(customer).isInactive && (
                                <span className="bg-red-50 text-red-600 text-[6px] md:text-[8px] font-black px-1 md:px-1.5 py-0.5 rounded uppercase flex-shrink-0">
                                  Inactif
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex md:hidden items-center gap-1.5 mt-0.5 text-[9px] text-gray-400 font-bold truncate whitespace-nowrap">
                            <span className="truncate">{customer.phone}</span>
                            <span className="text-gray-200">|</span>
                            <span className="text-green-600 font-black">{formatCurrency(customer.totalSpent || 0)}</span>
                          </div>
                          <div className="hidden md:block text-[10px] text-gray-400 font-mono uppercase">ID: {customer.id}</div>
                        </div>
                      </div>
 
                      {/* Actions for Mobile */}
                      <div className="flex md:hidden items-center gap-1.5 flex-shrink-0">
                        <button className="p-2 text-green-600 bg-green-50 rounded-lg active:scale-95" title="Appeler">
                          <Phone size={12} />
                        </button>
                        {permissions.canManageCustomers && !isSeller && (
                          <button
                            onClick={() => handleOpenModal(customer)}
                            className="p-2 text-[#f56b2a] bg-orange-50 rounded-lg active:scale-95"
                          >
                            <Edit size={12} />
                          </button>
                        )}
                        <ChevronRight size={12} className="text-gray-300" />
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:table-cell px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Phone size={12} className="text-gray-400" /> {customer.phone}
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:table-cell px-6 py-4">
                    <div className="flex items-center gap-2">
                      <History size={14} className="text-gray-300" />
                      <span className="text-sm font-black text-gray-700">{customer.ordersCount || 0}</span>
                    </div>
                  </div>

                  <div className="hidden md:table-cell px-6 py-4">
                    <span className="text-sm font-black text-green-600">{formatCurrency(customer.totalSpent || 0)}</span>
                  </div>

                  <div className="hidden md:table-cell px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {permissions.canManageCustomers && !isSeller && (
                        <>
                          <button
                            onClick={() => handleOpenModal(customer)}
                            className="p-2.5 text-[#f56b2a] bg-orange-50 rounded-xl transition-all active:scale-90"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(customer.id)}
                            className="p-2.5 text-red-600 bg-red-50 rounded-xl transition-all active:scale-90"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                      <button className="p-2.5 text-green-600 bg-green-50 rounded-xl transition-all active:scale-90" title="WhatsApp">
                        <Phone size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagination Load More */}
          {hasMore && (
            <div className="p-4 md:p-6 flex justify-center border-t border-gray-100 bg-gray-50/5">
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-100 rounded-xl shadow-sm text-xs font-black text-gray-400 hover:text-[#f56b2a] hover:border-orange-100 transition-all active:scale-95 disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <Loader2 size={14} className="animate-spin text-[#f56b2a]" />
                ) : (
                  <Plus size={14} className="text-[#f56b2a]" />
                )}
                {isLoadingMore ? 'Chargement...' : 'Voir plus de clients'}
              </button>
            </div>
          )}

          {!hasMore && localCustomers.length > 5 && (
            <div className="p-6 text-center text-gray-400 text-[10px] font-black uppercase tracking-widest opacity-50 border-t border-gray-50 bg-gray-50/5">
              Fin de liste
            </div>
          )}
          {filteredCustomers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
              <Users size={64} className="opacity-10" />
              <p className="font-medium">Aucun client trouvé</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Client */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-3 md:px-6 py-3 md:py-6 border-b border-gray-100 flex items-center justify-between bg-white">
              <h2 className="text-base md:text-xl font-black text-gray-900 tracking-tight whitespace-nowrap">{editingCustomer ? 'Modifier Client' : 'Nouveau Client'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 md:p-2 hover:bg-gray-50 rounded-full">
                <X size={18} className="md:size-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-3 md:p-6 space-y-4 md:space-y-5">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Nom Complet</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-xs md:text-sm focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] focus:outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Téléphone</label>
                  <input
                    required
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl text-xs md:text-sm focus:ring-4 focus:ring-orange-50 focus:border-[#f56b2a] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-grow py-2.5 md:py-4 border border-gray-100 rounded-xl md:rounded-2xl font-black text-[10px] md:text-sm text-gray-500 hover:bg-gray-50 transition-all active:scale-95 whitespace-nowrap"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-grow py-2.5 md:py-4 bg-[#f56b2a] text-white font-black rounded-xl md:rounded-2xl text-[10px] md:text-sm hover:bg-[#d55a20] transition-all shadow-xl shadow-orange-100 active:scale-95 whitespace-nowrap"
                >
                  {editingCustomer ? 'Actualiser' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersView;

