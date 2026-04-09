'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from '@/components/RouterPolyfill';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  BarChart2,
  Calendar,
  Eye,
  Flame,
  ChevronLeft,
  ChevronRight,
  Zap,
  Package,
  Store
} from 'lucide-react';
import { Order, Product, Customer, StaffRole, StaffPermissions } from '@/types';
import { formatCurrency } from '@/utils';

interface DashboardViewProps {
  orders: Order[];
  products: Product[];
  customers: Customer[];
  userRole?: StaffRole;
  permissions: StaffPermissions;
  userName?: string;
  store?: any;
}

const StatCard = ({ title, value, icon, trend, trendValue, color, compact }: any) => (
  <div className={`bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-orange-100/20 hover:scale-[1.02] transition-all duration-500 group cursor-default
    ${compact ? 'p-2 md:p-6' : 'p-4 md:p-6'}`}>
    <div className={`flex items-center justify-between ${compact ? 'mb-1.5 md:mb-5' : 'mb-3 md:mb-5'}`}>
      <div className={`rounded-xl md:rounded-2xl ${color} text-white shadow-lg ${color.replace('bg-', 'shadow-')}/20 group-hover:rotate-6 transition-transform duration-500 
        ${compact ? 'p-1.5 md:p-3.5' : 'p-2.5 md:p-3.5'}`}>
        {React.cloneElement(icon, { className: compact ? "w-3.5 h-3.5 md:w-6 md:h-6" : "w-4 h-4 md:w-6 md:h-6" })}
      </div>
      <div className={`flex items-center gap-0.5 md:gap-1 font-black px-1.5 md:px-2 py-0.5 md:py-1 rounded-full 
        ${compact ? 'text-[8px] md:text-[10px]' : 'text-[9px] md:text-[10px]'}
        ${trend === 'up' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
        {(!compact || (typeof window !== 'undefined' && window.innerWidth > 768)) && (trend === 'up' ? <ArrowUpRight size={10} className="md:w-3.5 md:h-3.5" /> : <ArrowDownRight size={10} className="md:w-3.5 md:h-3.5" />)}
        {trendValue}
      </div>
    </div>
    <div className="flex flex-col min-w-0">
      <span className={`text-gray-400 font-black uppercase tracking-widest truncate 
        ${compact ? 'text-[9px] md:text-[11px] mb-0.5' : 'text-[10px] md:text-[11px] mb-1'}`}>
        {title}
      </span>
      <span className={`font-black text-gray-900 tracking-tight truncate 
        ${compact ? 'text-sm md:text-2xl' : 'text-lg md:text-2xl'}`}>
        {value}
      </span>
    </div>
  </div>
);

const DashboardView: React.FC<DashboardViewProps> = ({ orders, products, customers, userRole, permissions, userName, store }) => {
  const router = useRouter();
  const getLocalYMD = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return getLocalYMD(d);
  });
  const [endDate, setEndDate] = useState<string>(() => getLocalYMD(new Date()));
  const [selectedVertical, setSelectedVertical] = useState<'all' | 'shopping' | 'food' | 'stay'>(store?.business_type || 'all');
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isSeller = userRole === 'SELLER';
  const totalStock = useMemo(() => (products || []).reduce((s, p) => s + p.stock, 0), [products]);

  // Helper : détecte le vertical d'un produit (gère les deux conventions snake_case / camelCase)
  const getVertical = (product: any): string => {
    if (!product) return 'shopping';
    // Champ direct
    const bt = product.businessType || product.business_type;
    if (bt) return bt;
    // Fallback via la catégorie principale
    const mc = product.mainCategory || product.main_category;
    if (mc === 'Restauration & Livraison Rapide') return 'food';
    if (mc === 'Séjours, Expériences & Immobilier') return 'stay';
    return 'shopping';
  };

  // Enhanced Metrics based on selected date range
  const filteredMetrics = useMemo(() => {
    const parseLocal = (dStr: string) => {
      const [y, m, d] = dStr.split('-').map(Number);
      return new Date(y, m - 1, d);
    };

    const start = parseLocal(startDate);
    start.setHours(0, 0, 0, 0);
    const end = parseLocal(endDate);
    end.setHours(23, 59, 59, 999);

    // Calculate previous period for trend
    const diffMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - diffMs - 1);
    const prevEnd = new Date(start.getTime() - 1);

    const currentFinalOrders = orders.filter(o => {
      const d = new Date(o.date);
      const inDateRange = d >= start && d <= end;
      if (!inDateRange) return false;
      
      if (selectedVertical === 'all') return true;
      return getVertical(o.items?.[0]?.product) === selectedVertical;
    });

    const prevFinalOrders = orders.filter(o => {
      const d = new Date(o.date);
      const inDateRange = d >= prevStart && d <= prevEnd;
      if (!inDateRange) return false;

      if (selectedVertical === 'all') return true;
      return getVertical(o.items?.[0]?.product) === selectedVertical;
    });

    const currentRev = currentFinalOrders.reduce((sum, o) => sum + o.total, 0);
    const prevRev = prevFinalOrders.reduce((sum, o) => sum + o.total, 0);
    const revTrendValue = prevRev === 0 ? (currentRev > 0 ? 100 : 0) : Math.round(((currentRev - prevRev) / prevRev) * 100);

    const currentCount = currentFinalOrders.length;
    const prevCount = prevFinalOrders.length;
    const countTrendValue = prevCount === 0 ? (currentCount > 0 ? 100 : 0) : Math.round(((currentCount - prevCount) / prevCount) * 100);

    const currentBasket = currentCount > 0 ? currentRev / currentCount : 0;
    const prevBasket = prevCount > 0 ? prevRev / prevCount : 0;
    const basketTrendValue = prevBasket === 0 ? (currentBasket > 0 ? 100 : 0) : Math.round(((currentBasket - prevBasket) / prevBasket) * 100);

    const totalTraffic = (store?.views || 0) + (products || []).reduce((sum, p) => sum + (p.views || 0), 0);

    // 🏨 Calcul des nuits réservées pour les boutiques de type 'stay'
    const calcNights = (ordersList: Order[]) => {
      let totalNights = 0;
      ordersList.forEach(o => {
        (o.items || []).forEach((item: any) => {
          const ci = item.checkIn || item.check_in;
          const co = item.checkOut || item.check_out;
          if (ci && co) {
            const nights = Math.max(1, Math.round((new Date(co).getTime() - new Date(ci).getTime()) / (1000 * 60 * 60 * 24)));
            totalNights += nights;
          }
        });
      });
      return totalNights;
    };

    const isStayStore = store?.business_type === 'stay';
    const currentNights = isStayStore ? calcNights(currentFinalOrders) : 0;
    const prevNights = isStayStore ? calcNights(prevFinalOrders) : 0;
    const nightsTrendValue = prevNights === 0 ? (currentNights > 0 ? 100 : 0) : Math.round(((currentNights - prevNights) / prevNights) * 100);
    const pricePerNight = currentNights > 0 ? currentRev / currentNights : 0;
    const prevPricePerNight = prevNights > 0 ? prevRev / prevNights : 0;
    const ppnTrendValue = prevPricePerNight === 0 ? (pricePerNight > 0 ? 100 : 0) : Math.round(((pricePerNight - prevPricePerNight) / prevPricePerNight) * 100);

    return {
      revenue: { current: currentRev, trend: revTrendValue >= 0 ? 'up' : 'down', pct: Math.abs(revTrendValue) },
      orders: { current: currentCount, trend: countTrendValue >= 0 ? 'up' : 'down', pct: Math.abs(countTrendValue) },
      basket: { current: currentBasket, trend: basketTrendValue >= 0 ? 'up' : 'down', pct: Math.abs(basketTrendValue) },
      traffic: { current: totalTraffic, trend: 'up' as const, pct: 'Live' },
      // Stats spécifiques 'stay'
      nights: { current: currentNights, trend: nightsTrendValue >= 0 ? 'up' : 'down', pct: Math.abs(nightsTrendValue) },
      pricePerNight: { current: pricePerNight, trend: ppnTrendValue >= 0 ? 'up' : 'down', pct: Math.abs(ppnTrendValue) },
    };
  }, [orders, products, store, startDate, endDate, selectedVertical]);

  // Custom Date Picker Logic
  const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);
  const [viewDate, setViewDate] = useState(new Date());

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handleDateSelect = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const dateStr = getLocalYMD(newDate);
    
    if (showPicker === 'start') {
      setStartDate(dateStr);
      // Automatically switch to 'end' for a better flow
      setShowPicker('end');
    } else {
      setEndDate(dateStr);
      // Keep it open to allow fine-tuning, but the user can now 'Apply'
    }
  };

  // Dynamic Chart Data based on Date Range
  const chartDataRaw = useMemo(() => {
    const parseLocal = (dStr: string) => {
      const [y, m, d] = dStr.split('-').map(Number);
      return new Date(y, m - 1, d);
    };

    const start = parseLocal(startDate);
    start.setHours(0, 0, 0, 0);
    const end = parseLocal(endDate);
    end.setHours(23, 59, 59, 999);

    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) {
      // Group by hours
      const hourSlots = [8, 10, 12, 14, 16, 18, 20];
      return hourSlots.map(hourInt => {
        const total = orders
          .filter(o => {
            const d = new Date(o.date);
            return d >= start && d <= end && d.getHours() >= hourInt && d.getHours() < hourInt + 2;
          })
          .reduce((sum, o) => sum + o.total, 0);
        return { label: `${hourInt}h`, value: total, isMajor: false };
      });
    }

    // Dynamic bucketing (aim for ~7-10 points)
    const bucketCount = Math.min(Math.max(diffDays, 1), diffDays < 7 ? diffDays + 1 : 10);
    const msPerBucket = diffMs / (bucketCount - 1 || 1);
    
    const buckets = [];
    let lastMonth = '';
    
    for (let i = 0; i < bucketCount; i++) {
        const bStart = new Date(start.getTime() + (i * msPerBucket));
        const bEnd = new Date(start.getTime() + ((i + 1) * msPerBucket) - 1);
        
        const total = orders
          .filter(o => {
            const orderDate = new Date(o.date);
            return orderDate >= bStart && orderDate <= (i === bucketCount - 1 ? end : bEnd);
          })
          .reduce((sum, o) => sum + o.total, 0);
        
        let label = '';
        const currentMonth = bStart.toLocaleDateString('fr-FR', { month: 'short' });
        
        if (diffDays <= 31) {
            if (i === 0 || i === bucketCount - 1 || currentMonth !== lastMonth) {
                label = bStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                lastMonth = currentMonth;
            } else {
                label = String(bStart.getDate());
            }
        } else {
            label = bStart.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
        }
        
        buckets.push({ 
            label, 
            value: total, 
            isMajor: label.includes(' ') || (diffDays > 31) 
        });
    }
    
    return buckets;
  }, [orders, startDate, endDate]);

  // Normalize for SVG (0-100)
  const currentData = useMemo(() => {
    const maxValue = Math.max(...chartDataRaw.map(d => d.value), 1);
    
    return chartDataRaw.map(d => ({
      ...d,
      displayValue: d.value,
      value: (d.value / maxValue) * 80 + 10, // scale to 10-90 for margins
      isMajor: d.isMajor
    }));
  }, [chartDataRaw]);

  const mostVisited = useMemo(() => {
    return [...products]
      .filter(p => {
        const match = (p.views || 0) > 0;
        if (!match) return false;
        if (selectedVertical === 'all') return true;
        return getVertical(p) === selectedVertical;
      })
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5);
  }, [products, selectedVertical]);

  const topSelling = useMemo(() => {
    // Calculer les ventes UNIQUEMENT à partir des commandes réelles
    // (p.salesCount vient de product_stats qui reflète déjà ces mêmes orders — ne pas additionner les deux)
    const salesMap: Record<string, number> = {};
    (orders || []).forEach(order => {
      (order.items || []).forEach((item: any) => {
        const id = item.product?.id;
        if (id) {
          salesMap[id] = (salesMap[id] || 0) + (item.quantity || 1);
        }
      });
    });

    return [...products]
      .map(p => ({
        ...p,
        // Utiliser les ventes calculées depuis les orders si disponibles, sinon fallback vers product_stats
        salesCount: salesMap[p.id] || p.salesCount || 0
      }))
      .filter(p => {
        const match = p.salesCount > 0;
        if (!match) return false;
        if (selectedVertical === 'all') return true;
        return getVertical(p) === selectedVertical;
      })
      .sort((a, b) => b.salesCount - a.salesCount)
      .slice(0, 5);
  }, [products, orders, selectedVertical]);



  return (
    <div className="flex-grow overflow-y-auto overflow-x-hidden p-2 md:p-8 custom-scrollbar bg-gray-50/50">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 md:mb-8 gap-1 md:gap-6">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="md:hidden w-8 h-8 rounded-xl overflow-hidden border border-white shadow-lg flex-shrink-0">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userRole || 'Admin'}`} className="w-full h-full object-cover bg-orange-50" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-base md:text-3xl font-black text-gray-900 tracking-tight leading-none truncate">
                Salut, {userName || 'Utilisateur'} 👋
              </h1>
              {store?.business_type && (
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                  store.business_type === 'food' ? 'bg-yellow-100 text-yellow-700' : 
                  store.business_type === 'stay' ? 'bg-blue-100 text-blue-700' : 
                  'bg-orange-100 text-orange-700'
                }`}>
                  Modèle {store.business_type === 'food' ? 'UberEats' : store.business_type === 'stay' ? 'Airbnb' : 'Amazon'}
                </span>
              )}
            </div>
                {/* Only show vertical filter if store type is not restricted */}
                {!store?.business_type && (
                  <div className="flex items-center gap-2 mt-2 md:mt-4 overflow-x-auto no-scrollbar pb-1">
                      {[
                          { id: 'all', label: 'Global', icon: Package, color: 'gray' },
                          { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: 'orange' },
                          { id: 'food', label: 'Resto', icon: Zap, color: 'yellow' },
                          { id: 'stay', label: 'Séjours', icon: Store, color: 'blue' }
                      ].map(v => (
                          <button
                              key={v.id}
                              onClick={() => setSelectedVertical(v.id as any)}
                              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] md:text-xs font-black transition-all border-2 whitespace-nowrap ${selectedVertical === v.id ? `bg-${v.color}-500 border-${v.color}-500 text-white shadow-lg` : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}
                          >
                              <v.icon size={14} /> {v.label}
                          </button>
                      ))}
                  </div>
                )}
          </div>
        </div>
        
        <div className="md:flex items-center gap-3">
          <div className="hidden md:flex flex-grow md:flex-none items-center justify-between md:justify-start gap-4 bg-white p-1.5 pl-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">État système</span>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[11px] font-black text-gray-700 uppercase">Opérationnel</span>
              </div>
            </div>
            <div className="w-px h-8 bg-gray-100 hidden md:block" />
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl text-[#f56b2a] font-black text-xs">
              <Clock size={14} />
              {mounted ? new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </div>
          </div>
        </div>
      </div>

      <div id="tour-dashboard-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-6 mb-2 md:mb-8">
        <StatCard
          title={store?.business_type === 'stay' ? "Revenus Locatifs" : store?.business_type === 'food' ? "Ventes Resto" : "Ventes effectuées"}
          value={formatCurrency(filteredMetrics.revenue.current)}
          icon={<DollarSign size={14} />}
          trend={filteredMetrics.revenue.trend}
          trendValue={`${filteredMetrics.revenue.pct}%`}
          color="bg-[#f56b2a]"
          compact={true}
        />
        <StatCard
          title={store?.business_type === 'stay' ? "Nuits réservées" : store?.business_type === 'food' ? "Plats servis" : "Commandes"}
          value={store?.business_type === 'stay' ? filteredMetrics.nights.current : filteredMetrics.orders.current}
          icon={store?.business_type === 'stay' ? <Calendar size={14} /> : <ShoppingBag size={14} />}
          trend={store?.business_type === 'stay' ? filteredMetrics.nights.trend : filteredMetrics.orders.trend}
          trendValue={`${store?.business_type === 'stay' ? filteredMetrics.nights.pct : filteredMetrics.orders.pct}%`}
          color="bg-purple-600"
          compact={true}
        />
        <StatCard
          title={store?.business_type === 'stay' ? "Prix / Nuit" : "Panier Moyen"}
          value={formatCurrency(store?.business_type === 'stay' ? filteredMetrics.pricePerNight.current : filteredMetrics.basket.current)}
          icon={<Zap size={14} />}
          trend={store?.business_type === 'stay' ? filteredMetrics.pricePerNight.trend : filteredMetrics.basket.trend}
          trendValue={`${store?.business_type === 'stay' ? filteredMetrics.pricePerNight.pct : filteredMetrics.basket.pct}%`}
          color="bg-blue-600"
          compact={true}
        />
        <StatCard
          title="Trafic Boutique"
          value={filteredMetrics.traffic.current.toLocaleString()}
          icon={<Eye size={14} />}
          trend={filteredMetrics.traffic.trend}
          trendValue={filteredMetrics.traffic.pct}
          color="bg-orange-600"
          compact={true}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-6 pb-8">
        {/* Performance Chart Section */}
        {permissions.canViewReports && (
          <div className="lg:col-span-3 bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm p-2 md:p-6 mb-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-1.5 md:mb-8 gap-2 md:gap-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-1.5 md:p-2.5 bg-orange-50 text-[#f56b2a] rounded-lg md:rounded-xl">
                  <BarChart2 size={18} className="md:w-6 md:h-6" />
                </div>
                <div>
                  <h3 className="text-sm md:text-lg font-black text-gray-900 tracking-tight whitespace-nowrap">Comparaison des Performances</h3>
                  <p className="text-[10px] md:text-xs font-bold text-gray-400 mt-0.5 whitespace-nowrap">Analyse des revenus par période</p>
                </div>
              </div>
 
              <div className="w-full md:w-auto relative">
                {/* Shopify-style Unified Range Button */}
                <button 
                  onClick={() => setShowPicker(showPicker ? null : 'start')}
                  className="w-full md:w-auto flex items-center justify-between gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-2xl shadow-sm hover:border-[#f56b2a]/30 transition-all group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-orange-50 rounded-lg text-[#f56b2a]">
                      <Calendar size={14} className="group-hover:rotate-3 transition-transform" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">Période d'analyse</span>
                      <span className="text-[10px] md:text-xs font-black text-gray-700 whitespace-nowrap">
                        {mounted ? `${new Date(startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — ${new Date(endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Chargement...'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className={`text-gray-300 transition-transform duration-300 ${showPicker ? 'rotate-90' : ''}`} />
                </button>

                {showPicker && (
                  <div className="contents">
                    {/* Backdrop */}
                    <div 
                      className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9998] animate-in fade-in duration-300"
                      onClick={() => setShowPicker(null)}
                    />
                    
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[92%] sm:w-[340px] md:w-[360px] bg-white rounded-[28px] shadow-2xl border border-gray-100 p-6 animate-in fade-in zoom-in-95 duration-300">
                      {/* Shopify-style Presets at the Top */}
                      <div className="flex flex-wrap gap-2 mb-5">
                        {[
                          { label: '7 jours', days: 7 },
                          { label: '30 jours', days: 30 },
                          { label: '90 jours', days: 90 }
                        ].map((preset) => {
                           const start = new Date();
                           start.setDate(start.getDate() - preset.days);
                           const isSelected = startDate === getLocalYMD(start);
                           return (
                            <button 
                              key={preset.label}
                              onClick={(e) => {
                                e.stopPropagation();
                                const end = new Date();
                                setStartDate(getLocalYMD(start));
                                setEndDate(getLocalYMD(end));
                                setShowPicker(null);
                              }}
                              className={`px-3 py-1.5 text-[9px] font-black rounded-full transition-all border ${isSelected ? 'bg-[#f56b2a] border-[#f56b2a] text-white' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
                            >
                              {preset.label}
                            </button>
                           );
                        })}
                      </div>

                      <div className="flex items-center justify-between mb-4 px-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1)); }}
                          className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 transition-all"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="font-black text-[11px] uppercase tracking-wider text-gray-800">
                          {viewDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                        </span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1)); }}
                          className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 transition-all"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-7 gap-y-0.5 gap-x-0 mb-4">
                        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => (
                          <span key={d} className="text-[9px] font-black text-gray-300 text-center mb-2">{d}</span>
                        ))}
                        {Array.from({ length: (firstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) + 6) % 7 }).map((_, i) => (
                          <div key={`empty-${i}`} />
                        ))}
                        {Array.from({ length: daysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => {
                          const d = i + 1;
                          const currentD = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
                          const dateStr = getLocalYMD(currentD);
                          const todayStr = getLocalYMD(new Date());
                          
                          const isStart = dateStr === startDate;
                          const isEnd = dateStr === endDate;
                          const inRange = dateStr > startDate && dateStr < endDate;
                          const isFuture = dateStr > todayStr;
                          
                          return (
                            <button
                              key={d}
                              disabled={isFuture}
                              onClick={(e) => { e.stopPropagation(); handleDateSelect(d); }}
                              className={`text-[10px] font-black h-9 transition-all relative z-10 flex items-center justify-center
                                ${isStart ? 'bg-[#f56b2a] text-white rounded-l-2xl shadow-md z-20' : ''}
                                ${isEnd ? 'bg-[#f56b2a] text-white rounded-r-2xl shadow-md z-20' : ''}
                                ${inRange ? 'bg-orange-50 text-[#f56b2a]' : ''}
                                ${!isStart && !isEnd && !inRange ? 'hover:bg-gray-50 text-gray-600 rounded-xl' : ''}
                                ${isStart && isEnd ? 'rounded-2xl' : ''}
                                ${isFuture ? 'opacity-20 cursor-not-allowed' : ''}
                              `}
                            >
                              {d}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between gap-4 px-1">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black text-gray-400 uppercase">Depuis</span>
                            <span className="text-[10px] font-black text-gray-800">{new Date(startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                          </div>
                          <div className="h-4 w-px bg-gray-100" />
                          <div className="flex flex-col text-right">
                            <span className="text-[8px] font-black text-gray-400 uppercase">Jusqu'au</span>
                            <span className="text-[10px] font-black text-gray-800">{new Date(endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowPicker(null); }}
                          className="w-full py-3 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-[0.97]"
                        >
                           Appliquer les dates
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="h-48 md:h-64 relative pt-6 md:pt-10 pb-4 md:pb-6 px-2 md:px-6">
              {/* Background Grid Lines */}
              <div className="absolute inset-y-10 left-6 right-6 flex flex-col justify-between pointer-events-none pb-6 z-0">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="w-full border-b border-dashed border-gray-100 h-0" />
                ))}
              </div>

              <div key={`${startDate}-${endDate}`} className="relative w-full h-[calc(100%-1.5rem)] z-10 animate-shopify-reveal">
                <svg key={`svg-${startDate}-${endDate}`} viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="shopifyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                    {/* The "Curtain" that opens from left to right */}
                    <clipPath id="chartReveal">
                      <rect x="0" y="0" width="0" height="100">
                        <animate 
                          attributeName="width" 
                          from="0" 
                          to="100" 
                          dur="1.2s" 
                          fill="freeze" 
                          begin="0.1s"
                          calcMode="spline"
                          keySplines="0.4 0 0.2 1"
                          keyTimes="0;1"
                        />
                      </rect>
                    </clipPath>
                  </defs>
                  
                  {/* Fill Area with Shopify-style wipe and rise */}
                  <g clipPath="url(#chartReveal)">
                    <path
                      d={`M ${currentData.map((d, i) => `${i * (100 / (currentData.length - 1))},${100 - d.value}`).join(' L ')} L 100,100 L 0,100 Z`}
                      fill="url(#shopifyGradient)"
                      className="transition-all duration-1000 ease-[cubic-bezier(0.2,0,0,1)]"
                    />
                    
                    {/* The Main Line */}
                    <path
                      d={`M ${currentData.map((d, i) => `${i * (100 / (currentData.length - 1))},${100 - d.value}`).join(' L ')}`}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      vectorEffect="non-scaling-stroke"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all duration-1000 ease-[cubic-bezier(0.2,0,0,1)]"
                    />
                  </g>
                </svg>

                {/* Staggered entry for dots - Shopify style (pop & float) */}
                {currentData.map((item, index) => {
                  const xPos = index * (100 / (currentData.length - 1));
                  const yPos = 100 - item.value;
                  return (
                    <div
                      key={`${startDate}-${endDate}-${item.label}-${index}`}
                      className="absolute group z-20 animate-shopify-dot"
                      style={{ 
                        left: `${xPos}%`, 
                        top: `${yPos}%`, 
                        transform: 'translate(-50%, -50%)',
                        animationDelay: `${index * 80 + 300}ms`
                      }}
                    >
                      <div className="absolute inset-[-20px] bg-transparent cursor-pointer" />
                      
                      {/* Substantial, clean dot */}
                      <div className="relative w-2.5 h-2.5 md:w-3.5 md:h-3.5 rounded-full bg-white border-[3px] border-[#10b981] shadow-sm group-hover:scale-[1.4] group-hover:bg-[#10b981] group-hover:border-white transition-all duration-300 pointer-events-none" />

                      {/* Tooltip - Minimal and centered */}
                      <div className="opacity-0 group-hover:opacity-100 absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg shadow-xl pointer-events-none transition-all duration-300 whitespace-nowrap translate-y-1 group-hover:translate-y-0">
                        {formatCurrency(item.displayValue)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* X Axis Labels */}
              <div key={`labels-${startDate}-${endDate}`} className="absolute bottom-0 left-0 right-0 h-6 translate-y-4">
                {currentData.map((item, index) => {
                  const xPos = index * (100 / (currentData.length - 1));
                  const isFirst = index === 0;
                  const isLast = index === currentData.length - 1;
                  
                  // Mobile optimization: show fewer labels on small screens to prevent overlap
                  const isHiddenOnMobile = !isFirst && !isLast && (index % 2 !== 0);

                  return (
                    <span
                      key={`label-${startDate}-${endDate}-${item.label}-${index}`}
                      className={`absolute text-[8px] md:text-[10px] font-bold text-gray-400 uppercase tracking-tighter md:tracking-widest whitespace-nowrap animate-fade-in
                        ${isHiddenOnMobile ? 'hidden md:block' : ''}
                        ${item.isMajor ? 'text-gray-600' : ''}
                      `}
                      style={{ 
                        left: `${xPos}%`,
                        transform: `translateX(${isFirst ? '0%' : isLast ? '-100%' : '-50%'})`,
                        animationDelay: `${index * 40 + 700}ms`
                      }}
                    >
                      {item.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm p-3 md:p-6">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-sm md:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2 whitespace-nowrap">
              <Eye size={16} className="text-blue-500 md:w-5 md:h-5" /> Plus Visités
            </h3>
            <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Storefront</span>
          </div>
          <div className="space-y-3 md:space-y-4">
            {mostVisited.length > 0 ? mostVisited.map(product => (
              <div 
                key={product.id} 
                className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 p-1.5 md:p-2 -m-1.5 md:-m-2 rounded-xl transition-colors min-w-0"
                onClick={() => router.push(`/product/${product.id}`)}
              >
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl overflow-hidden border border-gray-100 shadow-sm flex-shrink-0">
                    <img src={product.image} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] md:text-xs font-bold text-gray-900 truncate max-w-[100px] md:max-w-[120px]">{product.name}</div>
                    <div className="text-[9px] md:text-[10px] text-gray-400 font-bold whitespace-nowrap">{formatCurrency(product.price)}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] md:text-xs font-black text-blue-600 leading-none">{product.views}</div>
                  <div className="text-[8px] text-gray-300 font-black uppercase leading-tight">Vues</div>
                </div>
              </div>
            )) : (
              <div className="py-6 text-center text-gray-300 text-[10px] md:text-xs font-bold whitespace-nowrap">Aucune visite enregistrée</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm p-3 md:p-6">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-sm md:text-lg font-black text-gray-900 tracking-tight flex items-center gap-2 whitespace-nowrap">
              <Flame size={16} className="text-orange-500 md:w-5 md:h-5" /> Meilleures Ventes
            </h3>
            <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Volume</span>
          </div>
          <div className="space-y-3 md:space-y-4">
            {topSelling.length > 0 ? topSelling.map(product => (
              <div 
                key={product.id} 
                className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 p-1.5 md:p-2 -m-1.5 md:-m-2 rounded-xl transition-colors min-w-0"
                onClick={() => router.push(`/product/${product.id}`)}
              >
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl overflow-hidden border border-gray-100 shadow-sm flex-shrink-0">
                    <img src={product.image} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] md:text-xs font-bold text-gray-900 truncate max-w-[100px] md:max-w-[120px]">{product.name}</div>
                    <div className="text-[9px] md:text-[10px] font-bold text-gray-400 whitespace-nowrap">{product.category}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] md:text-xs font-black text-orange-600 leading-none">x{product.salesCount}</div>
                  <div className="text-[8px] text-gray-300 font-black uppercase leading-tight">Vendus</div>
                </div>
              </div>
            )) : (
              <div className="py-6 text-center text-gray-300 text-[10px] md:text-xs font-bold whitespace-nowrap">Aucune vente enregistrée</div>
            )}
          </div>
        </div>
        <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm p-3 md:p-6">
          <h3 className="text-sm md:text-lg font-black text-gray-900 tracking-tight mb-4 md:mb-6 whitespace-nowrap">Alertes Stock</h3>
          <div className="space-y-3 md:space-y-5">
            {products.filter(p => p.stock < 15).slice(0, 6).map(product => (
              <div key={product.id} className="flex items-center gap-3 md:gap-4 min-w-0">
                <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl overflow-hidden flex-shrink-0 border border-gray-100 shadow-sm">
                  <img src={product.image} className="w-full h-full object-cover" />
                </div>
                <div className="flex-grow min-w-0">
                  <div className="text-[10px] md:text-xs font-bold text-gray-900 truncate">{product.name}</div>
                  <div className="flex items-center gap-2 mt-1 md:mt-1.5">
                    <div className="flex-grow bg-gray-100 h-1 md:h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${product.stock < 5 ? 'bg-red-500' : 'bg-orange-500'}`}
                        style={{ width: `${Math.min(100, (product.stock / 20) * 100)}%` }}
                      />
                    </div>
                    <span className={`text-[9px] md:text-[10px] font-black whitespace-nowrap ${product.stock < 5 ? 'text-red-500' : 'text-orange-500'}`}>{product.stock}</span>
                  </div>
                </div>
              </div>
            ))}
            {products.filter(p => p.stock < 15).length === 0 && (
              <div className="py-6 md:py-10 text-center text-gray-400 text-[10px] md:text-sm font-medium whitespace-nowrap">
                Tous les stocks sont corrects
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;

