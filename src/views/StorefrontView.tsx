"use client";
import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Skeleton, ProductSkeleton } from "@/components/Skeleton";
import {
  ShoppingCart,
  Search,
  Store,
  MapPin,
  CreditCard,
  ChevronLeft,
  Star,
  Heart,
  X,
  CheckCircle2,
  User,
  Phone,
  Mail,
  Truck,
  ShieldCheck,
  Gift,
  Zap,
  Bell,
  MessageCircle,
  Plus,
  ArrowRight,
  Loader2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ShoppingBasketIcon,
  Globe,
  Package,
  Edit2,
  Trash2,
  Home,
  Briefcase,
  LogOut,
  ArrowLeft,
  AlertCircle,
  Clock,
  ShoppingBag,
  Tag,
  Calendar,
  Users,
  Snowflake,
  Monitor,
  UtensilsCrossed,
  Waves,
  Battery
} from "lucide-react";
import {
  StoreData,
  Product,
  Customer,
  Order,
  ViewType,
  NotificationType,
  Review,
  Coupon,
  ToastNotification,
  BusinessVertical,
} from "@/types";
import { generateProductSlug } from "@/utils/slug";
import { MAIN_CATEGORIES } from "@/constants";
import { formatCurrency, playSuccessSound, formatNumber } from "@/utils";
import ProductImage from "../components/ProductImage";
import ProductCard from "../components/ProductCard";
import Toast from "../components/Toast";
import Button from "../components/Button";
import {
  Routes,
  Route,
  useNavigate,
  useParams,
  Link,
  useLocation,
  useMatch,
  useRouter,
} from "@/components/RouterPolyfill";
import {
  incrementProductViews,
  incrementStoreViews,
  checkDateRangeAvailable,
  getUnavailableDates,
} from "@/supabase-api";
import {
  fetchMarketplaceProducts,
  fetchProductReviews,
} from "@/hooks/useSupabaseData";
import { MarketplaceBottomNav } from "@/components/MarketplaceBottomNav";
import { supabase } from "@/supabase";
import { BuyerView } from "./BuyerView";
import { fetchBuyerAddressesAction } from "@/app/actions/marketplace";

interface StorefrontProduct extends Product {
  storeId: string;
  storeName: string;
  storeSlug?: string;
}

const categoryImages: Record<string, string> = {
  all: "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=600&q=80",
  "Électronique & High-Tech":
    "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&q=80",
  "Maison & Bureau":
    "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&q=80",
  "Mode & Beauté":
    "https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&q=80",
  "Alimentation & Boissons":
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
  "Santé & Bien-être":
    "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80",
  "Sport & Loisirs":
    "https://images.unsplash.com/photo-1517836357463-d25dfeac00dc?w=600&q=80",
  "Auto & Moto":
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600&q=80",
  "Restauration & Livraison Rapide":
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
  "Séjours, Expériences & Immobilier":
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&q=80",
  "Jouets & Enfants":
    "https://images.unsplash.com/photo-1532330393533-443990a51d10?w=300&q=80",
  "Bricolage & Jardin":
    "https://images.unsplash.com/photo-1585913661635-2170c5891553?w=300&q=80",
  "Livres & Papeterie":
    "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=300&q=80",
  Divers:
    "https://images.unsplash.com/photo-1456324504439-367921d17449?w=300&q=80",
};

const getOptimizedImageUrl = (url: string, isSlow: boolean) => {
  if (!url || !url.includes("unsplash.com")) return url;
  const size = isSlow ? "150" : "400";
  const quality = isSlow ? "50" : "80";
  return url.replace(/w=\d+/, `w=${size}`).replace(/q=\d+/, `q=${quality}`);
};

interface CartItem {
  product: StorefrontProduct;
  quantity: number;
  variantId?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  selectedOptions?: Record<string, string>;
}

interface StorefrontViewProps {
  stores: StoreData[];
  onBackToApp: () => void | Promise<any>;
  onMarketplaceCheckout: (
    ordersData: Record<string, any>,
    customerData: any,
  ) => Promise<any>;
  onAddReview: (
    storeId: string,
    productId: string,
    review: any,
  ) => Promise<any>;
  onNotifyCartInterest: (storeId: string, productName: string) => Promise<any>;
  onNotifyPostCheckout: (ordersData: Record<string, any>) => Promise<any>;
  notify: (message: string, type: NotificationType, title?: string) => void;
}

// 🗓️ Custom Calendar Picker Component
function CalendarPicker({
  blockedDates,
  checkIn,
  checkOut,
  onCheckInChange,
  onCheckOutChange,
}: {
  blockedDates: string[];
  checkIn: string;
  checkOut: string;
  onCheckInChange: (date: string) => void;
  onCheckOutChange: (date: string) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    
    const days: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };
  
  const formatDate = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${month}-${dayStr}`;
  };
  
  const isDateBlocked = (day: number) => {
    const dateStr = formatDate(day);
    return blockedDates.includes(dateStr);
  };
  
  const isDatePast = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    return date < today;
  };
  
  const isDateInRange = (day: number) => {
    if (!checkIn || !checkOut) return false;
    const dateStr = formatDate(day);
    return dateStr > checkIn && dateStr < checkOut;
  };
  
  const isCheckIn = (day: number) => formatDate(day) === checkIn;
  const isCheckOut = (day: number) => formatDate(day) === checkOut;
  
  const handleDayClick = (day: number) => {
    if (isDateBlocked(day) || isDatePast(day)) return;
    
    const dateStr = formatDate(day);
    
    if (!checkIn || (checkIn && checkOut)) {
      onCheckInChange(dateStr);
      onCheckOutChange("");
    } else if (dateStr > checkIn) {
      onCheckOutChange(dateStr);
    } else {
      onCheckInChange(dateStr);
      onCheckOutChange("");
    }
  };
  
  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];
  const dayNames = ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"];
  const days = getDaysInMonth(currentMonth);
  
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-black text-gray-900 uppercase tracking-wider">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </span>
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronRight size={20} className="rotate-180" style={{ transform: 'rotate(180deg)' }} />
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((name) => (
          <div key={name} className="text-[10px] font-bold text-gray-400 text-center uppercase">
            {name}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={index} className="h-10" />;
          }
          
          const blocked = isDateBlocked(day);
          const past = isDatePast(day);
          const inRange = isDateInRange(day);
          const isStart = isCheckIn(day);
          const isEnd = isCheckOut(day);
          
          let dayClass = "h-10 flex items-center justify-center text-xs font-black rounded-lg cursor-pointer transition-all ";
          
          if (past) {
            dayClass += "text-gray-300 cursor-not-allowed ";
          } else if (blocked) {
            dayClass += "bg-red-50 text-red-400 cursor-not-allowed relative ";
          } else if (isStart || isEnd) {
            dayClass += "bg-blue-600 text-white ";
          } else if (inRange) {
            dayClass += "bg-blue-50 text-blue-600 ";
          } else {
            dayClass += "text-gray-700 hover:bg-gray-100 ";
          }
          
          return (
            <div
              key={index}
              onClick={() => handleDayClick(day)}
              className={dayClass}
            >
              {blocked ? (
                <div className="relative flex items-center justify-center w-full h-full">
                  <span className="opacity-50">{day}</span>
                  <X size={10} className="absolute text-red-400 font-bold" />
                </div>
              ) : (
                day
              )}
            </div>
          );
        })}
      </div>
      
      {(checkIn || checkOut) && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-4 text-xs font-black">
          {checkIn && (
            <div className="flex-1 bg-blue-50 text-blue-700 p-2 rounded-lg text-center">
              Arrivée: <span className="uppercase">{new Date(checkIn).toLocaleDateString('fr-FR')}</span>
            </div>
          )}
          {checkOut && (
            <div className="flex-1 bg-blue-50 text-blue-700 p-2 rounded-lg text-center">
              Départ: <span className="uppercase">{new Date(checkOut).toLocaleDateString('fr-FR')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  stores,
  onBackToApp,
  onMarketplaceCheckout,
  onAddReview,
  onNotifyCartInterest,
  onNotifyPostCheckout,
  notify,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { isOnline, isSlow } = useNetworkStatus();
  const storeViewTracked = React.useRef<string | null>(null);
  const productViewTracked = React.useRef<string | null>(null);

  // 🏛️ Notification State
  const [toastNotifications, setToastNotifications] = useState<
    ToastNotification[]
  >([]);

  const localNotify = useCallback(
    (message: string, type: NotificationType = "info", title?: string) => {
      const id = Math.random().toString(36).substr(2, 9);
      setToastNotifications((prev) => [...prev, { id, message, type, title }]);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToastNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const prefetchedProducts = useRef<Set<string>>(new Set());

  // ⚡ Helpers defined early for use in effects
  const loadCartFromStorage = useCallback((): CartItem[] => {
    try {
      const stored = localStorage.getItem("storefront_cart");
      if (stored) {
        const { data, timestamp } = JSON.parse(stored);
        // 24h expiration
        const expired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
        if (!expired) return data;
      }
    } catch (e) {}
    return [];
  }, []);

  const loadCustomerInfoFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem("storefront_customer");
      if (stored) {
        const { data, timestamp } = JSON.parse(stored);
        const expired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
        if (!expired) return data;
      }
    } catch (e) {}
    return { name: "", phone: "", address: "", city: "", zip: "" };
  }, []);

  const loadPromoFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem("storefront_promo");
      if (stored) {
        const { data, timestamp } = JSON.parse(stored);
        const expired = Date.now() - timestamp > 24 * 60 * 60 * 1000;
        if (!expired) return data;
      }
    } catch (e) {}
    return null;
  }, []);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    zip: "",
  });
  const [promoApplied, setPromoApplied] = useState<Coupon | null>(null);
  const [selectedVertical, setSelectedVertical] = useState<
    "all" | "shopping" | "food" | "stay"
  >("all");
  const [isMounted, setIsMounted] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [ftsResults, setFtsResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [cachedStores, setCachedStores] = useState<StoreData[]>([]);
  const [urlKey, setUrlKey] = useState(0);

  // 0. URL Change Listener - Force re-render on navigation
  useEffect(() => {
    setUrlKey(prev => prev + 1);
    const handlePopstate = () => setUrlKey(prev => prev + 1);
    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, []);

  // 0. URL Params Detection
  const storeMatch = useMatch("/store/:storeParam");
  const productMatch = useMatch("/product/:productId");
  const isCartView = location.pathname.includes("/cart");
  const isFeedView = location.pathname.includes("/feed");
  const isAccountViewUrl = location.pathname.startsWith("/mon-compte");
  const selectedStoreParam = storeMatch?.params.storeParam || null;
  const { "*": splatParam } = useParams();
  const splat = Array.isArray(splatParam) ? splatParam[0] : splatParam;
  const isProductDetailPath = splat?.startsWith("product/");
  const rawUrlProductId = (() => {
    const fromMatch = productMatch?.params.productId;
    const fromSplat = isProductDetailPath ? splat?.replace("product/", "") : null;
    const candidate = fromMatch || fromSplat;
    if (candidate && typeof candidate === "string" && candidate.length > 0 && candidate.length < 200) {
      return candidate;
    }
    return null;
  })();

  // ⚡ Derive active data from props or cache
  const activeStores = useMemo(() => {
    return stores && stores.length > 0 ? stores : cachedStores;
  }, [stores, cachedStores]);

  const selectedStoreId = useMemo(() => {
    if (!selectedStoreParam) return null;
    const store = activeStores.find(
      (s) => s.id === selectedStoreParam || s.slug === selectedStoreParam,
    );
    return store?.id || null;
  }, [selectedStoreParam, activeStores]);

  const selectedStore = useMemo(() => {
    return activeStores.find((s) => s.id === selectedStoreId) || null;
  }, [selectedStoreId, activeStores]);

  const [checkIn, setCheckIn] = useState<string>("");
  const [checkOut, setCheckOut] = useState<string>("");
  const [blockedDates, setBlockedDates] = useState<string[]>([]);

  // 🔄 Sync vertical with specific store type
  useEffect(() => {
    if (selectedStoreId && isMounted) {
      const activeStore = activeStores.find(s => s.id === selectedStoreId);
      if (activeStore?.business_type) {
        setSelectedVertical(activeStore.business_type);
      }
    }
  }, [selectedStoreId, activeStores, isMounted]);
  const [guestsNum, setGuestsNum] = useState<number>(1);
  const [expandedStaySection, setExpandedStaySection] = useState<string | null>("amenities");
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);

  // Reset booking step when modal opens/closes
  useEffect(() => {
    if (showBookingModal) {
      setBookingStep(1);
      setCheckIn("");
      setCheckOut("");
      setGuestsNum(1);
      setIsAvailable(null);
    }
  }, [showBookingModal]);

  // 🔍 DEBOUNCED FTS SEARCH (with deduplication)
  const ftsRequestRef = useRef<{ term: string; controller: AbortController } | null>(null);
  
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setFtsResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      // Cancel any pending request
      if (ftsRequestRef.current) {
        ftsRequestRef.current.controller.abort();
      }
      
      const controller = new AbortController();
      ftsRequestRef.current = { term: searchTerm, controller };
      setIsSearching(true);
      
      try {
        const { data } = await supabase
          .from('products')
          .select('id, name, price, image, stock, category, store_id')
          .textSearch('search_vector', searchTerm, {
            type: 'websearch',
            config: 'french'
          })
          .limit(20);
        
        // Only use result if it's for the current search term
        if (ftsRequestRef.current?.term === searchTerm) {
          setFtsResults(data || []);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error("FTS Search Error:", err);
        }
      } finally {
        if (ftsRequestRef.current?.term === searchTerm) {
          setIsSearching(false);
        }
      }
    }, 500);

    return () => {
      clearTimeout(delayDebounceFn);
      if (ftsRequestRef.current?.term === searchTerm) {
        ftsRequestRef.current.controller.abort();
      }
    };
  }, [searchTerm]);


  // ⚡ Performance: Loading state for Skeletons

  // 1. Load cache ASYNC on mount (non-blocking)
  React.useEffect(() => {
    setIsMounted(true);

    // Defer localStorage reads to next tick (non-blocking)
    const timer = setTimeout(() => {
      try {
        const cached = localStorage.getItem("marketplace_data_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.stores && parsed.stores.length > 0) {
            setCachedStores(parsed.stores);
            setIsInitialLoading(false);
          }
        }
      } catch (e) {}

      try {
        const savedCart = localStorage.getItem("storefront_cart");
        if (savedCart) {
          const { data, timestamp } = JSON.parse(savedCart);
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000 && data?.length > 0) {
            setCart(data);
          }
        }
      } catch (e) {}

      try {
        const savedCustomer = localStorage.getItem("storefront_customer");
        if (savedCustomer) {
          const { data, timestamp } = JSON.parse(savedCustomer);
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000 && data?.name) {
            setCustomerInfo(data);
          }
        }
      } catch (e) {}

      try {
        const savedPromo = localStorage.getItem("storefront_promo");
        if (savedPromo) {
          const { data, timestamp } = JSON.parse(savedPromo);
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000 && data) {
            setPromoApplied(data);
          }
        }
      } catch (e) {}
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Handle initial loading finish when props arrive
  useEffect(() => {
    if (stores && stores.length > 0) {
      setIsInitialLoading(false);
    }
  }, [stores]);

  // Safety timeout - only active if we have NO cache AND no stores
  useEffect(() => {
    if (cachedStores.length > 0 || (stores && stores.length > 0)) return;
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [cachedStores.length, stores]);

  const allProducts = useMemo(() => {
    const products: StorefrontProduct[] = [];
    activeStores.forEach((store: any) => {
      if (store.products) {
        store.products.forEach((product: any) => {
          // Only include products that are marked as online
          if (product.isOnline !== false) {
            products.push({
              ...product,
              image: getOptimizedImageUrl(product.image, isSlow),
              images: product.images?.map((img: string) =>
                getOptimizedImageUrl(img, isSlow),
              ),
              storeId: store.id || "",
              storeName: store.settings?.name || store.name || "Boutique",
              storeSlug: store.slug || undefined,
            });
          }
        });
      }
    });
    return products;
  }, [activeStores, isSlow]);

  // 2. Update Data Cache when fresh props arrive (Data Cache)
  React.useEffect(() => {
    if (!isMounted) return;
    if (
      (!stores || stores.length === 0) &&
      (!allProducts || allProducts.length === 0)
    )
      return;

    try {
      localStorage.setItem(
        "marketplace_data_cache",
        JSON.stringify({
          stores: stores || [],
          products: allProducts || [],
          timestamp: Date.now(),
        }),
      );
    } catch (e) {}
  }, [stores, allProducts, isMounted]);

  // 3. Save cart to localStorage when it changes (throttled, only after mounting)
  React.useEffect(() => {
    if (!isMounted) return;
    if (cartSaveTimeoutRef.current) clearTimeout(cartSaveTimeoutRef.current);
    cartSaveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          "storefront_cart",
          JSON.stringify({
            data: cart,
            timestamp: Date.now(),
          }),
        );
      } catch (e) {
        console.warn("Could not save cart to localStorage (Quota exceeded?)", e);
      }
    }, 500);
    return () => {
      if (cartSaveTimeoutRef.current) clearTimeout(cartSaveTimeoutRef.current);
    };
  }, [cart, isMounted]);

  const [checkoutStage, setCheckoutStage] = useState<
    "cart" | "shipping" | "payment" | "success"
  >("cart");

  const [isNavigating, setIsNavigating] = useState(false);
  const [isCheckoutTransitioning, setIsCheckoutTransitioning] = useState(false);
  const [isCartButtonLoading, setIsCartButtonLoading] = useState(false);
  const [isWhatsAppLoading, setIsWhatsAppLoading] = useState(false);
  const [navigationKey, setNavigationKey] = useState(0);
  const navStartTimeRef = useRef<number>(0);
  const navTargetPathRef = useRef<string>('');
  const navCompletedRef = useRef<boolean>(false);
  const stageTargetRef = useRef<string | null>(null);
  const cartSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 🚀 Navigation Directe
  const safeNavigate = useCallback(
    (path: string, options?: { action?: () => void }) => {
      const targetPathname = path.split('?')[0];
      
      // Si déjà sur la page, ne rien faire
      if (location.pathname === targetPathname || location.pathname === path) {
        return;
      }

      // Afficher le loader
      navCompletedRef.current = false;
      navTargetPathRef.current = targetPathname;
      navStartTimeRef.current = performance.now();
      console.log(`[Navigation] Started → "${path}"`);
      setNavigationKey(prev => prev + 1);
      setIsNavigating(true);

      // Lancer l'action optionnelle
      if (options?.action) options.action();

      // Naviguer
      navigate(path);
    },
    [navigate, location.pathname],
  );

  // 🔄 Dynamique: Couper le loader quand pathname change ET contenu visible
  useEffect(() => {
    if (!isNavigating || navCompletedRef.current) return;
    
    const currentPath = location.pathname;
    const targetPath = navTargetPathRef.current;
    
    // Vérifier si on a atteint la destination
    if (currentPath !== targetPath) return;
    
    // pathname a changé! Attendre que le contenu soit visible
    // On vérifie avec un MutationObserver ou un timer
    const checkContentVisible = () => {
      // Chercher le main content ou un élément significatif
      const mainContent = document.querySelector('main');
      const hasContent = mainContent && mainContent.children.length > 0;
      const duration = performance.now() - navStartTimeRef.current;
      
      if (hasContent) {
        navCompletedRef.current = true;
        console.log(`[Navigation] Content ready → ${duration.toFixed(0)}ms (${(duration / 1000).toFixed(2)}s)`);
        setIsNavigating(false);
      } else {
        // Réessayer dans 50ms
        setTimeout(checkContentVisible, 50);
      }
    };
    
    // Commencer à vérifier après 100ms minimum
    setTimeout(checkContentVisible, 100);
  }, [location.pathname, isNavigating]);

  // 🔄 Smooth Checkout Stage Transitions
  const handleStageChange = useCallback(
    (newStage: typeof checkoutStage) => {
      setCheckoutStage(newStage);
      stageTargetRef.current = newStage;
    },
    [checkoutStage],
  );

  // 🔄 Couper le loader quand l'étape de checkout a changé
  useEffect(() => {
    if (stageTargetRef.current && checkoutStage === stageTargetRef.current) {
      setTimeout(() => {
        stageTargetRef.current = null;
      }, 200);
    }
  }, [checkoutStage]);
  const [lastAddedProduct, setLastAddedProduct] =
    useState<StorefrontProduct | null>(null);
  const [cartNotif, setCartNotif] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [buyerDataCache, setBuyerDataCache] = useState<any>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  // Load cached buyer data on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("buyer_data_cache");
      if (saved) setBuyerDataCache(JSON.parse(saved));
    } catch (e) {}
  }, []);

  const updateBuyerCache = useCallback((newData: any) => {
    setBuyerDataCache(newData);
    try {
      localStorage.setItem("buyer_data_cache", JSON.stringify(newData));
    } catch (e) {}
  }, []);

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
  const [newReview, setNewReview] = useState({
    author: "",
    rating: 5,
    comment: "",
  });
  const [reviewStep, setReviewStep] = useState(1);

  // Post-order review state
  const [completedOrderStores, setCompletedOrderStores] = useState<
    Array<{
      storeId: string;
      storeName: string;
      products: Array<{ id: string; name: string; image: string }>;
    }>
  >([]);
  const [postOrderReviewTarget, setPostOrderReviewTarget] = useState<{
    storeId: string;
    productId: string;
    productName: string;
  } | null>(null);
  const [reviewedProducts, setReviewedProducts] = useState<string[]>([]);
  const [completedOrderItems, setCompletedOrderItems] = useState<
    Array<{ name: string; quantity: number; price: number }>
  >([]);
  const [completedOrderTotal, setCompletedOrderTotal] = useState<number>(0);

  // User Accounts State
  const [isAccountView, setIsAccountView] = useState(false);
  const [user, setUser] = useState<{
    id?: string;
    name: string;
    email: string;
  } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [showPropulseModal, setShowPropulseModal] = useState(false);

  // RESTORE USER SESSION
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.full_name || "Utilisateur",
          email: session.user.email || "",
        });
      }
    };
    checkSession();
  }, []);

  // Fetch buyer addresses when user is set
  const [buyerAddresses, setBuyerAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  useEffect(() => {
    const loadAddresses = async () => {
      if (user?.id) {
        const res = await fetchBuyerAddressesAction();
        if (res.success && res.addresses) {
          setBuyerAddresses(res.addresses);
        }
      }
    };
    loadAddresses();
  }, [user?.id]);

  // Auto-redirect to home if hitting /mon-compte without session (only for exact /mon-compte, not sub-paths)
  useEffect(() => {
    if (isAccountViewUrl && user === null && isMounted) {
      const timer = setTimeout(() => {
        // Only redirect if user is still null AND path is exactly /mon-compte (not sub-paths)
        if (!user && (location.pathname === "/mon-compte" || location.pathname === "/account")) {
          safeNavigate("/");
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isAccountViewUrl, user, isMounted]);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [rememberMe, setRememberMe] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "card">("cod");
  const [cardInfo, setCardInfo] = useState({ number: "", expiry: "", cvc: "" });
  const [promoCodeInput, setPromoCodeInput] = useState("");

  // Save customer info to localStorage when it changes
  React.useEffect(() => {
    if (!isMounted) return;
    try {
      localStorage.setItem(
        "storefront_customer",
        JSON.stringify({
          data: customerInfo,
          timestamp: Date.now(),
        }),
      );
    } catch (e) {
      console.warn("Could not save customer info to localStorage", e);
    }
  }, [customerInfo, isMounted]);

  // Save promo to localStorage when it changes
  React.useEffect(() => {
    if (!isMounted) return;
    try {
      if (promoApplied) {
        localStorage.setItem(
          "storefront_promo",
          JSON.stringify({
            data: promoApplied,
            timestamp: Date.now(),
          }),
        );
      } else {
        localStorage.removeItem("storefront_promo");
      }
    } catch (e) {
      console.warn("Could not save promo to localStorage", e);
    }
  }, [promoApplied, isMounted]);
  // Load coupons from Supabase - for all stores in cart or current store
  React.useEffect(() => {
    const loadCoupons = async () => {
      try {
        // Get unique store IDs from cart if on cart page
        let storeIds: string[] = [];

        if (isCartView && cart.length > 0) {
          storeIds = [
            ...new Set(cart.map((item) => item.product.storeId)),
          ] as string[];
        } else if (selectedStoreParam) {
          const currentStore = stores.find(
            (s) => s.id === selectedStoreParam || s.slug === selectedStoreParam,
          );
          if (currentStore) storeIds = [currentStore.id];
        }

        if (storeIds.length === 0) return;

        console.log("Loading coupons for stores:", storeIds);
        const { data: storesData, error: storesError } = await supabase
          .from("stores")
          .select(
            "id, name, email, phone, address, ninea, logo, slug, theme, description, settings",
          )
          .order("name");
        const { data } = await supabase
          .from("coupons")
          .select("*")
          .eq("active", true)
          .in("store_id", storeIds);
        console.log("Coupons loaded:", data);
        if (data) setCoupons(data);
      } catch (e) {
        console.log("Coupons table not available", e);
      }
    };
    loadCoupons();
  }, [selectedStoreParam, stores, isCartView]);
const [selectedDetailImage, setSelectedDetailImage] = useState<string | null>(
    null
  );
  const [storeTab, setStoreTab] = useState<"products" | "reviews">("products");
  const [storeReviews, setStoreReviews] = useState<Review[]>([]);
  const storeReviewsCacheRef = useRef<Record<string, Review[]>>({});
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
  const observerRef = useRef<IntersectionObserver | null>(null);
  const PAGE_LIMIT = 20;

  // ⚡ Navigation Transition Orchestrator - Feedback Visuel Immédiat

  const fusionPayApiUrl = process.env.NEXT_PUBLIC_FUSIONPAY_API_URL || "";
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [isProcessingAuth, setIsProcessingAuth] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<Record<
    string,
    any
  > | null>(null);
  const [pendingCustomerInfo, setPendingCustomerInfo] = useState<any>(null);

  const initiateFusionPayPayment = useCallback(
    async (
      amount: number,
      description: string,
      customer: { phone: string; name: string },
    ) => {
      try {
        const paymentData = {
          totalPrice: amount,
          article: [{ description: description }],
          numeroSend: customer.phone,
          nomclient: customer.name,
          return_url: window.location.href,
          webhook_url: "",
        };

        const response = await fetch(fusionPayApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(paymentData),
        });

        const data = await response.json();

        if (data.statut && data.url) {
          window.location.href = data.url;
        } else {
          notify(
            "Erreur lors de la création du paiement: " +
              (data.message || "Erreur inconnue"),
            "error",
          );
          setIsProcessingPayment(false);
        }
      } catch (error) {
        console.error("Erreur de paiement:", error);
        notify("Erreur lors du traitement du paiement. Veuillez réessayer.", "error");
        setIsProcessingPayment(false);
      }
    },
    [fusionPayApiUrl, notify],
  );

  // Reset checkout stage based on navigation (but NOT when success is set)
  const successStageRef = useRef(false);
  
  // Track when success is shown
  useEffect(() => {
    const stage = checkoutStage as string;
    if (stage === "success") {
      successStageRef.current = true;
    }
  }, [checkoutStage]);
  
  useEffect(() => {
    // Reset ONLY when leaving cart view AND we're not on success
    if (!isCartView && !successStageRef.current) {
      if (checkoutStage !== "cart") {
        setCheckoutStage("cart");
      }
    }
    // When entering cart view, clear success ref (allow resets now)
    if (isCartView) {
      successStageRef.current = false;
    }
  }, [isCartView, checkoutStage]);

  // Handle FusionPay return
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    if (token && pendingOrderData && pendingCustomerInfo) {
      checkFusionPayPaymentStatus(token);
    }
  }, []);

  const checkFusionPayPaymentStatus = async (token: string) => {
    try {
      const response = await fetch(
        `https://www.pay.moneyfusion.net/paiementNotif/${token}`,
      );
      const data = await response.json();

      if (data.statut && data.data?.statut === "paid") {
        if (pendingOrderData && pendingCustomerInfo) {
          onMarketplaceCheckout(pendingOrderData, pendingCustomerInfo);
        }
        playSuccessSound();
        const storeMap: Record<
          string,
          {
            storeId: string;
            storeName: string;
            products: Array<{ id: string; name: string; image: string }>;
          }
        > = {};
        cart.forEach((item) => {
          const sid = item.product.storeId;
          if (!storeMap[sid]) {
            storeMap[sid] = {
              storeId: sid,
              storeName: item.product.storeName,
              products: [],
            };
          }
          if (!storeMap[sid].products.find((p) => p.id === item.product.id)) {
            storeMap[sid].products.push({
              id: item.product.id,
              name: item.product.name,
              image: item.product.image,
            });
          }
        });
        setCompletedOrderStores(Object.values(storeMap));
        setCompletedOrderItems(
          cart.map((item) => ({
            name: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
          })),
        );
        setCompletedOrderTotal(cartTotal);
        setReviewedProducts([]);
        setCart([]);
        setPromoApplied(null);
        setPromoCodeInput("");
        setCheckoutStage("success");
        // Send notifications after success screen is triggered
        if (pendingOrderData) {
          onNotifyPostCheckout(pendingOrderData);
        }
        setPendingOrderData(null);
        setPendingCustomerInfo(null);
        window.history.replaceState({}, "", window.location.pathname);
      } else if (data.data?.statut === "pending") {
        notify("Paiement en cours de traitement...", "info");
      } else {
        notify("Paiement échoué ou annulé", "error");
        setIsProcessingPayment(false);
        setPendingOrderData(null);
        setPendingCustomerInfo(null);
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch (error) {
      console.error("Error checking payment status:", error);
      notify("Erreur lors de la vérification du paiement", "error");
      setIsProcessingPayment(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessingAuth(true);

    try {
      if (authMode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: authForm.email,
          password: authForm.password,
          options: { data: { full_name: authForm.name } },
        });
        if (error) throw error;
        setUser({
          id: data.user?.id,
          name: authForm.name,
          email: authForm.email,
        });
        notify("Compte créé ! Bienvenue.", "success");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authForm.email,
          password: authForm.password,
        });
        if (error) throw error;
        setUser({
          id: data.user?.id,
          name: data.user?.user_metadata?.full_name || "Utilisateur",
          email: authForm.email,
        });
        notify("Connexion réussie !", "success");
      }
      setShowAuthModal(false);
      setAuthForm({ name: "", email: "", password: "" });
    } catch (err: any) {
      notify(err.message || "Erreur d'authentification", "error");
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const handleLogout = async () => {
    const confirmed = window.confirm("Êtes-vous sûr de vouloir vous déconnecter ?");
    if (confirmed) {
      try {
        await supabase.auth.signOut();
      } catch (e) {}
      setUser(null);
      setCustomerInfo({ name: "", phone: "", address: "", city: "", zip: "" });
      setIsAccountView(false);
      localNotify("Déconnexion réussie", "info");
    }
  };

  const globalSearchStores = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return stores.filter((s) => {
      const name = (s.name || s.settings?.name || "").toLowerCase();
      const slug = (s.slug || "").toLowerCase();
      return name.includes(term) || slug.includes(term);
    });
  }, [searchTerm, stores]);

  const [productReviews, setProductReviews] = useState<
    Record<string, Review[]>
  >({});
  const [loadingReviews, setLoadingReviews] = useState<Record<string, boolean>>(
    {},
  );
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);

  const selectedProductDetails = useMemo(() => {
    if (!rawUrlProductId) return null;

    const matched = allProducts.find(
      (p) =>
        String(p.id) === rawUrlProductId ||
        generateProductSlug(p) === rawUrlProductId,
    );
    if (!matched) return null;

    const product = matched;
    const resolvedId = product.id;

    if (productReviews[resolvedId]) {
      const reviews = productReviews[resolvedId];
      const avgRating =
        reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0;
      return {
        ...product,
        reviews,
        rating: avgRating,
        reviewCount: reviews.length,
      };
    }
    return product;
  }, [allProducts, rawUrlProductId, productReviews]);

  // 📅 Fetch blocked dates for calendar
  useEffect(() => {
    if (showBookingModal && selectedProductDetails?.businessType === "stay") {
      const fetchBlockedDates = async () => {
        const unavailableDates = await getUnavailableDates(selectedProductDetails.id);
        setBlockedDates(unavailableDates);
      };
      fetchBlockedDates();
    }
  }, [showBookingModal, selectedProductDetails]);

  // 🗓️ Availability Checker
  useEffect(() => {
    if (
      selectedProductDetails &&
      selectedProductDetails.businessType === "stay" &&
      checkIn &&
      checkOut
    ) {
      const check = async () => {
        setIsCheckingAvailability(true);
        try {
          const available = await checkDateRangeAvailable(
            selectedProductDetails.id,
            checkIn,
            checkOut,
          );
          setIsAvailable(available);
        } catch (e) {
          console.error("Availability check failed", e);
        } finally {
          setIsCheckingAvailability(false);
        }
      };
      check();
    } else {
      setIsAvailable(null);
    }
  }, [checkIn, checkOut, selectedProductDetails]);

  const selectedProductId = selectedProductDetails?.id || null;

  // Track product views - only increment once per product per session
  useEffect(() => {
    if (
      selectedProductId &&
      selectedProductDetails &&
      productViewTracked.current !== selectedProductId
    ) {
      productViewTracked.current = selectedProductId;
      incrementProductViews(selectedProductId);
      setIsDescriptionExpanded(false); // Reset expansion on new product
      setSelectedDetailImage(null); // Reset selected image on new product
    }
  }, [selectedProductId, selectedProductDetails]);

  // Fetch product reviews (with cleanup + caching)
  useEffect(() => {
    if (!selectedProductId) return;
    
    // Skip if already cached
    if (productReviews[selectedProductId]) return;
    
    let cancelled = false;
    setLoadingReviews((prev) => ({ ...prev, [selectedProductId]: true }));
    
    fetchProductReviews(selectedProductId)
      .then((reviews) => {
        if (!cancelled) {
          setProductReviews((prev) => ({
            ...prev,
            [selectedProductId]: reviews,
          }));
          setLoadingReviews((prev) => ({
            ...prev,
            [selectedProductId]: false,
          }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingReviews((prev) => ({
            ...prev,
            [selectedProductId]: false,
          }));
        }
      });
    
    return () => {
      cancelled = true;
    };
  }, [selectedProductId, reviewRefreshKey, productReviews]);

  // Update selectedOptions when selectedProductDetails changes
  React.useEffect(() => {
    if (selectedProductDetails) {
      setSelectedDetailImage(
        selectedProductDetails.image ||
          (selectedProductDetails.images && selectedProductDetails.images[0]) ||
          null,
      );
      setSelectedOptions({}); // Reset selections
    }
  }, [selectedProductDetails]);

  // 🔮 Predictive Cache Utility
  const prefetchProduct = useCallback(async (productId: string) => {
    if (!productId || prefetchedProducts.current.has(productId)) return;
    prefetchedProducts.current.add(productId);

    // Fetch reviews early as they are the most expensive dynamic part of product view
    // Our Service Worker already handles image caching, so we focus on data/reviews
    fetchProductReviews(productId)
      .then((reviews) => {
        if (reviews && reviews.length > 0) {
          setProductReviews((prev) => ({ ...prev, [productId]: reviews }));
        }
      })
      .catch(() => {});
  }, []);

  // 🚀 Predictive Init: Prefetch top recommendations (only once, only if online)
  const prefetchDoneRef = React.useRef(false);
  useEffect(() => {
    if (!isMounted || allProducts.length === 0 || prefetchDoneRef.current || !navigator.onLine) return;
    prefetchDoneRef.current = true;
    const timer = setTimeout(() => {
      allProducts.slice(0, 6).forEach((p) => prefetchProduct(p.id));
    }, 2000);
    return () => clearTimeout(timer);
  }, [isMounted, allProducts.length, prefetchProduct]);

  // Track store views - only increment once per store per session
  useEffect(() => {
    if (selectedStoreId && storeViewTracked.current !== selectedStoreId) {
      storeViewTracked.current = selectedStoreId;
      incrementStoreViews(selectedStoreId);
      setStoreTab("products"); // Reset to products tab on navigation
      setShowAllStoreReviews(false); // Reset see more
    }
  }, [selectedStoreId]);

  useEffect(() => {
    setShowAllProductReviews(false); // Reset see more on product change
  }, [selectedProductId]);

  const storeProducts = useMemo(() => {
    if (!selectedStoreId) return [];
    return allProducts.filter((p) => {
      const isFromStore = p.storeId === selectedStoreId;
      const name = p.name || "";
      const category = p.category || "";
      const mCategory = p.mainCategory || "";
      const matchesSearch = name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" ||
        category === selectedCategory ||
        mCategory === selectedCategory;
      return isFromStore && matchesSearch && matchesCategory;
    });
  }, [allProducts, selectedStoreId, searchTerm, selectedCategory]);

  // Fetch store-wide reviews (with caching)
  useEffect(() => {
    if (!selectedStoreId || storeTab !== "reviews") return;
    
    // Skip if already cached
    if (storeReviewsCacheRef.current[selectedStoreId]) {
      setStoreReviews(storeReviewsCacheRef.current[selectedStoreId]);
      return;
    }
    
    setLoadingStoreReviews(true);
    const fetchReviews = async () => {
      try {
        const { data, error } = await supabase
          .from("product_reviews")
          .select("*")
          .eq("store_id", selectedStoreId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (data) {
          const reviews = data.map((r) => ({
            id: r.id,
            author: r.author_name,
            rating: r.rating,
            comment: r.comment,
            date: r.created_at,
            productId: r.product_id,
          }));
          storeReviewsCacheRef.current[selectedStoreId] = reviews;
          setStoreReviews(reviews);
        }
      } catch (e) {
        console.error("Error fetching store reviews:", e);
      } finally {
        setLoadingStoreReviews(false);
      }
    };
    fetchReviews();
  }, [selectedStoreId, storeTab]);

  const categories = useMemo(() => {
    const all = ["all", ...MAIN_CATEGORIES];
    if (selectedVertical === "all") return all;

    // Define which categories belong to which vertical
    const verticalMap: Record<string, string[]> = {
      food: ["Alimentation & Boissons", "Restauration & Livraison Rapide"],
      stay: ["Séjours, Expériences & Immobilier", "Maison & Bureau"],
      shopping: MAIN_CATEGORIES.filter(
        (cat) =>
          cat !== "Alimentation & Boissons" &&
          cat !== "Restauration & Livraison Rapide" &&
          cat !== "Séjours, Expériences & Immobilier",
      ),
    };

    return ["all", ...(verticalMap[selectedVertical] || [])];
  }, [selectedVertical]);

  const filteredProducts = useMemo(() => {
    return allProducts
      .filter((p) => {
        const isFromStore = !selectedStoreId || p.storeId === selectedStoreId;
        const name = p.name || "";
        const storeName = p.storeName || "";
        const category = p.category || "";
        const mCategory = p.mainCategory || "";
        const matchesSearch =
          name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          storeName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory =
          selectedCategory === "all" ||
          category === selectedCategory ||
          mCategory === selectedCategory;

        // Vertical Filtering
        let matchesVertical = true;
        if (selectedVertical !== "all") {
          const v =
            p.businessType ||
            (p.mainCategory === "Restauration & Livraison Rapide"
              ? "food"
              : p.mainCategory === "Séjours, Expériences & Immobilier"
                ? "stay"
                : "shopping");
          matchesVertical = v === selectedVertical;
        }

        return (
          isFromStore && matchesSearch && matchesCategory && matchesVertical
        );
      })
      .sort((a, b) => {
        if (searchTerm) return 0;

        // 1. Group by Category first for the Home sections
        const catA = a.mainCategory || a.category || "Autre";
        const catB = b.mainCategory || b.category || "Autre";
        if (catA !== catB) {
          const idxA = MAIN_CATEGORIES.indexOf(catA);
          const idxB = MAIN_CATEGORIES.indexOf(catB);
          return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
        }

        // 2. Within category: Top performers first
        // Most sold
        const salesDiff = (b.salesCount || 0) - (a.salesCount || 0);
        if (salesDiff !== 0) return salesDiff;

        // Best rated
        const ratingDiff = (b.rating || 0) - (a.rating || 0);
        if (ratingDiff !== 0) return ratingDiff;

        // Most views
        return (b.views || 0) - (a.views || 0);
      });
  }, [
    allProducts,
    searchTerm,
    selectedCategory,
    selectedStoreId,
    selectedVertical,
  ]);

  const loadingRef = useRef(false);
  const currentPageRef = useRef(0);

  // 🔥 Infinite Scroll (Client-Side from Cache) - Instant & Bug-free
  const loadPagedProducts = useCallback(
    async (reset: boolean = false) => {
      if (loadingRef.current && !reset) return;

      loadingRef.current = true;
      setIsLoadingMore(true);

      if (reset) {
        currentPageRef.current = 0;
        setPage(0);
      }

      const start = currentPageRef.current * PAGE_LIMIT;
      const end = start + PAGE_LIMIT;
      const nextBatch = filteredProducts.slice(start, end);

      setPagedProducts((prev) => (reset ? nextBatch : [...prev, ...nextBatch]));
      setHasMore(end < filteredProducts.length);

      currentPageRef.current += 1;
      setPage(currentPageRef.current);

      // Small delay to allow DOM to update and avoid instant double-trigger
      setTimeout(() => {
        setIsLoadingMore(false);
        loadingRef.current = false;
      }, 100);
    },
    [filteredProducts],
  );

  // Reset pagination on filter change or navigation
  useEffect(() => {
    loadPagedProducts(true);
  }, [
    selectedStoreId,
    selectedCategory,
    searchTerm,
    filteredProducts,
    location.pathname,
  ]); // Stable dependencies

  // Intersection Observer for Infinite Scroll (stable ref)
  useEffect(() => {
    if (!loadMoreRef.current) return;

    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current && hasMore) {
          loadPagedProducts();
        }
      },
      { threshold: 0.1 },
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadPagedProducts, hasMore]); // Re-run when products appear or path changes

  const partnerStores = useMemo(() => {
    return stores
      .filter((s) => {
        if (selectedVertical === "all") return true;
        // A store matches a vertical if it has products of that vertical
        // or if its main category matches. Usually, stores are specialized.
        const storeProducts = s.products || [];
        if (storeProducts.length === 0) return true; // Keep empty stores for now

        const firstProd = storeProducts[0];
        const v =
          firstProd.businessType ||
          (firstProd.mainCategory === "Restauration & Livraison Rapide"
            ? "food"
            : firstProd.mainCategory === "Séjours, Expériences & Immobilier"
              ? "stay"
              : "shopping");
        return v === selectedVertical;
      })
      .sort((a, b) => {
        const visitsA =
          (a.views || 0) +
          (a.products
            ?.filter((p) => p.isOnline !== false)
            .reduce((sum, p) => sum + (p.views || 0), 0) || 0);
        const visitsB =
          (b.views || 0) +
          (b.products
            ?.filter((p) => p.isOnline !== false)
            .reduce((sum, p) => sum + (p.views || 0), 0) || 0);
        if (visitsB !== visitsA) return visitsB - visitsA;
        return (b.rating || 0) - (a.rating || 0);
      });
  }, [stores, selectedVertical]);

  const addToCart = (
    product: StorefrontProduct,
    variantId?: string,
    bookingInfo?: { checkIn?: string; checkOut?: string; guests?: number },
  ) => {
    const isStay = product.businessType === 'stay' || product.category === 'Appartements' || product.mainCategory === "Séjours, Expériences & Immobilier";

    setCart((prev) => {
      const vid = variantId || null;

      // For stays, we enforce a single-item cart (Direct Checkout)
      if (isStay) {
        if (!bookingInfo?.checkIn || !bookingInfo?.checkOut) {
          return prev; 
        }

        const start = new Date(bookingInfo.checkIn);
        const end = new Date(bookingInfo.checkOut);
        const qty = Math.max(
          1,
          Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        );

        return [{
          product,
          quantity: qty,
          variantId: vid || undefined,
          checkIn: bookingInfo.checkIn,
          checkOut: bookingInfo.checkOut,
          guests: bookingInfo.guests,
        }];
      }

      const existing = prev.find(
        (item) =>
          item.product.id === product.id &&
          item.product.storeId === product.storeId &&
          (item.variantId === vid || (!item.variantId && !vid)) &&
          item.checkIn === bookingInfo?.checkIn &&
          item.checkOut === bookingInfo?.checkOut &&
          JSON.stringify(item.selectedOptions) === JSON.stringify(selectedOptions),
      );
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id &&
          item.product.storeId === product.storeId &&
          (item.variantId === vid || (!item.variantId && !vid)) &&
          item.checkIn === bookingInfo?.checkIn &&
          item.checkOut === bookingInfo?.checkOut &&
          JSON.stringify(item.selectedOptions) === JSON.stringify(selectedOptions)
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [
        ...prev,
        {
          product,
          quantity: 1,
          variantId: vid || undefined,
          checkIn: bookingInfo?.checkIn,
          checkOut: bookingInfo?.checkOut,
          guests: bookingInfo?.guests,
          selectedOptions,
        },
      ];
    });
    setLastAddedProduct(product);
    
    if (isStay) {
      if (!bookingInfo?.checkIn || !bookingInfo?.checkOut) {
        safeNavigate(`/product/${generateProductSlug(product)}`);
        return;
      }
      safeNavigate('/cart');
      setTimeout(() => setCheckoutStage('shipping'), 800);
      return;
    }

    setCartNotif(true);
    onNotifyCartInterest(product.storeId, product.name);
    setTimeout(() => setCartNotif(false), 4000);
  };

  const addWholesaleToCart = (product: StorefrontProduct) => {
    if (!product.wholesaleMinQty) return;
    setCart((prev) => {
      const existing = prev.find(
        (item) =>
          item.product.id === product.id &&
          item.product.storeId === product.storeId,
      );
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id &&
          item.product.storeId === product.storeId
            ? {
                ...item,
                quantity: Math.max(
                  item.quantity,
                  Number(product.wholesaleMinQty),
                ),
              }
            : item,
        );
      }
      return [...prev, { product, quantity: Number(product.wholesaleMinQty) }];
    });
    setLastAddedProduct(product);
    setCartNotif(true);
    setCheckoutStage("cart"); // Go straight to cart to see savings
    // Alert the store owner
    onNotifyCartInterest(product.storeId, product.name);
    setTimeout(() => setCartNotif(false), 4000);
  };

  const removeFromCart = (
    productId: string,
    storeId: string,
    variantId?: string,
  ) => {
    setCart((prev) =>
      prev.filter(
        (item) =>
          !(
            item.product.id === productId &&
            item.product.storeId === storeId &&
            item.variantId === variantId
          ),
      ),
    );
  };

  const updateQuantity = (
    productId: string,
    storeId: string,
    delta: number,
    variantId?: string,
  ) => {
    setCart((prev) =>
      prev.map((item) => {
        if (
          item.product.id === productId &&
          item.product.storeId === storeId &&
          item.variantId === variantId
        ) {
          const newQ = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQ };
        }
        return item;
      }),
    );
  };

  const shippingCost = 0;

  const getEffectiveItemPrice = useCallback((item: CartItem) => {
    const { product, quantity, variantId } = item;

    // If variant selected, use its price
    if (variantId && product.variants) {
      const variant = product.variants.find((v) => v.id === variantId);
      if (variant) return Number(variant.price);
    }

    if (
      product.wholesalePrice &&
      product.wholesaleMinQty &&
      quantity >= product.wholesaleMinQty
    ) {
      return Number(product.wholesalePrice);
    }
    return Number(product.price);
  }, []);

  const baseCartTotal = Math.max(
    0,
    cart.reduce(
      (sum, item) => sum + getEffectiveItemPrice(item) * (item.quantity || 1),
      0,
    ),
  );

  // Calculate discount only for products from the store that has the coupon
  const discountAmount = promoApplied
    ? cart
        .filter((item) => item.product.storeId === promoApplied.store_id)
        .reduce(
          (sum, item) =>
            sum + getEffectiveItemPrice(item) * (item.quantity || 1),
          0,
        ) *
      (promoApplied.discount_pct / 100)
    : 0;
  const cartTotal = baseCartTotal - discountAmount + shippingCost;
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handlePromoApply = async () => {
    console.log("handlePromoApply called", { promoCodeInput, coupons });
    const inputCode = promoCodeInput.trim().toUpperCase();
    setIsApplyingPromo(true);

    try {
      await new Promise((r) => setTimeout(r, 600)); // Dynamic feel
      const matchedCoupon = coupons.find(
        (c) => c.code === inputCode && c.active,
      );

      if (matchedCoupon) {
        setPromoApplied({ ...matchedCoupon });
        setPromoCodeInput("");
        localNotify(
          `Code promo appliqué: ${matchedCoupon.discount_pct}% de réduction!`,
          "success",
        );
      } else if (coupons.length === 0) {
        localNotify(
          "Aucun code promo disponible pour cette boutique.",
          "error",
        );
      } else {
        localNotify("Ce code promo n'existe pas pour cette boutique.", "error");
      }
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkoutStage === "shipping") handleStageChange("payment");
    else if (checkoutStage === "payment") {
      if (isProcessingPayment) return;

      const ordersData: Record<string, any> = {};
      cart.forEach((item) => {
        if (!ordersData[item.product.storeId]) {
          ordersData[item.product.storeId] = {
            items: [],
            subtotal: 0,
            total: 0,
          };
        }
        ordersData[item.product.storeId].items.push({
          product: item.product,
          quantity: item.quantity,
          checkIn: item.checkIn,
          checkOut: item.checkOut,
          guests: item.guests,
        });
      });
      Object.keys(ordersData).forEach((storeId) => {
        const storeOrder = ordersData[storeId];
        storeOrder.subtotal = storeOrder.items.reduce((sum: number, i: any) => {
          const price =
            i.product.wholesalePrice &&
            i.product.wholesaleMinQty &&
            i.quantity >= i.product.wholesaleMinQty
              ? i.product.wholesalePrice
              : i.product.price;
          return sum + price * i.quantity;
        }, 0);
        // Only apply discount to the store that has the coupon
        storeOrder.discountAmount =
          promoApplied && promoApplied.store_id === storeId
            ? storeOrder.subtotal * (promoApplied.discount_pct / 100)
            : 0;
        storeOrder.promoCode =
          promoApplied && promoApplied.store_id === storeId
            ? promoApplied.code
            : undefined;
        const discountedSubtotal =
          storeOrder.subtotal - storeOrder.discountAmount;
        const proportionalShipping =
          baseCartTotal > 0
            ? (storeOrder.subtotal / baseCartTotal) * shippingCost
            : 0;
        storeOrder.shippingCost = proportionalShipping;
        storeOrder.total = discountedSubtotal + proportionalShipping;
        storeOrder.paymentMethod =
          paymentMethod === "card" ? "CARTE" : "ESPECES";
      });

      if (paymentMethod === "card") {
        setIsProcessingPayment(true);
        setPendingOrderData(ordersData);
        setPendingCustomerInfo({
          ...customerInfo,
          address: `${customerInfo.address}, ${customerInfo.city}`,
        });
        const totalAmount = Object.values(ordersData).reduce(
          (sum: number, order: any) => sum + order.total,
          0,
        );

        initiateFusionPayPayment(
          Math.round(totalAmount),
          "Commande sur " + (stores[0]?.name || "POS Pro"),
          {
            phone: customerInfo.phone || "01010101",
            name: customerInfo.name || "Client",
          },
        );
      } else {
        setIsProcessingPayment(true);
        (async () => {
          try {
            const response = await onMarketplaceCheckout(ordersData, {
              ...customerInfo,
              address: `${customerInfo.address}, ${customerInfo.city}`,
            });
            if (response?.success) {
              playSuccessSound();

              const storeMap: Record<
                string,
                {
                  storeId: string;
                  storeName: string;
                  products: Array<{ id: string; name: string; image: string }>;
                }
              > = {};
              cart.forEach((item) => {
                const sid = item.product.storeId;
                if (!storeMap[sid]) {
                  storeMap[sid] = {
                    storeId: sid,
                    storeName: item.product.storeName,
                    products: [],
                  };
                }
                if (
                  !storeMap[sid].products.find((p) => p.id === item.product.id)
                ) {
                  storeMap[sid].products.push({
                    id: item.product.id,
                    name: item.product.name,
                    image: item.product.image,
                  });
                }
              });
              setCompletedOrderStores(Object.values(storeMap));
              setCompletedOrderItems(
                cart.map((item) => ({
                  name: item.product.name,
                  quantity: item.quantity,
                  price: item.product.price,
                })),
              );
              setCompletedOrderTotal(cartTotal);
              setReviewedProducts([]);
              setPromoApplied(null);
              setPromoCodeInput("");
              setCheckoutStage("success");
              setCart([]);
              onNotifyPostCheckout(ordersData);
            } else {
              localNotify(
                response?.error ||
                  "Erreur lors de la validation de la commande",
                "error",
              );
            }
          } catch (error) {
            console.error("Checkout error:", error);
            localNotify(
              "Une erreur est survenue lors de la validation.",
              "error",
            );
          } finally {
            setIsProcessingPayment(false);
          }
        })();
      }
    }
  };

  const handleSubmitReview = async () => {
    setIsSubmittingReview(true);
    const reviewToSubmit = {
      id: `rev-${Date.now()}`,
      author: newReview.author || "Anonyme",
      rating: newReview.rating,
      comment: newReview.comment,
      date: new Date().toISOString(),
    };

    try {
      let result: any;
      if (postOrderReviewTarget) {
        result = await onAddReview(
          postOrderReviewTarget.storeId,
          postOrderReviewTarget.productId,
          reviewToSubmit,
        );
        if (result?.success) {
          setReviewedProducts((prev) => [
            ...prev,
            postOrderReviewTarget.productId,
          ]);
        }
      } else if (selectedProductDetails) {
        result = await onAddReview(
          selectedProductDetails.storeId,
          selectedProductDetails.id,
          reviewToSubmit,
        );
      } else {
        return;
      }

      if (result && !result.success) {
        localNotify(
          "Erreur lors de la publication de l'avis : " + result.error,
          "error",
        );
        return;
      }

      setReviewRefreshKey((k) => k + 1);
      setReviewStep(4);
      setTimeout(() => {
        setNewReview({ author: "", rating: 5, comment: "" });
        setShowReviewForm(false);
        setReviewStep(1);
        setPostOrderReviewTarget(null);
      }, 2500);
    } catch (error) {
      localNotify(
        "Une erreur est survenue lors de l'envoi de votre avis.",
        "error",
      );
      console.error("Review submission error:", error);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const openPostOrderReview = (
    storeId: string,
    productId: string,
    productName: string,
  ) => {
    setPostOrderReviewTarget({ storeId, productId, productName });
    setNewReview({ author: customerInfo.name || "", rating: 5, comment: "" });
    setReviewStep(1);
    setShowReviewForm(true);
  };

  const renderStoreProfile = () => {
    if (!selectedStore) return null;
    return (
      <div className="mb-4 md:mb-6    duration-700">
        {/* Store Header Card */}
        <div className="bg-white rounded-[28px] md:rounded-[40px] overflow-hidden shadow-xl shadow-gray-200/50 border border-white relative">
          {/* Cover / Background Pattern - Reduced height on mobile */}
          <div className="h-14 md:h-48 bg-gradient-to-r from-[#f56b2a] to-[#ff9d6c] relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <Store
                size={150}
                className="absolute -right-10 -top-10 text-white rotate-12"
              />
              <Zap
                size={100}
                className="absolute left-10 bottom-0 text-white -rotate-12"
                fill="currentColor"
              />
            </div>
          </div>

          <div className="px-3 md:px-12 pb-2 md:pb-6 relative">
            {/* Compact Header Row */}
            <div className="flex items-center gap-2 md:gap-4 -mt-8 md:-mt-16 backdrop-blur-sm bg-white/50 rounded-2xl px-3 py-2">
              {/* Store Logo - Ultra Compact */}
              <div className="w-12 h-12 md:w-24 md:h-24 rounded-xl md:rounded-2xl bg-white p-0.5 md:p-1 shadow-xl z-20 flex-shrink-0">
                <div className="w-full h-full rounded-lg md:rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100 overflow-hidden">
                  {selectedStore.settings?.logo ? (
                    <img
                      src={selectedStore.settings.logo}
                      alt={selectedStore.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <Store size={20} className="text-[#f56b2a] md:hidden" />
                      <Store size={40} className="text-[#f56b2a] hidden md:block" />
                    </>
                  )}
                </div>
              </div>

              {/* Store Info */}
              <div className="flex-grow min-w-0">
                {/* Name + Country */}
                <div className="flex items-center gap-2 md:gap-4">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <ShieldCheck size={14} strokeWidth={3} className="text-green-500 hidden md:block" />
                    <h2 className="text-base md:text-3xl font-black text-gray-900">
                      {selectedStore.settings.name}
                    </h2>
                  </div>
                  {(() => {
                    const countryValue = selectedStore.address || selectedStore.settings?.address;
                    if (countryValue) {
                      return (
                        <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 md:px-3 py-1 rounded-full text-[8px] md:text-xs font-black whitespace-nowrap">
                          <Globe size={10} strokeWidth={3} className="text-blue-400 hidden md:block" />
                          <Globe size={8} strokeWidth={3} className="text-blue-400 md:hidden" />
                          <span>{countryValue}</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                {/* Description */}
                <p className="mt-2 md:mt-3 text-[11px] md:text-sm text-gray-500 leading-relaxed">
                  {selectedStore.description || (selectedStore.settings as any)?.description || "Votre destination shopping préférée pour des produits locaux et de qualité."}
                </p>
              </div>

              {/* Marketplace Return - Desktop Only */}
              <button
                onClick={() => {
                  safeNavigate("/", {
                    action: () => {
                      setSearchTerm("");
                      setSelectedCategory("all");
                    },
                  });
                }}
                className="hidden md:flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-xl font-black text-sm hover:bg-[#f56b2a] transition-all shadow-lg active:scale-95 flex-shrink-0"
              >
                <ChevronLeft size={16} strokeWidth={3} /> Marketplace
              </button>
            </div>

            {/* Store Dedicated Search Bar - Ultra Compact */}
            <div className="mt-2 md:mt-4 max-w-2xl mx-auto">
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#f56b2a] transition-colors">
                  <Search size={14} strokeWidth={3} />
                </div>
                <input
                  type="text"
                  placeholder="Chercher dans cette boutique..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 md:py-3 bg-gray-50/80 border border-gray-100/50 rounded-lg md:rounded-xl font-bold text-[10px] md:text-sm text-gray-700 focus:bg-white focus:border-[#f56b2a] focus:shadow-lg focus:shadow-orange-100/50 transition-all no-global-border"
                />
              </div>
            </div>

            {/* Stats Row - Compact but visible */}
            <div className="grid grid-cols-4 gap-1 md:gap-4 mt-2 md:mt-4">
              {/* Products Count */}
              <div className="bg-gray-50/80 p-1.5 md:p-3 rounded-lg md:rounded-xl border border-gray-100 flex flex-col items-center text-gray-900">
                <span className="text-[10px] md:text-2xl font-black leading-none">
                  {selectedStore.products?.filter((p) => p.isOnline !== false && p.image).length || 0}
                </span>
                <span className="text-[5px] md:text-[9px] font-black text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Produits
                </span>
              </div>

              {/* Visitors Count */}
              <div className="bg-orange-50/50 p-1.5 md:p-3 rounded-lg md:rounded-xl border border-orange-100/50 flex flex-col items-center text-[#f56b2a]">
                <span className="text-[10px] md:text-2xl font-black leading-none">
                  {formatNumber((selectedStore.views || 0) + (selectedStore.products?.filter((p) => p.isOnline !== false).reduce((sum, p) => sum + (p.views || 0), 0) || 0))}
                </span>
                <span className="text-[5px] md:text-[9px] font-black text-orange-400 uppercase tracking-wide whitespace-nowrap">
                  Visiteurs
                </span>
              </div>

              {/* Reviews Count */}
              <div className="bg-yellow-50/50 p-1.5 md:p-3 rounded-lg md:rounded-xl border border-yellow-100/50 flex flex-col items-center text-yellow-600">
                <span className="text-[10px] md:text-2xl font-black leading-none">
                  {formatNumber(selectedStore.products?.filter((p) => p.isOnline !== false).reduce((sum, p) => sum + (p.reviewCount || 0), 0) || 0)}
                </span>
                <span className="text-[5px] md:text-[9px] font-black text-yellow-600 uppercase tracking-wide whitespace-nowrap text-center">
                  Avis
                </span>
              </div>

              {/* Rating */}
              <div className="bg-green-50/50 p-1.5 md:p-3 rounded-lg md:rounded-xl border border-green-100/50 flex flex-col items-center text-green-600">
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] md:text-2xl font-black leading-none">
                    {selectedStore.rating?.toFixed(1) || "0.0"}
                  </span>
                  <Star size={8} fill="currentColor" className="text-yellow-400 hidden md:block" />
                  <Star size={6} fill="currentColor" className="text-yellow-400 md:hidden" />
                </div>
                <span className="text-[5px] md:text-[9px] font-black text-green-600 uppercase tracking-wide whitespace-nowrap">
                  Note
                </span>
              </div>
            </div>

            {/* Mobile Return Link - Ultra Compact */}
            <button
              onClick={() => {
                safeNavigate("/", {
                  action: () => {
                    setSearchTerm("");
                    setSelectedCategory("all");
                  },
                });
              }}
              className="md:hidden mt-2 w-full flex items-center justify-center gap-1.5 text-gray-400 py-1 transition-all hover:text-gray-600"
            >
              <ChevronLeft size={12} strokeWidth={3} />
              <span className="text-[9px] font-black uppercase tracking-wider">
                Marché
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderProductDetails = () => {
    if (!selectedProductDetails) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="w-16 h-16 border-4 border-[#f56b2a] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-black uppercase tracking-widest">
            Chargement du produit...
          </p>
        </div>
      );
    }

    const relatedProducts = allProducts
      .filter(
        (p) =>
          ((p.category && p.category === selectedProductDetails.category) ||
            p.storeId === selectedProductDetails.storeId) &&
          p.id !== selectedProductDetails.id &&
          p.isOnline !== false,
      )
      .slice(0, 5);

    return (
      <div className="max-w-7xl mx-auto px-0 md:px-4 py-0 md:py-10 space-y-0 md:space-y-12 mb-20 md:mb-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 md:gap-4 lg:gap-16 items-start">
          {/* Media Gallery - Professional Layout */}
          <div className="space-y-4">
            <div
              className="relative w-full rounded-none md:rounded-[32px] overflow-hidden bg-white group/main cursor-pointer shadow-2xl shadow-orange-100/20 border-b md:border border-gray-100 flex items-center justify-center"
              onClick={() => {
                setCurrentZoomImage(selectedDetailImage);
                setIsImageModalOpen(true);
              }}
            >
              <Image
                src={selectedDetailImage || selectedProductDetails.image}
                width={800}
                height={800}
                className="w-full h-auto max-h-[60vh] object-contain group-hover/main:scale-105"
                alt={selectedProductDetails.name}
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>

            {/* Thumbnails - Compact Grid */}
            {selectedProductDetails.images &&
              selectedProductDetails.images.length > 1 && (
                <div className="grid grid-cols-5 gap-1.5 px-4 md:px-0">
                  {selectedProductDetails.images.map((img, idx) => (
                    <button
                      key={idx}
                      onMouseEnter={() => setSelectedDetailImage(img)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDetailImage(img);
                      }}
                      className={`aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all relative ${
                        selectedDetailImage === img ||
                        (!selectedDetailImage && idx === 0)
                          ? "border-[#f56b2a] ring-2 ring-orange-50"
                          : "border-gray-100"
                      }`}
                    >
                      <Image
                        src={img}
                        alt={`${selectedProductDetails.name} thumbnail ${idx}`}
                        fill
                        className="object-cover"
                        sizes="60px"
                      />
                    </button>
                  ))}
                </div>
              )}
          </div>

          {/* Product Info - Compact Mobile */}
          <div className="flex flex-col h-full py-1 px-4 md:px-0">
            {(() => {
              const mainCat = selectedProductDetails.mainCategory;
              const isFood = selectedProductDetails.businessType === "food" || mainCat === "Restauration & Livraison Rapide";
              const isStay = selectedProductDetails.businessType === "stay" || mainCat === "Séjours, Expériences & Immobilier";
              const isProduct = !isFood && !isStay;
              const descriptionText = selectedProductDetails.description || "Découvrez cet article exceptionnel sélectionné avec soin par votre boutique pour sa qualité et son style unique.";
              const amenitiesList = selectedProductDetails.amenities || [];

              return (
                <>
                  <div className="mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() =>
                          safeNavigate(
                            `/store/${selectedProductDetails.storeSlug || selectedProductDetails.storeId}`,
                          )
                        }
                        className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full transition-colors border ${
                          isFood
                            ? "bg-green-50 text-green-600 border-green-100"
                            : isStay
                              ? "bg-blue-50 text-blue-600 border-blue-100"
                              : "bg-orange-50 text-[#f56b2a] border-orange-100"
                        }`}
                      >
                        {isFood
                          ? "🧑‍🍳 "
                          : isStay
                            ? "🏠 "
                            : "📦 "}{" "}
                        {selectedProductDetails.storeName}
                      </button>
                      {isFood && (
                        <span className="flex items-center gap-1 text-[8px] font-black text-gray-500 uppercase tracking-tighter bg-gray-50 px-1.5 py-0.5 rounded-full border border-gray-100">
                          <Clock size={8} className="text-green-500" />{" "}
                          {selectedProductDetails.deliveryTime || "30-45 min"}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 mb-2">
                      <h2 className="text-lg md:text-3xl font-black text-gray-900 leading-[1.1] tracking-tight">
                        {selectedProductDetails.name}
                      </h2>

                      <div className="flex flex-col items-start flex-shrink-0">
                        <div className="flex items-baseline gap-1.5 h-fit">
                          <span
                            className={`text-xl md:text-3xl font-black tracking-tighter whitespace-nowrap ${
                              isFood
                                ? "text-green-600"
                                : isStay
                                  ? "text-blue-600"
                                  : "text-[#f56b2a]"
                            }`}
                          >
                            {(() => {
                              const options = selectedProductDetails.options || [];
                              const hasOptions = options.length > 0;
                              const allSelected = hasOptions && options.every((o) => !!selectedOptions[o.id]);
                              const variant = hasOptions && selectedProductDetails.variants?.find(
                                (v) =>
                                  JSON.stringify(v.optionValues) ===
                                  JSON.stringify(selectedOptions),
                              );
                              
                              if (variant) {
                                return formatCurrency(variant.price);
                              }
                              if (hasOptions && allSelected) {
                                return formatCurrency(selectedProductDetails.price);
                              }
                              if (hasOptions) {
                                return `À partir de ${formatCurrency(selectedProductDetails.price)}`;
                              }
                              return formatCurrency(selectedProductDetails.price);
                            })()}
                          </span>
                          {isStay && (
                            <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">
                              / nuit
                            </span>
                          )}
                        </div>
                        {selectedProductDetails.originalPrice && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-500 line-through font-medium">
                              {formatCurrency(selectedProductDetails.originalPrice)}
                            </span>
                            <span className="text-[9px] font-black text-white bg-red-500 px-1.5 py-0.5 rounded-full uppercase tracking-widest">
                              -{Math.round(((selectedProductDetails.originalPrice - selectedProductDetails.price) / selectedProductDetails.originalPrice) * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex items-center gap-1 bg-yellow-50 px-1.5 py-0.5 rounded-lg border border-yellow-100">
                        <div className="flex text-yellow-500">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={8}
                              fill={s <= Math.round(selectedProductDetails.rating || 0) ? "currentColor" : "none"}
                            />
                          ))}
                        </div>
                        <span className="text-[9px] font-black text-yellow-700">
                          {(selectedProductDetails.rating || 0).toFixed(1)}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-500">
                        {formatNumber(selectedProductDetails.reviewCount || 0)} Avis
                      </span>
                      <span
                        className={`text-[10px] font-bold flex items-center gap-1 ${
                          isFood
                            ? "text-green-600"
                            : isStay
                              ? "text-blue-600"
                              : "text-orange-600"
                        }`}
                      >
                        {isFood ? (
                          <CheckCircle2 size={12} />
                        ) : isStay ? (
                          <MapPin size={12} />
                        ) : (
                          <ShoppingBag size={12} />
                        )}
                        {isFood
                          ? "Cuisiné frais"
                          : isStay
                            ? (selectedProductDetails.location || "Emplacement vérifié")
                            : `${formatNumber(selectedProductDetails.salesCount || 0)} Commandes`}
                      </span>
                    </div>
                  </div>

                  {/* --- MODE SPECIFIC OPTIONS --- */}

                  {/* Multi-Options Selection - AliExpress Style */}
                  {selectedProductDetails.options &&
                    selectedProductDetails.options.length > 0 && (
                      <div className="mb-6 space-y-5    duration-500">
                        {selectedProductDetails.options.map((option) => (
                          <div key={option.id} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                {option.name}
                              </h4>
                              {selectedOptions[option.id] && (
                                <span className="text-[10px] font-black text-[#f56b2a] bg-orange-50 px-2 py-0.5 rounded-full">
                                  {selectedOptions[option.id]}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {option.values.map((val) => {
                                const isSelected =
                                  selectedOptions[option.id] === val;
                                return (
                                  <button
                                    key={val}
                                    onClick={() =>
                                      setSelectedOptions((prev) => ({
                                        ...prev,
                                        [option.id]: val,
                                      }))
                                    }
                                    className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all border ${
                                      isSelected
                                        ? "bg-gray-900 text-white border-gray-900 shadow-lg scale-105"
                                        : "bg-white text-gray-600 border-gray-100 hover:border-gray-900"
                                    }`}
                                  >
                                    {val}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        {/* Selection Status */}
                        {(() => {
                          const allSelected =
                            selectedProductDetails.options.every(
                              (o) => !!selectedOptions[o.id],
                            );
                          if (!allSelected) {
                            return (
                              <p className="text-[9px] text-[#f56b2a] font-black uppercase tracking-tighter flex items-center gap-1.5 bg-orange-50/50 p-2 rounded-lg border border-orange-50">
                                <AlertCircle size={12} /> Veuillez choisir
                                toutes les options pour voir le prix exact
                              </p>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}

                  {/* Booking Modal (Popup) */}
                  {isStay && showBookingModal && createPortal(
                    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6 pb-[calc(64px+env(safe-area-inset-bottom,0px)+12px)] md:pb-6   duration-300">
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBookingModal(false)} />
                      <div className="relative w-full max-w-md mx-4 md:mx-0 bg-white rounded-[32px] shadow-2xl overflow-hidden   md: duration-500">
                        <div className="p-4 pb-2 flex items-center justify-between border-b border-gray-50">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${bookingStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>1</div>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${bookingStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>2</div>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${bookingStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>3</div>
                          </div>
                          <button onClick={() => setShowBookingModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X size={20} />
                          </button>
                        </div>

                        <div className="p-6 space-y-4">
                          {/* Step 1: Select Dates */}
                          {bookingStep === 1 && (
                            <>
                              <div className="text-center mb-4">
                                <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Sélectionnez vos dates</h4>
                                {blockedDates.length > 0 && (
                                  <p className="text-[9px] text-red-500 font-bold mt-1">Les dates en rouge sont indisponibles</p>
                                )}
                              </div>
                              <CalendarPicker 
                                blockedDates={blockedDates}
                                checkIn={checkIn}
                                checkOut={checkOut}
                                onCheckInChange={(date) => {
                                  setCheckIn(date);
                                  setIsAvailable(null);
                                }}
                                onCheckOutChange={(date) => {
                                  setCheckOut(date);
                                  setIsAvailable(null);
                                }}
                              />
                              <Button
                                onClick={() => {
                                  if (!checkIn || !checkOut) {
                                    localNotify("Veuillez sélectionner les dates d'arrivée et de départ", "warning");
                                    return;
                                  }
                                  if (isAvailable === false) {
                                    localNotify("Ces dates ne sont pas disponibles", "error");
                                    return;
                                  }
                                  setBookingStep(2);
                                }}
                                fullWidth
                                size="lg"
                                variant="secondary"
                                disabled={!checkIn || !checkOut}
                                className="h-12 rounded-xl font-black uppercase"
                              >
                                Suivant
                              </Button>
                            </>
                          )}

                          {/* Step 2: Select Guests */}
                          {bookingStep === 2 && (
                            <>
                              <div className="text-center mb-4">
                                <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Nombre de personnes</h4>
                              </div>
                              <div className="space-y-1.5">
                                <select
                                  value={guestsNum}
                                  onChange={(e) => setGuestsNum(parseInt(e.target.value))}
                                  className="w-full h-14 px-4 rounded-xl border border-gray-100 bg-gray-50/50 text-sm font-black text-center appearance-none focus:border-blue-500 focus:bg-white transition-all outline-none"
                                >
                                  {Array.from({ length: selectedProductDetails.maxGuests || 6 }, (_, i) => i + 1).map((n) => (
                                    <option key={n} value={n}>{n} {n > 1 ? "personnes" : "personne"}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex gap-3">
                                <Button
                                  onClick={() => setBookingStep(1)}
                                  fullWidth
                                  size="lg"
                                  variant="outline"
                                  className="h-12 rounded-xl font-black uppercase"
                                >
                                  Retour
                                </Button>
                                <Button
                                  onClick={() => setBookingStep(3)}
                                  fullWidth
                                  size="lg"
                                  variant="secondary"
                                  className="h-12 rounded-xl font-black uppercase"
                                >
                                  Suivant
                                </Button>
                              </div>
                            </>
                          )}

                          {/* Step 3: Confirm */}
                          {bookingStep === 3 && (
                            <>
                              <div className="text-center mb-4">
                                <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Récapitulatif</h4>
                              </div>
                              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 font-medium">Arrivée</span>
                                  <span className="font-black">{checkIn ? new Date(checkIn).toLocaleDateString('fr-FR') : '-'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 font-medium">Départ</span>
                                  <span className="font-black">{checkOut ? new Date(checkOut).toLocaleDateString('fr-FR') : '-'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 font-medium">Personnes</span>
                                  <span className="font-black">{guestsNum}</span>
                                </div>
                                <div className="border-t border-gray-200 pt-3 flex justify-between">
                                  <span className="text-gray-500 font-medium">Total</span>
                                  <span className="font-black text-lg">
                                    {(() => {
                                      const start = new Date(checkIn);
                                      const end = new Date(checkOut);
                                      const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                                      return formatCurrency(nights * selectedProductDetails.price);
                                    })()}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-3">
                                <Button
                                  onClick={() => setBookingStep(2)}
                                  fullWidth
                                  size="lg"
                                  variant="outline"
                                  className="h-12 rounded-xl font-black uppercase"
                                >
                                  Retour
                                </Button>
                                <Button
                                  onClick={() => {
                                    addToCart(selectedProductDetails, undefined, { checkIn, checkOut, guests: guestsNum });
                                    setShowBookingModal(false);
                                  }}
                                  fullWidth
                                  size="lg"
                                  variant="secondary"
                                  className="h-12 rounded-xl font-black uppercase"
                                >
                                  Confirmer
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}

                  {isProduct && selectedProductDetails.wholesalePrice && (
                    <div className="bg-gray-50/50 rounded-[32px] p-4 md:p-8 border border-gray-100 mb-6 backdrop-blur-sm relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100/20 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-orange-200/30 transition-colors duration-700" />
                      <button
                        onClick={() =>
                          addWholesaleToCart(selectedProductDetails)
                        }
                        className="relative w-full bg-white/80 hover:bg-white border border-orange-100 rounded-2xl p-4 flex items-center justify-between transition-all hover:shadow-md hover:scale-[1.01] group/wholesale"
                      >
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black text-[#f56b2a] uppercase tracking-widest">
                              Prix de Gros Amazon Style
                            </span>
                            <span className="text-xs font-bold text-gray-900">
                              {formatCurrency(
                                selectedProductDetails.wholesalePrice,
                              )}{" "}
                              <span className="text-[9px] text-gray-600 font-medium">
                                (Min. {selectedProductDetails.wholesaleMinQty})
                              </span>
                            </span>
                          </div>
                        </div>
                        <div className="text-[#f56b2a] font-black text-[9px] uppercase">
                          Acheter en lot{" "}
                          <ArrowRight size={12} className="inline ml-1" />
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Product Description - Collapsible & Formatted */}
                  <div className="mb-4 relative">
                    <div
                      className={`text-gray-500 text-xs md:text-[15px] leading-relaxed font-medium transition-all duration-300 ${!isDescriptionExpanded ? "line-clamp-3 md:line-clamp-none" : ""}`}
                      style={{ whiteSpace: "pre-line" }}
                    >
                      {descriptionText}
                    </div>

                    {isStay && (
                      <div className="mt-8 space-y-4    duration-700 ">
                        {/* --- ACCORDION 1: CAPACITY --- */}
                        <div className="border border-gray-100 rounded-3xl overflow-hidden bg-white shadow-sm transition-all hover:shadow-md">
                          <button
                            onClick={() =>
                              setExpandedStaySection(
                                expandedStaySection === "capacity"
                                  ? null
                                  : "capacity",
                              )
                            }
                            className="w-full px-6 py-5 flex items-center justify-between text-left group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                                <Users size={18} strokeWidth={2.5} />
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-gray-900 leading-tight">
                                  Détails du Logement
                                </h4>
                                <p className="text-[9px] text-blue-400 font-extrabold uppercase tracking-widest mt-0.5">
                                  Capacité & Espaces
                                </p>
                              </div>
                            </div>
                            <ChevronDown
                              size={18}
                              className={`text-gray-400 transition-transform duration-300 ${expandedStaySection === "capacity" ? "rotate-180 text-blue-500" : ""}`}
                            />
                          </button>

                          <div
                            className={`px-6 transition-all duration-300 ease-in-out ${expandedStaySection === "capacity" ? "pb-6 max-h-[500px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"}`}
                          >
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                              {selectedProductDetails.maxGuests && (
                                <div className="flex items-center gap-3 bg-blue-50/50 border border-blue-100/30 px-4 py-3 rounded-2xl">
                                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
                                    <Users size={16} />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-black text-blue-900 leading-none">
                                      {selectedProductDetails.maxGuests}
                                    </span>
                                    <span className="text-[8px] font-black text-blue-400 uppercase mt-0.5">
                                      Personnes
                                    </span>
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center gap-3 bg-indigo-50/50 border border-indigo-100/30 px-4 py-3 rounded-2xl">
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-600 shadow-sm">
                                  <Home size={16} />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-black text-indigo-900 leading-none">
                                    {selectedProductDetails.bedrooms || 1}
                                  </span>
                                  <span className="text-[8px] font-black text-indigo-400 uppercase mt-0.5">
                                    Chambre(s)
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 bg-emerald-50/50 border border-emerald-100/30 px-4 py-3 rounded-2xl">
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-emerald-600 shadow-sm">
                                  <ShieldCheck size={16} />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black text-emerald-900 leading-none">
                                    Vérifié
                                  </span>
                                  <span className="text-[8px] font-black text-emerald-400 uppercase mt-0.5">
                                    Hébergement
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* --- ACCORDION 2: AMENITIES --- */}
                        {amenitiesList.length > 0 && (
                          <div className="border border-gray-100 rounded-3xl overflow-hidden bg-white shadow-sm transition-all hover:shadow-md">
                            <button
                              onClick={() =>
                                setExpandedStaySection(
                                  expandedStaySection === "amenities"
                                    ? null
                                    : "amenities",
                                )
                              }
                              className="w-full px-6 py-5 flex items-center justify-between text-left group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                  <Zap size={18} strokeWidth={2.5} />
                                </div>
                                <div className="">
                                  <h4 className="text-sm font-black text-gray-900 leading-tight">
                                    Équipements & Confort
                                  </h4>
                                  <p className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-widest mt-0.5">
                                    {amenitiesList.length} services inclus
                                  </p>
                                </div>
                              </div>
                              <ChevronDown
                                size={18}
                                className={`text-gray-400 transition-transform duration-300 ${expandedStaySection === "amenities" ? "rotate-180 text-indigo-500" : ""}`}
                              />
                            </button>

                            <div
                              className={`px-6 transition-all duration-300 ease-in-out ${expandedStaySection === "amenities" ? "pb-6 max-h-[1000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"}`}
                            >
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                                {[
                                  {
                                    id: "wifi",
                                    label: "Wi-Fi Haut Débit",
                                    icon: <Globe size={16} />,
                                    color: "text-blue-500",
                                    bg: "bg-blue-50/50",
                                  },
                                  {
                                    id: "ac",
                                    label: "Climatisation",
                                    icon: <Snowflake size={16} />,
                                    color: "text-cyan-500",
                                    bg: "bg-cyan-50/50",
                                  },
                                  {
                                    id: "generator",
                                    label: "Électricité H24",
                                    icon: <Battery size={16} />,
                                    color: "text-yellow-500",
                                    bg: "bg-yellow-50/50",
                                  },
                                  {
                                    id: "canalplus",
                                    label: "Canal+ / Smart TV",
                                    icon: <Monitor size={16} />,
                                    color: "text-blue-600",
                                    bg: "bg-blue-500/10",
                                  },
                                  {
                                    id: "cleaning",
                                    label: "Ménage Inclus",
                                    icon: <CheckCircle2 size={16} />,
                                    color: "text-emerald-500",
                                    bg: "bg-emerald-50/50",
                                  },
                                  {
                                    id: "pool",
                                    label: "Piscine Privée",
                                    icon: <Waves size={16} />,
                                    color: "text-cyan-600",
                                    bg: "bg-cyan-50/50",
                                  },
                                  {
                                    id: "kitchen",
                                    label: "Cuisine Équipée",
                                    icon: <UtensilsCrossed size={16} />,
                                    color: "text-orange-500",
                                    bg: "bg-orange-50/50",
                                  },
                                  {
                                    id: "security",
                                    label: "Gardiennage 24/7",
                                    icon: <ShieldCheck size={16} />,
                                    color: "text-slate-600",
                                    bg: "bg-slate-100/50",
                                  },
                                ]
                                  .filter((a) => amenitiesList.includes(a.id))
                                  .map((amenity) => (
                                    <div
                                      key={amenity.id}
                                      className="flex flex-col items-center text-center gap-2 p-3 rounded-2xl bg-gray-50/50 border border-gray-100/50 transition-all hover:bg-white hover:shadow-sm"
                                    >
                                      <div
                                        className={`p-2 rounded-xl ${amenity.bg} ${amenity.color}`}
                                      >
                                        {amenity.icon}
                                      </div>
                                      <span className="text-[10px] font-black text-gray-700 uppercase tracking-tight leading-tight">
                                        {amenity.label}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {descriptionText && descriptionText.length > 150 && (
                      <button
                        onClick={() =>
                          setIsDescriptionExpanded(!isDescriptionExpanded)
                        }
                        className={`mt-4 font-black text-[10px] md:hidden uppercase tracking-widest flex items-center gap-1 active:scale-95 transition-all ${
                          isFood
                            ? "text-green-600"
                            : isStay
                              ? "text-blue-600"
                              : "text-[#f56b2a]"
                        }`}
                      >
                        {isDescriptionExpanded
                          ? "Voir moins"
                          : "Lire la suite"}
                        <ChevronRight
                          size={10}
                          className={`transition-transform duration-300 ${isDescriptionExpanded ? "-rotate-90" : "rotate-90"}`}
                        />
                      </button>
                    )}
                  </div>

                  <div className="mb-4 flex gap-4 overflow-x-auto no-scrollbar py-1">
                    <div className="flex-shrink-0 flex items-center gap-2 bg-gray-50/80 px-3 py-2 rounded-xl border border-gray-100">
                      <ShieldCheck
                        size={16}
                        className={
                          isFood
                            ? "text-green-500"
                            : isStay
                              ? "text-blue-500"
                              : "text-[#f56b2a]"
                        }
                      />
                      <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">
                        {isFood ? "Fraîcheur" : isStay ? "Vérifié" : "Garantie"}
                      </span>
                    </div>
                    {isStay ? (
                      <div className="flex-shrink-0 flex items-center gap-2 bg-blue-50/50 px-3 py-2 rounded-xl border border-blue-100">
                        <Calendar size={14} className="text-blue-500" />
                        <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest">
                          Réservation Flexible
                        </span>
                      </div>
                    ) : (
                      <div className="flex-shrink-0 flex items-center gap-2 bg-gray-50/80 px-3 py-2 rounded-xl border border-gray-100">
                        <Truck
                          size={16}
                          className={
                            isFood
                              ? "text-green-500"
                              : isStay
                                ? "text-blue-500"
                                : "text-[#f56b2a]"
                          }
                        />
                        <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">
                          {isFood ? "Livraison Express" : "Livraison Disponible"}
                        </span>
                      </div>
                    )}
                    {!isStay && selectedProductDetails.stock != null && (selectedProductDetails.stock as number) > 0 && (
                      <div className="flex-shrink-0 flex items-center gap-2 bg-green-50/50 px-3 py-2 rounded-xl border border-green-100">
                        <CheckCircle2 size={14} className="text-green-500" />
                        <span className="text-[8px] font-black text-green-600 uppercase tracking-widest">
                          En Stock ({selectedProductDetails.stock})
                        </span>
                      </div>
                    )}
                    {!isStay && (selectedProductDetails.stock === 0 || selectedProductDetails.stock == null) && (
                      <div className="flex-shrink-0 flex items-center gap-2 bg-red-50/50 px-3 py-2 rounded-xl border border-red-100">
                        <AlertCircle size={14} className="text-red-500" />
                        <span className="text-[8px] font-black text-red-600 uppercase tracking-widest">
                          {selectedProductDetails.stock == null ? "Stock non disponible" : "Rupture de Stock"}
                        </span>
                      </div>
                    )}
                  </div>

                  <Button
                      onClick={() => {
                        if (isStay) {
                          if (selectedProductDetails.currentBooking) return;
                          setShowBookingModal(true);
                          return;
                        }

                        const options = selectedProductDetails.options || [];
                        const allSelected = options.every(
                          (o) => !!selectedOptions[o.id],
                        );

                        if (options.length > 0 && !allSelected) {
                          localNotify(
                            "Veuillez sélectionner toutes les options",
                            "warning",
                          );
                          return;
                        }

                        // Find matching variant
                        let variantId = undefined;
                        if (
                          options.length > 0 &&
                          selectedProductDetails.variants
                        ) {
                          const variant = selectedProductDetails.variants.find(
                            (v) =>
                              JSON.stringify(v.optionValues) ===
                              JSON.stringify(selectedOptions),
                          );
                          variantId = variant?.id;
                        }

                        addToCart(
                          selectedProductDetails,
                          variantId
                        );
                      }}
                      disabled={!!(isStay && selectedProductDetails.currentBooking)}
                      variant={
                        isFood ? "primary" : isStay ? "secondary" : "primary"
                      }
                      fullWidth
                      size="xl"
                      className={
                        isFood
                          ? "bg-green-600 hover:bg-green-700"
                          : isStay
                            ? `${selectedProductDetails.currentBooking ? 'bg-orange-600 text-white border-none cursor-not-allowed shadow-none uppercase !opacity-100' : 'bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100'}`
                            : ""
                      }
                      icon={
                        isCheckingAvailability ? (
                          <Loader2 className="animate-spin" size={20} />
                        ) : isFood ? (
                          <ShoppingBasketIcon size={20} strokeWidth={3} />
                        ) : isStay ? (
                           selectedProductDetails.currentBooking ? <Clock size={20} strokeWidth={3} /> : <Calendar size={20} strokeWidth={3} />
                        ) : (
                          <ShoppingCart size={20} strokeWidth={3} />
                        )
                      }
                    >
                      {isCheckingAvailability
                        ? "Vérification..."
                        : isStay
                          ? (selectedProductDetails.currentBooking 
                              ? (() => {
                                  try {
                                    const endDate = new Date(selectedProductDetails.currentBooking.endDate);
                                    if (isNaN(endDate.getTime())) return "Réserver séjour";
                                    return `Occupé jusqu'au ${endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
                                  } catch {
                                    return "Réserver séjour";
                                  }
                                })()
                              : "Réserver séjour")
                          : isFood
                            ? "Commander ce plat"
                            : "Ajouter au panier"}
                    </Button>
                </>
              );
            })()}
          </div>
        </div>

        {/* Customer Reviews Section */}
        <div className="mx-4 md:mx-0 bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide mb-1">
                Avis clients
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex text-yellow-400">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={12}
                      fill={
                        s <= Math.round(selectedProductDetails?.rating || 0)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  ))}
                </div>
                <span className="text-xs font-bold text-gray-600">
                  {(selectedProductDetails?.rating || 0).toFixed(1)}/5
                </span>
                <span className="text-[10px] text-gray-600 font-medium">
                  ({formatNumber(selectedProductDetails?.reviewCount || 0)} avis)
                </span>
              </div>
            </div>
            <Button
              onClick={() => {
                if (!user) {
                  setAuthMode("login");
                  setShowAuthModal(true);
                  return;
                }
                setShowReviewForm(true);
                setReviewStep(1);
              }}
              variant="secondary"
              size="sm"
              icon={<MessageCircle size={13} />}
            >
              Laisser une note
            </Button>
          </div>

          {/* Rating Distribution */}
          {(selectedProductDetails.reviews?.length || 0) > 0 && (
            <div className="mb-5 p-3 bg-gray-50/80 rounded-xl border border-gray-100">
              <div className="space-y-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count =
                    selectedProductDetails.reviews?.filter(
                      (r) => r.rating === star,
                    ).length || 0;
                  const total = selectedProductDetails.reviews?.length || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-gray-600 w-3 text-right">
                        {star}
                      </span>
                      <Star
                        size={9}
                        className="text-yellow-400"
                        fill="currentColor"
                      />
                      <div className="flex-grow h-1.5 bg-gray-200/80 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-bold text-gray-600 w-6">
                        {pct}%
                      </span>
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
                  <div
                    key={idx}
                    className="flex gap-3 pb-4 border-b border-gray-50 last:border-0 last:pb-0"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex-shrink-0 flex items-center justify-center text-[10px] font-black text-gray-500">
                      {review.author?.[0]?.toUpperCase() || "A"}
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <h4 className="text-[11px] font-black text-gray-900 truncate">
                            {review.author}
                          </h4>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                size={8}
                                className="text-yellow-400"
                                fill={
                                  s <= review.rating ? "currentColor" : "none"
                                }
                              />
                            ))}
                          </div>
                        </div>
                        <span className="text-[9px] font-medium text-gray-500 flex-shrink-0">
                          {new Date(review.date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">
                        {review.comment}
                      </p>
                    </div>
                  </div>
                ))}

                {selectedProductDetails.reviews &&
                  selectedProductDetails.reviews.length > 3 &&
                  !showAllProductReviews && (
                    <button
                      onClick={() => setShowAllProductReviews(true)}
                      className="w-full py-3 mt-2 bg-gray-50 text-gray-900 text-[11px] font-black uppercase tracking-widest rounded-xl border border-gray-100 hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                    >
                      Voir plus d'avis (
                      {selectedProductDetails.reviews.length - 3})
                      <ChevronRight size={14} className="rotate-90" />
                    </button>
                  )}
              </>
            ) : (
              <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                <MessageCircle
                  size={20}
                  className="mx-auto mb-2 text-gray-500"
                />
                <p className="text-[11px] text-gray-600 font-bold">
                  Aucun avis pour le moment
                </p>
                <p className="text-[9px] text-gray-500 mt-0.5">
                  Soyez le premier à partager votre expérience !
                </p>
              </div>
            )}
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <div className="px-4 md:px-0    duration-700 ">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                <Star
                  className="text-yellow-500"
                  fill="currentColor"
                  size={18}
                />{" "}
                Vous pourriez aussi aimer
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
              {relatedProducts.map((product) => (
                <ProductCard
                  key={`${product.storeId}-${product.id}`}
                  product={product as any}
                  onAddToCart={addToCart as any}
                  onStoreSelect={(id) =>
                    safeNavigate(`/store/${product.storeSlug || id}`)
                  }
                  onClick={() =>
                    safeNavigate(`/product/${generateProductSlug(product)}`)
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCart = () => {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col    duration-500">
        <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-white text-gray-900 z-10 shrink-0">
          <h2 className="text-sm md:text-lg font-black flex items-center gap-1.5 leading-tight">
            {checkoutStage === "cart" ? (
              <ShoppingCart className="text-[#f56b2a]" size={16} />
            ) : (
              <ShieldCheck className="text-green-500" size={16} />
            )}
            <span className="truncate">
              {checkoutStage === "cart"
                ? "Mon Panier"
                : checkoutStage === "shipping"
                  ? (cart.some(i => i.product.businessType === 'stay') ? "Informations" : "Livraison")
                  : checkoutStage === "payment"
                    ? "Paiement"
                    : "Commande Validée"}
            </span>
          </h2>
          <button
            onClick={() => {
              safeNavigate("/", {
                action: () => {
                  setCheckoutStage("cart");
                  setCompletedOrderStores([]);
                  setCompletedOrderItems([]);
                  setCompletedOrderTotal(0);
                },
              });
            }}
            className="px-2.5 py-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500 font-black text-[9px] uppercase tracking-tighter flex items-center gap-1 whitespace-nowrap"
          >
            <ChevronLeft size={12} /> Continuer les achats
          </button>
        </div>

        {/* Step Indicator */}
        {checkoutStage !== "success" && (
          <div className="bg-gray-50/50 px-4 md:px-8 py-2 border-b border-gray-100">
            <div className="flex items-center justify-between max-w-2xl mx-auto">
              {[
                { id: "cart", label: "Panier", icon: ShoppingCart },
                { id: "shipping", label: cart.some(i => i.product.businessType === 'stay') ? "Informations" : "Livraison", icon: MapPin },
                { id: "payment", label: "Paiement", icon: CreditCard },
              ].map((stage, idx, array) => {
                const Icon = stage.icon;
                const isActive = stage.id === checkoutStage;
                const isPast =
                  array.findIndex((s) => s.id === checkoutStage) > idx;
                return (
                  <React.Fragment key={stage.id}>
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <div
                        className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all ${isActive ? "bg-[#f56b2a] text-white shadow-lg shadow-orange-100 scale-110" : isPast ? "bg-green-100 text-green-600" : "bg-white border-2 border-gray-100 text-gray-500"}`}
                      >
                        {isPast ? (
                          <CheckCircle2 size={18} />
                        ) : (
                          <Icon size={isActive ? 18 : 16} />
                        )}
                      </div>
                      <span
                        className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest ${isActive ? "text-gray-900" : isPast ? "text-green-600" : "text-gray-500"}`}
                      >
                        {stage.label}
                      </span>
                    </div>
                    {idx < array.length - 1 && (
                      <div className="flex-grow h-[2px] mx-2 md:mx-4 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-[#f56b2a] transition-all duration-700 ${isPast ? "w-full" : "w-0"}`}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-grow overflow-y-auto custom-scrollbar bg-gray-50/50 p-3 md:p-8">
          {checkoutStage === "cart" &&
            (cart.length > 0 ? (
              <div className="space-y-4">
                {Array.from(
                  new Set(
                    cart
                      .filter((i) => i.product?.storeId)
                      .map((item) => item.product.storeId),
                  ),
                ).map((storeId) => (
                  <div
                    key={storeId}
                    className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100"
                  >
                    <div className="flex items-center gap-2 mb-3 px-2">
                      <Store size={12} className="text-[#f56b2a]" />
                      <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                        Vendu par
                      </span>
                      <span className="text-[11px] font-black text-gray-900 border-b-2 border-orange-100 pb-0.5">
                        {cart.find((i) => i.product?.storeId === storeId)
                          ?.product.storeName || "Boutique"}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {cart
                        .filter((item) => item.product?.storeId === storeId)
                        .map((item) => (
                          <div
                            key={`${item.product.id}-${item.variantId || "base"}`}
                            className="flex gap-3"
                          >
                            <div className="w-16 h-16 flex-shrink-0">
                              <ProductImage
                                src={item.product.image}
                                alt={item.product.name || "Product Image"}
                                containerClassName="rounded-xl border border-gray-100 shadow-sm"
                                showZoomEffect={false}
                              />
                            </div>
                            <div className="flex-grow flex flex-col justify-between">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="text-sm font-bold text-gray-800 line-clamp-1">
                                    {item.product.name || "Unknown Product"}
                                  </h4>
                                  {item.variantId && item.product.variants && (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <Tag
                                        size={10}
                                        className="text-gray-400"
                                      />
                                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                                        {
                                          item.product.variants.find(
                                            (v) => v.id === item.variantId,
                                          )?.name
                                        }
                                      </span>
                                    </div>
                                  )}
                                  {item.checkIn && item.checkOut && (
                                    <div className="mt-1 flex flex-col gap-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <Clock
                                          size={10}
                                          className="text-blue-500"
                                        />
                                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">
                                          {new Date(
                                            item.checkIn,
                                          ).toLocaleDateString("fr-FR", {
                                            day: "numeric",
                                            month: "short",
                                          })}{" "}
                                          -{" "}
                                          {new Date(
                                            item.checkOut,
                                          ).toLocaleDateString("fr-FR", {
                                            day: "numeric",
                                            month: "short",
                                          })}
                                        </span>
                                      </div>
                                      {item.guests && (
                                        <div className="flex items-center gap-1.5">
                                          <User
                                            size={10}
                                            className="text-gray-400"
                                          />
                                          <span className="text-[9px] font-bold text-gray-500">
                                            {item.guests}{" "}
                                            {item.guests > 1
                                              ? "voyageurs"
                                              : "voyageur"}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() =>
                                    removeFromCart(
                                      item.product.id,
                                      item.product.storeId,
                                      item.variantId,
                                    )
                                  }
                                  className="text-gray-600 hover:text-red-500 p-1"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-[#f56b2a] text-xs">
                                      {formatCurrency(
                                        getEffectiveItemPrice(item),
                                      )}
                                    </span>
                                    {item.product.wholesalePrice &&
                                      Number(item.quantity) >=
                                        Number(
                                          item.product.wholesaleMinQty,
                                        ) && (
                                        <span className="text-[10px] text-gray-500 line-through font-bold">
                                          {formatCurrency(
                                            Number(item.product.price),
                                          )}
                                        </span>
                                      )}
                                  </div>
                                  {item.product.wholesalePrice && (
                                    <div
                                      className={`mt-0.5 text-[8px] md:text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${item.quantity >= (item.product.wholesaleMinQty || 0) ? "text-green-600" : "text-gray-600"}`}
                                    >
                                      {item.quantity >=
                                      (item.product.wholesaleMinQty || 0) ? (
                                        <>
                                          <CheckCircle2 size={10} /> Tarif de
                                          gros appliqué
                                        </>
                                      ) : (
                                        <>
                                          <Zap size={10} fill="currentColor" />{" "}
                                          Plus que{" "}
                                          {Number(
                                            item.product.wholesaleMinQty,
                                          ) - item.quantity}{" "}
                                          pour le prix de gros
                                        </>
                                      )}
                                    </div>
                                  )}
                                  {promoApplied &&
                                    promoApplied.store_id ===
                                      item.product.storeId && (
                                      <span className="text-[10px] text-green-600 font-bold">
                                        Coupon appliqué
                                      </span>
                                    )}
                                  {item.checkIn ? (
                                    <div className="mt-2 px-3 py-1 bg-blue-50 rounded-lg border border-blue-100 flex items-center gap-2">
                                      <span className="text-[10px] font-black text-blue-700">
                                        {item.quantity}{" "}
                                        {item.quantity > 1 ? "nuits" : "nuit"}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1 border border-gray-200 shadow-inner mt-2">
                                      <button
                                        onClick={() =>
                                          updateQuantity(
                                            item.product.id,
                                            item.product.storeId,
                                            -1,
                                            item.variantId,
                                          )
                                        }
                                        className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 font-bold"
                                      >
                                        -
                                      </button>
                                      <span className="text-xs font-black text-gray-900 w-4 text-center">
                                        {item.quantity}
                                      </span>
                                      <button
                                        onClick={() =>
                                          updateQuantity(
                                            item.product.id,
                                            item.product.storeId,
                                            1,
                                            item.variantId,
                                          )
                                        }
                                        className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 font-bold"
                                      >
                                        +
                                      </button>
                                    </div>
                                  )}
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
                <p className="text-lg font-black text-gray-900">
                  Votre panier est vide
                </p>
              </div>
            ))}
          {(checkoutStage === "shipping" || checkoutStage === "payment") && (
            <form
              id="checkout-form"
              onSubmit={handleCheckoutSubmit}
              className="space-y-6"
            >
              {checkoutStage === "shipping" && (
                <div className="space-y-6   ">
                  {/* Section 1: Informations Personnelles */}
                  <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#f56b2a] flex items-center justify-center font-black text-sm">
                        1
                      </div>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">
                        Vos Informations
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-600 uppercase ml-1">
                          Nom Complet
                        </label>
                        <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#f56b2a] transition-colors">
                            <User size={18} />
                          </div>
                          <input
                            required
                            type="text"
                            value={customerInfo.name}
                            onChange={(e) =>
                              setCustomerInfo({
                                ...customerInfo,
                                name: e.target.value,
                              })
                            }
                            className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:bg-white transition-all no-global-border"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-600 uppercase ml-1">
                          Téléphone Mobile
                        </label>
                        <div className="relative group">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#f56b2a] transition-colors">
                            <Phone size={18} />
                          </div>
                          <input
                            required
                            type="tel"
                            value={customerInfo.phone}
                            onChange={(e) =>
                              setCustomerInfo({
                                ...customerInfo,
                                phone: e.target.value,
                              })
                            }
                            className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:bg-white transition-all no-global-border"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {!cart.some(i => i.product.businessType === 'stay') && (
                    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
                      <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#f56b2a] flex items-center justify-center font-black text-sm">
                          2
                        </div>
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">
                          Adresse de Livraison
                        </h3>
                      </div>

                      {user && buyerAddresses.length > 0 && !customerInfo.address ? (
                        <div className="space-y-4">
                          <p className="text-xs font-bold text-gray-500 mb-3">Sélectionnez une adresse enregistrée</p>
                          <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {buyerAddresses.map((addr) => (
                              <button
                                key={addr.id}
                                onClick={() => { setSelectedAddressId(addr.id); setCustomerInfo({ ...customerInfo, name: addr.full_name, phone: addr.phone, address: addr.address, city: addr.city }); }}
                                className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${selectedAddressId === addr.id ? 'border-[#f56b2a] bg-orange-50/30' : 'border-gray-100 hover:border-gray-200'}`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                                    {addr.name === 'Maison' ? <Home size={16} /> : addr.name === 'Bureau' ? <Briefcase size={16} /> : <MapPin size={16} />}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-black text-gray-900">{addr.name}</p>
                                    <p className="text-xs text-gray-500">{addr.address}, {addr.city}</p>
                                  </div>
                                  {addr.is_default && <span className="text-[9px] font-black text-[#f56b2a] uppercase">Par défaut</span>}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : user && buyerAddresses.length > 0 && customerInfo.address ? (
                        <div className="space-y-4">
                          <div className="p-4 rounded-2xl border-2 border-[#f56b2a] bg-orange-50/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                                  <MapPin size={16} />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-black text-gray-900">{customerInfo.name}</p>
                                  <p className="text-xs text-gray-500">{customerInfo.address}, {customerInfo.city}</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => { setSelectedAddressId(null); setCustomerInfo({ ...customerInfo, address: "", city: "" }); }}
                                className="text-[9px] font-bold text-[#f56b2a] underline"
                              >
                                Changer
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-600 uppercase ml-1">
                              Adresse (Rue, Quartier...)
                            </label>
                            <div className="relative group">
                              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#f56b2a] transition-colors">
                                <MapPin size={18} />
                              </div>
                              <input
                                required
                                type="text"
                                value={customerInfo.address}
                                onChange={(e) =>
                                  setCustomerInfo({
                                    ...customerInfo,
                                    address: e.target.value,
                                  })
                                }
                                className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:bg-white transition-all no-global-border"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-600 uppercase ml-1">
                              Ville
                            </label>
                            <input
                              required
                              type="text"
                              value={customerInfo.city}
                              onChange={(e) =>
                                setCustomerInfo({
                                  ...customerInfo,
                                  city: e.target.value,
                                })
                              }
                              className="w-full px-5 py-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl font-bold text-gray-700 focus:bg-white transition-all no-global-border"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {checkoutStage === "payment" && (
                <div className="space-y-4   ">
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      onClick={() => setPaymentMethod("cod")}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === "cod" ? "border-[#f56b2a] bg-orange-50" : "border-gray-100 bg-white"}`}
                    >
                      <Truck
                        size={24}
                        className={
                          paymentMethod === "cod"
                            ? "text-[#f56b2a]"
                            : "text-gray-600"
                        }
                      />
                      <div className="mt-2 font-black text-sm text-gray-900">
                        Paiement à la livraison
                      </div>
                    </div>
                    <div
                      onClick={() => setPaymentMethod("card")}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentMethod === "card" ? "border-[#f56b2a] bg-orange-50" : "border-gray-100 bg-white"}`}
                    >
                      <CreditCard
                        size={24}
                        className={
                          paymentMethod === "card"
                            ? "text-[#f56b2a]"
                            : "text-gray-600"
                        }
                      />
                      <div className="mt-2 font-black text-sm text-gray-900">
                        Carte Bancaire
                      </div>
                    </div>
                  </div>
                  {paymentMethod === "card" && (
                    <div className="space-y-3 p-4 bg-gray-100 rounded-2xl">
                      <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200">
                        <ShieldCheck
                          size={20}
                          className="text-green-500 flex-shrink-0"
                        />
                        <div className="text-xs font-bold text-gray-600">
                          Paiement sécurisé par FusionPay
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500 text-center">
                        Vous serez redirigé vers le formulaire de paiement
                        sécurisé
                      </p>
                    </div>
                  )}
                </div>
              )}
            </form>
          )}
          {checkoutStage === "success" && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 text-center relative overflow-hidden">
              <div className="relative mb-10">
                <div className="absolute inset-0 bg-green-100 rounded-full blur-2xl opacity-50 scale-150 animate-pulse" />
                <div className="relative w-24 h-24 bg-green-500 text-white rounded-full flex items-center justify-center shadow-2xl success-glow animate-success-bounce">
                  <CheckCircle2 size={48} strokeWidth={3} />
                </div>
                <div className="absolute -right-2 -top-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-white shadow-lg animate-bounce">
                  <Star size={18} fill="currentColor" />
                </div>
              </div>

              <h3 className="text-2xl md:text-3xl font-black text-gray-900 mb-3 tracking-tight leading-tight">
                Commande <span className="text-green-500">Réussie !</span>
              </h3>

              <div className="w-10 h-1 bg-green-500 rounded-full mb-4 mx-auto" />

              <p className="text-gray-500 max-w-sm mb-8 font-bold text-sm leading-relaxed">
                Votre commande a été enregistrée avec succès.
                <br className="hidden md:block" />
                Le vendeur va traiter votre commande rapidement.
              </p>

              <div className="w-full flex flex-col items-center">
                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest text-center mb-3">
                  Cliquez sur un bouton pour continuer
                </p>
                <div className="flex gap-3 w-full max-w-sm">
                  <Button
                    onClick={() => safeNavigate("/")}
                    loading={isNavigating}
                    loadingText="Chargement..."
                    variant="secondary"
                    size="md"
                    fullWidth
                    className="flex-1"
                    icon={<ArrowRight size={14} />}
                    iconPosition="right"
                  >
                    Accueil
                  </Button>
                  {(() => {
                    const firstStore = completedOrderStores[0];
                    if (!firstStore) return null;
                    const store = stores.find(
                      (s) => s.id === firstStore.storeId,
                    );
                    const storePhone = store?.phone || store?.settings?.phone;
                    if (completedOrderStores.length === 1 && storePhone && completedOrderItems.length > 0) {
                      const waMsg = `📦 NOUVELLE COMMANDE #${Date.now().toString().slice(-6)}\n\nClient: ${customerInfo.name || "Anonyme"}\nTéléphone: ${customerInfo.phone || "Non fourni"}\n\nArticles:\n${completedOrderItems.map((item) => `• ${item.quantity}x ${item.name} - ${formatCurrency(item.price * item.quantity)}`).join("\n")}\n\nTotal: ${formatCurrency(completedOrderTotal)}\nMode de paiement: ${paymentMethod === "cod" ? "Espèces" : "Carte"}`;
                      const waUrl = `https://wa.me/${storePhone.replace(/\D/g, "")}?text=${encodeURIComponent(waMsg)}`;

                      return (
                        <Button
                          onClick={() => {
                            setIsWhatsAppLoading(true);
                            window.open(waUrl, "_blank");
                            setTimeout(() => setIsWhatsAppLoading(false), 1500);
                          }}
                          loading={isWhatsAppLoading}
                          loadingText="Ouverture..."
                          variant="primary"
                          size="md"
                          fullWidth
                          className="flex-1 !bg-green-500 hover:!bg-green-600"
                          icon={
                            <svg
                              viewBox="0 0 24 24"
                              className="w-4 h-4 flex-shrink-0"
                              fill="currentColor"
                            >
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.162-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                          }
                        >
                          WhatsApp
                        </Button>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
        {checkoutStage !== "success" && cart.length > 0 && (
          <div className="p-4 bg-white border-t border-gray-100">
            <div className="space-y-2 mb-6 text-sm">
              <div className="flex justify-between items-center text-gray-500">
                <span>Sous-total</span>
                <span className="font-bold">
                  {formatCurrency(Number(baseCartTotal) || 0)}
                </span>
              </div>
              {promoApplied && (
                <div className="flex justify-between items-center text-green-600 font-bold">
                  <span>Remise ({promoApplied.code})</span>
                  <span>-{formatCurrency(Number(discountAmount) || 0)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xl font-black text-gray-900 pt-2 border-t border-gray-100">
                <span>Total</span>
                <span className="text-[#f56b2a]">
                  {formatCurrency(Number(cartTotal) || 0)}
                </span>
              </div>
            </div>

            {/* Code Promo Input */}
            {!promoApplied && checkoutStage === "cart" && (
              <div className="mb-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value)}
                    placeholder="Code promo"
                    className="flex-grow px-3 py-2.5 sm:px-4 sm:py-2.5 bg-gray-50 border border-gray-100 rounded-xl font-bold text-xs sm:text-sm uppercase w-full"
                  />
                  <Button
                    onClick={handlePromoApply}
                    disabled={!promoCodeInput.trim()}
                    loading={isApplyingPromo}
                    loadingText="Vérification..."
                    variant="secondary"
                    size="sm"
                  >
                    Appliquer
                  </Button>
                </div>
              </div>
            )}

            {promoApplied && (
              <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-2 bg-green-50 px-3 sm:px-4 py-2.5 rounded-xl border border-green-100">
                <span className="text-green-600 font-bold text-xs sm:text-sm">
                  Code appliqué: {promoApplied.code}
                </span>
                <button
                  onClick={() => setPromoApplied(null)}
                  className="text-gray-600 hover:text-red-500 p-1"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {checkoutStage === "cart" && (
                <Button
                  onClick={() => {
                    setIsCheckoutTransitioning(true);
                    setTimeout(() => {
                      setCheckoutStage("shipping");
                      setIsCheckoutTransitioning(false);
}, 500);
                  }}
                  loading={isCheckoutTransitioning}
                  loadingText="Chargement..."
                  fullWidth
                  size="xl"
                  icon={<ChevronLeft size={20} className="rotate-180" />}
                  iconPosition="right"
                >
                  Continuer la commande
                </Button>
              )}
              {(checkoutStage === "shipping" ||
                checkoutStage === "payment") && (
                <>
                  <Button
                    form="checkout-form"
                    type="submit"
                    loading={isProcessingPayment}
                    loadingText={
                      checkoutStage === "payment"
                        ? "Traitement en cours..."
                        : "Passage au paiement..."
                    }
                    fullWidth
                    size="xl"
                    variant="secondary"
                  >
                    {checkoutStage === "shipping"
                      ? "Passer au paiement"
                      : "Confirmer la commande"}
                  </Button>
                  <Button
                    onClick={() =>
                      handleStageChange(
                        checkoutStage === "shipping" ? "cart" : "shipping",
                      )
                    }
                    loading={isNavigating}
                    variant="ghost"
                    size="sm"
                    fullWidth
                  >
                    ← Retour à l'étape précédente
                  </Button>
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
      {/* Global Connectivity Banner */}
      {!isOnline && (
        <div className="bg-red-500 text-white text-[10px] font-black uppercase tracking-widest py-2 text-center   duration-300 z-[10001]">
          Vous êtes hors ligne • Reconnexion en cours...
        </div>
      )}
      {/* BuyerView Overlay (Full screen for mobile/desktop) */}
      {(isAccountView || isAccountViewUrl) && user && (
        <div className="fixed inset-0 z-[900] bg-white overflow-y-auto">
          <BuyerView
            userEmail={user.email}
            accountTab={location.pathname.split('/mon-compte/')[1] || 'commandes'}
            onBack={() => {
              if (isAccountViewUrl) safeNavigate("/");
              else setIsAccountView(false);
            }}
            notify={notify}
            onLogout={handleLogout}
            cachedData={buyerDataCache}
            onUpdateCache={updateBuyerCache}
          />
        </div>
      )}

      {/* Global Notifications (Toasts) */}
      <div className="fixed top-6 right-6 z-[99999] flex flex-col gap-4 pointer-events-none items-end">
        {toastNotifications.map((notif) => (
          <Toast key={notif.id} notification={notif} onRemove={removeToast} />
        ))}
      </div>

      <MarketplaceBottomNav
        cartItemsCount={cartItemsCount}
        loading={isNavigating}
        onSearchClick={() => {
          setIsSearchOpen(true);
        }}
        onHomeClick={() => {
          if (isNavigating) return;
          setIsSearchOpen(false);
          setIsAccountView(false);
          safeNavigate("/");
        }}
        onCartClick={() => {
          if (isNavigating) return;
          setIsSearchOpen(false);
          setIsAccountView(false);
          safeNavigate("/cart");
        }}
        onAccountClick={() => {
          if (isNavigating) return;
          if (user) {
            safeNavigate("/mon-compte/commandes");
          } else {
            setAuthMode("login");
            setShowAuthModal(true);
          }
        }}
      />

      {/* 🌀 Global Navigation Loading Overlay - With unique key for clean re-renders */}
      {isNavigating && (
        <div 
          key={`loader-${navigationKey}`}
          className="fixed inset-0 z-[9999] bg-white/95 backdrop-blur-xl flex items-center justify-center   duration-300"
        >
          <div className="flex flex-col items-center gap-6   duration-500">
            <div className="relative">
              <div className="w-20 h-20 border-[4px] border-gray-100 border-t-[#f56b2a] rounded-full animate-spin shadow-inner" />
              <div className="absolute inset-0 flex items-center justify-center">
                <ShoppingBasketIcon
                  size={32}
                  className="text-[#f56b2a]/20 animate-pulse"
                />
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[11px] font-black text-gray-900 uppercase tracking-[0.3em] animate-pulse">
                Chargement
              </span>
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-[#f56b2a] rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-[#f56b2a] rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-[#f56b2a] rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Premium Sticky Header */}
      {(location.pathname === "/" ||
        !location.pathname ||
        location.pathname === "") && (
        <header className="bg-white/90 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-[100] transition-all">
          <div className="container mx-auto px-4">
            {/* Top Utility Bar - Hidden on scroll or simplified for mobile */}

            {/* Main Interaction Bar */}
            <div className="flex items-center justify-between py-4">
              {/* Logo with modern typography */}
              <div
                className="flex items-center cursor-pointer group flex-shrink-0"
                onClick={() => {
                  safeNavigate("/", {
                    action: () => {
                      setSearchTerm("");
                      setSelectedCategory("all");
                    },
                  });
                }}
              >
                <div className="w-8 h-8 md:w-10 md:h-10 bg-[#f56b2a] rounded-2xl flex items-center justify-center shadow-lg shadow-orange-100 group-hover:scale-110 transition-transform mr-2 md:mr-3">
                  <ShoppingBasketIcon
                    size={20}
                    className="text-white md:hidden"
                  />
                  <ShoppingBasketIcon
                    size={24}
                    className="text-white hidden md:block"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-base md:text-2xl font-black tracking-tight leading-none text-gray-900">
                    Market<span className="text-[#f56b2a]">Place</span>
                  </span>
                  <span className="hidden md:block text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] leading-none mt-1">
                    Local & Express
                  </span>
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
                      if (checkoutStage === "success") {
                        setCheckoutStage("cart");
                        setCompletedOrderStores([]);
                        setCompletedOrderItems([]);
                        setCompletedOrderTotal(0);
                      }
                      safeNavigate("/cart");
                    }}
                    className="w-9 h-9 md:w-12 md:h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-900 group-hover:bg-[#f56b2a] group-hover:text-white transition-all active:scale-90"
                  >
                    <ShoppingCart
                      size={20}
                      className="md:hidden"
                      strokeWidth={2.5}
                    />
                    <ShoppingCart
                      size={22}
                      className="hidden md:block"
                      strokeWidth={2.5}
                    />
                    {cartItemsCount > 0 && (
                      <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#f56b2a] border-2 border-white rounded-full flex items-center justify-center text-[10px] font-black text-white  ">
                        {cartItemsCount}
                      </div>
                    )}
                  </button>
                </div>

                {/* User Profile Button */}
                <div className="ml-1 md:ml-3">
                  <button
                    onClick={() => {
                      if (user) {
                        safeNavigate("/mon-compte/commandes");
                      } else {
                        setAuthMode("login");
                        setShowAuthModal(true);
                      }
                    }}
                    className={`flex items-center gap-2.5 p-1.5 md:px-4 md:py-2.5 rounded-2xl transition-all active:scale-[0.98] group/auth border-[1.5px] ${user ? "bg-[#f56b2a]/5 border-[#f56b2a]/20 text-[#f56b2a]" : "bg-gray-50 border-gray-100 text-gray-700 hover:bg-[#f56b2a]/10 hover:text-[#f56b2a] hover:border-[#f56b2a]/20"}`}
                  >
                    <div
                      className={`w-7 h-7 md:w-8 md:h-8 rounded-xl flex items-center justify-center shadow-sm transition-all ${user ? "bg-[#f56b2a] text-white" : "bg-white text-gray-400 group-hover/auth:bg-[#f56b2a] group-hover/auth:text-white"}`}
                    >
                      <User size={18} strokeWidth={3} />
                    </div>
                    <div className="hidden md:flex flex-col items-start leading-none pr-1">
                      <span className="text-[9px] font-black uppercase tracking-wider opacity-60 mb-0.5">
                        {user ? "Mon Compte" : "Bienvenue"}
                      </span>
                      <span className="text-xs font-black truncate max-w-[100px]">
                        {user ? user.name : "Se connecter"}
                      </span>
                    </div>
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
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setIsSearchOpen(true)}
                  className="w-full bg-transparent py-2 px-3 text-[11px] font-bold text-gray-800 focus:outline-none placeholder-gray-400 no-global-border border-none cursor-pointer"
                />
              </div>
            </div>

            {/* Dynamic Horizontal Categories - Scrollable with scroll hint */}
            <div className="relative">
              <div className="flex items-center gap-2 py-2 overflow-x-auto no-scrollbar mask-fade-right -mx-4 px-4 whitespace-nowrap scroll-smooth">
                {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    if (
                      location.pathname.includes("/product/") ||
                      location.pathname.includes("/cart")
                    ) {
                      safeNavigate("/");
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all border-2 active:scale-95 whitespace-nowrap ${
                    selectedCategory === cat
                      ? "bg-[#f56b2a] border-[#f56b2a] text-white shadow-md"
                      : "bg-white border-gray-100 text-gray-600 hover:border-gray-200"
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${selectedCategory === cat ? "bg-white" : "bg-gray-200"}`}
                  />
                  {cat === "all" ? "Tout voir" : cat}
                </button>
              ))}
              </div>
              {/* Scroll indicators */}
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-gray-50 to-transparent pointer-events-none md:hidden" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-50 to-transparent pointer-events-none md:hidden" />
            </div>
          </div>
        </header>
      )}

      {cartNotif && lastAddedProduct && (
        <div className="fixed top-4 right-4 left-4 md:left-auto md:w-[340px] z-[1000]    duration-400 px-2 md:px-0">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white/20 overflow-hidden">
            {/* Progress bar at the bottom for top-toasts feels better or keep top */}
            <div className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white flex-shrink-0 border border-gray-100 shadow-sm relative">
                  <Image
                    src={lastAddedProduct.image}
                    alt={lastAddedProduct.name}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <CheckCircle2
                      size={12}
                      className="text-green-500"
                      strokeWidth={3}
                    />
                    <span className="text-[9px] font-black text-green-600 uppercase tracking-widest leading-none">
                      Ajouté au panier
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-gray-900 truncate leading-snug">
                    {lastAddedProduct.name}
                  </p>
                  <p className="text-[11px] font-black text-[#f56b2a] mt-0.5">
                    {formatCurrency(Number(lastAddedProduct.price) || 0)}
                  </p>
                </div>
                <button
                  onClick={() => setCartNotif(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-600 self-start"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            {/* Tiny progress line at the very bottom */}
            <div className="h-0.5 bg-gray-100 w-full overflow-hidden">
              <div
                className="h-full bg-green-500/50 animate-[shrink_4s_linear_forwards]"
                style={{ animation: "shrink 4s linear forwards" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Global Search Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[1000] bg-white   duration-300 flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <button
              onClick={() => setIsSearchOpen(false)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              aria-label="Fermer la recherche"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="flex-grow relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#f56b2a]"
                size={18}
              />
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
                  onClick={() => setSearchTerm("")}
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
                  <div className="  duration-500">
                    <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Store size={12} /> Boutiques ({globalSearchStores.length}
                      )
                    </h3>
                    <div className="grid grid-cols-2 gap-3 pb-4">
                      {globalSearchStores.map((store) => (
                        <div
                          key={store.id}
                          onClick={() => {
                            safeNavigate(`/store/${store.slug || store.id}`, {
                              action: () => setIsSearchOpen(false),
                            });
                          }}
                          className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group active:scale-[0.98]"
                        >
                          <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-inner overflow-hidden border-2 border-orange-50">
                            {store.settings?.logo ? (
                              <img
                                loading="lazy"
                                decoding="async"
                                src={store.settings.logo}
                                alt={store.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Store className="text-[#f56b2a]" size={28} />
                            )}
                          </div>
                          <h3 className="font-bold text-gray-800 text-[11px] mb-1 leading-tight line-clamp-1">
                            {store.settings?.name || "Boutique"}
                          </h3>
                          <div className="flex flex-col gap-0.5">
                            <p className="text-[9px] text-gray-600 font-black uppercase tracking-tighter">
                              {
                                (store.products || []).filter(
                                  (p) => p.isOnline !== false && p.image,
                                ).length
                              }{" "}
                              PROD.
                            </p>
                            <p className="text-[9px] text-[#f56b2a] font-black tracking-wider">
                              @{(store.slug || "boutique").toLowerCase()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Products Results (FTS Powered) */}
                {(isSearching || ftsResults.length > 0) ? (
                  <div className="  duration-500 ">
                    <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <ShoppingCart size={12} /> {isSearching ? 'Recherche en cours...' : `Produits (${ftsResults.length})`}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {isSearching ? (
                        Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)
                      ) : (
                        ftsResults.map((product) => (
                          <div
                            key={product.id}
                            onClick={() => {
                              safeNavigate(
                                `/product/${generateProductSlug(product)}`,
                                {
                                  action: () => setIsSearchOpen(false),
                                },
                              );
                            }}
                            className="cursor-pointer"
                          >
                            <ProductCard
                              product={product as any}
                              onAddToCart={addToCart as any}
                              onStoreSelect={(id) => {
                                safeNavigate(
                                  `/store/${product.storeSlug || id}`,
                                  {
                                    action: () => setIsSearchOpen(false),
                                  },
                                );
                              }}
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  !isSearching && globalSearchStores.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-500">
                        <Search size={32} />
                      </div>
                      <p className="text-gray-900 font-black">
                        Pas de résultats pour "{searchTerm}"
                      </p>
                      <p className="text-gray-600 text-xs mt-1 font-bold">
                        Vérifiez l'orthographe ou essayez un autre mot.
                      </p>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                  <Zap
                    size={12}
                    className="text-orange-500"
                    fill="currentColor"
                  />{" "}
                  Recherches Populaires
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    "iPhone",
                    "Samsung",
                    "Mode",
                    "Sneakers",
                    "Parfums",
                    "High-Tech",
                  ].map((tag) => (
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

      <main
        className={`container mx-auto ${selectedProductId ? "px-0" : "px-4"} ${selectedStoreParam || selectedProductId ? "pt-0 pb-4" : "py-4"} md:py-8 flex-grow`}
      >
        <Routes>
          <Route
            index
            element={
              <>
                {/* Hidden H1 for SEO - Important for index page */}
                <h1 className="sr-only">
                  POS Market - Boutique Marketplace Express Premium
                </h1>

                {/* Hero Bannière Premium - Carousel */}
                {!searchTerm && selectedCategory === "all" && (
                  <div className="mb-10 mt-2 md:mt-6 relative group overflow-hidden rounded-[32px] md:rounded-[40px] isolation-auto">
                    <div
                      className="relative w-full min-h-[260px] md:h-[300px] flex transition-transform duration-700 ease-in-out"
                      style={{
                        transform: `translateX(-${currentSlide * 100}%)`,
                      }}
                    >
                      {/* Slide 1 - Vendre */}
                      <div className="min-w-full relative bg-gradient-to-br from-[#fff1eb] to-[#ace0f9]/20 flex items-center justify-center border border-white">
                        <div className="absolute left-0 top-0 w-full h-full overflow-hidden">
                          <div className="absolute -left-10 -top-10 w-40 h-40 bg-orange-200/30 rounded-full blur-3xl" />
                          <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-blue-100/40 rounded-full blur-3xl" />
                        </div>
                        <div className="relative z-10 flex flex-col items-center text-center px-4 py-8 md:py-0 max-w-2xl">
                          <div className="inline-flex items-center gap-2 bg-white/60 backdrop-blur-md px-3 py-1 rounded-full border border-orange-100 mb-6 font-black text-[10px] text-[#f56b2a] uppercase tracking-widest">
                            <Zap size={14} fill="currentColor" /> Offre
                            Commerçant
                          </div>
                          <h2 className="text-2xl md:text-[40px] font-black text-gray-900 mb-4 tracking-tight leading-[1.1]">
                            C'est le moment{" "}
                            <span className="text-[#f56b2a]">de vendre</span>
                          </h2>
                          <p className="text-gray-500 text-xs md:text-base font-bold mb-6 max-w-md">
                            Boostez votre visibilité et attirez plus de clients
                            dès aujourd'hui sur notre plateforme express.
                          </p>
                          <Button
                            onClick={() =>
                              safeNavigate(user ? "/dashboard" : "/login")
                            }
                            loading={isNavigating}
                            variant="secondary"
                            size="xl"
                          >
                            Commencer maintenant
                          </Button>
                        </div>
                      </div>

                      {/* Slide 2 - Gestion */}
                      <div className="min-w-full relative bg-gradient-to-br from-[#e0f2fe] to-[#f0f9ff] flex items-center justify-center border border-white">
                        <div className="absolute inset-0 overflow-hidden">
                          <div className="absolute right-0 top-0 w-80 h-80 bg-blue-200/20 rounded-full blur-3xl" />
                        </div>
                        <div className="relative z-10 flex flex-col items-center text-center px-4 py-8 md:py-0 max-w-2xl">
                          <div className="inline-flex items-center gap-2 bg-blue-500 text-white px-3 py-1 rounded-full mb-6 font-black text-[10px] uppercase tracking-widest">
                            <ShieldCheck size={14} /> Gestion Pro
                          </div>
                          <h2 className="text-2xl md:text-[40px] font-black text-gray-900 mb-4 tracking-tight leading-[1.1]">
                            Gérez votre{" "}
                            <span className="text-blue-500">
                              stock facilement
                            </span>
                          </h2>
                          <p className="text-gray-500 text-xs md:text-base font-bold mb-6 max-w-md">
                            Un inventaire synchronisé et des alertes
                            automatiques pour ne jamais manquer une vente.
                          </p>
                          <Button
                            onClick={() =>
                              safeNavigate(user ? "/dashboard" : "/login")
                            }
                            loading={isNavigating}
                            variant="secondary"
                            size="xl"
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            Commencer maintenant
                          </Button>
                        </div>
                      </div>

                      {/* Slide 3 - Croissance */}
                      <div className="min-w-full relative bg-gradient-to-br from-[#fef2f2] to-[#fff1f2] flex items-center justify-center border border-white">
                        <div className="absolute inset-0 overflow-hidden">
                          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-100/30 rounded-full blur-[100px]" />
                        </div>
                        <div className="relative z-10 flex flex-col items-center text-center px-4 py-8 md:py-0 max-w-2xl">
                          <div className="inline-flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full mb-6 font-black text-[10px] uppercase tracking-widest">
                            <Heart size={14} fill="currentColor" /> Communauté
                          </div>
                          <h2 className="text-2xl md:text-[40px] font-black text-gray-900 mb-4 tracking-tight leading-[1.1]">
                            Rejoignez{" "}
                            <span className="text-red-500">le succès</span>
                          </h2>
                          <p className="text-gray-500 text-xs md:text-base font-bold mb-6 max-w-md">
                            Faites partie des 500+ commerçants qui ont déjà
                            transformé leur manière de vendre.
                          </p>
                          <Button
                            onClick={() =>
                              safeNavigate(user ? "/dashboard" : "/login")
                            }
                            variant="secondary"
                            size="xl"
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Commencer maintenant
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Pagination Dots */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                      {[0, 1, 2].map((idx) => (
                        <div
                          key={idx}
                          onClick={() => setCurrentSlide(idx)}
                          className={`h-1.5 rounded-full transition-all cursor-pointer ${currentSlide === idx ? "w-8 bg-gray-900" : "w-2 bg-gray-300"}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Super App Verticals - Compact Mobile-First */}
                {!searchTerm && selectedCategory === "all" && !selectedStoreId && (
                  <div className="mb-6 md:mb-10    duration-700">
                    <h2 className="text-sm md:text-xl font-black text-gray-900 mb-3 md:mb-6 tracking-tight">
                      Que voulez-vous faire aujourd'hui ?
                    </h2>
                    <div className="grid grid-cols-3 gap-2 md:gap-4">
                      {[
                        {
                          id: "shopping",
                          label: "Shopping",
                          icon: ShoppingBag,
                          color: "orange",
                          bgSelected: "bg-orange-500",
                          bgUnselected: "bg-orange-50",
                          borderSelected: "border-orange-500",
                          textSelected: "text-white",
                          iconColor: "text-orange-500",
                        },
                        {
                          id: "food",
                          label: "Resto",
                          icon: Zap,
                          color: "yellow",
                          bgSelected: "bg-yellow-500",
                          bgUnselected: "bg-yellow-50",
                          borderSelected: "border-yellow-500",
                          textSelected: "text-white",
                          iconColor: "text-yellow-500",
                        },
                        {
                          id: "stay",
                          label: "Séjours",
                          icon: Store,
                          color: "blue",
                          bgSelected: "bg-blue-500",
                          bgUnselected: "bg-blue-50",
                          borderSelected: "border-blue-500",
                          textSelected: "text-white",
                          iconColor: "text-blue-500",
                        },
                      ].map((v) => (
                        <button
                          key={v.id}
                          onClick={() => {
                            setSelectedVertical(v.id as any);
                            setSelectedCategory("all");
                          }}
                          className={`relative flex flex-col items-center justify-center py-3 px-2 md:py-6 md:px-4 rounded-2xl md:rounded-3xl transition-all border-2 md:border-4 group active:scale-95 overflow-hidden ${
                            selectedVertical === v.id
                              ? `${v.bgSelected} ${v.textSelected} ${v.borderSelected} shadow-lg`
                              : "bg-white border-gray-100 text-gray-900 hover:border-gray-200 hover:shadow-md"
                          }`}
                        >
                          <div
                            className={`w-8 h-8 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center mb-1.5 md:mb-3 transition-all ${
                              selectedVertical === v.id
                                ? "bg-white/20"
                                : v.bgUnselected
                            }`}
                          >
                            <v.icon
                              size={18}
                              className={`md:hidden ${selectedVertical === v.id ? "text-white" : v.iconColor}`}
                              strokeWidth={2.5}
                            />
                            <v.icon
                              size={28}
                              className={`hidden md:block ${selectedVertical === v.id ? "text-white" : v.iconColor}`}
                              strokeWidth={2.5}
                            />
                          </div>
                          <span className={`text-[9px] md:text-base font-black uppercase tracking-wide ${selectedVertical === v.id ? "text-white" : "text-gray-900"}`}>
                            {v.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Partners */}
                {!searchTerm &&
                  selectedCategory === "all" &&
                  partnerStores.length > 0 && (
                    <div className="mb-12">
                      <h2 className="text-xl font-black text-gray-900 mb-6 tracking-tight">
                        Boutiques partenaires
                      </h2>
                      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
                        {partnerStores.slice(0, 6).map((store) => (
                          <div
                            key={store.id}
                            onClick={() =>
                              safeNavigate(`/store/${store.slug || store.id}`)
                            }
                            className="min-w-[180px] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm cursor-pointer flex flex-col items-center text-center group will-change-transform"
                          >
                            <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-3 group-hover:scale-110">
                              <Store className="text-[#f56b2a]" size={28} />
                            </div>
                            <h3 className="font-bold text-gray-800 text-xs mb-1">
                              {store.settings?.name || "Boutique"}
                            </h3>
                            <div className="flex flex-col gap-0.5">
                              <p className="text-[10px] text-gray-600 font-black">
                                {
                                  (store.products || []).filter(
                                    (p) => p.isOnline !== false && p.image,
                                  ).length
                                }{" "}
                                Produits
                              </p>
                              <p className="text-[9px] text-[#f56b2a] font-black uppercase tracking-wider">
                                {formatNumber((store.views || 0) +
                                  (store.products?.reduce(
                                    (sum, p) => sum + (p.views || 0),
                                    0,
                                  ) || 0))}{" "}
                                Visites
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Résultats boutiques (Mode recherche) */}
                {searchTerm && globalSearchStores.length > 0 && (
                  <div className="mb-12    duration-500">
                    <h2 className="text-lg font-black text-gray-900 mb-6 tracking-tight flex items-center gap-2">
                      <Store className="text-[#f56b2a]" size={20} /> Boutiques
                      trouvées ({globalSearchStores.length})
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {globalSearchStores.slice(0, 12).map((store) => (
                        <div
                          key={store.id}
                          onClick={() =>
                            safeNavigate(`/store/${store.slug || store.id}`)
                          }
                          className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group active:scale-[0.98]"
                        >
                          <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-inner overflow-hidden border-2 border-orange-50">
                            {store.settings?.logo ? (
                              <img
                                loading="lazy"
                                decoding="async"
                                src={store.settings.logo}
                                alt={store.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Store className="text-[#f56b2a]" size={28} />
                            )}
                          </div>
                          <h3 className="font-bold text-gray-800 text-[11px] mb-1 leading-tight line-clamp-1">
                            {store.settings?.name || "Boutique"}
                          </h3>
                          <div className="flex flex-col gap-0.5">
                            <p className="text-[9px] text-gray-600 font-black uppercase tracking-tighter">
                              {
                                (store.products || []).filter(
                                  (p) => p.isOnline !== false && p.image,
                                ).length
                              }{" "}
                              PROD.
                            </p>
                            <p className="text-[9px] text-[#f56b2a] font-black tracking-wider">
                              @{(store.slug || "boutique").toLowerCase()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                    {searchTerm ? (
                      <>
                        <ShoppingCart className="text-[#f56b2a]" size={20} />{" "}
                        Résultats produits
                      </>
                    ) : selectedCategory !== "all" ? (
                      <>
                        <Zap className="text-yellow-500" /> {selectedCategory}
                      </>
                    ) : (
                      <>
                        <Zap className="text-yellow-500" /> Recommandations
                      </>
                    )}
                  </h2>
                </div>

                {/* Skeleton Grid when loading and no data */}
                {isInitialLoading && pagedProducts.length === 0 && (
                  <div className="space-y-12">
                    {[1, 2].map((row) => (
                      <div key={row}>
                        <div className="flex items-center gap-3 mb-6">
                          <div className="h-0.5 w-8 skeleton rounded" />
                          <div className="h-4 w-32 skeleton rounded" />
                          <div className="flex-grow h-px skeleton" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className="bg-white rounded-2xl border border-gray-100 overflow-hidden h-64 flex flex-col"
                            >
                              <div className="aspect-square skeleton" />
                              <div className="p-3 space-y-2">
                                <div className="h-3 w-3/4 skeleton rounded" />
                                <div className="h-4 w-1/2 skeleton rounded" />
                                <div className="h-8 w-full skeleton rounded-xl mt-2" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Grid (Grouped by Category if no search) */}
                {pagedProducts.length > 0 ? (
                  <>
                    <div className="relative space-y-12">
                      {searchTerm ? (
                        /* Simple grid for search results */
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6">
                          {pagedProducts.map((product) => (
                            <ProductCard
                              key={`${product.storeId}-${product.id}`}
                              product={product as any}
                              onAddToCart={addToCart as any}
                              onStoreSelect={(id) =>
                                safeNavigate(
                                  `/store/${product.storeSlug || id}`,
                                )
                              }
                              onClick={() =>
                                safeNavigate(
                                  `/product/${generateProductSlug(product)}`,
                                )
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        /* Grouped sections for browsing */
                        (() => {
                          const groups: Record<string, typeof pagedProducts> =
                            {};
                          pagedProducts.forEach((p: any) => {
                            const cat = p.mainCategory || p.category || "Autre";
                            if (!groups[cat]) groups[cat] = [];
                            groups[cat].push(p);
                          });

                          // Maintain MAIN_CATEGORIES order
                          const sortedCats = Object.keys(groups).sort(
                            (a: string, b: string) => {
                              const idxA = MAIN_CATEGORIES.indexOf(a);
                              const idxB = MAIN_CATEGORIES.indexOf(b);
                              return (
                                (idxA === -1 ? 999 : idxA) -
                                (idxB === -1 ? 999 : idxB)
                              );
                            },
                          );

                          return sortedCats.map((cat) => (
                            <div
                              key={cat}
                              className="   duration-500"
                            >
                              {selectedCategory === "all" && (
                                <div className="flex items-center gap-3 mb-6">
                                  <div className="h-0.5 w-8 bg-[#f56b2a]" />
                                  <h3 className="text-[10px] md:text-sm font-black text-gray-900 uppercase tracking-[0.15em] whitespace-nowrap">
                                    {cat}
                                  </h3>
                                  <div className="flex-grow h-px bg-gray-100" />
                                </div>
                              )}
                              <div className="flex overflow-x-auto no-scrollbar gap-4 pb-4 snap-x snap-mandatory md:grid md:grid-cols-4 lg:grid-cols-5 md:gap-6 md:pb-0">
                                {groups[cat].map((product) => (
                                  <ProductCard
                                    key={`${product.storeId}-${product.id}`}
                                    product={product as any}
                                    onAddToCart={addToCart as any}
                                    onStoreSelect={(id) =>
                                      safeNavigate(
                                        `/store/${product.storeSlug || id}`,
                                      )
                                    }
                                    onClick={() =>
                                      safeNavigate(
                                        `/product/${generateProductSlug(product)}`,
                                      )
                                    }
                                    className="w-[160px] xs:w-[190px] md:w-auto flex-shrink-0 md:flex-shrink snap-start"
                                  />
                                ))}
                              </div>
                            </div>
                          ));
                        })()
                      )}
                    </div>

                    {/* Load More Trigger */}
                    <div
                      ref={loadMoreRef}
                      className="py-20 flex flex-col items-center justify-center"
                    >
                      {isLoadingMore && (
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex gap-1.5">
                            <div className="w-2 h-2 bg-[#f56b2a] rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-2 h-2 bg-[#f56b2a] rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-2 h-2 bg-[#f56b2a] rounded-full animate-bounce" />
                          </div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            Expansion du catalogue...
                          </p>
                        </div>
                      )}
                      {!hasMore && pagedProducts.length > 0 && (
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-12 h-1 bg-gray-100 rounded-full" />
                          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                            Vous avez atteint la fin
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                ) : !isLoadingMore ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                    <Search size={64} className="opacity-20 mb-4" />
                    <p className="text-xl font-black text-gray-600">
                      Aucun produit trouvé.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2
                      size={48}
                      className="text-[#f56b2a] animate-spin opacity-20"
                    />
                  </div>
                )}
              </>
            }
          />
          <Route
            path="store/:storeParam"
            element={
              <>
                {renderStoreProfile()}

                {/* Tabs Switcher - Native App Style */}
                <div className="flex items-center gap-1 p-1 bg-gray-100/50 rounded-[20px] mb-6 max-w-fit mx-auto md:mx-0 border border-gray-100/50">
                  <button
                    onClick={() => setStoreTab("products")}
                    className={`px-6 py-2.5 rounded-[16px] font-black text-[11px] md:text-sm transition-all flex items-center gap-2 ${storeTab === "products" ? "bg-white text-gray-900 shadow-md shadow-gray-200/50" : "text-gray-600 hover:text-gray-600"}`}
                  >
                    <ShoppingBasketIcon size={14} /> Produits
                  </button>
                  <button
                    onClick={() => setStoreTab("reviews")}
                    className={`px-6 py-2.5 rounded-[16px] font-black text-[11px] md:text-sm transition-all flex items-center gap-2 ${storeTab === "reviews" ? "bg-white text-gray-900 shadow-md shadow-gray-200/50" : "text-gray-600 hover:text-gray-600"}`}
                  >
                    <Star
                      size={14}
                      className={
                        storeTab === "reviews" ? "text-yellow-500" : ""
                      }
                      fill={storeTab === "reviews" ? "currentColor" : "none"}
                    />{" "}
                    Avis
                  </button>
                </div>

                {storeTab === "products" ? (
                  <>
                    <div className="relative space-y-12">
                      {pagedProducts.length > 0 ? (
                        /* Grouped sections for store products */
                        (() => {
                          const groups: Record<string, typeof pagedProducts> =
                            {};
                          pagedProducts.forEach((p: any) => {
                            const cat = p.mainCategory || p.category || "Autre";
                            if (!groups[cat]) groups[cat] = [];
                            groups[cat].push(p);
                          });

                          // Maintain MAIN_CATEGORIES order
                          const sortedCats = Object.keys(groups).sort(
                            (a: string, b: string) => {
                              const idxA = MAIN_CATEGORIES.indexOf(a);
                              const idxB = MAIN_CATEGORIES.indexOf(b);
                              return (
                                (idxA === -1 ? 999 : idxA) -
                                (idxB === -1 ? 999 : idxB)
                              );
                            },
                          );

                          return sortedCats.map((cat) => (
                            <div
                              key={cat}
                              className="   duration-500"
                            >
                              <div className="flex items-center gap-3 mb-6">
                                <div className="h-0.5 w-8 bg-[#f56b2a]" />
                                <h3 className="text-[10px] md:text-sm font-black text-gray-900 uppercase tracking-[0.15em] whitespace-nowrap">
                                  {cat}
                                </h3>
                                <div className="flex-grow h-px bg-gray-100" />
                              </div>
                              <div className="flex overflow-x-auto no-scrollbar gap-4 pb-4 snap-x snap-mandatory md:grid md:grid-cols-4 lg:grid-cols-5 md:gap-6 md:pb-0">
                                {groups[cat].map((product) => (
                                  <ProductCard
                                    key={`${product.storeId}-${product.id}`}
                                    product={product as any}
                                    onAddToCart={addToCart as any}
                                    onStoreSelect={(id) =>
                                      safeNavigate(
                                        `/store/${product.storeSlug || id}`,
                                      )
                                    }
                                    onClick={() =>
                                      safeNavigate(
                                        `/product/${generateProductSlug(product)}`,
                                      )
                                    }
                                    className="w-[160px] xs:w-[190px] md:w-auto flex-shrink-0 md:flex-shrink snap-start"
                                  />
                                ))}
                              </div>
                            </div>
                          ));
                        })()
                      ) : !isLoadingMore ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                          <Search size={48} className="text-gray-200 mb-4" />
                          <p className="text-sm font-bold text-gray-600 uppercase tracking-widest text-center">
                            Aucun produit trouvé
                          </p>
                        </div>
                      ) : null}
                    </div>

                    {/* Load More Trigger */}
                    <div
                      ref={loadMoreRef}
                      className="py-10 flex flex-col items-center justify-center"
                    >
                      {isLoadingMore && (
                        <div className="flex flex-col items-center gap-3">
                          <Loader2
                            size={32}
                            className="text-[#f56b2a] animate-spin"
                          />
                          <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                            Chargement des produits...
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="   duration-500">
                    {loadingStoreReviews ? (
                      <div className="flex flex-col items-center justify-center py-20">
                        <Loader2
                          size={32}
                          className="text-[#f56b2a] animate-spin mb-4"
                        />
                        <p className="text-xs font-black text-gray-600 uppercase tracking-widest">
                          Chargement des avis...
                        </p>
                      </div>
                    ) : storeReviews.length > 0 ? (
                      <div className="flex flex-col gap-4">
                        <div className="flex md:grid md:grid-cols-2 gap-4 overflow-x-auto md:overflow-x-visible no-scrollbar pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
                          {(showAllStoreReviews
                            ? storeReviews
                            : storeReviews.slice(0, 5)
                          ).map((review) => (
                            <div
                              key={review.id}
                              className="min-w-[280px] md:min-w-0 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md flex-shrink-0 md:flex-shrink"
                            >
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-orange-50 text-[#f56b2a] flex items-center justify-center font-black text-xs border border-orange-100 flex-shrink-0">
                                    {review.author?.[0]?.toUpperCase() || "A"}
                                  </div>
                                  <div className="min-w-0 overflow-hidden">
                                    <p className="font-black text-gray-900 text-xs leading-none mb-1 truncate max-w-[120px]">
                                      {review.author}
                                    </p>
                                    <div className="flex gap-0.5">
                                      {[...Array(5)].map((_, i) => (
                                        <Star
                                          key={i}
                                          size={8}
                                          fill={
                                            i < review.rating
                                              ? "currentColor"
                                              : "none"
                                          }
                                          className={
                                            i < review.rating
                                              ? "text-yellow-400"
                                              : "text-gray-200"
                                          }
                                        />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <span className="text-[9px] font-bold text-gray-500">
                                  {new Date(review.date).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-gray-500 text-[11px] leading-relaxed mb-3 line-clamp-3">
                                {review.comment}
                              </p>
                              {review.productId && (
                                <div
                                  onClick={() =>
                                    safeNavigate(`/product/${review.productId}`)
                                  }
                                  className="flex items-center gap-3 bg-gray-50/50 p-2 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-all"
                                >
                                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white border border-gray-100">
                                    <Image
                                      src={
                                        allProducts.find(
                                          (p) => p.id === review.productId,
                                        )?.image || ""
                                      }
                                      alt="Product"
                                      fill
                                      className="object-cover"
                                      sizes="40px"
                                    />
                                  </div>
                                  <div className="flex-grow min-w-0">
                                    <p className="text-[10px] font-black text-gray-900 truncate">
                                      {allProducts.find(
                                        (p) => p.id === review.productId,
                                      )?.name || "Produit"}
                                    </p>
                                    <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">
                                      Voir le produit
                                    </p>
                                  </div>
                                  <ChevronRight
                                    size={14}
                                    className="text-gray-500 mr-1"
                                  />
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
                        <p className="text-sm font-black text-gray-600 uppercase tracking-widest text-center">
                          Aucun avis pour le moment
                        </p>
                        <p className="text-[11px] text-gray-500 mt-2 text-center max-w-[200px]">
                          Les avis des clients sur les produits s'afficheront
                          ici.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            }
          />
          <Route path="product/:productId" element={renderProductDetails()} />
          <Route path="cart" element={renderCart()} />
        </Routes>
      </main>

      {cartItemsCount > 0 && !isCartView && !isFeedView && (
        <div
          className="fixed left-4 right-4 z-[1001] md:bottom-8 md:right-8 md:left-auto flex justify-center pointer-events-none px-2 md:px-0"
          style={{
            bottom: "calc(64px + env(safe-area-inset-bottom, 0px) + 12px)",
          }}
        >
          <button
            onClick={() => {
              setIsCartButtonLoading(true);
              if (checkoutStage === "success") {
                setCheckoutStage("cart");
                setCompletedOrderStores([]);
                setCompletedOrderItems([]);
                setCompletedOrderTotal(0);
              }
              safeNavigate("/cart");
            }}
            disabled={isCartButtonLoading}
            className="pointer-events-auto w-full max-w-sm md:w-auto bg-[#f56b2a] text-white py-4 px-6 rounded-2xl shadow-[0_15px_40px_rgba(245,107,42,0.4)] md:shadow-2xl flex items-center justify-center gap-3 font-black transition-all active:scale-[0.98] hover:bg-[#e55a1b] relative overflow-hidden group disabled:opacity-80"
          >
            {isCartButtonLoading ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-sm uppercase tracking-wider font-black">
                  Chargement...
                </span>
              </div>
            ) : (
              <>
                <div className="relative">
                  <ShoppingCart
                    size={20}
                    strokeWidth={3}
                    className="group-hover:rotate-12 transition-transform"
                  />
                  <span
                    key={cartItemsCount}
                    className="absolute -top-2.5 -right-2.5 bg-gray-900 text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#f56b2a] font-black shadow-lg shadow-orange-100"
                  >
                    {cartItemsCount}
                  </span>
                </div>
                <span className="text-sm uppercase tracking-wider font-black">
                  VOIR MON PANIER <span className="opacity-40 mx-1.5">•</span>{" "}
                  {formatCurrency(Number(cartTotal) || 0)}
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div
            className="fixed inset-0 bg-[#002f34]/60 backdrop-blur-md"
            onClick={() => setShowAuthModal(false)}
          />
          <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden   duration-300 my-auto">
            <div className="p-6 md:p-8 max-h-[90vh] overflow-y-auto no-scrollbar">
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600 hover:text-gray-900 z-10"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>

              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#ffe8e0] text-[#f56b2a] mb-4 shadow-sm">
                  <User size={24} strokeWidth={2.5} />
                </div>
                <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-1 leading-tight">
                  {authMode === "login"
                    ? "Ravi de vous revoir !"
                    : "Bienvenue parmi nous"}
                </h2>
                <p className="text-gray-500 font-medium text-xs md:text-sm">
                  {authMode === "login"
                    ? "Connectez-vous pour continuer vos achats."
                    : "Créez votre compte en quelques secondes."}
                </p>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-3">
                {authMode === "register" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-600 uppercase ml-2">
                      Nom Complet
                    </label>
                    <input
                      required
                      type="text"
                      value={authForm.name}
                      onChange={(e) =>
                        setAuthForm({ ...authForm, name: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:bg-white transition-all text-sm"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-600 uppercase ml-2">
                    Adresse Email
                  </label>
                  <input
                    required
                    type="email"
                    value={authForm.email}
                    onChange={(e) =>
                      setAuthForm({ ...authForm, email: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:bg-white transition-all text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-600 uppercase ml-2">
                    Mot de passe
                  </label>
                  <input
                    required
                    type="password"
                    value={authForm.password}
                    onChange={(e) =>
                      setAuthForm({ ...authForm, password: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/20 focus:bg-white transition-all text-sm"
                  />
                </div>

                <Button
                  type="submit"
                  loading={isProcessingAuth}
                  loadingText={
                    authMode === "login" ? "Connexion..." : "Inscription..."
                  }
                  fullWidth
                  size="lg"
                  className="mt-2"
                >
                  {authMode === "login" ? "Se connecter" : "Créer mon compte"}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-50 text-center">
                <p className="text-gray-500 font-medium text-xs md:text-sm">
                  {authMode === "login"
                    ? "Pas encore de compte ?"
                    : "Vous avez déjà un compte ?"}
                  <button
                    type="button"
                    onClick={() =>
                      setAuthMode(authMode === "login" ? "register" : "login")
                    }
                    className="text-[#f56b2a] font-black hover:underline underline-offset-4 ml-1"
                  >
                    {authMode === "login" ? "Inscrivez-vous" : "Connectez-vous"}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {showPropulseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm   duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl   duration-300 relative">
            <button
              onClick={() => setShowPropulseModal(false)}
              className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600 hover:text-gray-900 z-10"
              aria-label="Fermer propulser"
            >
              <X size={24} />
            </button>

            <div className="relative h-32 md:h-40 bg-gradient-to-br from-[#f56b2a] to-[#f56b2a] p-6 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <Zap className="w-full h-full scale-150 rotate-12" />
              </div>
              <div className="relative text-center">
                <Zap
                  size={40}
                  className="text-white mx-auto mb-2 drop-shadow-lg"
                  fill="currentColor"
                />
                <h3 className="text-xl md:text-2xl font-black text-white leading-tight">
                  Propulsez votre Boutique
                </h3>
              </div>
            </div>

            <div className="p-6 md:p-8">
              <p className="text-gray-600 font-medium text-sm md:text-base leading-relaxed mb-6 text-center">
                Rejoignez nos commerçants d'élite et bénéficiez d'une visibilité
                exceptionnelle sur leboncoin marketplace.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-2xl">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Zap
                      size={16}
                      className="text-[#f56b2a]"
                      fill="currentColor"
                    />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900 text-xs mb-0.5 uppercase tracking-tight">
                      Top Ranking
                    </h4>
                    <p className="text-[10px] text-gray-500 font-medium">
                      Vos produits apparaissent en tête des recherches et
                      recommandations.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-2xl">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={16} className="text-[#f56b2a]" />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900 text-xs mb-0.5 uppercase tracking-tight">
                      Badge de Confiance
                    </h4>
                    <p className="text-[10px] text-gray-500 font-medium">
                      Bénéficiez d'un badge exclusif qui rassure vos acheteurs.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-2xl">
                  <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Bell size={16} className="text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900 text-xs mb-0.5 uppercase tracking-tight">
                      Alertes Mobiles
                    </h4>
                    <p className="text-[10px] text-gray-500 font-medium">
                      Vos fidèles clients sont notifiés à chaque nouvel
                      arrivage.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-2xl">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Store size={16} className="text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900 text-xs mb-0.5 uppercase tracking-tight">
                      Page Premium
                    </h4>
                    <p className="text-[10px] text-gray-500 font-medium">
                      Personnalisez votre boutique aux couleurs de votre marque.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowPropulseModal(false);
                  onBackToApp();
                }}
                className="w-full py-4 bg-[#f56b2a] hover:bg-[#d55a20] text-white rounded-[20px] font-black text-lg shadow-xl shadow-orange-200 transition-all flex items-center justify-center gap-3"
              >
                <Zap size={20} fill="currentColor" />
                Devenir une Boutique Premium
              </button>
              <p className="text-center mt-4 text-gray-600 text-[10px] font-bold uppercase tracking-widest">
                Essai gratuit de 14 jours • Sans engagement
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Step-Form Review Modal */}
      {showReviewForm && (
        <div
          className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-gray-900/60 backdrop-blur-sm   duration-300"
          onClick={() => {
            setShowReviewForm(false);
            setReviewStep(1);
          }}
        >
          <div
            className="bg-white w-full max-w-md md:rounded-[28px] rounded-t-[28px] overflow-hidden shadow-2xl   md: duration-400 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setShowReviewForm(false);
                setReviewStep(1);
                setNewReview({ author: "", rating: 5, comment: "" });
              }}
              className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-600 hover:text-gray-900 z-10"
            >
              <X size={18} />
            </button>

            {/* Progress Bar */}
            {reviewStep < 4 && (
              <div className="px-6 pt-5 pb-0">
                <div className="flex items-center gap-1.5 mb-1">
                  {[1, 2, 3].map((s) => (
                    <div
                      key={s}
                      className="flex-grow h-1 rounded-full overflow-hidden bg-gray-100"
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${s <= reviewStep ? "bg-[#f56b2a] w-full" : "w-0"}`}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest text-right">
                  Étape {reviewStep}/3
                </p>
              </div>
            )}

            {/* Step Content */}
            <div className="p-6 md:p-8">
              {/* Step 1: Rating */}
              {reviewStep === 1 && (
                <div className="   duration-300 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-yellow-50 text-yellow-500 flex items-center justify-center mx-auto mb-4">
                    <Star size={24} fill="currentColor" />
                  </div>
                  <h3 className="text-base font-black text-gray-900 mb-1">
                    Quelle note donnez-vous ?
                  </h3>
                  <p className="text-[11px] text-gray-600 font-medium mb-6">
                    Touchez une étoile pour noter ce produit
                  </p>

                  <div className="flex items-center justify-center gap-3 mb-8">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        onClick={() =>
                          setNewReview({ ...newReview, rating: num })
                        }
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-90 ${newReview.rating >= num ? "bg-yellow-400 text-white shadow-lg shadow-yellow-200 scale-110" : "bg-gray-50 text-gray-500 border border-gray-100 hover:bg-yellow-50 hover:text-yellow-400"}`}
                      >
                        <Star
                          size={22}
                          fill={
                            newReview.rating >= num ? "currentColor" : "none"
                          }
                        />
                      </button>
                    ))}
                  </div>
                  <p className="text-xs font-black text-gray-900 mb-6">
                    {newReview.rating === 1
                      ? "Très insatisfait"
                      : newReview.rating === 2
                        ? "Insatisfait"
                        : newReview.rating === 3
                          ? "Correct"
                          : newReview.rating === 4
                            ? "Satisfait"
                            : "Très satisfait"}{" "}
                    — {newReview.rating}/5
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
                <div className="   duration-300 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-4">
                    <User size={24} />
                  </div>
                  <h3 className="text-base font-black text-gray-900 mb-1">
                    Comment vous appelez-vous ?
                  </h3>
                  <p className="text-[11px] text-gray-600 font-medium mb-6">
                    Votre prénom sera affiché avec votre avis
                  </p>

                  <input
                    type="text"
                    value={newReview.author}
                    onChange={(e) =>
                      setNewReview({ ...newReview, author: e.target.value })
                    }
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
                <div className="   duration-300 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-500 flex items-center justify-center mx-auto mb-4">
                    <MessageCircle size={24} />
                  </div>
                  <h3 className="text-base font-black text-gray-900 mb-1">
                    Partagez votre expérience
                  </h3>
                  <p className="text-[11px] text-gray-600 font-medium mb-6">
                    Décrivez ce que vous avez aimé ou non
                  </p>

                  <textarea
                    rows={4}
                    value={newReview.comment}
                    onChange={(e) =>
                      setNewReview({ ...newReview, comment: e.target.value })
                    }
                    placeholder="Écrivez votre avis ici..."
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-medium text-xs text-gray-700 focus:bg-white focus:border-[#f56b2a] focus:shadow-lg focus:shadow-orange-50 transition-all no-global-border mb-2 resize-none"
                    autoFocus
                  />
                  <p className="text-[9px] text-gray-500 font-medium mb-5">
                    {newReview.comment.length}/500 caractères
                  </p>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => setReviewStep(2)}
                      variant="ghost"
                      size="md"
                      className="flex-1"
                      icon={<ChevronLeft size={14} />}
                    >
                      Retour
                    </Button>
                    <Button
                      onClick={handleSubmitReview}
                      disabled={!newReview.comment.trim()}
                      loading={isSubmittingReview}
                      loadingText="Publication..."
                      variant="primary"
                      size="md"
                      className="flex-[2]"
                      icon={<Star size={14} />}
                    >
                      Publier mon avis
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Success */}
              {reviewStep === 4 && (
                <div className="   duration-500 text-center py-4">
                  <div className="relative w-16 h-16 mx-auto mb-5">
                    <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-30" />
                    <div className="relative w-full h-full bg-green-500 text-white rounded-full flex items-center justify-center shadow-xl">
                      <CheckCircle2 size={32} strokeWidth={3} />
                    </div>
                  </div>
                  <h3 className="text-lg font-black text-gray-900 mb-1">
                    Merci ! 🎉
                  </h3>
                  <p className="text-[11px] text-gray-600 font-medium">
                    Votre avis a été publié avec succès
                  </p>
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
        <div
          className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex items-center justify-center   duration-300"
          onClick={() => setIsImageModalOpen(false)}
        >
          <button
            onClick={() => setIsImageModalOpen(false)}
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all active:scale-95 z-50"
            aria-label="Fermer l image"
          >
            <X size={24} />
          </button>
          <div
            className="w-full h-full p-4 md:p-10 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-full">
              <img
                src={
                  currentZoomImage ||
                  selectedDetailImage ||
                  selectedProductDetails?.image ||
                  ""
                }
                className="w-full h-full object-contain shadow-2xl rounded-2xl   duration-500"
                alt="Full Size Product"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
