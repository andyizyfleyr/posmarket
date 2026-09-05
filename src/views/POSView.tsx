'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/supabase';
import { useRouter } from '@/components/RouterPolyfill';
import { createOrderAction } from '@/app/actions/orders';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  CreditCard,
  Banknote,
  Download,
  Printer,
  X,
  CheckCircle2,
  User,
  ShoppingBasket,
  Clock,
  ArrowRight,
  ChevronDown,
  Store,
  AlertTriangle,
  Package,
  Sparkles,
} from 'lucide-react';
import { playSuccessSound, formatCurrency } from '@/utils';
import { getEffectiveWholesaleUnitPrice, getNormalizedWholesaleTiers } from '@/utils/wholesale';
import { printPosReceipt, downloadPosReceiptPdf, ReceiptData } from '@/utils/receipt';
import ProductImage from '../components/ProductImage';
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

/* ─── POS Product Card (inline, compact, no links) ─── */
const POSProductCard = React.memo(({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (p: Product) => void;
}) => {
  const [tapped, setTapped] = useState(false);
  const isOutOfStock = (product as any).stock === 0;
  const isLowStock = typeof (product as any).stock === 'number' && (product as any).stock > 0 && (product as any).stock <= 5;

  const handleTap = useCallback(() => {
    if (isOutOfStock) return;
    onAdd(product);
    setTapped(true);
    setTimeout(() => setTapped(false), 300);
  }, [product, onAdd, isOutOfStock]);

  return (
    <button
      type="button"
      onClick={handleTap}
      disabled={isOutOfStock}
      className={`relative flex flex-col bg-white rounded-2xl border overflow-hidden text-left transition-all duration-150 active:scale-[0.96] focus:outline-none
        ${tapped ? 'border-[#f56b2a] ring-2 ring-[#f56b2a]/20 shadow-lg shadow-orange-100' : 'border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200'}
        ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-gray-50">
        <ProductImage
          src={product.image}
          alt={product.name}
          containerClassName="w-full h-full"
          objectFit="cover"
          showZoomEffect={false}
        />
        {/* Tap feedback overlay */}
        <div className={`absolute inset-0 bg-[#f56b2a]/10 transition-opacity duration-200 pointer-events-none ${tapped ? 'opacity-100' : 'opacity-0'}`} />
        {/* Add icon overlay */}
        <div className={`absolute bottom-1.5 right-1.5 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg
          ${tapped ? 'bg-[#f56b2a] text-white scale-110' : 'bg-white/90 backdrop-blur-sm text-gray-600 border border-gray-100'}
          ${isOutOfStock ? 'hidden' : ''}
        `}>
          <Plus size={14} strokeWidth={3} />
        </div>
        {/* Low stock badge */}
        {isLowStock && (
          <div className="absolute top-1.5 left-1.5 bg-amber-500 text-white px-1.5 py-0.5 rounded-md text-[7px] md:text-[8px] font-black uppercase flex items-center gap-0.5 shadow-md">
            <AlertTriangle size={8} /> {(product as any).stock} restant{(product as any).stock > 1 ? 's' : ''}
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
            <span className="bg-gray-900/80 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider">Rupture</span>
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-1.5 md:p-2 flex-1 flex flex-col justify-between min-h-0">
        <h4 className="text-[9px] md:text-[11px] font-bold text-gray-800 leading-tight line-clamp-1 mb-0.5">{product.name}</h4>
        <span className="text-[11px] md:text-sm font-black text-gray-900">{formatCurrency(product.price)}</span>
      </div>
    </button>
  );
});
POSProductCard.displayName = 'POSProductCard';

/* ─── POS Cart Item (compact) ─── */
const POSCartItem = React.memo(({
  item,
  onUpdate,
  onRemove,
}: {
  item: ICartItem;
  onUpdate: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
}) => {
  const unitPrice = getEffectiveWholesaleUnitPrice(item.product, item.quantity);
  const isWholesale = unitPrice < item.product.price;

  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-gray-50 last:border-0 group">
      <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100 bg-gray-50">
        <ProductImage
          src={item.product.image}
          alt={item.product.name}
          containerClassName="w-full h-full"
          objectFit="cover"
          showZoomEffect={false}
        />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-[11px] md:text-xs font-bold text-gray-800 truncate leading-tight">{item.product.name}</h4>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-[10px] ${isWholesale ? 'text-[#f56b2a] font-bold' : 'text-gray-400 font-semibold'}`}>
            {formatCurrency(unitPrice)}
          </span>
          {isWholesale && (
            <span className="text-[7.5px] bg-orange-100 text-[#f56b2a] font-black px-1 rounded uppercase">Gros</span>
          )}
          <span className="text-[10px] text-gray-300">×</span>
          <span className="text-[10px] font-bold text-gray-600">{item.quantity}</span>
        </div>
      </div>
      {/* Qty controls */}
      <div className="flex items-center gap-0.5 bg-gray-50 rounded-lg p-0.5 border border-gray-100">
        <button
          onClick={() => onUpdate(item.product.id, -1)}
          className="w-6 h-6 flex items-center justify-center rounded-md bg-white text-gray-500 shadow-sm active:scale-90 transition-transform hover:text-gray-800"
        >
          <Minus size={10} strokeWidth={2.5} />
        </button>
        <span className="px-1.5 text-[11px] font-black text-gray-800 min-w-[1.2rem] text-center tabular-nums">{item.quantity}</span>
        <button
          onClick={() => onUpdate(item.product.id, 1)}
          className="w-6 h-6 flex items-center justify-center rounded-md bg-white text-gray-500 shadow-sm active:scale-90 transition-transform hover:text-gray-800"
        >
          <Plus size={10} strokeWidth={2.5} />
        </button>
      </div>
      {/* Total + remove */}
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className="text-xs font-black text-gray-900 tabular-nums">{formatCurrency(unitPrice * item.quantity)}</span>
        <button
          onClick={() => onRemove(item.product.id)}
          className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
          title="Supprimer"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
});
POSCartItem.displayName = 'POSCartItem';

/* ─── MAIN POS VIEW ─── */
const POSView: React.FC<POSViewProps> = ({ products, customers, currentStoreId, storeSettings, permissions, notify, businessType }) => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<ICartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showCartSheet, setShowCartSheet] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState('');
  const [orderType, setOrderType] = useState<'IN_STORE' | 'PICKUP'>('IN_STORE');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [promoApplied, setPromoApplied] = useState<{ code: string, discountPct: number } | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [liveTime, setLiveTime] = useState('');
  const [promoInput, setPromoInput] = useState('');

  // Live clock
  useEffect(() => {
    const tick = () => setLiveTime(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // Load coupons
  useEffect(() => {
    const loadCoupons = async () => {
      try {
        const { data } = await supabase
          .from('coupons')
          .select('*')
          .eq('active', true)
          .eq('store_id', currentStoreId);
        if (data) setCoupons(data as unknown as Coupon[]);
      } catch (e) {
        console.log('Coupons table not available');
      }
    };
    if (currentStoreId) loadCoupons();
  }, [currentStoreId]);

  const categoriesRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Horizontal scroll on categories
  useEffect(() => {
    const el = categoriesRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0 && el.scrollWidth > el.clientWidth) {
        const canScrollLeft = el.scrollLeft > 0;
        const canScrollRight = el.scrollLeft < el.scrollWidth - el.clientWidth;
        if ((e.deltaY > 0 && canScrollRight) || (e.deltaY < 0 && canScrollLeft)) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  /* ─── Data ─── */
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.mainCategory?.trim()) cats.add(p.mainCategory.trim());
      else if (p.category?.trim()) cats.add(p.category.trim());
    });
    return ['all', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.category || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' ||
        (p.category?.trim() === selectedCategory) ||
        (p.mainCategory?.trim() === selectedCategory);
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

  /* ─── Cart logic ─── */
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
    setCart([]);
    setSelectedCustomer(null);
    setPromoApplied(null);
  }, []);

  const totals = useMemo(() => {
    const baseSubtotal = cart.reduce((sum, item) => sum + (getEffectiveWholesaleUnitPrice(item.product, item.quantity) * item.quantity), 0);
    const discountAmount = promoApplied ? baseSubtotal * (promoApplied.discountPct / 100) : 0;
    const subtotal = baseSubtotal - discountAmount;
    const total = subtotal;
    return { baseSubtotal, discountAmount, subtotal, total };
  }, [cart, promoApplied]);

  const totalItems = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);

  const handlePromoApply = (code: string) => {
    const normalizedCode = code.trim().toUpperCase();
    const matchedCoupon = coupons.find(c => c.code === normalizedCode && c.active);
    if (matchedCoupon) {
      setPromoApplied({ code: matchedCoupon.code, discountPct: matchedCoupon.discount_pct });
      setPromoInput('');
      if (notify) notify(`Code promo "${matchedCoupon.code}" appliqué: ${matchedCoupon.discount_pct}% de réduction!`, 'success');
    } else {
      if (notify) notify('Code non valide ou expiré.', 'error');
    }
  };

  /* ─── Checkout ─── */
  const handleCheckout = () => {
    const newOrderId = 'CMD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    setCurrentOrderId(newOrderId);
    setIsProcessing(true);
    setTimeout(async () => {
      try {
        const order: Order = {
          id: '',
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
        if (result.order?.id) setCurrentOrderId(result.order.id);
        playSuccessSound();
        setShowCheckoutModal(true);
        setShowCartSheet(false);
        router.refresh();
      } catch (err: unknown) {
        console.error(err);
        if (notify) notify(err instanceof Error ? err.message : "Erreur lors de l'enregistrement du paiement", 'error');
      } finally {
        setIsProcessing(false);
      }
    }, 600);
  };

  const getReceiptData = useCallback((): ReceiptData => {
    return {
      orderId: currentOrderId ? currentOrderId.slice(-8).toUpperCase() : 'CMD',
      date: new Date().toLocaleDateString('fr-FR'),
      storeName: storeSettings?.name || 'Point de Vente',
      storeAddress: storeSettings?.address || undefined,
      storePhone: storeSettings?.phone || undefined,
      storeEmail: storeSettings?.email || undefined,
      orderType,
      paymentMethod: paymentMethod === PaymentMethod.CASH ? 'Espèces' : 'Carte',
      customerName: selectedCustomer ? selectedCustomer.name : undefined,
      items: cart.map(item => {
        const unitPrice = getEffectiveWholesaleUnitPrice(item.product, item.quantity);
        return {
          name: item.product.name,
          quantity: item.quantity,
          unit: item.product.unit,
          unitPrice,
          total: unitPrice * item.quantity
        };
      }),
      subtotal: totals.baseSubtotal,
      discount: promoApplied ? {
        code: promoApplied.code,
        amount: totals.discountAmount
      } : undefined,
      total: totals.total
    };
  }, [currentOrderId, storeSettings, orderType, paymentMethod, selectedCustomer, cart, totals, promoApplied]);

  const handlePrint = useCallback(() => {
    try {
      const data = getReceiptData();
      printPosReceipt(data);
      if (notify) notify("Impression du reçu lancée", 'info');
    } catch (err) {
      console.error('Print error:', err);
      if (notify) notify("Erreur lors de l'impression du reçu", 'error');
    }
  }, [getReceiptData, notify]);

  const handleDownloadPDF = useCallback(async () => {
    if (isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      const data = getReceiptData();
      await downloadPosReceiptPdf(data);
      if (notify) notify('Reçu PDF téléchargé avec succès !', 'success');
    } catch (err) {
      console.error('PDF error:', err);
      if (notify) notify('Erreur lors du téléchargement du PDF', 'error');
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [isDownloadingPdf, getReceiptData, notify]);

  const closeCheckout = () => {
    setShowCheckoutModal(false);
    setCart([]);
    setSelectedCustomer(null);
    setShowCartSheet(false);
    setPromoApplied(null);
    setOrderType('IN_STORE');
  };

  /* ─── Cart Panel Content (shared between desktop sidebar & mobile bottom sheet) ─── */
  const CartContent = () => (
    <>
      {/* Cart header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowCartSheet(false)}
            className="md:hidden p-1 -ml-1 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ChevronDown size={20} />
          </button>
          <div className="bg-gradient-to-br from-[#f56b2a] to-[#e04e0f] p-1.5 rounded-xl text-white shadow-md shadow-orange-200/50">
            <Receipt size={16} />
          </div>
          <div>
            <h2 className="text-sm font-black text-gray-900 leading-none">Panier</h2>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{totalItems} article{totalItems > 1 ? 's' : ''}</span>
          </div>
        </div>
        {cart.length > 0 && (
          <button
            onClick={clearCart}
            className="text-[9px] font-bold text-gray-400 hover:text-red-500 px-2 py-1 hover:bg-red-50 rounded-lg transition-all uppercase tracking-wider"
          >
            Vider
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
        {/* Customer section */}
        <div className="py-3 border-b border-gray-50">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Client</label>
          {!selectedCustomer ? (
            <div className="relative">
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#f56b2a]/20 focus:border-[#f56b2a]/30 focus:outline-none transition-all"
                placeholder="Nom ou téléphone..."
              />
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
              {filteredCustomers.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-white border border-gray-100 rounded-xl shadow-2xl z-50 mt-1 max-h-36 overflow-y-auto">
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                      className="w-full p-2.5 hover:bg-orange-50 text-left text-xs border-b border-gray-50 last:border-0 transition-colors"
                    >
                      <div className="font-bold text-gray-800">{c.name}</div>
                      <div className="text-[10px] text-gray-400">{c.phone}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-2 bg-orange-50/60 border border-orange-100/50 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="bg-gradient-to-br from-[#f56b2a] to-[#e04e0f] w-7 h-7 rounded-lg text-white flex items-center justify-center text-[10px] font-black shadow-sm">
                  {selectedCustomer.name[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-[11px] font-bold text-gray-800">{selectedCustomer.name}</div>
                  <div className="text-[9px] text-[#f56b2a] font-semibold">{selectedCustomer.phone}</div>
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="p-1 hover:bg-orange-100 rounded-lg transition-colors">
                <X size={14} className="text-orange-400" />
              </button>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="py-2">
          {cart.length === 0 ? (
            <div className="py-10 text-center">
              <div className="bg-gray-50 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-200">
                <ShoppingBasket size={28} />
              </div>
              <p className="text-gray-300 text-xs font-bold">Panier vide</p>
              <p className="text-gray-200 text-[10px] mt-1">Appuyez sur un produit pour l&apos;ajouter</p>
            </div>
          ) : (
            <div>
              {cart.map(item => (
                <POSCartItem
                  key={item.product.id}
                  item={item}
                  onUpdate={updateQuantity}
                  onRemove={removeFromCart}
                />
              ))}
            </div>
          )}
        </div>

        {/* Order type & payment (compact, side by side) */}
        {cart.length > 0 && (
          <div className="pb-3 space-y-2.5">
            {/* Order type */}
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Commande</label>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { id: 'IN_STORE' as const, label: 'Magasin', icon: <Store size={13} /> },
                  { id: 'PICKUP' as const, label: 'Click & Collect', icon: <Clock size={13} /> }
                ]).map(t => (
                  <button
                    key={t.id}
                    onClick={() => setOrderType(t.id)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black transition-all border active:scale-95
                      ${orderType === t.id
                        ? 'bg-[#f56b2a] border-[#f56b2a] text-white shadow-md shadow-orange-200/50'
                        : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
                      }`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Payment */}
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Paiement</label>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { id: PaymentMethod.CASH, label: 'Espèces', icon: <Banknote size={13} /> },
                  { id: PaymentMethod.CARD, label: 'Carte', icon: <CreditCard size={13} /> }
                ]).map(pm => (
                  <button
                    key={pm.id}
                    onClick={() => setPaymentMethod(pm.id)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black transition-all border active:scale-95
                      ${paymentMethod === pm.id
                        ? 'bg-[#f56b2a] border-[#f56b2a] text-white shadow-md shadow-orange-200/50'
                        : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
                      }`}
                  >
                    {pm.icon} {pm.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Promo */}
            {!promoApplied && (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  placeholder="Code promo..."
                  className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5 text-[10px] font-bold focus:outline-none focus:border-[#f56b2a]/30 focus:ring-2 focus:ring-[#f56b2a]/10 transition-all"
                  onKeyDown={(e) => { if (e.key === 'Enter' && promoInput) handlePromoApply(promoInput); }}
                />
                <button
                  onClick={() => promoInput && handlePromoApply(promoInput)}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-black text-gray-500 hover:bg-gray-100 transition-all active:scale-95"
                >
                  OK
                </button>
              </div>
            )}
            {promoApplied && (
              <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-3 py-1.5">
                <span className="text-[10px] font-bold text-green-700">✓ {promoApplied.code} (−{promoApplied.discountPct}%)</span>
                <button onClick={() => setPromoApplied(null)} className="text-green-400 hover:text-red-500 transition-colors"><X size={12} /></button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Totals & checkout button - sticky bottom */}
      <div className="px-4 py-3 md:py-4 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        {cart.length > 0 && (
          <>
            <div className="space-y-1 mb-3">
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-400 font-medium">Sous-total</span>
                <span className="font-bold text-gray-600 tabular-nums">{formatCurrency(totals.baseSubtotal)}</span>
              </div>
              {promoApplied && (
                <div className="flex justify-between text-[11px] text-green-600 font-bold">
                  <span>Remise ({promoApplied.code})</span>
                  <span>−{formatCurrency(totals.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-50">
                <span className="text-sm font-black text-gray-900">Total</span>
                <span className="text-xl md:text-2xl font-black text-[#f56b2a] tabular-nums">{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </>
        )}
        {permissions.canManageOrders ? (
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || isProcessing}
            className="w-full bg-gradient-to-r from-[#f56b2a] to-[#e04e0f] text-white font-black text-sm md:text-base py-3.5 md:py-4 rounded-2xl flex items-center justify-center gap-2.5 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 shadow-xl shadow-orange-200/40 transition-all active:scale-[0.98] hover:shadow-2xl hover:shadow-orange-200/60"
          >
            {isProcessing ? (
              <Loader color="text-white" size="sm" />
            ) : (
              <CreditCard size={18} />
            )}
            {isProcessing ? 'Envoi...' : cart.length === 0 ? 'Panier vide' : 'Encaisser'}
          </button>
        ) : (
          <div className="p-3 bg-red-50 text-red-500 rounded-xl text-[10px] font-bold text-center border border-red-100 flex items-center justify-center gap-2">
            <X size={13} /> Permission insuffisante
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex flex-grow overflow-hidden h-full relative bg-gray-50/30">
      {/* ─── LEFT: Product Grid ─── */}
      <div className={`flex-grow flex flex-col overflow-hidden ${showCartSheet ? 'hidden md:flex' : 'flex'}`}>
        {/* POS Header */}
        <div className="px-3 md:px-5 py-2.5 md:py-3 bg-white border-b border-gray-100 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="bg-gradient-to-br from-[#f56b2a] to-[#e04e0f] p-1.5 md:p-2 rounded-xl text-white shadow-md shadow-orange-200/30">
              <Sparkles size={16} className="md:w-[18px] md:h-[18px]" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm md:text-base font-black text-gray-900 leading-none">{storeSettings?.name || 'Point de Vente'}</h1>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{liveTime} • POS</span>
            </div>
          </div>

          {/* Search */}
          <div className="flex-grow relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              ref={searchRef}
              type="text"
              value={searchTerm}
              placeholder="Rechercher un produit..."
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 md:py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:border-[#f56b2a]/30 text-xs md:text-sm font-medium transition-all"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Product count badge */}
          <div className="hidden md:flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100 flex-shrink-0">
            <Package size={14} className="text-gray-400" />
            <span className="text-xs font-black text-gray-600">{filteredProducts.length}</span>
          </div>
        </div>

        {/* Categories */}
        <div className="px-3 md:px-5 py-2 md:py-2.5 bg-white border-b border-gray-50">
          <div
            ref={categoriesRef}
            className="flex flex-row flex-nowrap items-center gap-1.5 md:gap-2 overflow-x-auto no-scrollbar scroll-smooth"
          >
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex-shrink-0 px-3 md:px-4 py-1.5 md:py-2 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-wider transition-all border active:scale-95 whitespace-nowrap
                  ${selectedCategory === cat
                    ? 'bg-[#f56b2a] border-[#f56b2a] text-white shadow-md shadow-orange-100'
                    : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
              >
                {cat === 'all' ? 'Tout' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-grow overflow-y-auto px-3 md:px-5 py-3 md:py-4 pb-28 md:pb-4 custom-scrollbar">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="bg-gray-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-4 text-gray-300">
                <Search size={28} />
              </div>
              <p className="text-sm font-bold text-gray-400">Aucun produit trouvé</p>
              <p className="text-[10px] text-gray-300 mt-1">Essayez un autre terme de recherche</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 md:gap-3">
              {filteredProducts.map(product => (
                <POSProductCard key={product.id} product={product} onAdd={addToCart} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── RIGHT: Cart Sidebar (Desktop) ─── */}
      <div className="hidden md:flex w-[360px] lg:w-[400px] xl:w-[420px] flex-shrink-0 flex-col h-full bg-white border-l border-gray-100 shadow-[-4px_0_20px_rgba(0,0,0,0.02)]">
        <CartContent />
      </div>

      {/* ─── MOBILE: Bottom Cart Bar ─── */}
      {cart.length > 0 && !showCartSheet && (
        <button
          onClick={() => setShowCartSheet(true)}
          className="md:hidden fixed bottom-[68px] left-3 right-3 z-40 bg-gradient-to-r from-[#f56b2a] to-[#e04e0f] text-white px-4 py-3 rounded-2xl shadow-[0_4px_24px_rgba(245,107,42,0.35)] flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <ShoppingBasket size={18} />
              <span className="absolute -top-1.5 -right-2 bg-white text-[#f56b2a] text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                {totalItems}
              </span>
            </div>
            <span className="font-black text-sm">{formatCurrency(totals.total)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-black">
            Voir le panier <ArrowRight size={16} />
          </div>
        </button>
      )}

      {/* ─── MOBILE: Cart Bottom Sheet ─── */}
      {showCartSheet && (
        <div className="md:hidden fixed inset-0 z-[60] flex flex-col">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setShowCartSheet(false)}
          />
          {/* Sheet */}
          <div className="relative mt-auto bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh] animate-slide-up">
            {/* Drag handle */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <CartContent />
          </div>
        </div>
      )}

      {/* ─── SUCCESS MODAL ─── */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full md:max-w-md md:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up md:animate-in md:zoom-in-95 md:duration-300">
            {/* Header */}
            <div className="p-6 md:p-8 text-center bg-gradient-to-b from-green-50 to-white">
              <div className="md:hidden w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-100/50" style={{ animation: 'bounceIn 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97)' }}>
                <CheckCircle2 size={36} />
              </div>
              <h2 className="text-xl md:text-2xl font-black text-gray-900">Vente enregistrée !</h2>
              <p className="text-xs text-gray-400 font-bold mt-1 uppercase tracking-wider">#{currentOrderId.slice(-8).toUpperCase()}</p>
            </div>

            {/* Summary card */}
            <div className="px-6 pb-4">
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5 border border-gray-100">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 font-medium">{totalItems} article{totalItems > 1 ? 's' : ''}</span>
                  <span className="font-bold text-gray-700">{formatCurrency(totals.baseSubtotal)}</span>
                </div>
                {promoApplied && (
                  <div className="flex justify-between text-xs text-green-600 font-bold">
                    <span>Remise ({promoApplied.code})</span>
                    <span>−{formatCurrency(totals.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-2 border-t border-gray-200">
                  <span className="text-sm font-black text-gray-900">Total payé</span>
                  <span className="text-xl font-black text-[#f56b2a]">{formatCurrency(totals.total)}</span>
                </div>
                <div className="flex items-center gap-3 pt-2 border-t border-gray-200 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    {paymentMethod === PaymentMethod.CASH ? <Banknote size={12} /> : <CreditCard size={12} />}
                    {paymentMethod === PaymentMethod.CASH ? 'Espèces' : 'Carte'}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    {orderType === 'IN_STORE' ? <Store size={12} /> : <Clock size={12} />}
                    {orderType === 'IN_STORE' ? 'En magasin' : 'Click & Collect'}
                  </span>
                  {selectedCustomer && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1"><User size={12} /> {selectedCustomer.name}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-5 pt-2 flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all shadow-sm"
                >
                  <Printer size={16} className="text-[#f56b2a]" /> Imprimer
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={isDownloadingPdf}
                  className="flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50"
                >
                  {isDownloadingPdf ? (
                    <Loader size="sm" color="text-[#f56b2a]" />
                  ) : (
                    <>
                      <Download size={16} className="text-[#f56b2a]" /> PDF
                    </>
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={closeCheckout}
                className="w-full py-3.5 bg-gradient-to-r from-[#f56b2a] to-[#e04e0f] text-white font-black text-sm rounded-2xl active:scale-[0.98] transition-transform shadow-lg shadow-orange-200/30"
              >
                Nouvelle Vente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSView;
