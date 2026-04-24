'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect, lazy, Suspense } from 'react';
import { supabase } from '@/supabase';
import { useRouter } from '@/components/RouterPolyfill';
import { createOrderAction } from '@/app/actions/orders';
import {
  Search,
  Plus,
  Trash2,
  Receipt,
  CreditCard,
  Banknote,
  LayoutGrid,
  Download,
  Printer,
  X,
  CheckCircle2,
  User,
  ShoppingBasket,
  Clock,
  ArrowRight,
  Tag
} from 'lucide-react';
import { playSuccessSound } from '@/utils';
import { formatCurrency } from '@/utils';
import ProductCard from '../components/ProductCard';
import CartItem from '../components/CartItem';
import { Product, CartItem as ICartItem, Customer, PaymentMethod, Order, StoreSettings, StaffPermissions, NotificationType, Coupon } from '@/types';
import Loader from '../components/Loader';

interface POSViewProps {
  products: Product[];
  customers: Customer[];
  currentStoreId?: string;
  storeSettings: StoreSettings;
  permissions: StaffPermissions;
  notify?: (message: string, type: NotificationType, title?: string) => void;
  businessType?: string;
}

const POSView: React.FC<POSViewProps> = ({ products, customers, currentStoreId, storeSettings, permissions, notify, businessType }) => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<ICartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showCartOnMobile, setShowCartOnMobile] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState('');
  const [orderType, setOrderType] = useState<'IN_STORE' | 'PICKUP'>('IN_STORE');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Promo and Gift Card code
  const [promoApplied, setPromoApplied] = useState<{ code: string, discountPct: number } | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load coupons from Supabase
  useEffect(() => {
    const loadCoupons = async () => {
      try {
        const { data } = await supabase
          .from('coupons')
          .select('*')
          .eq('active', true)
          .eq('store_id', currentStoreId);
        if (data) setCoupons(data);
      } catch (e) {
        console.log('Coupons table not available');
      }
    };
    if (currentStoreId) loadCoupons();
  }, [currentStoreId]);

  const receiptRef = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.mainCategory) cats.add(p.mainCategory);
      else if (p.category) cats.add(p.category);
    });
    return ['all', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.category || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory || p.mainCategory === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory, products]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return [];
    return customers.filter(c =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch)
    );
  }, [customerSearch, customers]);

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(item => item.product.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    if (confirm('Êtes-vous sûr de vouloir vider le panier ?')) {
      setCart([]);
      setSelectedCustomer(null);
      setPromoApplied(null);
    }
  }, []);

    const totals = useMemo(() => {
    const baseSubtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const discountAmount = promoApplied ? baseSubtotal * (promoApplied.discountPct / 100) : 0;
    const subtotal = baseSubtotal - discountAmount;

    const total = subtotal;

    return { baseSubtotal, discountAmount, subtotal, total };
  }, [cart, promoApplied]);

  const handlePromoApply = (code: string) => {
    const normalizedCode = code.trim().toUpperCase();
    
    // Find matching active coupon from state (loaded from Supabase)
    const matchedCoupon = coupons.find(c => c.code === normalizedCode && c.active);
    
    if (matchedCoupon) {
      setPromoApplied({ code: matchedCoupon.code, discountPct: matchedCoupon.discount_pct });
      if (notify) notify(`Code promo "${matchedCoupon.code}" appliqué: ${matchedCoupon.discount_pct}% de réduction!`, 'success');
    } else {
      if (notify) notify('Code non valide ou expiré.', 'error');
    }
  };

  const handleCheckout = () => {
    const newOrderId = 'CMD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    setCurrentOrderId(newOrderId);

    setIsProcessing(true);
    setTimeout(async () => {
      try {
        const order: Order = {
          id: '', // Will be generated by server
          date: new Date().toISOString(),
          items: [...cart],
          subtotal: totals.subtotal,
          total: totals.total,
          discountAmount: totals.discountAmount,
          promoCode: promoApplied ? promoApplied.code : undefined,
          paymentMethod,
          customer: selectedCustomer || undefined,
          type: orderType,
          status: orderType === 'PICKUP' ? 'PENDING' : 'COMPLETED'
        };

        const result = await createOrderAction(order, currentStoreId!);
        if (!result.success) throw new Error(result.error);
        
        // Update with the real ID from DB
        if (result.order?.id) {
          setCurrentOrderId(result.order.id);
        }
        
        playSuccessSound();
        setShowCheckoutModal(true);
        router.refresh();
      } catch (err: any) {
        console.error(err);
        if (notify) notify(err.message || "Erreur lors de l'enregistrement du paiement", 'error');
      } finally {
        setIsProcessing(false);
      }
    }, 600); // Small delay for UX "feel"
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = storeSettings.name;
    window.print();
    document.title = originalTitle;
  };

  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;
    
    // Lazy load heavy libraries only when needed
    const [html2canvasModule, jspdfModule] = await Promise.all([
      import('html2canvas'),
      import('jspdf')
    ]);
    const html2canvas = html2canvasModule.default || html2canvasModule;
    const { jsPDF } = jspdfModule;
    
    const canvas = await html2canvas(receiptRef.current, { 
      scale: 2, 
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });
    const imgData = canvas.toDataURL('image/png');
    
    const imgProps = {
      width: canvas.width,
      height: canvas.height
    };
    const pdfWidth = 80;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfWidth, pdfHeight] });
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Recu-${currentOrderId}.pdf`);
  };

  const closeCheckout = () => {
    setShowCheckoutModal(false);
    setCart([]);
    setSelectedCustomer(null);
    setShowCartOnMobile(false);
    setPromoApplied(null);
    setOrderType('IN_STORE');
  };

  return (
    <div className="flex flex-grow overflow-hidden h-full relative">
      {/* Left Side: Product Grid */}
      <div className={`flex-grow flex flex-col p-3 md:p-4 overflow-hidden border-r border-gray-200 bg-white/50 ${showCartOnMobile ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center gap-2 md:gap-4 mb-3 md:mb-6">
          <div className="flex-grow relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search size={14} className="md:w-4 md:h-4" />
            </div>
            <input
              id="tour-pos-search"
              type="text"
              value={searchTerm}
              placeholder="Rechercher..."
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 md:py-2 bg-white border border-gray-200 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f56b2a] shadow-sm text-xs md:text-sm"
            />
          </div>
          <button className="p-1.5 md:p-2 bg-white border border-gray-200 rounded-lg md:rounded-xl hover:bg-gray-50 transition-colors shadow-sm text-gray-500">
            <LayoutGrid size={18} className="md:w-5 md:h-5" />
          </button>
        </div>

        {/* Categories Selector */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all border-2 active:scale-95 whitespace-nowrap ${
                selectedCategory === cat
                ? 'bg-[#f56b2a] border-[#f56b2a] text-white shadow-md shadow-orange-100'
                : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
              }`}
            >
              {cat === 'all' ? 'Tout voir' : cat}
            </button>
          ))}
        </div>

        <div className="flex-grow overflow-y-auto pr-2 pb-20 md:pb-8 custom-scrollbar">
          <div id="tour-pos-products" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-2 md:gap-3">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} onAddToCart={() => addToCart(product)} />
            ))}
          </div>
        </div>
      </div>

      {/* Right Side: Cart */}
      <div id="tour-pos-cart" className={`
        ${showCartOnMobile ? 'flex fixed inset-0 z-[60] bg-white' : 'hidden'}
        md:flex md:relative md:w-[380px] lg:w-[420px] flex-shrink-0 bg-white shadow-xl flex flex-col h-full overflow-hidden border-l border-gray-200
      `}>
        <div className="p-3 md:p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCartOnMobile(false)}
              className="md:hidden p-1.5 -ml-1 text-gray-500"
            >
              <X size={18} />
            </button>
            <div className="bg-[#f56b2a] p-1.5 rounded-lg text-white"><Receipt size={16} className="md:w-[18px] md:h-[18px]" /></div>
            <h2 className="text-base md:text-lg font-bold text-gray-800 whitespace-nowrap">Panier</h2>
          </div>
          <button onClick={clearCart} className="text-gray-400 hover:text-red-500 p-1.5 md:p-2 hover:bg-red-50 rounded-full transition-colors">
            <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
          </button>
        </div>
 
        <div className="flex-grow overflow-y-auto px-3 md:px-4 custom-scrollbar">
          <div className="py-4 border-b border-gray-100">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Client</label>
            {!selectedCustomer ? (
              <div className="relative mb-2">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-3 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#f56b2a] focus:outline-none"
                />
                <Search size={14} className="absolute right-3 top-3 text-gray-400" />
                {filteredCustomers.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-white border border-gray-200 rounded-xl shadow-xl z-50 mt-1 max-h-40 overflow-y-auto">
                    {filteredCustomers.map(c => (
                      <div key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }} className="p-3 hover:bg-orange-50 cursor-pointer text-sm border-b border-gray-50 last:border-0">
                        <div className="font-bold text-gray-800">{c.name}</div>
                        <div className="text-[10px] text-gray-500">{c.phone}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 rounded-xl mb-2">
                <div className="flex items-center gap-3">
                  <div className="bg-[#f56b2a] w-8 h-8 rounded-full text-white flex items-center justify-center"><User size={16} /></div>
                  <div>
                    <div className="text-sm font-bold text-[#7a2f0a]">{selectedCustomer.name}</div>
                    <div className="text-[10px] text-[#f56b2a]">{selectedCustomer.phone}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="p-1 hover:bg-orange-100 rounded-full transition-colors">
                  <X size={16} className="text-[#ff8c52] hover:text-[#f56b2a]" />
                </button>
              </div>
            )}
          </div>

          <div className="py-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Articles</h3>
              <span className="bg-orange-100 text-[#d55a20] text-[10px] font-bold px-2 py-0.5 rounded-full">{cart.length}</span>
            </div>
            {cart.length === 0 ? (
              <div className="py-12 text-center">
                <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                  <ShoppingBasket size={32} />
                </div>
                <p className="text-gray-400 text-sm">Votre panier est vide</p>
              </div>
            ) : (
              <div className="space-y-1">
                {cart.map(item => (
                  <CartItem 
                    key={item.product.id} 
                    item={item} 
                    onUpdateQuantity={updateQuantity}
                    onRemove={() => removeFromCart(item.product.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <>
              <div className="py-2.5 space-y-2">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type de Commande</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'IN_STORE', label: 'En Magasin', icon: <ShoppingBasket size={14} /> },
                    { id: 'PICKUP', label: 'Click & Collect', icon: <Clock size={14} /> }
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setOrderType(type.id as any)}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border transition-all ${orderType === type.id
                        ? 'bg-[#f56b2a] border-[#f56b2a] text-white shadow-lg shadow-orange-200'
                        : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'
                        }`}
                    >
                      <div className={orderType === type.id ? 'text-white' : 'text-gray-400'}>{type.icon}</div>
                      <div className="text-xs font-bold">{type.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="py-2.5 space-y-2">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mode de Paiement</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: PaymentMethod.CASH, label: 'Espèces', icon: <Banknote size={14} /> },
                    { id: PaymentMethod.CARD, label: 'Carte', icon: <CreditCard size={14} /> }
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border transition-all ${paymentMethod === pm.id
                        ? 'bg-[#f56b2a] border-[#f56b2a] text-white shadow-lg shadow-orange-200'
                        : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'
                        }`}
                    >
                      <div className={paymentMethod === pm.id ? 'text-white' : 'text-gray-400'}>{pm.icon}</div>
                      <div className="text-xs font-bold">{pm.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 md:p-6 bg-white border-t border-gray-100 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
 
          {cart.length > 0 && !promoApplied && (
            <div className="flex gap-2 mb-3 md:mb-4 border-b border-gray-100 pb-3 md:pb-4">
              <input
                type="text"
                placeholder="Code promo..."
                className="flex-grow bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-bold focus:outline-none focus:border-[#f56b2a]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePromoApply(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>
          )}
 
          <div className="space-y-1.5 md:space-y-2 mb-4 md:mb-6">
            <div className="flex justify-between text-[11px] md:text-sm">
              <span className="text-gray-400 font-medium">Sous-total</span>
              <span className="font-semibold text-gray-700">{formatCurrency(totals.baseSubtotal || 0)}</span>
            </div>
            {promoApplied && (
              <div className="flex justify-between text-[11px] md:text-sm text-green-500 font-bold">
                <span>Remise ({promoApplied.code})</span>
                <span>-{formatCurrency(totals.discountAmount || 0)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1.5 md:pt-2 border-t border-gray-50">
              <span className="text-gray-900 font-bold text-sm md:text-lg">Total</span>
              <span className="text-lg md:text-2xl font-black text-[#f56b2a]">{formatCurrency(totals.total)}</span>
            </div>
          </div>
          {permissions.canManageOrders ? (
            <button
              id="tour-pos-checkout"
              onClick={handleCheckout}
              disabled={cart.length === 0 || isProcessing}
              className="w-full bg-[#f56b2a] text-white font-bold text-base md:text-lg py-3 md:py-4 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 md:gap-3 hover:bg-[#d55a20] disabled:bg-gray-200 shadow-xl shadow-orange-100 transition-all active:scale-[0.98]"
            >
              {isProcessing ? (
                <Loader color="text-white" size="sm" />
              ) : (
                <CreditCard size={18} className="md:w-[22px] md:h-[22px]" />
              )}
              {isProcessing ? 'Envoi...' : (businessType === 'stay' ? 'Réserver' : 'Encaisser')}
            </button>
          ) : (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold text-center border border-red-100 flex items-center justify-center gap-2">
              <X size={14} /> Permission insuffisante
            </div>
          )}
        </div>
      </div>

      {/* Mobile Floating Cart Button - Legacy Look */}
      {cart.length > 0 && !showCartOnMobile && (
        <button
          onClick={() => setShowCartOnMobile(true)}
          className="md:hidden fixed bottom-20 right-4 z-40 bg-[#f56b2a] text-white p-3 rounded-full shadow-2xl flex items-center gap-2 animate-bounce"
        >
          <div className="relative">
            <ShoppingBasket size={18} />
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#f56b2a]">
              {cart.length}
            </span>
          </div>
          <span className="font-black text-sm pr-1">{formatCurrency(totals.total)}</span>
        </button>
      )}

      {/* Checkout Success Modal - Legacy Look */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 text-center border-b border-gray-100">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={32} /></div>
              <h2 className="text-2xl font-bold text-gray-800">Succès !</h2>
              <p className="text-gray-500 text-sm">Commande {currentOrderId.slice(-8).toUpperCase()} validée.</p>
            </div>
            <div className="flex-grow overflow-y-auto p-6 bg-gray-50">
              <div ref={receiptRef} id="receipt-print" className="print-only bg-white p-6 shadow-sm border border-gray-200 mx-auto w-[80mm] text-[10pt] font-mono">
                <div className="text-center mb-4 border-b border-dashed border-gray-300 pb-4">
                  <h1 className="text-xl font-black uppercase tracking-tighter text-gray-900">{storeSettings.name}</h1>
                  <p className="text-[8pt] text-gray-600 mt-1">{storeSettings.address}</p>
                  <p className="text-[8pt] text-gray-500 font-mono mt-0.5">{storeSettings.phone} • {storeSettings.email}</p>
                </div>
                <div className="border-b border-dashed border-gray-300 pb-2 mb-2 space-y-1">
                  <div className="flex justify-between"><span>DATE:</span><span>{new Date().toLocaleDateString('fr-FR')}</span></div>
                  <div className="flex justify-between"><span>CMD:</span><span>{currentOrderId.slice(-8).toUpperCase()}</span></div>
                  <div className="flex justify-between"><span>TYPE:</span><span>{orderType === 'PICKUP' ? 'CLICK & COLLECT' : 'EN MAGASIN'}</span></div>
                </div>
                <table className="w-full text-left">
                  <tbody>
                    {cart.map(item => (
                      <tr key={item.product.id}>
                        <td className="py-1">{item.product.name}</td>
                        <td className="py-1 text-center">x{item.quantity}{item.product.unit && item.product.unit !== 'pièce' ? ` ${item.product.unit}` : ''}</td>
                        <td className="py-1 text-right">{formatCurrency(item.product.price * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 pt-2 border-t border-dashed border-gray-300 font-bold space-y-1">
                  <div className="flex justify-between text-xs text-gray-600"><span>SOUS-TOTAL:</span><span>{formatCurrency(totals.baseSubtotal || 0)}</span></div>
                  {promoApplied && (
                    <div className="flex justify-between text-[10px] text-gray-500"><span>Code Promo ({promoApplied.code}):</span><span>-{formatCurrency(totals.discountAmount || 0)}</span></div>
                  )}
                  <div className="flex justify-between text-lg pt-2 border-t border-gray-200"><span>TOTAL:</span><span>{formatCurrency(totals.total)}</span></div>
                </div>
                <div className="mt-4 text-center text-[8pt]">MERCI DE VOTRE VISITE !</div>
              </div>
            </div>
            <div className="p-6 flex flex-col gap-3 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handlePrint} className="flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl font-bold"><Printer size={18} /> Imprimer</button>
                <button onClick={handleDownloadPDF} className="flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl font-bold"><Download size={18} /> PDF</button>
              </div>
              <button onClick={closeCheckout} className="w-full py-4 bg-[#f56b2a] text-white font-bold rounded-xl">
                {businessType === 'stay' ? 'Nouvelle Réservation' : 'Nouvelle Vente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSView;
