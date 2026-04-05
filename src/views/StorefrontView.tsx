'use client';
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    ShoppingCart, Search, Store, MapPin, CreditCard, ChevronLeft,
    Star, Heart, X, CheckCircle2, User, Phone, Mail, Truck, ShieldCheck,
    Gift, Zap, Bell, MessageCircle, Plus, ArrowRight, Loader2, ChevronRight, ShoppingBasketIcon, Globe,
    Eye, ShoppingBag
} from 'lucide-react';
import { StoreData, Product, Customer, Order, ViewType, NotificationType, Review, Coupon, ToastNotification } from '@/types';
import { generateProductSlug } from '@/utils/slug';
import { MAIN_CATEGORIES } from '@/constants';
import { formatCurrency, playSuccessSound } from '@/utils';
import ProductImage from '../components/ProductImage';
import ProductCard from '../components/ProductCard';
import Toast from '../components/Toast';
import { Routes, Route, useNavigate, useParams, Link, useLocation, useMatch, useRouter } from '@/components/RouterPolyfill';
import { incrementProductViews, incrementStoreViews } from '@/supabase-api';
import { fetchMarketplaceProducts, fetchProductReviews } from '@/hooks/useSupabaseData';
import { MarketplaceBottomNav } from '@/components/MarketplaceBottomNav';
import { supabase } from '@/supabase';

interface StorefrontProduct extends Product {
    storeId: string;
    storeName: string;
    storeSlug?: string;
}

const categoryImages: Record<string, string> = {
    'all': 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=150&q=80',
    'Électronique & High-Tech': 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=300&q=80',
    'Maison & Bureau': 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=300&q=80',
    'Mode & Beauté': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&q=80',
    'Alimentation & Boissons': 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=300&q=80',
    'Santé & Bien-être': 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=300&q=80',
    'Sport & Loisirs': 'https://images.unsplash.com/photo-1517836357463-d25dfeac00dc?w=300&q=80',
    'Auto & Moto': 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=300&q=80',
    'Jouets & Enfants': 'https://images.unsplash.com/photo-1532330393533-443990a51d10?w=300&q=80',
    'Bricolage & Jardin': 'https://images.unsplash.com/photo-1585913661635-2170c5891553?w=300&q=80',
    'Livres & Papeterie': 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=300&q=80',
    'Divers': 'https://images.unsplash.com/photo-1456324504439-367921d17449?w=300&q=80'
};

interface CartItem {
    product: StorefrontProduct;
    quantity: number;
}

interface StorefrontViewProps {
    stores: StoreData[];
    onBackToApp: () => void | Promise<any>;
    onMarketplaceCheckout: (ordersData: Record<string, any>, customerData: any) => Promise<any>;
    onAddReview: (storeId: string, productId: string, review: any) => Promise<any>;
    notify: (message: string, type: NotificationType, title?: string) => void;
}


export const StorefrontView: React.FC<StorefrontViewProps> = ({ stores, onBackToApp, onMarketplaceCheckout, onAddReview, notify }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();
    const storeViewTracked = React.useRef<string | null>(null);
    const productViewTracked = React.useRef<string | null>(null);

    // 🏛️ Global Loading Semaphore
    const [loadingStack, setLoadingStack] = useState(0);
    const [toastNotifications, setToastNotifications] = useState<ToastNotification[]>([]);

    const performAction = useCallback(async (action: () => Promise<any> | void, delayDuration = 400) => {
        // Retour visuel IMMÉDIAT demandé par l'utilisateur
        setLoadingStack(prev => prev + 1);
        
        // Garantie absolue (double rAF) que le navigateur a dessiné le loader à l'écran AVANT le blocage du thread
        await new Promise(resolve => {
            if (typeof window !== 'undefined') {
                window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
            } else {
                setTimeout(resolve, 50);
            }
        });

        try {
            const result = action();
            if (result instanceof Promise) {
                await result;
            }
        } catch (error) {
            console.error("Action orchestration failed:", error);
        } finally {
            // Maintenir le loader visible suffisamment longtemps pour être vu par le visiteur
            setTimeout(() => {
                setLoadingStack(prev => Math.max(0, prev - 1));
            }, delayDuration);
        }
    }, []);

    const localNotify = useCallback((message: string, type: NotificationType = 'info', title?: string) => {
        const id = Math.random().toString(36).substr(2, 9);
        setToastNotifications(prev => [...prev, { id, message, type, title }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToastNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // Load cart from localStorage (24h expiration)
    const loadCartFromStorage = (): CartItem[] => {
        try {
            const stored = localStorage.getItem('storefront_cart');
            if (stored) {
                const { data, timestamp } = JSON.parse(stored);
                const expired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
                if (!expired) return data;
            }
        } catch (e) { }
        return [];
    };

    const [cart, setCart] = useState<CartItem[]>([]);
    const [isMounted, setIsMounted] = useState(false);
    
    // 0. URL Params Detection (Moved to top to prevent 'used before declaration')
    const storeMatch = useMatch('/store/:storeParam');
    const productMatch = useMatch('/product/:productId');
    const isCartView = location.pathname.includes('/cart');
    const isFeedView = location.pathname.includes('/feed');
    const selectedStoreParam = storeMatch?.params.storeParam || null;
    const { "*": splatParam } = useParams();
    const splat = Array.isArray(splatParam) ? splatParam[0] : splatParam;
    const isProductDetailPath = splat?.startsWith('product/');
    const rawUrlProductId = productMatch?.params.productId || (isProductDetailPath ? splat?.replace('product/', '') : null);

    // Persistence Cache: Instant load from localStorage
    const [cachedStores, setCachedStores] = useState<StoreData[]>([]);

    // 1. Load cache IMMEDIATELY on mount
    React.useEffect(() => {
        setIsMounted(true);
        
        try {
            const storedMarketplace = localStorage.getItem('marketplace_cache');
            if (storedMarketplace) {
                const { data, timestamp } = JSON.parse(storedMarketplace);
                // Cache valid for 30 minutes
                const isFresh = Date.now() - timestamp < 30 * 60 * 1000;
                if (data && data.length > 0) {
                    setCachedStores(data);
                }
            }
        } catch (e) {
            console.warn('Marketplace cache load failed', e);
        }

        const savedCart = loadCartFromStorage();
        if (savedCart.length > 0) setCart(savedCart);
        
        const savedCustomer = loadCustomerInfoFromStorage();
        if (savedCustomer.name) setCustomerInfo(savedCustomer);
        
        const savedPromo = loadPromoFromStorage();
        if (savedPromo) setPromoApplied(savedPromo);

        // ⚡ Vitesse éclair (Cdiscount/Amazon style)
    }, []);

    // 2. Update cache when fresh props arrive
    React.useEffect(() => {
        if (!isMounted || !stores || stores.length === 0) return;
        
        try {
            localStorage.setItem('marketplace_cache', JSON.stringify({
                data: stores,
                timestamp: Date.now()
            }));
        } catch (e) { }
    }, [stores, isMounted]);

    // Use cached data as fallback for UI
    const activeStores = stores && stores.length > 0 ? stores : cachedStores;

    // 2. Update cache when fresh props arrive
    React.useEffect(() => {
        if (!isMounted || !stores || stores.length === 0) return;
        
        try {
            localStorage.setItem('marketplace_cache', JSON.stringify({
                data: stores,
                timestamp: Date.now()
            }));
        } catch (e) { }
    }, [stores, isMounted]);

    // 3. Save cart to localStorage when it changes (only after mounting)
    React.useEffect(() => {
        if (!isMounted) return;
        try {
            localStorage.setItem('storefront_cart', JSON.stringify({
                data: cart,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Could not save cart to localStorage (Quota exceeded?)', e);
        }
    }, [cart, isMounted]);

    const allProducts = useMemo(() => {
        const products: StorefrontProduct[] = [];
        activeStores.forEach(store => {
            if (store.products) {
                store.products.forEach(product => {
                    // Only include products that are marked as online
                    if (product.isOnline !== false) {
                        products.push({
                            ...product,
                            storeId: store.id || '',
                            storeName: store.settings?.name || store.name || 'Boutique',
                            storeSlug: store.slug || undefined
                        });
                    }
                });
            }
        });
        return products;
    }, [activeStores]);

    const selectedStoreId = useMemo(() => {
        if (!selectedStoreParam) return null;
        const store = activeStores.find(s => s.id === selectedStoreParam || s.slug === selectedStoreParam);
        return store?.id || null;
    }, [selectedStoreParam, activeStores]);

    const selectedStore = useMemo(() => {
        return activeStores.find(s => s.id === selectedStoreId) || null;
    }, [selectedStoreId, activeStores]);

    const [checkoutStage, setCheckoutStage] = useState<'cart' | 'shipping' | 'payment' | 'success'>('cart');
    const [lastAddedProduct, setLastAddedProduct] = useState<StorefrontProduct | null>(null);
    const [cartNotif, setCartNotif] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Carousel auto-play
    React.useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % 3);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    // Params logic moved to top

    // Review form state
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [newReview, setNewReview] = useState({ author: '', rating: 5, comment: '' });
    const [reviewStep, setReviewStep] = useState(1);

    // Post-order review state
    const [completedOrderStores, setCompletedOrderStores] = useState<Array<{ storeId: string, storeName: string, products: Array<{ id: string, name: string, image: string }> }>>([]);
    const [postOrderReviewTarget, setPostOrderReviewTarget] = useState<{ storeId: string, productId: string, productName: string } | null>(null);
    const [reviewedProducts, setReviewedProducts] = useState<string[]>([]);
    const [completedOrderItems, setCompletedOrderItems] = useState<Array<{ name: string, quantity: number, price: number }>>([]);
    const [completedOrderTotal, setCompletedOrderTotal] = useState<number>(0);

    // User Accounts State
    const [user, setUser] = useState<{ name: string, email: string } | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
    const [showPropulseModal, setShowPropulseModal] = useState(false);

    // Load customer info from localStorage (24h expiration)
    const loadCustomerInfoFromStorage = (): { name: string, phone: string, address: string, city: string, zip: string } => {
        try {
            const stored = localStorage.getItem('storefront_customer');
            if (stored) {
                const { data, timestamp } = JSON.parse(stored);
                const expired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
                if (!expired) return data;
            }
        } catch (e) { }
        return { name: '', phone: '', address: '', city: '', zip: '' };
    };

    const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', address: '', city: '', zip: '' });

    // Save customer info to localStorage when it changes
    React.useEffect(() => {
        if (!isMounted) return;
        try {
            localStorage.setItem('storefront_customer', JSON.stringify({
                data: customerInfo,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Could not save customer info to localStorage', e);
        }
    }, [customerInfo]);
    const [paymentMethod, setPaymentMethod] = useState<'cod' | 'card'>('cod');
    const [cardInfo, setCardInfo] = useState({ number: '', expiry: '', cvc: '' });
    const [promoCodeInput, setPromoCodeInput] = useState('');

    // Load promo from localStorage (24h expiration)
    const loadPromoFromStorage = () => {
        try {
            const stored = localStorage.getItem('storefront_promo');
            if (stored) {
                const { data, timestamp } = JSON.parse(stored);
                const expired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
                if (!expired) return data;
            }
        } catch (e) { }
        return null;
    };

    const [promoApplied, setPromoApplied] = useState<{ code: string, discountPct: number, storeId: string } | null>(null);

    // Save promo to localStorage when it changes
    React.useEffect(() => {
        if (!isMounted) return;
        try {
            if (promoApplied) {
                localStorage.setItem('storefront_promo', JSON.stringify({
                    data: promoApplied,
                    timestamp: Date.now()
                }));
            } else {
                localStorage.removeItem('storefront_promo');
            }
        } catch (e) {
            console.warn('Could not save promo to localStorage', e);
        }
    }, [promoApplied]);
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [rememberMe, setRememberMe] = useState(true);

    // Load coupons from Supabase - for all stores in cart or current store
    React.useEffect(() => {
        const loadCoupons = async () => {
            try {
                // Get unique store IDs from cart if on cart page
                let storeIds: string[] = [];

                if (isCartView && cart.length > 0) {
                    storeIds = [...new Set(cart.map(item => item.product.storeId))] as string[];
                } else if (selectedStoreParam) {
                    const currentStore = stores.find(s => s.id === selectedStoreParam || s.slug === selectedStoreParam);
                    if (currentStore) storeIds = [currentStore.id];
                }

                if (storeIds.length === 0) return;

                console.log('Loading coupons for stores:', storeIds);
                const { data: storesData, error: storesError } = await supabase
                    .from('stores')
                    .select('id, name, email, phone, address, ninea, logo, slug, theme, description, settings')
                    .order('name');
                const { data } = await supabase
                    .from('coupons')
                    .select('*')
                    .eq('active', true)
                    .in('store_id', storeIds);
                console.log('Coupons loaded:', data);
                if (data) setCoupons(data);
            } catch (e) {
                console.log('Coupons table not available', e);
            }
        };
        loadCoupons();
    }, [selectedStoreParam, stores, isCartView]);
    const [selectedDetailImage, setSelectedDetailImage] = useState<string | null>(null);
    const [storeTab, setStoreTab] = useState<'products' | 'reviews'>('products');
    const [storeReviews, setStoreReviews] = useState<Review[]>([]);
    const [loadingStoreReviews, setLoadingStoreReviews] = useState(false);
    const [showAllProductReviews, setShowAllProductReviews] = useState(false);
    const [showAllStoreReviews, setShowAllStoreReviews] = useState(false);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [currentZoomImage, setCurrentZoomImage] = useState<string | null>(null);
    
    // Pagination & Infinite Scroll State
    const [page, setPage] = useState(0);
    const [pagedProducts, setPagedProducts] = useState<StorefrontProduct[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const PAGE_LIMIT = 20;


    const fusionPayApiUrl = process.env.NEXT_PUBLIC_FUSIONPAY_API_URL || '';
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [pendingOrderData, setPendingOrderData] = useState<Record<string, any> | null>(null);
    const [pendingCustomerInfo, setPendingCustomerInfo] = useState<any>(null);

    const initiateFusionPayPayment = useCallback(async (amount: number, description: string, customer: { phone: string; name: string }) => {
        try {
            const paymentData = {
                totalPrice: amount,
                article: [{ description: description }],
                numeroSend: customer.phone,
                nomclient: customer.name,
                return_url: window.location.href,
                webhook_url: ''
            };

            const response = await fetch(fusionPayApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(paymentData),
            });

            const data = await response.json();

            if (data.statut && data.url) {
                window.location.href = data.url;
            } else {
                notify('Erreur lors de la création du paiement: ' + (data.message || 'Erreur inconnue'), 'error');
                setIsProcessingPayment(false);
            }
        } catch (error) {
            console.error('FusionPay error:', error);
            notify('Erreur de connexion avec FusionPay', 'error');
            setIsProcessingPayment(false);
        }
    }, [fusionPayApiUrl, notify]);

    // Reset checkout stage when entering the cart page with a fresh cart
    React.useEffect(() => {
        if (isCartView && checkoutStage === 'success') {
            setCheckoutStage('cart');
            setCompletedOrderStores([]);
            setCompletedOrderItems([]);
            setCompletedOrderTotal(0);
        }
    }, [isCartView]);

    // Also reset when leaving the cart page
    React.useEffect(() => {
        if (!isCartView && checkoutStage !== 'cart') {
            setCheckoutStage('cart');
        }
    }, [isCartView]);

    // Handle FusionPay return
    React.useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (token && pendingOrderData && pendingCustomerInfo) {
            checkFusionPayPaymentStatus(token);
        }
    }, []);

    const checkFusionPayPaymentStatus = async (token: string) => {
        try {
            const response = await fetch(`https://www.pay.moneyfusion.net/paiementNotif/${token}`);
            const data = await response.json();

            if (data.statut && data.data?.statut === 'paid') {
                if (pendingOrderData && pendingCustomerInfo) {
                    onMarketplaceCheckout(pendingOrderData, pendingCustomerInfo);
                }
                playSuccessSound();
                const storeMap: Record<string, { storeId: string, storeName: string, products: Array<{ id: string, name: string, image: string }> }> = {};
                cart.forEach(item => {
                    const sid = item.product.storeId;
                    if (!storeMap[sid]) {
                        storeMap[sid] = { storeId: sid, storeName: item.product.storeName, products: [] };
                    }
                    if (!storeMap[sid].products.find(p => p.id === item.product.id)) {
                        storeMap[sid].products.push({ id: item.product.id, name: item.product.name, image: item.product.image });
                    }
                });
                setCompletedOrderStores(Object.values(storeMap));
                setCompletedOrderItems(cart.map(item => ({ name: item.product.name, quantity: item.quantity, price: item.product.price })));
                setCompletedOrderTotal(cartTotal);
                setReviewedProducts([]);
                setCart([]);
                setPromoApplied(null);
                setPromoCodeInput('');
                setCheckoutStage('success');
                setPendingOrderData(null);
                setPendingCustomerInfo(null);
                window.history.replaceState({}, '', window.location.pathname);
            } else if (data.data?.statut === 'pending') {
                notify('Paiement en cours de traitement...', 'info');
            } else {
                notify('Paiement échoué ou annulé', 'error');
                setIsProcessingPayment(false);
                setPendingOrderData(null);
                setPendingCustomerInfo(null);
                window.history.replaceState({}, '', window.location.pathname);
            }
        } catch (error) {
            console.error('Error checking payment status:', error);
            notify('Erreur lors de la vérification du paiement', 'error');
            setIsProcessingPayment(false);
        }
    };

    const handleAuthSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        performAction(() => {
            setUser({ name: authMode === 'register' ? authForm.name : 'Utilisateur', email: authForm.email });
            setShowAuthModal(false);
            setCustomerInfo(prev => ({
                ...prev,
                name: authMode === 'register' ? authForm.name : 'Utilisateur'
            }));
            setAuthForm({ name: '', email: '', password: '' });
        }, 600);
    };

    const handleLogout = () => {
        if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
            performAction(() => {
                setUser(null);
                setCustomerInfo({ name: '', phone: '', address: '', city: '', zip: '' });
                localNotify('Déconnexion réussie', 'info');
            }, 500);
        }
    };


    const globalSearchStores = useMemo(() => {
        if (!searchTerm) return [];
        const term = searchTerm.toLowerCase();
        return stores.filter(s => {
            const name = (s.name || s.settings?.name || '').toLowerCase();
            const slug = (s.slug || '').toLowerCase();
            return name.includes(term) || slug.includes(term);
        });
    }, [searchTerm, stores]);

    const [productReviews, setProductReviews] = useState<Record<string, Review[]>>({});
    const [loadingReviews, setLoadingReviews] = useState<Record<string, boolean>>({});
    const [reviewRefreshKey, setReviewRefreshKey] = useState(0);

    const selectedProductDetails = useMemo(() => {
        if (!rawUrlProductId) return null;
        
        const matched = allProducts.find(p => String(p.id) === rawUrlProductId || generateProductSlug(p) === rawUrlProductId);
        if (!matched) return null;
        
        const product = matched;
        const resolvedId = product.id;

        if (productReviews[resolvedId]) {
            const reviews = productReviews[resolvedId];
            const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
            return { ...product, reviews, rating: avgRating, reviewCount: reviews.length };
        }
        return product;
    }, [allProducts, rawUrlProductId, productReviews]);

    const selectedProductId = selectedProductDetails?.id || null;

    // Track product views - only increment once per product per session
    useEffect(() => {
        if (selectedProductId && selectedProductDetails && productViewTracked.current !== selectedProductId) {
            productViewTracked.current = selectedProductId;
            incrementProductViews(selectedProductId);
            setIsDescriptionExpanded(false); // Reset expansion on new product
        }
    }, [selectedProductId, selectedProductDetails]);



    // Fetch product reviews
    useEffect(() => {
        if (selectedProductId) {
            setLoadingReviews(prev => ({ ...prev, [selectedProductId]: true }));
            fetchProductReviews(selectedProductId).then(reviews => {
                setProductReviews(prev => ({ ...prev, [selectedProductId]: reviews }));
                setLoadingReviews(prev => ({ ...prev, [selectedProductId]: false }));
            }).catch(() => {
                setLoadingReviews(prev => ({ ...prev, [selectedProductId]: false }));
            });
        }
    }, [selectedProductId, reviewRefreshKey]);



    // Update selectedDetailImage when selectedProductId changes
    React.useEffect(() => {
        if (selectedProductDetails) {
            setSelectedDetailImage(selectedProductDetails.image || (selectedProductDetails.images && selectedProductDetails.images[0]) || null);
        }
    }, [selectedProductDetails]);


    // Track store views - only increment once per store per session
    useEffect(() => {
        if (selectedStoreId && storeViewTracked.current !== selectedStoreId) {
            storeViewTracked.current = selectedStoreId;
            incrementStoreViews(selectedStoreId);
            setStoreTab('products'); // Reset to products tab on navigation
            setShowAllStoreReviews(false); // Reset see more
        }
    }, [selectedStoreId]);

    useEffect(() => {
        setShowAllProductReviews(false); // Reset see more on product change
    }, [selectedProductId]);

    const storeProducts = useMemo(() => {
        if (!selectedStoreId) return [];
        return allProducts.filter(p => {
            const isFromStore = p.storeId === selectedStoreId;
            const name = p.name || '';
            const category = p.category || '';
            const mCategory = p.mainCategory || '';
            const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = selectedCategory === 'all' || category === selectedCategory || mCategory === selectedCategory;
            return isFromStore && matchesSearch && matchesCategory;
        });
    }, [allProducts, selectedStoreId, searchTerm, selectedCategory]);

    // Fetch store-wide reviews
    useEffect(() => {
        if (selectedStoreId && storeTab === 'reviews') {
            setLoadingStoreReviews(true);
            const fetchReviews = async () => {
                try {
                    const { data, error } = await supabase
                        .from('product_reviews')
                        .select('*')
                        .eq('store_id', selectedStoreId)
                        .order('created_at', { ascending: false });
                    
                    if (error) throw error;
                    
                    if (data) {
                        setStoreReviews(data.map(r => ({
                            id: r.id,
                            author: r.author_name,
                            rating: r.rating,
                            comment: r.comment,
                            date: r.created_at,
                            productId: r.product_id
                        })));
                    }
                } catch (e) {
                    console.error('Error fetching store reviews:', e);
                } finally {
                    setLoadingStoreReviews(false);
                }
            };
            fetchReviews();
        }
    }, [selectedStoreId, storeTab]);



    const categories = useMemo(() => {
        return ['all', ...MAIN_CATEGORIES];
    }, []);

    const filteredProducts = useMemo(() => {
        return allProducts
            .filter(p => {
                const isFromStore = !selectedStoreId || p.storeId === selectedStoreId;
                const name = p.name || '';
                const storeName = p.storeName || '';
                const category = p.category || '';
                const mCategory = p.mainCategory || '';
                const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    storeName.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesCategory = selectedCategory === 'all' || category === selectedCategory || mCategory === selectedCategory;
                return isFromStore && matchesSearch && matchesCategory;
            })
            .sort((a, b) => {
                // 1. Most sold first
                const salesDiff = (b.salesCount || 0) - (a.salesCount || 0);
                if (salesDiff !== 0) return salesDiff;
                // 2. Best rated
                const ratingDiff = (b.rating || 0) - (a.rating || 0);
                if (ratingDiff !== 0) return ratingDiff;
                // 3. Most reviews
    // 4. Most views
                return (b.views || 0) - (a.views || 0);
            });
    }, [allProducts, searchTerm, selectedCategory, selectedStoreId]);

    // 🔥 Infinite Scroll (Client-Side from Cache) - Instant & Bug-free
    const loadPagedProducts = useCallback(async (reset: boolean = false) => {
        setIsLoadingMore(true);
        
        const nextPage = reset ? 0 : page;
        const start = nextPage * PAGE_LIMIT;
        const end = start + PAGE_LIMIT;
        const nextBatch = filteredProducts.slice(start, end);
        
        setPagedProducts(prev => reset ? nextBatch : [...prev, ...nextBatch]);
        setHasMore(end < filteredProducts.length);
        setPage(nextPage + 1);
        setIsLoadingMore(false);
    }, [page, filteredProducts]);

    // Reset pagination on filter change
    useEffect(() => {
        loadPagedProducts(true);
    }, [selectedStoreId, selectedCategory, searchTerm, loadPagedProducts]);

    // Intersection Observer for Infinite Scroll
    useEffect(() => {
        if (!loadMoreRef.current) return;
        
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
                loadPagedProducts();
            }
        }, { threshold: 0.1 });
        
        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [loadPagedProducts, isLoadingMore, hasMore]);


    const partnerStores = useMemo(() => {
        return stores
            .sort((a, b) => {
                const visitsA = (a.views || 0) + (a.products?.filter(p => p.isOnline !== false).reduce((sum, p) => sum + (p.views || 0), 0) || 0);
                const visitsB = (b.views || 0) + (b.products?.filter(p => p.isOnline !== false).reduce((sum, p) => sum + (p.views || 0), 0) || 0);
                if (visitsB !== visitsA) return visitsB - visitsA;
                return (b.rating || 0) - (a.rating || 0);
            });
    }, [stores]);

    const addToCart = (product: StorefrontProduct) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id && item.product.storeId === product.storeId);
            if (existing) {
                return prev.map(item =>
                    (item.product.id === product.id && item.product.storeId === product.storeId)
                        ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
        setLastAddedProduct(product);
        setCartNotif(true);
        setTimeout(() => setCartNotif(false), 4000);
    };

    const addWholesaleToCart = (product: StorefrontProduct) => {
        if (!product.wholesaleMinQty) return;
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id && item.product.storeId === product.storeId);
            if (existing) {
                return prev.map(item =>
                    (item.product.id === product.id && item.product.storeId === product.storeId)
                        ? { ...item, quantity: Math.max(item.quantity, Number(product.wholesaleMinQty)) } : item
                );
            }
            return [...prev, { product, quantity: Number(product.wholesaleMinQty) }];
        });
        setLastAddedProduct(product);
        setCartNotif(true);
        setCheckoutStage('cart'); // Go straight to cart to see savings
        setTimeout(() => setCartNotif(false), 4000);
    };

    const removeFromCart = (productId: string, storeId: string) => {
        setCart(prev => prev.filter(item => !(item.product.id === productId && item.product.storeId === storeId)));
    };

    const updateQuantity = (productId: string, storeId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.product.id === productId && item.product.storeId === storeId) {
                const newQ = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQ };
            }
            return item;
        }));
    };

    const shippingCost = 0;

    const getEffectiveItemPrice = useCallback((item: CartItem) => {
        const { product, quantity } = item;
        if (product.wholesalePrice && product.wholesaleMinQty && quantity >= product.wholesaleMinQty) {
            return Number(product.wholesalePrice);
        }
        return Number(product.price);
    }, []);

    const baseCartTotal = Math.max(0, cart.reduce((sum, item) => sum + (getEffectiveItemPrice(item) * (item.quantity || 1)), 0));

    // Calculate discount only for products from the store that has the coupon
    const discountAmount = promoApplied
        ? cart
            .filter(item => item.product.storeId === promoApplied.storeId)
            .reduce((sum, item) => sum + (getEffectiveItemPrice(item) * (item.quantity || 1)), 0) * (promoApplied.discountPct / 100)
        : 0;
    const cartTotal = baseCartTotal - discountAmount + shippingCost;
    const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const handlePromoApply = () => {
        performAction(() => {
            console.log('handlePromoApply called', { promoCodeInput, coupons });
            const inputCode = promoCodeInput.trim().toUpperCase();

            // Find matching active coupon from state (loaded from Supabase for current store)
            const matchedCoupon = coupons.find(c => c.code === inputCode && c.active);

            if (matchedCoupon) {
                setPromoApplied({ code: matchedCoupon.code, discountPct: matchedCoupon.discount_pct, storeId: matchedCoupon.store_id });
                setPromoCodeInput('');
                localNotify(`Code promo appliqué: ${matchedCoupon.discount_pct}% de réduction!`, 'success');
            } else if (coupons.length === 0) {
                console.log('No coupons available for this store');
                localNotify('Aucun code promo disponible pour cette boutique.', 'error');
            } else {
                console.log('Code not found in coupons', inputCode, coupons);
                localNotify('Ce code promo n\'existe pas pour cette boutique.', 'error');
            }
        }, 400);
    };

    const handleCheckoutSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (checkoutStage === 'shipping') setCheckoutStage('payment');
        else if (checkoutStage === 'payment') {
            if (isProcessingPayment) return;

            const ordersData: Record<string, any> = {};
            cart.forEach(item => {
                if (!ordersData[item.product.storeId]) {
                    ordersData[item.product.storeId] = { items: [], subtotal: 0, total: 0 };
                }
                ordersData[item.product.storeId].items.push({ product: item.product, quantity: item.quantity });
            });
            Object.keys(ordersData).forEach(storeId => {
                const storeOrder = ordersData[storeId];
                storeOrder.subtotal = storeOrder.items.reduce((sum: number, i: any) => {
                    const price = (i.product.wholesalePrice && i.product.wholesaleMinQty && i.quantity >= i.product.wholesaleMinQty) 
                        ? i.product.wholesalePrice 
                        : i.product.price;
                    return sum + (price * i.quantity);
                }, 0);
                // Only apply discount to the store that has the coupon
                storeOrder.discountAmount = (promoApplied && promoApplied.storeId === storeId) ? storeOrder.subtotal * (promoApplied.discountPct / 100) : 0;
                storeOrder.promoCode = (promoApplied && promoApplied.storeId === storeId) ? promoApplied.code : undefined;
                const discountedSubtotal = storeOrder.subtotal - storeOrder.discountAmount;
                const proportionalShipping = baseCartTotal > 0 ? (storeOrder.subtotal / baseCartTotal) * shippingCost : 0;
                storeOrder.shippingCost = proportionalShipping;
                storeOrder.total = discountedSubtotal + proportionalShipping;
                storeOrder.paymentMethod = paymentMethod === 'card' ? 'CARTE' : 'ESPECES';
            });

            if (paymentMethod === 'card') {
                setIsProcessingPayment(true);
                setPendingOrderData(ordersData);
                setPendingCustomerInfo({ ...customerInfo, address: `${customerInfo.address}, ${customerInfo.city}` });
                const totalAmount = Object.values(ordersData).reduce((sum: number, order: any) => sum + order.total, 0);
                initiateFusionPayPayment(
                    Math.round(totalAmount),
                    'Commande sur ' + (stores[0]?.name || 'POS Pro'),
                    {
                        phone: customerInfo.phone || '01010101',
                        name: customerInfo.name || 'Client'
                    }
                );
            } else {
                (async () => {
                    const response = await onMarketplaceCheckout(ordersData, { ...customerInfo, address: `${customerInfo.address}, ${customerInfo.city}` });
                    if (response?.success) {
                        playSuccessSound();

                        const storeMap: Record<string, { storeId: string, storeName: string, products: Array<{ id: string, name: string, image: string }> }> = {};
                        cart.forEach(item => {
                            const sid = item.product.storeId;
                            if (!storeMap[sid]) {
                                storeMap[sid] = { storeId: sid, storeName: item.product.storeName, products: [] };
                            }
                            if (!storeMap[sid].products.find(p => p.id === item.product.id)) {
                                storeMap[sid].products.push({ id: item.product.id, name: item.product.name, image: item.product.image });
                            }
                        });
                        setCompletedOrderStores(Object.values(storeMap));
                        setCompletedOrderItems(cart.map(item => ({ name: item.product.name, quantity: item.quantity, price: item.product.price })));
                        setCompletedOrderTotal(cartTotal);
                        setReviewedProducts([]);
                        setPromoApplied(null);
                        setPromoCodeInput('');
                        setCheckoutStage('success');
                        setCart([]);
                    } else {
                        localNotify(response?.error || "Erreur lors de la validation de la commande", 'error');
                    }
                })();
            }
        }
    };

    const handleSubmitReview = async () => {
        performAction(async () => {
            const reviewToSubmit = {
                id: `rev-${Date.now()}`,
                author: newReview.author || 'Anonyme',
                rating: newReview.rating,
                comment: newReview.comment,
                date: new Date().toISOString()
            };

            try {
                let result: any;
                if (postOrderReviewTarget) {
                    result = await onAddReview(postOrderReviewTarget.storeId, postOrderReviewTarget.productId, reviewToSubmit);
                    if (result?.success) {
                        setReviewedProducts(prev => [...prev, postOrderReviewTarget.productId]);
                    }
                } else if (selectedProductDetails) {
                    result = await onAddReview(selectedProductDetails.storeId, selectedProductDetails.id, reviewToSubmit);
                } else {
                    return;
                }

                if (result && !result.success) {
                    localNotify('Erreur lors de la publication de l\'avis : ' + result.error, 'error');
                    return;
                }

                setReviewRefreshKey(k => k + 1);
                setReviewStep(4);
                setTimeout(() => {
                    setNewReview({ author: '', rating: 5, comment: '' });
                    setShowReviewForm(false);
                    setReviewStep(1);
                    setPostOrderReviewTarget(null);
                }, 2500);
            } catch (error) {
                localNotify('Une erreur est survenue lors de l\'envoi de votre avis.', 'error');
                console.error('Review submission error:', error);
            }
        }, 800); // More delay for review to feel like work was done
    };

    const openPostOrderReview = (storeId: string, productId: string, productName: string) => {
        setPostOrderReviewTarget({ storeId, productId, productName });
        setNewReview({ author: customerInfo.name || '', rating: 5, comment: '' });
        setReviewStep(1);
        setShowReviewForm(true);
    };

    const renderStoreProfile = () => {
        if (!selectedStore) return null;
        return (
            <div className="mb-4 md:mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
                {/* Store Header Card */}
                <div className="bg-white rounded-[28px] md:rounded-[40px] overflow-hidden shadow-xl shadow-gray-200/50 border border-white relative">
                    {/* Cover / Background Pattern - Reduced height on mobile */}
                    <div className="h-14 md:h-48 bg-gradient-to-r from-[#f56b2a] to-[#ff9d6c] relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10 pointer-events-none">
                            <Store size={150} className="absolute -right-10 -top-10 text-white rotate-12" />
                            <Zap size={100} className="absolute left-10 bottom-0 text-white -rotate-12" fill="currentColor" />
                        </div>
                    </div>

                    <div className="px-4 md:px-12 pb-3 md:pb-12 relative">
                        {/* Profile Info Row */}
                        <div className="flex flex-col md:flex-row items-center md:items-end gap-2 md:gap-6 -mt-10 md:-mt-16 mb-3 md:mb-8">
                            {/* Store Logo/Icon - Smaller on mobile */}
                            <div className="w-16 h-16 md:w-32 md:h-32 rounded-[22px] md:rounded-[32px] bg-white p-1 md:p-1.5 shadow-2xl z-20">
                                <div className="w-full h-full rounded-[18px] md:rounded-[26px] bg-gray-50 flex items-center justify-center border border-gray-100">
                                    <Store size={28} className="text-[#f56b2a] md:hidden" />
                                    <Store size={56} className="text-[#f56b2a] hidden md:block" />
                                </div>
                            </div>

                            {/* Title and Badge */}
                            <div className="text-center md:text-left flex-grow pt-0 min-w-0">
                                <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3 mb-1">
                                    <h1 className="text-lg md:text-4xl font-black text-gray-900 tracking-tight leading-tight truncate px-2 md:px-0">
                                        {selectedStore.settings.name}
                                    </h1>
                                    <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-1.5 md:gap-2">
                                        <div className="inline-flex items-center gap-1 bg-green-50 text-green-600 px-2.5 py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-wider border border-green-100/50">
                                            <ShieldCheck size={12} strokeWidth={3} /> Vérifié
                                        </div>
                                        {(() => {
                                            const countryValue = selectedStore.address || selectedStore.settings?.address;
                                            if (countryValue) {
                                                return (
                                                    <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-wider border border-blue-100/50 shadow-sm whitespace-nowrap">
                                                        <Globe size={12} strokeWidth={3} className="text-blue-400" />
                                                        <span className="opacity-70">Pays de la boutique :</span>
                                                        <span>{countryValue}</span>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </div>
                                {(() => {
                                    const desc = selectedStore.description || (selectedStore.settings as any)?.description || 'Votre destination shopping préférée pour des produits locaux et de qualité.';
                                    return (
                                        <div className="mt-4 md:mt-6 w-full max-w-2xl mx-auto md:mx-0 relative">
                                            <div className="absolute -left-1 -top-2 opacity-10 scale-75 md:scale-100">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-[#f56b2a]">
                                                    <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C20.1216 16 21.017 15.1046 21.017 14V9C21.017 7.89543 20.1216 7 19.017 7H15.017C13.9124 7 13.017 7.89543 13.017 9V15C13.017 17.1856 12.3551 18.9142 11.0261 20.1906C10.6384 20.5638 10.6318 21.1963 11.0113 21.5779C11.3908 21.9594 12.0039 21.9392 12.3614 21.5332L14.017 21ZM5.017 21L5.017 18C5.017 16.8954 5.91243 16 7.017 16H10.017C11.1216 16 12.017 15.1046 12.017 14V9C12.017 7.89543 11.1216 7 10.017 7H6.017C4.91243 7 4.017 7.89543 4.017 9V15C4.017 17.1856 3.35513 18.9142 2.02612 20.1906C1.63836 20.5638 1.63175 21.1963 2.01129 21.5779C2.39084 21.9594 3.0039 21.9392 3.36141 21.5332L5.017 21Z" />
                                                </svg>
                                            </div>
                                            <p className="text-gray-500 text-[11px] md:text-sm font-semibold leading-relaxed md:leading-loose tracking-tight px-3 md:px-0 text-center md:text-left">
                                                <span className="bg-gradient-to-r from-gray-500 to-gray-700 bg-clip-text text-transparent">
                                                    {desc}
                                                </span>
                                            </p>
                                            <div className="h-[2px] w-8 md:w-12 bg-gradient-to-r from-[#f56b2a]/40 to-transparent mt-3 md:mt-4 mx-auto md:mx-0 rounded-full"></div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Marketplace Return - Desktop Only */}
                            <button
                                onClick={() => {
                                    performAction(() => {
                                        navigate('/');
                                        setSearchTerm('');
                                        setSelectedCategory('all');
                                    }, 300);
                                }}
                                className="hidden md:flex items-center gap-3 bg-gray-900 text-white px-6 py-4 rounded-2xl font-black text-sm hover:bg-[#f56b2a] transition-all shadow-lg active:scale-95"
                            >
                                <ChevronLeft size={18} strokeWidth={3} /> Marketplace
                            </button>
                        </div>

                        {/* Store Dedicated Search Bar - Compact on Mobile */}
                        <div className="mb-3 md:mb-8 max-w-2xl mx-auto md:mx-0">
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#f56b2a] transition-colors">
                                    <Search size={16} strokeWidth={3} />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Chercher dans cette boutique..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 md:py-4 bg-gray-50/80 border border-gray-100/50 rounded-xl md:rounded-[20px] font-bold text-[10px] md:text-base text-gray-700 focus:bg-white focus:border-[#f56b2a] focus:shadow-xl focus:shadow-orange-100/50 transition-all no-global-border"
                                />
                            </div>
                        </div>

                        {/* Stats Row - Always visible on 4 columns for mobile */}
                        <div className="grid grid-cols-4 gap-1.5 md:gap-8 pt-4 md:pt-6 border-t border-gray-50">
                            {/* Products Count */}
                            <div className="bg-gray-50/50 p-2 md:p-4 rounded-xl md:rounded-[20px] border border-gray-50 flex flex-col items-center md:items-start text-gray-900">
                                <span className="text-xs md:text-3xl font-black leading-none mb-0.5 md:mb-1">
                                    {selectedStore.products?.filter(p => p.isOnline !== false && p.image).length || 0}
                                </span>
                                <span className="text-[6.5px] md:text-[10px] font-black text-gray-600 uppercase tracking-widest whitespace-nowrap">Produits</span>
                            </div>

                            {/* Visitors Count */}
                            <div className="bg-orange-50/30 p-2 md:p-4 rounded-xl md:rounded-[20px] border border-orange-50/50 flex flex-col items-center md:items-start text-[#f56b2a]">
                                <span className="text-xs md:text-3xl font-black leading-none mb-0.5 md:mb-1">
                                    {(selectedStore.views || 0) + (selectedStore.products?.filter(p => p.isOnline !== false).reduce((sum, p) => sum + (p.views || 0), 0) || 0)}
                                </span>
                                <span className="text-[6.5px] md:text-[10px] font-black text-orange-400 uppercase tracking-widest whitespace-nowrap">Visiteurs</span>
                            </div>

                            {/* Reviews Count */}
                            <div className="bg-yellow-50/30 p-2 md:p-4 rounded-xl md:rounded-[20px] border border-yellow-50/50 flex flex-col items-center md:items-start text-yellow-600">
                                <span className="text-xs md:text-3xl font-black leading-none mb-0.5 md:mb-1">
                                    {selectedStore.products?.filter(p => p.isOnline !== false).reduce((sum, p) => sum + (p.reviewCount || 0), 0) || 0}
                                </span>
                                <span className="text-[6.5px] md:text-[10px] font-black text-yellow-600 uppercase tracking-widest whitespace-nowrap text-center">Avis Client</span>
                            </div>

                            {/* Rating */}
                            <div className="bg-green-50/30 p-2 md:p-4 rounded-xl md:rounded-[20px] border border-green-50/50 flex flex-col items-center md:items-start text-green-600">
                                <div className="flex items-center gap-0.5 mb-0.5 md:mb-1">
                                    <span className="text-xs md:text-3xl font-black leading-none">
                                        {selectedStore.rating?.toFixed(1) || '0.0'}
                                    </span>
                                    <Star size={10} fill="currentColor" className="text-yellow-400 mb-0.5" />
                                </div>
                                <span className="text-[6.5px] md:text-[10px] font-black text-green-600 uppercase tracking-widest whitespace-nowrap">Note</span>
                            </div>
                        </div>

                        {/* Mobile Return Link - Cleaner look */}
                        <button
                            onClick={() => {
                                navigate('/');
                                setSearchTerm('');
                                setSelectedCategory('all');
                            }}
                            className="md:hidden mt-5 w-full flex items-center justify-center gap-2 text-gray-600 py-1 transition-all hover:text-gray-600"
                        >
                            <ChevronLeft size={14} strokeWidth={3} />
                            <span className="text-[10px] font-black uppercase tracking-[0.15em]">Marché principal</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderProductDetails = () => {
        if (!selectedProductDetails) {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500 animate-pulse">
                    <div className="w-16 h-16 border-4 border-[#f56b2a] border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-sm font-black uppercase tracking-widest">Chargement du produit...</p>
                </div>
            );
        }

        const relatedProducts = allProducts
            .filter(p => (p.category === selectedProductDetails.category || p.storeId === selectedProductDetails.storeId) && p.id !== selectedProductDetails.id && p.isOnline !== false)
            .slice(0, 5);

        return (
            <div className="max-w-7xl mx-auto px-0 md:px-4 py-0 md:py-10 space-y-0 md:space-y-12 mb-20 md:mb-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 md:gap-4 lg:gap-16 items-start">
                    {/* Media Gallery - Professional Layout */}
                    <div className="space-y-4">
                        <div className="relative aspect-square rounded-none md:rounded-[32px] overflow-hidden bg-white group/main cursor-zoom-in shadow-2xl shadow-orange-100/20 border-b md:border border-gray-100" onClick={() => { setCurrentZoomImage(selectedDetailImage); setIsImageModalOpen(true); }}>
                            <img loading="lazy" decoding="async"
                                src={selectedDetailImage || selectedProductDetails.image}
                                className="relative z-10 w-full h-full object-contain transition-transform duration-700 group-hover/main:scale-110"
                                alt={selectedProductDetails.name}
                            />

                        </div>

                        {/* Thumbnails - Scrollable Horizontal */}
                        {selectedProductDetails.images && selectedProductDetails.images.length > 1 && (
                            <div className="flex gap-2 md:gap-3 overflow-x-auto py-2 md:py-3 px-4 md:px-0 w-full justify-start md:justify-center scrollbar-none no-scrollbar">
                                {selectedProductDetails.images.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onMouseEnter={() => setSelectedDetailImage(img)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedDetailImage(img);
                                        }}
                                        className={`w-14 h-14 md:w-20 md:h-20 rounded-lg md:rounded-xl overflow-hidden cursor-pointer border-2 transition-all flex-shrink-0 shadow-sm relative group/thumb bg-white ${
                                            (selectedDetailImage === img || (!selectedDetailImage && idx === 0)) 
                                                ? 'border-[#f56b2a] ring-2 md:ring-4 ring-orange-50 scale-105' 
                                                : 'border-white hover:border-orange-200 hover:scale-[1.02]'
                                        }`}
                                    >
                                        <img src={img} className="relative z-10 w-full h-full object-contain" loading="lazy" />
                                        {(selectedDetailImage === img || (!selectedDetailImage && idx === 0)) && (
                                            <div className="absolute top-1 right-1 z-20 bg-[#f56b2a] text-white p-0.5 rounded-full shadow-sm animate-in zoom-in duration-300">
                                                <CheckCircle2 size={10} strokeWidth={3} />
                                            </div>
                                        )}
                                        <div className={`absolute inset-0 bg-white/40 transition-opacity duration-300 ${selectedDetailImage === img || (!selectedDetailImage && idx === 0) ? 'opacity-0' : 'opacity-0 group-hover/thumb:opacity-20'}`} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Product Info - Premium Typography */}
                    <div className="flex flex-col h-full py-2 px-4 md:px-0">
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-3">
                                <button
                                    onClick={() => navigate(`/store/${selectedProductDetails.storeSlug || selectedProductDetails.storeId}`)}
                                    className="px-3 py-1 bg-orange-50 text-[#f56b2a] text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-orange-100 transition-colors border border-orange-100"
                                >
                                    Vendu par {selectedProductDetails.storeName}
                                </button>
                            </div>
                            <div className="flex flex-col gap-4 mb-4">
                                <h1 className="text-xl md:text-3xl font-black text-gray-900 leading-[1.1] tracking-tight">
                                    {selectedProductDetails.name}
                                </h1>

                                <div className="flex flex-col items-start flex-shrink-0">
                                    <div className="flex items-baseline gap-2 h-fit">
                                        <span className="text-2xl md:text-3xl font-black text-[#f56b2a] tracking-tighter whitespace-nowrap">
                                            {formatCurrency(selectedProductDetails.price)}
                                        </span>
                                        {selectedProductDetails.category === 'Appartements' && (
                                            <span className="text-xs font-black text-gray-600 uppercase tracking-widest">/ nuit</span>
                                        )}
                                    </div>
                                    {selectedProductDetails.originalPrice && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-600 line-through font-medium">{formatCurrency(selectedProductDetails.originalPrice)}</span>
                                            <span className="text-[10px] font-black text-white bg-red-500 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                                -{Math.round(((selectedProductDetails.originalPrice - selectedProductDetails.price) / selectedProductDetails.originalPrice) * 100)}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-4 mb-6">
                                <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-100">
                                    <div className="flex text-yellow-500">
                                        {[1, 2, 3, 4, 5].map(s => <Star key={s} size={10} fill={s <= Math.round(selectedProductDetails.rating || 0) ? "currentColor" : "none"} />)}
                                    </div>
                                    <span className="text-[10px] font-black text-yellow-700">{(selectedProductDetails.rating || 0).toFixed(1)}</span>
                                </div>
                                <span className="text-[11px] font-bold text-gray-600 border-l border-gray-200 pl-4">{selectedProductDetails.reviewCount || 0} Avis Clients</span>
                                <span className="text-[11px] font-bold text-orange-600 border-l border-gray-200 pl-4 flex items-center gap-1.5">
                                    <ShoppingBag size={12} className="text-orange-500" /> {selectedProductDetails.salesCount || 0} Ventes
                                </span>
                            </div>
                        </div>

                        {selectedProductDetails.wholesalePrice && 
                            <div className="bg-gray-50/50 rounded-[32px] p-4 md:p-8 border border-gray-100 mb-6 backdrop-blur-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100/20 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-orange-200/30 transition-colors duration-700" />
                                <button 
                                    onClick={() => addWholesaleToCart(selectedProductDetails)}
                                    className="relative w-full bg-white/80 hover:bg-white border border-orange-100 rounded-2xl p-4 flex items-center justify-between transition-all hover:shadow-md hover:scale-[1.01] group/wholesale"
                                >
                                    <div className="flex flex-col items-start gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[8px] font-black text-[#f56b2a] uppercase tracking-widest">Prix de Gros</span>
                                            <span className="text-xs font-bold text-gray-900">
                                                {formatCurrency(selectedProductDetails.wholesalePrice)} <span className="text-[9px] text-gray-600 font-medium">(Min. {selectedProductDetails.wholesaleMinQty})</span>
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-[#f56b2a] font-black text-[9px] uppercase">Acheter <ArrowRight size={12} className="inline ml-1" /></div>
                                </button>
                            </div>
                        }

                        {/* Product Description - Collapsible & Formatted */}
                        <div className="mb-4 relative">
                            {(() => {
                                const isApartment = selectedProductDetails.category === 'Appartements';
                                let descriptionText = selectedProductDetails.description || "Découvrez ce produit exceptionnel sélectionné avec soin par votre boutique pour sa qualité et son style unique.";
                                let amenities: Record<string, boolean> | null = null;

                                if (isApartment && selectedProductDetails.description?.startsWith('{')) {
                                    try {
                                        const parsed = JSON.parse(selectedProductDetails.description);
                                        descriptionText = parsed.text || "";
                                        amenities = parsed.amenities || null;
                                    } catch (e) {}
                                }

                                return (
                                    <>
                                        <div 
                                            className={`text-gray-500 text-xs md:text-[15px] leading-relaxed font-medium transition-all duration-300 ${!isDescriptionExpanded ? 'line-clamp-3 md:line-clamp-none' : ''}`}
                                            style={{ whiteSpace: 'pre-line' }}
                                        >
                                            {descriptionText}
                                        </div>

                                        {amenities && (
                                            <div className="mt-6 pt-6 border-t border-gray-50">
                                                <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-widest mb-4">Ce que propose ce logement</h4>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                    {[
                                                        { id: 'wifi', label: 'Wi-Fi', icon: '📶' },
                                                        { id: 'ac', label: 'Climatisation', icon: '❄️' },
                                                        { id: 'generator', label: 'Groupe Électrogène', icon: '⚡' },
                                                        { id: 'water_reserve', label: 'Réserve d\'eau', icon: '🚰' },
                                                        { id: 'canalplus', label: 'Canal+ / DSTV', icon: '📡' },
                                                        { id: 'cleaning', label: 'Ménage', icon: '🧹' },
                                                        { id: 'balcony', label: 'Balcon', icon: '🌇' },
                                                        { id: 'parking', label: 'Parking', icon: '🚗' },
                                                        { id: 'pool', label: 'Piscine', icon: '🏊' },
                                                        { id: 'kitchen', label: 'Cuisine', icon: '🍳' },
                                                        { id: 'microwave', label: 'Micro-onde', icon: '⏲️' },
                                                        { id: 'security', label: 'Gardiennage', icon: '🛡️' }
                                                    ].filter(a => amenities![a.id]).map(amenity => (
                                                        <div key={amenity.id} className="flex items-center gap-2 bg-gray-50/50 p-2 rounded-xl border border-gray-50 transition-all hover:bg-white hover:shadow-sm group">
                                                            <span className="text-sm group-hover:scale-110 transition-transform">{amenity.icon}</span>
                                                            <span className="text-[10px] font-bold text-gray-600">{amenity.label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {(descriptionText && descriptionText.length > 150) && (
                                            <button 
                                                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                                                className="mt-2 text-[#f56b2a] font-black text-[10px] md:hidden uppercase tracking-widest flex items-center gap-1 active:scale-95 transition-all"
                                            >
                                                {isDescriptionExpanded ? 'Voir moins' : 'Lire la suite'}
                                                <ChevronRight size={10} className={`transition-transform duration-300 ${isDescriptionExpanded ? '-rotate-90' : 'rotate-90'}`} />
                                            </button>
                                        )}
                                    </>
                                );
                            })()}
                        </div>

                        <div className="mb-4 flex gap-4 overflow-x-auto no-scrollbar py-1">
                            <div className="flex-shrink-0 flex items-center gap-2 bg-gray-50/80 px-3 py-2 rounded-xl border border-gray-100">
                                <ShieldCheck size={16} className="text-[#f56b2a]" />
                                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Garantie</span>
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-2 bg-gray-50/80 px-3 py-2 rounded-xl border border-gray-100">
                                <Truck size={16} className="text-[#f56b2a]" />
                                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Livraison</span>
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-2 bg-gray-50/80 px-3 py-2 rounded-xl border border-gray-100">
                                <CheckCircle2 size={16} className="text-[#f56b2a]" />
                                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Retours</span>
                            </div>
                        </div>

                        <button
                            onClick={() => addToCart(selectedProductDetails)}
                            className="flex w-full py-4 bg-[#f56b2a] text-white rounded-[20px] font-black text-base shadow-xl shadow-orange-100 hover:bg-[#d55a20] transition-all items-center justify-center gap-3 active:scale-[0.98]"
                        >
                            {selectedProductDetails.category === 'Appartements' ? (
                                <><CheckCircle2 size={20} strokeWidth={3} /> Réserver cet Appartement</>
                            ) : (
                                <><ShoppingCart size={20} strokeWidth={3} /> Ajouter au panier</>
                            )}
                        </button>

                    </div>
                </div>

                {/* Customer Reviews Section */}
                <div className="mx-4 md:mx-0 bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide mb-1">Avis clients</h3>
                            <div className="flex items-center gap-2">
                                <div className="flex text-yellow-400">
                                    {[1, 2, 3, 4, 5].map(s => <Star key={s} size={12} fill={s <= Math.round(selectedProductDetails.rating || 0) ? "currentColor" : "none"} />)}
                                </div>
                                <span className="text-xs font-bold text-gray-600">{(selectedProductDetails.rating || 0).toFixed(1)}/5</span>
                                <span className="text-[10px] text-gray-600 font-medium">({selectedProductDetails.reviewCount || 0} avis)</span>
                            </div>
                        </div>
                        <button
                            onClick={() => { setShowReviewForm(true); setReviewStep(1); }}
                            className="bg-gray-900 text-white px-4 py-2 rounded-xl font-bold text-[11px] hover:bg-[#f56b2a] transition-all flex items-center gap-1.5 active:scale-95"
                        >
                            <MessageCircle size={13} /> Laisser une note
                        </button>
                    </div>

                    {/* Rating Distribution */}
                    {(selectedProductDetails.reviews?.length || 0) > 0 && (
                        <div className="mb-5 p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                            <div className="space-y-1">
                                {[5, 4, 3, 2, 1].map(star => {
                                    const count = selectedProductDetails.reviews?.filter(r => r.rating === star).length || 0;
                                    const total = selectedProductDetails.reviews?.length || 1;
                                    const pct = Math.round((count / total) * 100);
                                    return (
                                        <div key={star} className="flex items-center gap-2">
                                            <span className="text-[9px] font-bold text-gray-600 w-3 text-right">{star}</span>
                                            <Star size={9} className="text-yellow-400" fill="currentColor" />
                                            <div className="flex-grow h-1.5 bg-gray-200/80 rounded-full overflow-hidden">
                                                <div className="h-full bg-yellow-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                                            </div>
                                            <span className="text-[9px] font-bold text-gray-600 w-6">{pct}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Reviews List */}
                    <div className="space-y-4">
                        {selectedProductId && loadingReviews[selectedProductId] ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="w-6 h-6 text-[#f56b2a] animate-spin" />
                            </div>
                        ) : (selectedProductDetails.reviews?.length || 0) > 0 ? (
                            <>
                                {(showAllProductReviews 
                                    ? selectedProductDetails.reviews 
                                    : selectedProductDetails.reviews?.slice(0, 3)
                                )?.map((review, idx) => (
                                    <div key={idx} className="flex gap-3 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex-shrink-0 flex items-center justify-center text-[10px] font-black text-gray-500">
                                            {review.author?.[0]?.toUpperCase() || 'A'}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <div className="flex items-center justify-between gap-2 mb-0.5">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <h4 className="text-[11px] font-black text-gray-900 truncate">{review.author}</h4>
                                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                                        {[1, 2, 3, 4, 5].map(s => <Star key={s} size={8} className="text-yellow-400" fill={s <= review.rating ? "currentColor" : "none"} />)}
                                                    </div>
                                                </div>
                                                <span className="text-[9px] font-medium text-gray-500 flex-shrink-0">{new Date(review.date).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 leading-relaxed">{review.comment}</p>
                                        </div>
                                    </div>
                                ))}

                                {selectedProductDetails.reviews && selectedProductDetails.reviews.length > 3 && !showAllProductReviews && (
                                    <button
                                        onClick={() => setShowAllProductReviews(true)}
                                        className="w-full py-3 mt-2 bg-gray-50 text-gray-900 text-[11px] font-black uppercase tracking-widest rounded-xl border border-gray-100 hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                                    >
                                        Voir plus d'avis ({selectedProductDetails.reviews.length - 3})
                                        <ChevronRight size={14} className="rotate-90" />
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                                <MessageCircle size={20} className="mx-auto mb-2 text-gray-500" />
                                <p className="text-[11px] text-gray-600 font-bold">Aucun avis pour le moment</p>
                                <p className="text-[9px] text-gray-500 mt-0.5">Soyez le premier à partager votre expérience !</p>
                            </div>
                        )}
                    </div>
                </div>

                {relatedProducts.length > 0 && (
                    <div className="px-4 md:px-0 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                                <Star className="text-yellow-500" fill="currentColor" size={18} /> Vous pourriez aussi aimer
                            </h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
                            {relatedProducts.map(product => (
                                <div key={`${product.storeId}-${product.id}`} onClick={() => navigate(`/product/${generateProductSlug(product)}`)} className="cursor-pointer">
                                    <ProductCard product={product as any} onAddToCart={addToCart as any} onStoreSelect={(id) => navigate(`/store/${product.storeSlug || id}`)} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderCart = () => {
        return (
            <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-500">
                <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-white text-gray-900 z-10 shrink-0">
                    <h2 className="text-sm md:text-lg font-black flex items-center gap-1.5 leading-tight">
                        {checkoutStage === 'cart' ? <ShoppingCart className="text-[#f56b2a]" size={16} /> : <ShieldCheck className="text-green-500" size={16} />}
                        <span className="truncate">{checkoutStage === 'cart' ? 'Mon Panier' : checkoutStage === 'shipping' ? 'Livraison' : checkoutStage === 'payment' ? 'Paiement' : 'Commande Validée'}</span>
                    </h2>
                    <button onClick={() => { navigate('/'); setCheckoutStage('cart'); setCompletedOrderStores([]); setCompletedOrderItems([]); setCompletedOrderTotal(0); }} className="px-2.5 py-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500 font-black text-[9px] uppercase tracking-tighter flex items-center gap-1 whitespace-nowrap">
                        <ChevronLeft size={12} /> Continuer les achats
                    </button>
                </div>

                {/* Step Indicator */}
                {checkoutStage !== 'success' && (
                    <div className="bg-gray-50/50 px-4 md:px-8 py-2 border-b border-gray-100">
                        <div className="flex items-center justify-between max-w-2xl mx-auto">
                            {[
                                { id: 'cart', label: 'Panier', icon: ShoppingCart },
                                { id: 'shipping', label: 'Livraison', icon: MapPin },
                                { id: 'payment', label: 'Paiement', icon: CreditCard }
                            ].map((stage, idx, array) => {
                                const Icon = stage.icon;
                                const isActive = stage.id === checkoutStage;
                                const isPast = array.findIndex(s => s.id === checkoutStage) > idx;
                                return (
                                    <React.Fragment key={stage.id}>
                                        <div className="flex flex-col items-center gap-2 shrink-0">
                                            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-[#f56b2a] text-white shadow-lg shadow-orange-100 scale-110' : isPast ? 'bg-green-100 text-green-600' : 'bg-white border-2 border-gray-100 text-gray-500'}`}>
                                                {isPast ? <CheckCircle2 size={18} /> : <Icon size={isActive ? 18 : 16} />}
                                            </div>
                                            <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-gray-900' : isPast ? 'text-green-600' : 'text-gray-500'}`}>{stage.label}</span>
                                        </div>
                                        {idx < array.length - 1 && (
                                            <div className="flex-grow h-[2px] mx-2 md:mx-4 bg-gray-100 rounded-full overflow-hidden">
                                                <div className={`h-full bg-[#f56b2a] transition-all duration-700 ${isPast ? 'w-full' : 'w-0'}`} />
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex-grow overflow-y-auto custom-scrollbar bg-gray-50/50 p-3 md:p-8">
                    {checkoutStage === 'cart' && (
                        cart.length > 0 ? (
                            <div className="space-y-4">
                                {Array.from(new Set(cart.filter(i => i.product?.storeId).map(item => item.product.storeId))).map(storeId => (
                                    <div key={storeId} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
                                        <div className="flex items-center gap-2 mb-3 px-2">
                                            <Store size={12} className="text-[#f56b2a]" />
                                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Vendu par</span>
                                            <span className="text-[11px] font-black text-gray-900 border-b-2 border-orange-100 pb-0.5">
                                                {cart.find(i => i.product?.storeId === storeId)?.product.storeName || 'Boutique'}
                                            </span>
                                        </div>
                                        <div className="space-y-4">
                                            {cart.filter(item => item.product?.storeId === storeId).map((item) => (
                                                <div key={item.product.id} className="flex gap-3">
                                                    <div className="w-16 h-16 flex-shrink-0">
                                                        <ProductImage src={item.product.image} alt={item.product.name || 'Product Image'} containerClassName="rounded-xl border border-gray-100 shadow-sm" showZoomEffect={false} />
                                                    </div>
                                                    <div className="flex-grow flex flex-col justify-between">
                                                        <div className="flex justify-between items-start">
                                                            <h4 className="text-sm font-bold text-gray-800 line-clamp-1">{item.product.name || 'Unknown Product'}</h4>
                                                            <button onClick={() => removeFromCart(item.product.id, item.product.storeId)} className="text-gray-600 hover:text-red-500 p-1"><X size={14} /></button>
                                                        </div>
                                                        <div className="flex items-center justify-between mt-2">
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-black text-[#f56b2a] text-xs">{formatCurrency(getEffectiveItemPrice(item))}</span>
                                                                    {item.product.wholesalePrice && Number(item.quantity) >= Number(item.product.wholesaleMinQty) && (
                                                                        <span className="text-[10px] text-gray-500 line-through font-bold">
                                                                            {formatCurrency(Number(item.product.price))}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {item.product.wholesalePrice && (
                                                                    <div className={`mt-0.5 text-[8px] md:text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${item.quantity >= (item.product.wholesaleMinQty || 0) ? 'text-green-600' : 'text-gray-600'}`}>
                                                                        {item.quantity >= (item.product.wholesaleMinQty || 0) ? (
                                                                            <><CheckCircle2 size={10} /> Tarif de gros appliqué</>
                                                                        ) : (
                                                                            <><Zap size={10} fill="currentColor" /> Plus que {Number(item.product.wholesaleMinQty) - item.quantity} pour le prix de gros</>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {promoApplied && promoApplied.storeId === item.product.storeId && (
                                                                    <span className="text-[10px] text-green-600 font-bold">Coupon appliqué</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1 border border-gray-200 shadow-inner">
                                                                <button onClick={() => updateQuantity(item.product.id, item.product.storeId, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 font-bold">-</button>
                                                                <span className="text-xs font-black text-gray-900 w-4 text-center">{item.quantity}</span>
                                                                <button onClick={() => updateQuantity(item.product.id, item.product.storeId, 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 font-bold">+</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center py-20 text-gray-600">
                                <ShoppingCart size={64} className="opacity-20 mb-4" />
                                <p className="text-lg font-black text-gray-900">Votre panier est vide</p>
                            </div>
                        )
                    )}
                    {(checkoutStage === 'shipping' || checkoutStage === 'payment') && (
                        <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-6">
                            {checkoutStage === 'shipping' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    {/* Section 1: Informations Personnelles */}
                                    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
                                        <div className="flex items-center gap-3 mb-8">
                                            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#f56b2a] flex items-center justify-center font-black text-sm">1</div>
                                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Vos Informations</h3>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-600 uppercase ml-1">Nom Complet</label>
                                                <div className="relative group">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#f56b2a] transition-colors">
                                                        <User size={18} />
                                                    </div>
                                                    <input
                                                        required
                                                        type="text"
                                                        value={customerInfo.name}
                                                        onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:bg-white transition-all no-global-border"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-600 uppercase ml-1">Téléphone Mobile</label>
                                                <div className="relative group">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#f56b2a] transition-colors">
                                                        <Phone size={18} />
                                                    </div>
                                                    <input
                                                        required
                                                        type="tel"
                                                        value={customerInfo.phone}
                                                        onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:bg-white transition-all no-global-border"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 2: Adresse de Livraison */}
                                    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
                                        <div className="flex items-center gap-3 mb-8">
                                            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#f56b2a] flex items-center justify-center font-black text-sm">2</div>
                                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Adresse de Livraison</h3>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-600 uppercase ml-1">Adresse (Rue, Quartier...)</label>
                                                <div className="relative group">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#f56b2a] transition-colors">
                                                        <MapPin size={18} />
                                                    </div>
                                                    <input
                                                        required
                                                        type="text"
                                                        value={customerInfo.address}
                                                        onChange={e => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                                                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:bg-white transition-all no-global-border"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-gray-600 uppercase ml-1">Ville</label>
                                                    <input
                                                        required
                                                        type="text"
                                                        value={customerInfo.city}
                                                        onChange={e => setCustomerInfo({ ...customerInfo, city: e.target.value })}
                                                        className="w-full px-5 py-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:bg-white transition-all no-global-border"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            )}
                            {checkoutStage === 'payment' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div onClick={() => setPaymentMethod('cod')} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === 'cod' ? 'border-[#f56b2a] bg-orange-50' : 'border-gray-100 bg-white'}`}>
                                            <Truck size={24} className={paymentMethod === 'cod' ? 'text-[#f56b2a]' : 'text-gray-600'} />
                                            <div className="mt-2 font-black text-sm text-gray-900">Paiement à la livraison</div>
                                        </div>
                                        <div onClick={() => setPaymentMethod('card')} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === 'card' ? 'border-[#f56b2a] bg-orange-50' : 'border-gray-100 bg-white'}`}>
                                            <CreditCard size={24} className={paymentMethod === 'card' ? 'text-[#f56b2a]' : 'text-gray-600'} />
                                            <div className="mt-2 font-black text-sm text-gray-900">Carte Bancaire</div>
                                        </div>
                                    </div>
                                    {paymentMethod === 'card' && (
                                        <div className="space-y-3 p-4 bg-gray-100 rounded-2xl">
                                            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200">
                                                <ShieldCheck size={20} className="text-green-500 flex-shrink-0" />
                                                <div className="text-xs font-bold text-gray-600">
                                                    Paiement sécurisé par FusionPay
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-gray-500 text-center">
                                                Vous serez redirigé vers le formulaire de paiement sécurisé
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </form>
                    )}
                    {checkoutStage === 'success' && (
                        <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-in fade-in zoom-in duration-1000 relative overflow-hidden">
                            {/* Animated Particles background */}
                            <div className="absolute inset-0 pointer-events-none">
                                {[...Array(12)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="absolute w-2 h-2 rounded-full bg-green-400/30 animate-particle"
                                        style={{
                                            left: `${Math.random() * 100}%`,
                                            top: `${Math.random() * 100}%`,
                                            animationDelay: `${Math.random() * 2}s`
                                        }}
                                    />
                                ))}
                            </div>

                            <div className="relative mb-10">
                                <div className="absolute inset-0 bg-green-100 rounded-full blur-2xl opacity-50 scale-150 animate-pulse" />
                                <div className="relative w-24 h-24 bg-green-500 text-white rounded-full flex items-center justify-center shadow-2xl success-glow animate-success-bounce">
                                    <CheckCircle2 size={48} strokeWidth={3} />
                                </div>
                                <div className="absolute -right-2 -top-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-white shadow-lg animate-bounce delay-300">
                                    <Star size={18} fill="currentColor" />
                                </div>
                            </div>

                            <h3 className="text-2xl md:text-3xl font-black text-gray-900 mb-3 tracking-tight leading-tight animate-in slide-in-from-bottom-4 duration-700 delay-300">
                                Commande <span className="text-green-500">Réussie !</span>
                            </h3>

                            <div className="w-10 h-1 bg-green-500 rounded-full mb-4 mx-auto" />

                            <p className="text-gray-500 max-w-sm mb-8 font-bold text-sm leading-relaxed animate-in fade-in duration-1000 delay-500">
                                Votre commande a été enregistrée avec succès.<br className="hidden md:block" />
                                Le vendeur va traiter votre commande rapidement.
                            </p>



                            <div className="animate-in slide-in-from-bottom-8 duration-700 delay-700 w-full flex flex-col items-center">
                                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest text-center mb-3">
                                    Cliquez sur un bouton pour continuer
                                </p>
                                <div className="flex gap-3 w-full max-w-sm">
                                    <button
                                        onClick={() => {
                                            navigate('/');
                                        }}
                                        className="flex-1 bg-gray-900 hover:bg-black text-white px-2 py-3.5 rounded-2xl font-black text-[10px] transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-1 group whitespace-nowrap"
                                    >
                                        Accueil
                                        <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                    {(() => {
                                        const store = stores.find(s => s.id === completedOrderStores[0].storeId);
                                        const storePhone = store?.phone || store?.settings?.phone;
                                        if (completedOrderStores.length === 1 && storePhone) {
                                            return (
                                                <a
                                                    href={`https://wa.me/${storePhone.replace(/\D/g, '')}?text=${encodeURIComponent(`📦 NOUVELLE COMMANDE #${Date.now().toString().slice(-6)}\n\nClient: ${customerInfo.name || 'Anonyme'}\nTéléphone: ${customerInfo.phone || 'Non fourni'}\n\nArticles:\n${completedOrderItems.map(item => `• ${item.quantity}x ${item.name} - ${formatCurrency(item.price * item.quantity)}`).join('\n')}\n\nTotal: ${formatCurrency(completedOrderTotal)}\nMode de paiement: ${paymentMethod === 'cod' ? 'Espèces' : 'Carte'}`)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex-1 bg-green-500 hover:bg-green-600 text-white px-2 py-3.5 rounded-2xl font-black text-[10px] transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-1 whitespace-nowrap"
                                                >
                                                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor">
                                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.162-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                                    </svg>
                                                    WhatsApp
                                                </a>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {checkoutStage !== 'success' && cart.length > 0 && (
                    <div className="p-4 bg-white border-t border-gray-100">
                        <div className="space-y-2 mb-6 text-sm">
                            <div className="flex justify-between items-center text-gray-500"><span>Sous-total</span><span className="font-bold">{formatCurrency(Number(baseCartTotal) || 0)}</span></div>
                            {promoApplied && <div className="flex justify-between items-center text-green-600 font-bold"><span>Remise ({promoApplied.code})</span><span>-{formatCurrency(Number(discountAmount) || 0)}</span></div>}
                            <div className="flex justify-between items-center text-xl font-black text-gray-900 pt-2 border-t border-gray-100"><span>Total</span><span className="text-[#f56b2a]">{formatCurrency(Number(cartTotal) || 0)}</span></div>
                        </div>

                        {/* Code Promo Input */}
                        {!promoApplied && checkoutStage === 'cart' && (
                            <div className="mb-4">
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        value={promoCodeInput}
                                        onChange={(e) => setPromoCodeInput(e.target.value)}
                                        placeholder="Code promo"
                                        className="flex-grow px-3 py-2.5 sm:px-4 sm:py-2.5 bg-gray-50 border border-gray-100 rounded-xl font-bold text-xs sm:text-sm uppercase w-full"
                                    />
                                    <button
                                        onClick={handlePromoApply}
                                        disabled={!promoCodeInput.trim()}
                                        className="px-4 py-2.5 bg-gray-900 text-white rounded-xl font-black text-xs sm:text-sm disabled:opacity-50 whitespace-nowrap"
                                    >
                                        Appliquer
                                    </button>
                                </div>
                            </div>
                        )}

                        {promoApplied && (
                            <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-2 bg-green-50 px-3 sm:px-4 py-2.5 rounded-xl border border-green-100">
                                <span className="text-green-600 font-bold text-xs sm:text-sm">Code appliqué: {promoApplied.code}</span>
                                <button onClick={() => setPromoApplied(null)} className="text-gray-600 hover:text-red-500 p-1">
                                    <X size={16} />
                                </button>
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            {checkoutStage === 'cart' && (
                                <button onClick={() => {
                                    performAction(() => {
                                        setCheckoutStage('shipping');
                                    }, 400);
                                }} className="w-full py-4 bg-[#f56b2a] text-white rounded-2xl font-black text-lg shadow-lg shadow-red-100 hover:bg-red-600 transition-all flex items-center justify-center gap-2">Continuer la commande <ChevronLeft size={20} className="rotate-180" /></button>
                            )}
                            {(checkoutStage === 'shipping' || checkoutStage === 'payment') && (
                                <>
                                    <button
                                        form="checkout-form"
                                        type="submit"
                                        disabled={isProcessingPayment}
                                        className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isProcessingPayment ? (
                                            <>
                                                <Loader2 size={20} className="animate-spin" />
                                                Traitement en cours...
                                            </>
                                        ) : checkoutStage === 'shipping' ? 'Passer au paiement' : 'Confirmer la commande'}
                                    </button>
                                    <button
                                        onClick={() => setCheckoutStage(checkoutStage === 'shipping' ? 'cart' : 'shipping')}
                                        className="w-full py-2 text-gray-600 font-bold text-xs hover:text-gray-600 transition-all"
                                    >
                                        ← Retour à l'étape précédente
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50 font-sans pb-[100px] md:pb-0 overflow-x-hidden w-full max-w-[100vw]">

            {/* Global Notifications (Toasts) */}
            <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-4 pointer-events-none items-end">
                {toastNotifications.map(notif => (
                    <Toast key={notif.id} notification={notif} onRemove={removeToast} />
                ))}
            </div>

            <MarketplaceBottomNav 
                cartItemsCount={cartItemsCount}
                onSearchClick={() => {
                    setIsSearchOpen(true);
                }}
                onHomeClick={() => setIsSearchOpen(false)}
            />

            {/* Premium Sticky Header */}
            {(location.pathname === '/' || !location.pathname || location.pathname === '') && (
                <header className="bg-white/90 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-[100] transition-all">
                    <div className="container mx-auto px-4">
                        {/* Top Utility Bar - Hidden on scroll or simplified for mobile */}


                        {/* Main Interaction Bar */}
                        <div className="flex items-center justify-between py-4">
                            {/* Logo with modern typography */}
                            <div
                                className="flex items-center cursor-pointer group flex-shrink-0"
                                onClick={() => {
                                    performAction(() => {
                                        navigate('/');
                                        setSearchTerm('');
                                        setSelectedCategory('all');
                                    }, 400);
                                }}
                            >
                                <div className="w-8 h-8 md:w-10 md:h-10 bg-[#f56b2a] rounded-2xl flex items-center justify-center shadow-lg shadow-orange-100 group-hover:scale-110 transition-transform mr-2 md:mr-3">
                                    <ShoppingBasketIcon size={20} className="text-white md:hidden" />
                                    <ShoppingBasketIcon size={24} className="text-white hidden md:block" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-base md:text-2xl font-black tracking-tight leading-none text-gray-900">
                                        Market<span className="text-[#f56b2a]">Place</span>
                                    </span>
                                    <span className="hidden md:block text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] leading-none mt-1">Local & Express</span>
                                </div>
                            </div>

                            {/* Search Bar - Desktop Only version */}
                            <div className="hidden md:block flex-grow max-w-[600px] mx-8 relative">
                                <div className="flex items-center bg-white rounded-2xl overflow-hidden border-[1.5px] border-[rgba(245,107,42,0.2)] hover:border-[rgba(245,107,42,0.5)] focus-within:border-[#f56b2a] focus-within:shadow-xl focus-within:shadow-orange-100/20 transition-all group">
                                    <div className="pl-4 text-gray-600 group-focus-within:text-[#f56b2a]">
                                        <Search size={18} strokeWidth={2.5} />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Chercher un produit, une boutique..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-transparent py-3 px-3 text-sm font-bold text-gray-800 focus:outline-none placeholder-gray-400 no-global-border border-none"
                                    />
                                    <button className="bg-[#f56b2a] hover:bg-[#d55a20] text-white px-6 py-3 font-black text-sm transition-all active:scale-95">
                                        Rechercher
                                    </button>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2">
                                <div className="relative group">
                                    <button
                                        onClick={() => {
                                            if (checkoutStage === 'success') {
                                                setCheckoutStage('cart');
                                                setCompletedOrderStores([]);
                                                setCompletedOrderItems([]);
                                                setCompletedOrderTotal(0);
                                            }
                                            navigate('/cart');
                                        }}
                                        className="w-9 h-9 md:w-12 md:h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-900 group-hover:bg-[#f56b2a] group-hover:text-white transition-all active:scale-90"
                                    >
                                        <ShoppingCart size={20} className="md:hidden" strokeWidth={2.5} />
                                        <ShoppingCart size={22} className="hidden md:block" strokeWidth={2.5} />
                                        {cartItemsCount > 0 && (
                                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#f56b2a] border-2 border-white rounded-full flex items-center justify-center text-[10px] font-black text-white animate-in zoom-in">
                                                {cartItemsCount}
                                            </div>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Full Width Search Bar - Mobile Only */}
                        <div className="md:hidden pb-2">
                            <div className="flex items-center bg-white rounded-xl overflow-hidden border-[1.5px] border-[rgba(245,107,42,0.2)] hover:border-[rgba(245,107,42,0.5)] focus-within:border-[#f56b2a] focus-within:shadow-xl transition-all group">
                                <div className="pl-3 text-gray-600 group-focus-within:text-[#f56b2a]">
                                    <Search size={16} strokeWidth={2.5} />
                                </div>
                                <input
                                    id="mobile-search-input"
                                    type="text"
                                    placeholder="Je cherche..."
                                    readOnly
                                    onClick={() => setIsSearchOpen(true)}
                                    className="w-full bg-transparent py-2 px-3 text-[11px] font-bold text-gray-800 focus:outline-none placeholder-gray-400 no-global-border border-none cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Dynamic Horizontal Categories - Scrollable */}
                        <div className="flex items-center gap-2 py-2 overflow-x-auto no-scrollbar mask-fade-right -mx-4 px-4 whitespace-nowrap">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => {
                                        setSelectedCategory(cat);
                                        if (location.pathname.includes('/product/') || location.pathname.includes('/cart')) {
                                            navigate('/');
                                        }
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all border-2 active:scale-95 whitespace-nowrap ${selectedCategory === cat
                                            ? 'bg-[#f56b2a] border-[#f56b2a] text-white shadow-md'
                                            : 'bg-white border-gray-100 text-gray-600 hover:border-gray-200'
                                        }`}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full ${selectedCategory === cat ? 'bg-white' : 'bg-gray-200'}`} />
                                    {cat === 'all' ? 'Tout voir' : cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>
            )}

            {cartNotif && lastAddedProduct && (
                <div className="fixed top-4 right-4 left-4 md:left-auto md:w-[340px] z-[1000] animate-in slide-in-from-top-10 fade-in duration-400 px-2 md:px-0">
                    <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white/20 overflow-hidden">
                        {/* Progress bar at the bottom for top-toasts feels better or keep top */}
                        <div className="p-3">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white flex-shrink-0 border border-gray-100 shadow-sm">
                                    <img loading="lazy" decoding="async" src={lastAddedProduct.image} alt={lastAddedProduct.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-grow min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <CheckCircle2 size={12} className="text-green-500" strokeWidth={3} />
                                        <span className="text-[9px] font-black text-green-600 uppercase tracking-widest leading-none">Ajouté au panier</span>
                                    </div>
                                    <p className="text-[11px] font-bold text-gray-900 truncate leading-snug">{lastAddedProduct.name}</p>
                                    <p className="text-[11px] font-black text-[#f56b2a] mt-0.5">{formatCurrency(Number(lastAddedProduct.price) || 0)}</p>
                                </div>
                                <button onClick={() => setCartNotif(false)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-600 self-start">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        {/* Tiny progress line at the very bottom */}
                        <div className="h-0.5 bg-gray-100 w-full overflow-hidden">
                            <div className="h-full bg-green-500/50 animate-[shrink_4s_linear_forwards]" style={{ animation: 'shrink 4s linear forwards' }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Global Search Overlay */}
            {isSearchOpen && (
                <div className="fixed inset-0 z-[1000] bg-white animate-in fade-in duration-300 flex flex-col">
                    <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                        <button 
                            onClick={() => setIsSearchOpen(false)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                         aria-label="Fermer la recherche">
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex-grow relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f56b2a]" size={18} />
                            <input 
                                autoFocus
                                type="text"
                                placeholder="Chercher un produit, une boutique..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-50 pl-10 pr-4 py-3 rounded-2xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 no-global-border border-none"
                            />
                            {searchTerm && (
                                <button 
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-600"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-grow overflow-y-auto px-4 py-6">
                        {searchTerm ? (
                            <div className="space-y-8">
                                {/* Stores Results */}
                                {globalSearchStores.length > 0 && (
                                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                                        <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Store size={12} /> Boutiques ({globalSearchStores.length})
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3 pb-4">
                                            {globalSearchStores.map(store => (
                                                <div 
                                                    key={store.id}
                                                    onClick={() => {
                                                        performAction(() => {
                                                            navigate(`/store/${store.slug || store.id}`);
                                                            setIsSearchOpen(false);
                                                        }, 400);
                                                    }}
                                                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group active:scale-[0.98]"
                                                >
                                                    <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-inner overflow-hidden border-2 border-orange-50">
                                                        {store.settings?.logo ? (
                                                            <img loading="lazy" decoding="async" src={store.settings.logo} alt={store.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Store className="text-[#f56b2a]" size={28} />
                                                        )}
                                                    </div>
                                                    <h3 className="font-bold text-gray-800 text-[11px] mb-1 leading-tight line-clamp-1">{store.settings?.name || 'Boutique'}</h3>
                                                    <div className="flex flex-col gap-0.5">
                                                        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-tighter">
                                                            {(store.products || []).filter(p => p.isOnline !== false && p.image).length} PROD.
                                                        </p>
                                                        <p className="text-[9px] text-[#f56b2a] font-black tracking-wider">
                                                            @{(store.slug || 'boutique').toLowerCase()}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Products Results */}
                                {filteredProducts.length > 0 ? (
                                    <div className="animate-in slide-in-from-bottom-4 duration-500 delay-100">
                                        <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <ShoppingCart size={12} /> Produits
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            {filteredProducts
                                                .slice(0, 20)
                                                .map(product => (
                                                    <div 
                                                        key={product.id}
                                                        onClick={() => {
                                                            navigate(`/product/${generateProductSlug(product)}`);
                                                            setIsSearchOpen(false);
                                                        }}
                                                        className="cursor-pointer"
                                                    >
                                                        <ProductCard 
                                                            product={product as any}
                                                            onAddToCart={addToCart as any}
                                                            onStoreSelect={(id) => {
                                                                navigate(`/store/${product.storeSlug || id}`);
                                                                setIsSearchOpen(false);
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                ) : globalSearchStores.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-500">
                                            <Search size={32} />
                                        </div>
                                        <p className="text-gray-900 font-black">Pas de résultats pour "{searchTerm}"</p>
                                        <p className="text-gray-600 text-xs mt-1 font-bold">Vérifiez l'orthographe ou essayez un autre mot.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                    <Zap size={12} className="text-orange-500" fill="currentColor" /> Recherches Populaires
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {['iPhone', 'Samsung', 'Mode', 'Sneakers', 'Parfums', 'High-Tech'].map(tag => (
                                        <button 
                                            key={tag}
                                            onClick={() => setSearchTerm(tag)}
                                            className="px-4 py-2 bg-gray-50 hover:bg-orange-50 hover:text-[#f56b2a] rounded-full text-xs font-bold text-gray-600 border border-gray-100 transition-all active:scale-95"
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                                

                            </div>
                        )}
                    </div>
                </div>
            )}

            <main className={`container mx-auto ${selectedProductId ? 'px-0' : 'px-4'} ${selectedStoreParam || selectedProductId ? 'pt-0 pb-4' : 'py-4'} md:py-8 flex-grow`}>
                <Routes>
                    <Route index element={
                        <>
                            {/* Hero Bannière Premium - Carousel */}
                            {!searchTerm && selectedCategory === 'all' && (
                                <div className="mb-10 mt-2 md:mt-6 relative group overflow-hidden rounded-[32px] md:rounded-[40px] isolation-auto">
                                    <div className="relative w-full min-h-[260px] md:h-[300px] flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                                        {/* Slide 1 - Vendre */}
                                        <div className="min-w-full relative bg-gradient-to-br from-[#fff1eb] to-[#ace0f9]/20 flex items-center justify-center border border-white">
                                            <div className="absolute left-0 top-0 w-full h-full overflow-hidden">
                                                <div className="absolute -left-10 -top-10 w-40 h-40 bg-orange-200/30 rounded-full blur-3xl animate-pulse" />
                                                <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-blue-100/40 rounded-full blur-3xl" />
                                            </div>
                                            <div className="relative z-10 flex flex-col items-center text-center px-4 py-8 md:py-0 max-w-2xl animate-in fade-in zoom-in duration-700">
                                                <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-md px-3 py-1 rounded-full border border-orange-100 mb-6 font-black text-[10px] text-[#f56b2a] uppercase tracking-widest">
                                                    <Zap size={14} fill="currentColor" /> Offre Commerçant
                                                </div>
                                                <h2 className="text-2xl md:text-[40px] font-black text-gray-900 mb-4 tracking-tight leading-[1.1]">
                                                    C'est le moment <span className="text-[#f56b2a]">de vendre</span>
                                                </h2>
                                                <p className="text-gray-500 text-xs md:text-lg font-bold mb-6 max-w-md">
                                                    Boostez votre visibilité et attirez plus de clients dès aujourd'hui sur notre plateforme express.
                                                </p>
                                                <button onClick={() => setShowPropulseModal(true)} className="bg-gray-900 hover:bg-[#f56b2a] text-white px-8 py-4 rounded-2xl font-black text-base transition-all shadow-xl active:scale-95">
                                                    Propulser ma boutique
                                                </button>
                                            </div>
                                        </div>

                                        {/* Slide 2 - Gestion */}
                                        <div className="min-w-full relative bg-gradient-to-br from-[#e0f2fe] to-[#f0f9ff] flex items-center justify-center border border-white">
                                            <div className="absolute inset-0 overflow-hidden">
                                                <div className="absolute right-0 top-0 w-80 h-80 bg-blue-200/20 rounded-full blur-3xl" />
                                            </div>
                                            <div className="relative z-10 flex flex-col items-center text-center px-4 py-8 md:py-0 max-w-2xl animate-in fade-in slide-in-from-right-10 duration-700">
                                                <div className="inline-flex items-center gap-2 bg-blue-500 text-white px-3 py-1 rounded-full mb-6 font-black text-[10px] uppercase tracking-widest">
                                                    <ShieldCheck size={14} /> Gestion Pro
                                                </div>
                                                <h2 className="text-2xl md:text-[40px] font-black text-gray-900 mb-4 tracking-tight leading-[1.1]">
                                                    Gérez votre <span className="text-blue-500">stock facilement</span>
                                                </h2>
                                                <p className="text-gray-500 text-xs md:text-lg font-bold mb-6 max-w-md">
                                                    Un inventaire synchronisé et des alertes automatiques pour ne jamais manquer une vente.
                                                </p>
                                                <button onClick={onBackToApp} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black text-base transition-all shadow-xl active:scale-95">
                                                    Accéder au Dashboard
                                                </button>
                                            </div>
                                        </div>

                                        {/* Slide 3 - Croissance */}
                                        <div className="min-w-full relative bg-gradient-to-br from-[#fef2f2] to-[#fff1f2] flex items-center justify-center border border-white">
                                            <div className="absolute inset-0 overflow-hidden">
                                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-100/30 rounded-full blur-[100px]" />
                                            </div>
                                            <div className="relative z-10 flex flex-col items-center text-center px-4 py-8 md:py-0 max-w-2xl animate-in fade-in scale-95 duration-700">
                                                <div className="inline-flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full mb-6 font-black text-[10px] uppercase tracking-widest">
                                                    <Heart size={14} fill="currentColor" /> Communauté
                                                </div>
                                                <h2 className="text-2xl md:text-[40px] font-black text-gray-900 mb-4 tracking-tight leading-[1.1]">
                                                    Rejoignez <span className="text-red-500">le succès</span>
                                                </h2>
                                                <p className="text-gray-500 text-xs md:text-lg font-bold mb-6 max-w-md">
                                                    Faites partie des 500+ commerçants qui ont déjà transformé leur manière de vendre.
                                                </p>
                                                <button onClick={() => setShowPropulseModal(true)} className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-2xl font-black text-base transition-all shadow-xl active:scale-95">
                                                    Créer mon compte
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pagination Dots */}
                                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                                        {[0, 1, 2].map((idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => setCurrentSlide(idx)}
                                                className={`h-1.5 rounded-full transition-all cursor-pointer ${currentSlide === idx ? 'w-8 bg-gray-900' : 'w-2 bg-gray-300'}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}


                            {/* Partners */}
                            {!searchTerm && selectedCategory === 'all' && partnerStores.length > 0 && (
                                <div className="mb-12">
                                    <h2 className="text-xl font-black text-gray-900 mb-6 tracking-tight">Boutiques partenaires</h2>
                                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
                                        {partnerStores.slice(0, 6).map(store => (
                                            <div key={store.id} onClick={() => navigate(`/store/${store.slug || store.id}`)} className="min-w-[180px] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group">
                                                <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                    <Store className="text-[#f56b2a]" size={28} />
                                                </div>
                                                <h3 className="font-bold text-gray-800 text-xs mb-1">{store.settings?.name || 'Boutique'}</h3>
                                                <div className="flex flex-col gap-0.5">
                                                    <p className="text-[10px] text-gray-600 font-black">
                                                        {(store.products || []).filter(p => p.isOnline !== false && p.image).length} Produits
                                                    </p>
                                                    <p className="text-[9px] text-[#f56b2a] font-black uppercase tracking-wider">
                                                        {(store.views || 0) + (store.products?.reduce((sum, p) => sum + (p.views || 0), 0) || 0)} Visites
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Résultats boutiques (Mode recherche) */}
                            {searchTerm && globalSearchStores.length > 0 && (
                                <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <h2 className="text-lg font-black text-gray-900 mb-6 tracking-tight flex items-center gap-2">
                                        <Store className="text-[#f56b2a]" size={20} /> Boutiques trouvées ({globalSearchStores.length})
                                    </h2>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        {globalSearchStores.slice(0, 12).map(store => (
                                            <div key={store.id} onClick={() => navigate(`/store/${store.slug || store.id}`)} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group active:scale-[0.98]">
                                                <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-inner overflow-hidden border-2 border-orange-50">
                                                    {store.settings?.logo ? (
                                                        <img loading="lazy" decoding="async" src={store.settings.logo} alt={store.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Store className="text-[#f56b2a]" size={28} />
                                                    )}
                                                </div>
                                                <h3 className="font-bold text-gray-800 text-[11px] mb-1 leading-tight line-clamp-1">{store.settings?.name || 'Boutique'}</h3>
                                                <div className="flex flex-col gap-0.5">
                                                    <p className="text-[9px] text-gray-600 font-black uppercase tracking-tighter">
                                                        {(store.products || []).filter(p => p.isOnline !== false && p.image).length} PROD.
                                                    </p>
                                                    <p className="text-[9px] text-[#f56b2a] font-black tracking-wider">
                                                        @{(store.slug || 'boutique').toLowerCase()}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Grid title */}
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                                    {searchTerm ? (
                                        <><ShoppingCart className="text-[#f56b2a]" size={20} /> Résultats produits</>
                                    ) : (
                                        <><Zap className="text-yellow-500" /> Recommandations</>
                                    )}
                                </h2>
                            </div>

                            {/* Grid */}
                            {pagedProducts.length > 0 ? (
                                <>
                                    <div className="relative">
                                        {/* Localized Grid Loader - Professional Feedback */}
                                        {isLoadingMore && (
                                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-start pt-32 bg-gray-50/20 backdrop-blur-[2px] animate-in fade-in duration-300">
                                                <div className="bg-white/90 backdrop-blur-md p-5 rounded-[32px] shadow-2xl shadow-orange-100/50 border border-white flex flex-col items-center gap-3 animate-in zoom-in-95 duration-200">
                                                    <Loader2 size={36} className="text-[#f56b2a] animate-spin" strokeWidth={3} />
                                                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] animate-pulse">Chargement</p>
                                                </div>
                                            </div>
                                        )}

                                        <div className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6 transition-all duration-500 ${isLoadingMore ? 'opacity-30 blur-[1px]' : 'opacity-100 blur-0'}`}>
                                            {pagedProducts.map(product => (
                                                <div key={`${product.storeId}-${product.id}`} onClick={() => navigate(`/product/${generateProductSlug(product)}`)} className="cursor-pointer">
                                                    <ProductCard product={product as any} onAddToCart={addToCart as any} onStoreSelect={(id) => navigate(`/store/${product.storeSlug || id}`)} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* Load More Trigger */}
                                    <div ref={loadMoreRef} className="py-10 flex flex-col items-center justify-center">
                                        {isLoadingMore && (
                                            <div className="flex flex-col items-center gap-3">
                                                <Loader2 size={32} className="text-[#f56b2a] animate-spin" />
                                                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Chargement en cours...</p>
                                            </div>
                                        )}
                                        {!hasMore && pagedProducts.length > 0 && (
                                            <div className="w-10 h-1 bg-gray-100 rounded-full" />
                                        )}
                                    </div>
                                </>
                            ) : !isLoadingMore ? (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                                    <Search size={64} className="opacity-20 mb-4" />
                                    <p className="text-xl font-black text-gray-600">Aucun produit trouvé.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <Loader2 size={48} className="text-[#f56b2a] animate-spin opacity-20" />
                                </div>
                            )}
                        </>
                    } />
                    <Route path="store/:storeParam" element={
                        <>
                            {renderStoreProfile()}
                            
                            {/* Tabs Switcher - Native App Style */}
                            <div className="flex items-center gap-1 p-1 bg-gray-100/50 rounded-[20px] mb-6 max-w-fit mx-auto md:mx-0 border border-gray-100/50">
                                <button 
                                    onClick={() => setStoreTab('products')}
                                    className={`px-6 py-2.5 rounded-[16px] font-black text-[11px] md:text-sm transition-all flex items-center gap-2 ${storeTab === 'products' ? 'bg-white text-gray-900 shadow-md shadow-gray-200/50' : 'text-gray-600 hover:text-gray-600'}`}
                                >
                                    <ShoppingBasketIcon size={14} /> Produits
                                </button>
                                <button 
                                    onClick={() => setStoreTab('reviews')}
                                    className={`px-6 py-2.5 rounded-[16px] font-black text-[11px] md:text-sm transition-all flex items-center gap-2 ${storeTab === 'reviews' ? 'bg-white text-gray-900 shadow-md shadow-gray-200/50' : 'text-gray-600 hover:text-gray-600'}`}
                                >
                                    <Star size={14} className={storeTab === 'reviews' ? 'text-yellow-500' : ''} fill={storeTab === 'reviews' ? 'currentColor' : 'none'} /> Avis
                                </button>
                            </div>

                            {storeTab === 'products' ? (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6">
                                        {pagedProducts.length > 0 ? pagedProducts.map(product => (
                                            <div key={`${product.storeId}-${product.id}`} 
                                                onClick={() => {
                                                    performAction(() => {
                                                        navigate(`/product/${generateProductSlug(product)}`);
                                                    }, 300);
                                                }} 
                                                className="cursor-pointer"
                                            >
                                                <ProductCard product={product as any} onAddToCart={addToCart as any} onStoreSelect={(id) => {
                                                    performAction(() => {
                                                        navigate(`/store/${product.storeSlug || id}`);
                                                    }, 300);
                                                }} />
                                            </div>
                                        )) : !isLoadingMore ? (
                                            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                                                <Search size={48} className="text-gray-200 mb-4" />
                                                <p className="text-sm font-bold text-gray-600 uppercase tracking-widest text-center">Aucun produit trouvé</p>
                                            </div>
                                        ) : null}
                                    </div>
                                    
                                    {/* Load More Trigger */}
                                    <div ref={loadMoreRef} className="py-10 flex flex-col items-center justify-center">
                                        {isLoadingMore && (
                                            <div className="flex flex-col items-center gap-3">
                                                <Loader2 size={32} className="text-[#f56b2a] animate-spin" />
                                                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Chargement des produits...</p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {loadingStoreReviews ? (
                                        <div className="flex flex-col items-center justify-center py-20">
                                            <Loader2 size={32} className="text-[#f56b2a] animate-spin mb-4" />
                                            <p className="text-xs font-black text-gray-600 uppercase tracking-widest">Chargement des avis...</p>
                                        </div>
                                    ) : storeReviews.length > 0 ? (
                                        <div className="flex flex-col gap-4">
                                            <div className="flex md:grid md:grid-cols-2 gap-4 overflow-x-auto md:overflow-x-visible no-scrollbar pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
                                                {(showAllStoreReviews ? storeReviews : storeReviews.slice(0, 5)).map((review) => (
                                                    <div key={review.id} className="min-w-[280px] md:min-w-0 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md flex-shrink-0 md:flex-shrink">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-orange-50 text-[#f56b2a] flex items-center justify-center font-black text-xs border border-orange-100 flex-shrink-0">
                                                                    {review.author?.[0]?.toUpperCase() || 'A'}
                                                                </div>
                                                                <div className="min-w-0 overflow-hidden">
                                                                    <p className="font-black text-gray-900 text-xs leading-none mb-1 truncate max-w-[120px]">{review.author}</p>
                                                                    <div className="flex gap-0.5">
                                                                        {[...Array(5)].map((_, i) => (
                                                                            <Star key={i} size={8} fill={i < review.rating ? "currentColor" : "none"} className={i < review.rating ? "text-yellow-400" : "text-gray-200"} />
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <span className="text-[9px] font-bold text-gray-500">
                                                                {new Date(review.date).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <p className="text-gray-500 text-[11px] leading-relaxed mb-3 line-clamp-3">{review.comment}</p>
                                                        {review.productId && (
                                                            <div 
                                                                onClick={() => navigate(`/product/${review.productId}`)}
                                                                className="flex items-center gap-3 bg-gray-50/50 p-2 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-all"
                                                            >
                                                                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white border border-gray-100">
                                                                    <img loading="lazy" decoding="async" 
                                                                        src={allProducts.find(p => p.id === review.productId)?.image || ""} 
                                                                        alt="" 
                                                                        className="w-full h-full object-cover"
                                                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                                                    />
                                                                </div>
                                                                <div className="flex-grow min-w-0">
                                                                    <p className="text-[10px] font-black text-gray-900 truncate">
                                                                        {allProducts.find(p => p.id === review.productId)?.name || "Produit"}
                                                                    </p>
                                                                    <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">Voir le produit</p>
                                                                </div>
                                                                <ChevronRight size={14} className="text-gray-500 mr-1" />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {storeReviews.length > 3 && !showAllStoreReviews && (
                                                <button
                                                    onClick={() => setShowAllStoreReviews(true)}
                                                    className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-sm shadow-xl transition-all hover:bg-[#f56b2a] flex items-center justify-center gap-2"
                                                >
                                                    Voir plus d'avis ({storeReviews.length - 3})
                                                    <ChevronRight size={16} className="rotate-90" />
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                                            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-6">
                                                <Star size={32} className="text-gray-200" />
                                            </div>
                                            <p className="text-sm font-black text-gray-600 uppercase tracking-widest text-center">Aucun avis pour le moment</p>
                                            <p className="text-[11px] text-gray-500 mt-2 text-center max-w-[200px]">Les avis des clients sur les produits s'afficheront ici.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    } />
                    <Route path="product/:productId" element={renderProductDetails()} />
                    <Route path="cart" element={renderCart()} />
                </Routes>
            </main>

            {cartItemsCount > 0 && !isCartView && !isFeedView && (
                <div className="fixed bottom-[80px] left-4 right-4 z-50 md:bottom-8 md:right-8 md:left-auto flex justify-center pointer-events-none px-2 md:px-0">
                    <button
                        onClick={() => {
                            if (checkoutStage === 'success') {
                                setCheckoutStage('cart');
                                setCompletedOrderStores([]);
                                setCompletedOrderItems([]);
                                setCompletedOrderTotal(0);
                            }
                            navigate('/cart');
                        }}
                        className="pointer-events-auto w-full md:w-auto bg-[#f56b2a] text-white py-4 px-6 rounded-2xl shadow-[0_15px_40px_rgba(245,107,42,0.4)] md:shadow-2xl flex items-center justify-center gap-3 font-black transition-all active:scale-[0.98] hover:bg-[#d55a20] relative overflow-hidden group"
                    >
                        {/* Pulse effect background */}
                        <div className="absolute inset-0 bg-white/10 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="relative flex items-center gap-3">
                            <div className="relative">
                                <ShoppingCart size={20} strokeWidth={3} className="group-hover:rotate-12 transition-transform" />
                                <span key={cartItemsCount} className="absolute -top-2.5 -right-2.5 bg-gray-900 text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#f56b2a] font-black animate-in zoom-in duration-300">
                                    {cartItemsCount}
                                </span>
                            </div>
                            <span className="text-sm uppercase tracking-wider font-black">
                                VOIR MON PANIER <span className="opacity-40 mx-1.5">•</span> {formatCurrency(Number(cartTotal) || 0)}
                            </span>
                        </div>
                    </button>
                </div>
            )}

            {showAuthModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 relative">
                        <button
                            onClick={() => setShowAuthModal(false)}
                            className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600 hover:text-gray-900 z-10"
                         aria-label="Fermer">
                            <X size={24} />
                        </button>

                        <div className="p-8 md:p-10">
                            <div className="text-center mb-10">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[#ffe8e0] text-[#f56b2a] mb-6 shadow-sm">
                                    <User size={32} strokeWidth={2.5} />
                                </div>
                                <h2 className="text-3xl font-black text-gray-900 mb-2 leading-tight">
                                    {authMode === 'login' ? 'Ravi de vous revoir !' : 'Bienvenue parmi nous'}
                                </h2>
                                <p className="text-gray-500 font-medium text-sm">
                                    {authMode === 'login' ? 'Connectez-vous pour continuer vos achats.' : 'Créez votre compte en quelques secondes.'}
                                </p>
                            </div>

                            <form onSubmit={handleAuthSubmit} className="space-y-4">
                                {authMode === 'register' && (
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-600 uppercase ml-2">Nom Complet</label>
                                        <input
                                            required
                                            type="text"
                                            value={authForm.name}
                                            onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:bg-white transition-all"
                                        />
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-600 uppercase ml-2">Adresse Email</label>
                                    <input
                                        required
                                        type="email"
                                        value={authForm.email}
                                        onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:bg-white transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-600 uppercase ml-2">Mot de passe</label>
                                    <input
                                        required
                                        type="password"
                                        value={authForm.password}
                                        onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:bg-white transition-all"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-4 bg-[#f56b2a] hover:bg-[#d55a20] text-white rounded-2xl font-black text-lg shadow-xl shadow-orange-100 transition-all mt-4"
                                >
                                    {authMode === 'login' ? 'Se connecter' : 'Créer mon compte'}
                                </button>
                            </form>

                            <div className="mt-8 pt-8 border-t border-gray-50 text-center">
                                <p className="text-gray-500 font-medium text-sm">
                                    {authMode === 'login' ? 'Pas encore de compte ?' : 'Vous avez déjà un compte ?'}
                                    <button
                                        onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                                        className="ml-2 text-[#f56b2a] font-black hover:underline underline-offset-4"
                                    >
                                        {authMode === 'login' ? 'Inscrivez-vous' : 'Connectez-vous'}
                                    </button>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {showPropulseModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 relative">
                        <button
                            onClick={() => setShowPropulseModal(false)}
                            className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600 hover:text-gray-900 z-10"
                         aria-label="Fermer propulser">
                            <X size={24} />
                        </button>

                        <div className="relative h-48 bg-gradient-to-br from-[#f56b2a] to-[#f56b2a] p-10 flex items-center justify-center overflow-hidden">
                            <div className="absolute inset-0 opacity-10 pointer-events-none">
                                <Zap className="w-full h-full scale-150 rotate-12" />
                            </div>
                            <div className="relative text-center">
                                <Zap size={64} className="text-white mx-auto mb-4 drop-shadow-lg" fill="currentColor" />
                                <h3 className="text-3xl font-black text-white leading-tight">Propulsez votre Boutique</h3>
                            </div>
                        </div>

                        <div className="p-10">
                            <p className="text-gray-600 font-medium text-lg leading-relaxed mb-8 text-center">
                                Rejoignez nos commerçants d'élite et bénéficiez d'une visibilité exceptionnelle sur leboncoin marketplace.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                                <div className="flex items-start gap-4 p-4 bg-orange-50 rounded-2xl">
                                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                                        <Zap size={20} className="text-[#f56b2a]" fill="currentColor" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-gray-900 text-sm mb-1 uppercase tracking-tight">Top Ranking</h4>
                                        <p className="text-xs text-gray-500 font-medium">Vos produits apparaissent en tête des recherches et recommandations.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 p-4 bg-orange-50 rounded-2xl">
                                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                                        <ShieldCheck size={20} className="text-[#f56b2a]" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-gray-900 text-sm mb-1 uppercase tracking-tight">Badge de Confiance</h4>
                                        <p className="text-xs text-gray-500 font-medium">Bénéficiez d'un badge exclusif qui rassure vos acheteurs.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 p-4 bg-green-50 rounded-2xl">
                                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                                        <Bell size={20} className="text-green-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-gray-900 text-sm mb-1 uppercase tracking-tight">Alertes Mobiles</h4>
                                        <p className="text-xs text-gray-500 font-medium">Vos fidèles clients sont notifiés à chaque nouvel arrivage.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-2xl">
                                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                                        <Store size={20} className="text-purple-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-gray-900 text-sm mb-1 uppercase tracking-tight">Page Premium</h4>
                                        <p className="text-xs text-gray-500 font-medium">Personnalisez votre boutique aux couleurs de votre marque.</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setShowPropulseModal(false);
                                    onBackToApp();
                                }}
                                className="w-full py-5 bg-[#f56b2a] hover:bg-[#d55a20] text-white rounded-[24px] font-black text-xl shadow-2xl shadow-orange-200 transition-all flex items-center justify-center gap-3"
                            >
                                <Zap size={24} fill="currentColor" />
                                Devenir une Boutique Premium
                            </button>
                            <p className="text-center mt-6 text-gray-600 text-[10px] font-bold uppercase tracking-widest">
                                Essai gratuit de 14 jours • Sans engagement
                            </p>
                        </div>
                    </div>
                </div>
            )}
            {/* Step-Form Review Modal */}
            {showReviewForm && (
                <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => { setShowReviewForm(false); setReviewStep(1); }}>
                    <div
                        className="bg-white w-full max-w-md md:rounded-[28px] rounded-t-[28px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-400 relative"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            onClick={() => { setShowReviewForm(false); setReviewStep(1); setNewReview({ author: '', rating: 5, comment: '' }); }}
                            className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-600 hover:text-gray-900 z-10"
                        >
                            <X size={18} />
                        </button>

                        {/* Progress Bar */}
                        {reviewStep < 4 && (
                            <div className="px-6 pt-5 pb-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                    {[1, 2, 3].map(s => (
                                        <div key={s} className="flex-grow h-1 rounded-full overflow-hidden bg-gray-100">
                                            <div className={`h-full rounded-full transition-all duration-500 ${s <= reviewStep ? 'bg-[#f56b2a] w-full' : 'w-0'}`} />
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest text-right">Étape {reviewStep}/3</p>
                            </div>
                        )}

                        {/* Step Content */}
                        <div className="p-6 md:p-8">
                            {/* Step 1: Rating */}
                            {reviewStep === 1 && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300 text-center">
                                    <div className="w-12 h-12 rounded-2xl bg-yellow-50 text-yellow-500 flex items-center justify-center mx-auto mb-4">
                                        <Star size={24} fill="currentColor" />
                                    </div>
                                    <h3 className="text-base font-black text-gray-900 mb-1">Quelle note donnez-vous ?</h3>
                                    <p className="text-[11px] text-gray-600 font-medium mb-6">Touchez une étoile pour noter ce produit</p>

                                    <div className="flex items-center justify-center gap-3 mb-8">
                                        {[1, 2, 3, 4, 5].map(num => (
                                            <button
                                                key={num}
                                                onClick={() => setNewReview({ ...newReview, rating: num })}
                                                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-90 ${newReview.rating >= num ? 'bg-yellow-400 text-white shadow-lg shadow-yellow-200 scale-110' : 'bg-gray-50 text-gray-500 border border-gray-100 hover:bg-yellow-50 hover:text-yellow-400'}`}
                                            >
                                                <Star size={22} fill={newReview.rating >= num ? "currentColor" : "none"} />
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs font-black text-gray-900 mb-6">
                                        {newReview.rating === 1 ? 'Très insatisfait' : newReview.rating === 2 ? 'Insatisfait' : newReview.rating === 3 ? 'Correct' : newReview.rating === 4 ? 'Satisfait' : 'Très satisfait'} — {newReview.rating}/5
                                    </p>
                                    <button
                                        onClick={() => setReviewStep(2)}
                                        className="w-full py-3.5 bg-gray-900 text-white rounded-2xl font-bold text-xs hover:bg-[#f56b2a] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        Continuer <ArrowRight size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Step 2: Name */}
                            {reviewStep === 2 && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300 text-center">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-4">
                                        <User size={24} />
                                    </div>
                                    <h3 className="text-base font-black text-gray-900 mb-1">Comment vous appelez-vous ?</h3>
                                    <p className="text-[11px] text-gray-600 font-medium mb-6">Votre prénom sera affiché avec votre avis</p>

                                    <input
                                        type="text"
                                        value={newReview.author}
                                        onChange={e => setNewReview({ ...newReview, author: e.target.value })}
                                        placeholder="Votre prénom..."
                                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm text-gray-700 text-center focus:bg-white focus:border-[#f56b2a] focus:shadow-lg focus:shadow-orange-50 transition-all no-global-border mb-6"
                                        autoFocus
                                    />

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setReviewStep(1)}
                                            className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-bold text-xs hover:bg-gray-200 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                                        >
                                            <ChevronLeft size={14} /> Retour
                                        </button>
                                        <button
                                            onClick={() => setReviewStep(3)}
                                            className="flex-[2] py-3.5 bg-gray-900 text-white rounded-2xl font-bold text-xs hover:bg-[#f56b2a] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                        >
                                            Continuer <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Comment */}
                            {reviewStep === 3 && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300 text-center">
                                    <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-500 flex items-center justify-center mx-auto mb-4">
                                        <MessageCircle size={24} />
                                    </div>
                                    <h3 className="text-base font-black text-gray-900 mb-1">Partagez votre expérience</h3>
                                    <p className="text-[11px] text-gray-600 font-medium mb-6">Décrivez ce que vous avez aimé ou non</p>

                                    <textarea
                                        rows={4}
                                        value={newReview.comment}
                                        onChange={e => setNewReview({ ...newReview, comment: e.target.value })}
                                        placeholder="Écrivez votre avis ici..."
                                        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-medium text-xs text-gray-700 focus:bg-white focus:border-[#f56b2a] focus:shadow-lg focus:shadow-orange-50 transition-all no-global-border mb-2 resize-none"
                                        autoFocus
                                    />
                                    <p className="text-[9px] text-gray-500 font-medium mb-5">{newReview.comment.length}/500 caractères</p>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setReviewStep(2)}
                                            className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-2xl font-bold text-xs hover:bg-gray-200 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                                        >
                                            <ChevronLeft size={14} /> Retour
                                        </button>
                                        <button
                                            onClick={() => handleSubmitReview()}
                                            disabled={!newReview.comment.trim()}
                                            className="flex-[2] py-3.5 bg-[#f56b2a] text-white rounded-2xl font-bold text-xs hover:bg-[#d55a20] transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-orange-100"
                                        >
                                            <Star size={14} /> Publier mon avis
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 4: Success */}
                            {reviewStep === 4 && (
                                <div className="animate-in fade-in zoom-in duration-500 text-center py-4">
                                    <div className="relative w-16 h-16 mx-auto mb-5">
                                        <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-30" />
                                        <div className="relative w-full h-full bg-green-500 text-white rounded-full flex items-center justify-center shadow-xl">
                                            <CheckCircle2 size={32} strokeWidth={3} />
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-black text-gray-900 mb-1">Merci ! 🎉</h3>
                                    <p className="text-[11px] text-gray-600 font-medium">Votre avis a été publié avec succès</p>
                                </div>
                            )}
                        </div>

                        {/* Bottom safe area for mobile */}
                        <div className="h-2 md:hidden" />
                    </div>
                </div>
            )}
            {/* Image Full-Size Modal */}
            {isImageModalOpen && (
                <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-300" onClick={() => setIsImageModalOpen(false)}>
                    <button 
                        onClick={() => setIsImageModalOpen(false)}
                        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all active:scale-95 z-50"
                     aria-label="Fermer l image">
                        <X size={24} />
                    </button>
                    <div className="w-full h-full p-4 md:p-10 flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        <img loading="lazy" decoding="async" 
                            src={currentZoomImage || selectedDetailImage || selectedProductDetails?.image || ''} 
                            className="max-w-full max-h-full object-contain shadow-2xl rounded-2xl animate-in zoom-in-95 duration-500"
                            alt="Full Size Product"
                        />
                    </div>
                </div>
            )}

            {/* 🚀 Universal Progress Feedback - Always visible at top when processing */}
            {loadingStack > 0 && typeof document !== 'undefined' && createPortal(
                <div className="fixed top-0 left-0 right-0 z-[2147483646] h-[5px] bg-gray-100/30 overflow-hidden pointer-events-none">
                    <div className="h-full bg-gradient-to-r from-[#f56b2a] via-[#ff9d6c] to-[#f56b2a] shadow-[0_0_20px_rgba(245,107,42,1)] animate-progress-slide" />
                </div>,
                document.body
            )}

            {/* 💎 Premium Global Loader Overlay - Luxury Experience (for blocking actions) */}
            {loadingStack > 0 && typeof document !== 'undefined' && createPortal(
                <div 
                    className={`fixed inset-0 z-[2147483647] flex flex-col items-center justify-center bg-white/70 backdrop-blur-md transition-all duration-75 animate-in fade-in`}
                >
                    {/* Minimalist Premium Spinner (Neon Style) */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-[#f56b2a] rounded-full blur-3xl opacity-40 animate-pulse scale-150" />
                        <div className="relative">
                            <Loader2 size={64} className="text-[#f56b2a] animate-spin" strokeWidth={2.5} />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <ShoppingBasketIcon size={28} className="text-[#f56b2a]/30" />
                            </div>
                        </div>
                    </div>

                    <style>{`
                        @keyframes progress-slide {
                            0% { width: 0%; left: -100%; }
                            25% { width: 50%; left: 0%; }
                            50% { width: 80%; left: 20%; }
                            100% { width: 100%; left: 100%; }
                        }
                        .animate-progress-slide {
                            position: absolute;
                            animation: progress-slide 1s cubic-bezier(0.4, 0.0, 0.2, 1) infinite;
                        }
                    `}</style>
                </div>,
                document.body
            )}
        </div>
    );
};

