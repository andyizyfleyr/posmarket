"use client";
import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import Image from "next/image";
import { ProductSkeleton } from "@/components/Skeleton";
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
  Truck,
  ShieldCheck,
  Zap,
  Bell,
  PartyPopper,
  MessageCircle,
  ArrowRight,
  Loader2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ShoppingBasketIcon,
  Package,
  Trash2,
  Home,
  Briefcase,
  ArrowLeft,
  AlertCircle,
  Clock,
  ShoppingBag,
  Tag,
  RotateCcw,
  Maximize2,
  Eye,
  Share2,
  Check,
} from "lucide-react";
import {
  StoreData,
  Product,
  NotificationType,
  Review,
  Coupon,
  ToastNotification,
} from "@/types";
import { generateProductSlug } from "@/utils/slug";
import { MAIN_CATEGORIES } from "@/constants";
import { formatCurrency, formatNumber, formatPhoneSN, isValidPhoneSN, playSuccessSound } from "@/utils";
import ProductImage, { PRODUCT_BLUR_DATA_URL } from "../components/ProductImage";
import ProductCard from "../components/ProductCard";
import Toast from "../components/Toast";
import Button from "../components/Button";
import { MarketplaceFooter } from "@/components/MarketplaceFooter";
import type { BuyerAddress } from "@/components/buyer/accountTypes";
import {
  Routes,
  Route,
  useNavigate,
  useParams,
  Link,
  useLocation,
  useMatch,
} from "@/components/RouterPolyfill";
import {
  incrementProductViews,
  incrementStoreViews,
} from "@/supabase-api";
import {
  fetchProductReviews,
} from "@/hooks/useSupabaseData";
import { useCoupons, useStoreReviews, useProductReviews } from "@/hooks/useMarketplaceData";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/supabase";
import { BuyerView } from "./BuyerView";
import { fetchBuyerAddressesAction } from "@/app/actions/marketplace";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import { enablePushNotifications, isPushSupported } from "@/utils/push";

interface StorefrontProduct extends Product {
  storeId: string;
  storeName: string;
  storeSlug?: string;
}

type FtsRow = {
  id: string;
  name: string;
  price: number | string;
  image: string | null;
  stock: number | null;
  category: string | null;
  store_id: string;
  isOnline: boolean | null;
};

export type CheckoutStoreOrderDraft = {
  items: Array<{ product: StorefrontProduct; quantity: number }>;
  subtotal: number;
  discountAmount?: number;
  promoCode?: string | null;
  shippingCost?: number;
  paymentMethod?: string;
  total: number;
};

export type CheckoutCustomerDraft = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  zip?: string;
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
  selectedOptions?: Record<string, string>;
}

// Compare deux ensembles d'options sans tenir compte de l'ordre des clés
// (JSON.stringify dépend de l'ordre d'insertion -> fausses non-correspondances)
const sameSelectedOptions = (
  a?: Record<string, string> | null,
  b?: Record<string, string> | null,
): boolean => {
  if (!a || !b) return !a && !b;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => a[k] === b[k]);
};

// Recherches récentes (max 6, dédupliquées)
const RECENT_SEARCHES_KEY = "storefront_recent_searches";
const loadRecentSearches = (): string[] => {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(RECENT_SEARCHES_KEY) || "[]",
    ) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
};
const saveRecentSearch = (term: string): string[] => {
  const t = term.trim();
  if (t.length < 2) return loadRecentSearches();
  const list = [
    t,
    ...loadRecentSearches().filter((s) => s.toLowerCase() !== t.toLowerCase()),
  ].slice(0, 6);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
  return list;
};

interface StorefrontViewProps {
  stores: StoreData[];
  initialCategory?: string;
  onBackToApp: () => void | Promise<void>;
  onMarketplaceCheckout: (
    ordersData: Record<string, CheckoutStoreOrderDraft>,
    customerData: CheckoutCustomerDraft,
  ) => Promise<{ success: boolean; error?: string | undefined }>;
  onAddReview: (
    storeId: string,
    productId: string,
    review: Review,
  ) => Promise<{ success: boolean; error?: string | undefined }>;
  onNotifyCartInterest: (
    storeId: string,
    productName: string,
  ) => Promise<{ success: boolean; error?: string | undefined }>;
  onNotifyPostCheckout: (
    ordersData: Record<string, CheckoutStoreOrderDraft>,
  ) => Promise<{ success: boolean; error?: string | undefined }>;
  notify: (message: string, type: NotificationType, title?: string) => void;
}


function categoryToSlug(cat: string): string {
  return encodeURIComponent(cat);
}


export const StorefrontView: React.FC<StorefrontViewProps> = ({
  stores,
  initialCategory,
  onBackToApp,
  onMarketplaceCheckout,
  onAddReview,
  onNotifyCartInterest,
  onNotifyPostCheckout,
  notify,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
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
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || "all");
  const prefetchedProducts = useRef<Set<string>>(new Set());

  // ⚡ Helpers defined early for use in effects

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    zip: "",
  });
  const [promoApplied, setPromoApplied] = useState<Coupon | null>(null);
  const [selectedVertical] = useState<"all" | "shopping" | "food">("all");
  const [isMounted, setIsMounted] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [ftsResults, setFtsResults] = useState<StorefrontProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [cachedStores, setCachedStores] = useState<StoreData[]>([]);
  const [, setUrlKey] = useState(0);
  const [productSwipeIdx, setProductSwipeIdx] = useState(0);

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
          .select('id, name, price, image, stock, category, store_id, isOnline')
          .textSearch('search_vector', searchTerm, {
            type: 'websearch',
            config: 'french'
          })
          .limit(50);

        // Même règle que la grille d'accueil : isOnline absent ou vrai.
        // (Filtrage client : .or() indisponible sur ce client Supabase.)
        const rows = (data || []) as FtsRow[];
        const onlineResults = rows.filter((p) => p?.isOnline !== false);

        // Only use result if it's for the current search term
        if (ftsRequestRef.current?.term === searchTerm) {
          setFtsResults(
            onlineResults.slice(0, 20).map((p) => ({
              id: p.id,
              name: p.name,
              price: Number(p.price),
              image: p.image || "",
              stock: p.stock ?? 0,
              category: p.category || "Autre",
              storeId: p.store_id,
              storeName: "",
              storeSlug: undefined,
            }) as StorefrontProduct),
          );
        }
      } catch (err) {
        if ((err as { name?: string } | null)?.name !== "AbortError") {
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
      } catch {}

      try {
        const savedCart = localStorage.getItem("storefront_cart");
        if (savedCart) {
          const { data, timestamp } = JSON.parse(savedCart);
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000 && data?.length > 0) {
            setCart(data);
          }
        }
      } catch {}

      try {
        const savedCustomer = localStorage.getItem("storefront_customer");
        if (savedCustomer) {
          const { data, timestamp } = JSON.parse(savedCustomer);
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000 && data?.name) {
            setCustomerInfo(data);
          }
        }
      } catch {}

      try {
        const savedPromo = localStorage.getItem("storefront_promo");
        if (savedPromo) {
          const { data, timestamp } = JSON.parse(savedPromo);
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000 && data) {
            setPromoApplied(data);
          }
        }
      } catch {}
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
    activeStores.forEach((store) => {
      if (store.products) {
        store.products.forEach((product) => {
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
    } catch {}
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
      if (process.env.NODE_ENV !== 'production') console.log(`[Navigation] Started → "${path}"`);
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

    // pathname a changé! Attendre que le contenu soit visible.
    // Timer tracé pour être nettoyé au unmount, et nombre de retries plafonné
    // (pas de boucle infinie de setTimeout).
    let timer: ReturnType<typeof setTimeout>;
    let retries = 0;
    const checkContentVisible = () => {
      const mainContent = document.querySelector('main');
      const hasContent = mainContent && mainContent.children.length > 0;
      const duration = performance.now() - navStartTimeRef.current;

      if (hasContent || ++retries > 20) {
        navCompletedRef.current = true;
        if (process.env.NODE_ENV !== 'production') console.log(`[Navigation] Content ready → ${duration.toFixed(0)}ms (${(duration / 1000).toFixed(2)}s)`);
        setIsNavigating(false);
      } else {
        timer = setTimeout(checkContentVisible, 50);
      }
    };

    // Commencer à vérifier après 100ms minimum
    timer = setTimeout(checkContentVisible, 100);
    return () => clearTimeout(timer);
  }, [location.pathname, isNavigating]);

  // 🔄 Smooth Checkout Stage Transitions
  const handleStageChange = useCallback(
    (newStage: typeof checkoutStage) => {
      setCheckoutStage(newStage);
      stageTargetRef.current = newStage;
    },
    [],
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
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  // Carousel auto-play - uniquement sur l'accueil, en pause au survol et
  // quand l'onglet est masqué (la slide ne saute plus sous les yeux de
  // l'utilisateur pendant qu'il interagit).
  const [heroPaused, setHeroPaused] = useState(false);
  React.useEffect(() => {
    if (location.pathname !== "/" || heroPaused || document.hidden) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(timer);
  }, [location.pathname, heroPaused]);

  // Header compact au scroll (mobile) : recherche + catégories se replient
  // pour rendre le contenu accessible plus vite sur petits écrans.
  const [headerCompact, setHeaderCompact] = useState(false);
  React.useEffect(() => {
    const onScroll = () => setHeaderCompact(window.scrollY > 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ⌨️ Décalage clavier : la barre checkout remonte au-dessus du clavier
  const keyboardOffset = useKeyboardOffset();

  // 📉 Onglets boutique : se replient quand on scrolle vers le bas
  const [tabsHidden, setTabsHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  React.useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const prev = lastScrollYRef.current;
      lastScrollYRef.current = y;
      if (y < 120) {
        setTabsHidden(false);
        return;
      }
      if (y - prev > 10) setTabsHidden(true);
      else if (prev - y > 10) setTabsHidden(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 🔎 Recherches récentes (localStorage)
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  React.useEffect(() => {
    if (isSearchOpen) setRecentSearches(loadRecentSearches());
  }, [isSearchOpen]);

  // 📲 Bannière d'installation PWA
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  React.useEffect(() => {
    const check = () => {
      const w = window as unknown as { __pwaInstallPrompt?: unknown };
      const dismissed = localStorage.getItem("pwa_install_dismissed") === "1";
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      setCanInstallPwa(!!w.__pwaInstallPrompt && !dismissed && !standalone);
    };
    check();
    window.addEventListener("pwa:install-available", check);
    return () => window.removeEventListener("pwa:install-available", check);
  }, []);

  const installPwa = async () => {
    const w = window as unknown as {
      __pwaInstallPrompt?: { prompt: () => Promise<void> };
    };
    if (!w.__pwaInstallPrompt) return;
    try {
      await w.__pwaInstallPrompt.prompt();
    } catch {}
    (window as unknown as { __pwaInstallPrompt?: unknown }).__pwaInstallPrompt = null;
    setCanInstallPwa(false);
  };

  const dismissInstall = () => {
    localStorage.setItem("pwa_install_dismissed", "1");
    setCanInstallPwa(false);
  };

  // 👉 Swipe-to-delete panier
  const [swipeState, setSwipeState] = useState<{ key: string; dx: number } | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

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
  const [, setReviewedProducts] = useState<string[]>([]);
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
  const [buyerAddresses, setBuyerAddresses] = useState<BuyerAddress[]>([]);
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

  // 🏠 Pré-remplissage automatique de l'adresse par défaut à l'étape livraison
  const addressAutoFilledRef = useRef(false);
  useEffect(() => {
    if (
      checkoutStage === "shipping" &&
      user?.id &&
      !addressAutoFilledRef.current &&
      buyerAddresses.length > 0 &&
      !customerInfo.address
    ) {
      const def =
        buyerAddresses.find((a) => a.is_default) || buyerAddresses[0];
      addressAutoFilledRef.current = true;
      setSelectedAddressId(def.id);
      setCustomerInfo((ci) => ({
        ...ci,
        name: ci.name || def.full_name || "",
        phone: ci.phone || formatPhoneSN(def.phone || ""),
        address: def.address || "",
        city: def.city || "",
      }));
      localNotify("Adresse enregistrée pré-remplie", "info");
    }
  }, [checkoutStage, user?.id, buyerAddresses, customerInfo.address, localNotify]);

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
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "card">("cod");
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [isPromoOpen, setIsPromoOpen] = useState(false);
  const [expandedCartStores, setExpandedCartStores] = useState<Set<string>>(
    new Set(),
  );

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
  // Load coupons from Supabase - for all stores in cart or current store.
  // Dépend des boutiques du PANIER (clé stable) : ajouter un produit d'une
  // nouvelle boutique recharge les coupons même si on est déjà sur /cart.
  const cartStoreIdsKey = useMemo(
    () =>
      isCartView
        ? [
            ...new Set(
              cart
                .map((item) => item.product?.storeId)
                .filter(Boolean) as string[],
            ),
          ]
            .sort()
            .join("|")
        : "",
    [isCartView, cart],
  );

  // 💾 Coupons (React Query) - for all stores in cart or current store.
  // Dépend des boutiques du PANIER (clé stable) : ajouter un produit d'une
  // nouvelle boutique recharge les coupons même si on est déjà sur /cart.
  const couponStoreIds = useMemo(() => {
    if (isCartView && cartStoreIdsKey) {
      return cartStoreIdsKey.split("|");
    } else if (selectedStoreParam) {
      const currentStore = stores.find(
        (s) => s.id === selectedStoreParam || s.slug === selectedStoreParam,
      );
      return currentStore ? [currentStore.id] : [];
    }
    return [];
  }, [isCartView, cartStoreIdsKey, selectedStoreParam, stores]);

  const couponsQuery = useCoupons(couponStoreIds);

  React.useEffect(() => {
    setCoupons((couponsQuery.data || []) as unknown as Coupon[]);
  }, [couponsQuery.data]);

  React.useEffect(() => {
    if (couponStoreIds.length === 0) setCoupons([]);
  }, [couponStoreIds.length]);

  // Un coupon restauré depuis localStorage peut avoir été désactivé ou
  // supprimé entre-temps : on le retire s'il n'est plus valide.
  React.useEffect(() => {
    if (!promoApplied || coupons.length === 0) return;
    const stillValid = coupons.some(
      (c) => c.id === promoApplied.id && c.active,
    );
    if (!stillValid) {
      setPromoApplied(null);
      localNotify(
        "Code promo expiré ou désactivé : il a été retiré de votre commande.",
        "info",
      );
    }
  }, [coupons, promoApplied, localNotify]);
const [selectedDetailImage, setSelectedDetailImage] = useState<string | null>(
    null
  );
  const [storeTab, setStoreTab] = useState<"products" | "reviews">("products");
  const [storeDescExpanded, setStoreDescExpanded] = useState(false);
  const [followedStores, setFollowedStores] = useState<Set<string>>(new Set());
  const [storeReviews, setStoreReviews] = useState<Review[]>([]);
  const storeReviewsCacheRef = useRef<Record<string, Review[]>>({});
  const [loadingStoreReviews, setLoadingStoreReviews] = useState(false);
  const [showAllProductReviews, setShowAllProductReviews] = useState(false);
  const [showAllStoreReviews, setShowAllStoreReviews] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // 📳 Pull-to-refresh (accueil + boutiques)
  const handlePtrRefresh = useCallback(() => {
    window.location.reload();
  }, []);
  usePullToRefresh(
    (location.pathname === "/" || location.pathname.startsWith("/store/")) &&
      !isSearchOpen &&
      !showAuthModal &&
      !isImageModalOpen,
    handlePtrRefresh,
  );
  const [currentZoomImage, setCurrentZoomImage] = useState<string | null>(null);
  // Galerie snapshot pour la navigation ‹ › dans le modal plein écran
  const [zoomGallery, setZoomGallery] = useState<string[]>([]);

  // Verrouille le scroll de la page quand un modal/overlay plein écran est
  // ouvert (sinon la page défile derrière sur iOS).
  React.useEffect(() => {
    const locked =
      showAuthModal || isSearchOpen || isImageModalOpen || showReviewForm;
    if (!locked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showAuthModal, isSearchOpen, isImageModalOpen, showReviewForm]);

  // Pagination & Infinite Scroll State
  const [, setPage] = useState(0);
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
    CheckoutStoreOrderDraft
  > | null>(null);
  const [pendingCustomerInfo, setPendingCustomerInfo] =
    useState<CheckoutCustomerDraft | null>(null);

  const initiateFusionPayPayment = useCallback(
    async (
      amount: number,
      description: string,
      customer: { phone: string; name: string },
    ) => {
      if (!fusionPayApiUrl) {
        notify(
          "Paiement par carte indisponible (configuration manquante). Choisissez le paiement à la livraison.",
          "error",
        );
        setIsProcessingPayment(false);
        return;
      }
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
    if (!token) return;

    // Après la redirection full-page, l'état React est perdu : on restaure
    // la commande persistée en sessionStorage avant de vérifier le paiement.
    let orderData = pendingOrderData;
    let customer = pendingCustomerInfo;
    if (!orderData || !customer) {
      try {
        const saved = sessionStorage.getItem("fusionpay_pending_order");
        if (saved) {
          const parsed = JSON.parse(saved);
          orderData = parsed.ordersData;
          customer = parsed.customer;
          if (orderData) setPendingOrderData(orderData);
          if (customer) setPendingCustomerInfo(customer);
        }
      } catch {}
    }
    if (orderData && customer) {
      checkFusionPayPaymentStatus(token, orderData, customer);
    } else {
      // Token orphelin : nettoyer l'URL pour éviter une boucle au refresh
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearFusionPayPending = () => {
    try {
      sessionStorage.removeItem("fusionpay_pending_order");
    } catch {}
    setPendingOrderData(null);
    setPendingCustomerInfo(null);
  };

  const checkFusionPayPaymentStatus = async (
    token: string,
    orderDataOverride?: NonNullable<typeof pendingOrderData>,
    customerOverride?: typeof pendingCustomerInfo,
  ) => {
    const activeOrderData = orderDataOverride || pendingOrderData;
    const activeCustomer = customerOverride || pendingCustomerInfo;
    try {
      const response = await fetch(
        `https://www.pay.moneyfusion.net/paiementNotif/${token}`,
      );
      const data = await response.json();

      if (data.statut && data.data?.statut === "paid") {
        if (activeOrderData && activeCustomer) {
          onMarketplaceCheckout(activeOrderData, activeCustomer);
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
        if (activeOrderData) {
          onNotifyPostCheckout(activeOrderData);
        }
        clearFusionPayPending();
        // Preserve Next.js history state (raw {} breaks the router and can
        // trigger spontaneous back-navigations later)
        window.history.replaceState(window.history.state, "", window.location.pathname);
      } else if (data.data?.statut === "pending") {
        notify("Paiement en cours de traitement...", "info");
      } else {
        notify("Paiement échoué ou annulé", "error");
        setIsProcessingPayment(false);
        clearFusionPayPending();
        window.history.replaceState(window.history.state, "", window.location.pathname);
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
    } catch (err) {
      notify(
        (err instanceof Error
          ? err.message
          : (err as { message?: string } | null)?.message) ||
          "Erreur d'authentification",
        "error",
      );
    } finally {
      setIsProcessingAuth(false);
    }
  };

  const handleLogout = async () => {
    // La confirmation est gérée par la modale de l'espace compte (BuyerView).
    try {
      await supabase.auth.signOut();
    } catch {}
    setUser(null);
    setCustomerInfo({ name: "", phone: "", address: "", city: "", zip: "" });
    setIsAccountView(false);
    safeNavigate("/");
    localNotify("Déconnexion réussie", "info");
  };

  const handleUserUpdate = (updates: { name: string }) => {
    setUser((prev) => (prev ? { ...prev, name: updates.name || prev.name } : prev));
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



  const selectedProductId = selectedProductDetails?.id || null;

  // 💾 Product reviews (React Query) - deduped + cached across navigation
  const productReviewsQuery = useProductReviews(selectedProductId);

  React.useEffect(() => {
    if (!selectedProductId) return;
    if (productReviewsQuery.data) {
      setProductReviews((prev) => {
        if (prev[selectedProductId]) return prev;
        return {
          ...prev,
          [selectedProductId]: productReviewsQuery.data as unknown as Review[],
        };
      });
    }
  }, [selectedProductId, productReviewsQuery.data]);

  React.useEffect(() => {
    if (!selectedProductId) return;
    if (productReviewsQuery.isFetching) {
      setLoadingReviews((prev) => ({ ...prev, [selectedProductId]: true }));
    } else {
      setLoadingReviews((prev) => ({ ...prev, [selectedProductId]: false }));
    }
  }, [selectedProductId, productReviewsQuery.isFetching]);

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
      setProductSwipeIdx(0);
    }
  }, [selectedProductId, selectedProductDetails]);

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
          setProductReviews((prev) => ({ ...prev, [productId]: reviews as unknown as Review[] }));
        }
      })
      .catch(() => {});
  }, []);

  // 🖼️ Précharge données + image (touchstart / hover sur ProductCard)
  const warmProduct = useCallback(
    (p: { id: string; image?: string }) => {
      prefetchProduct(p.id);
      if (p.image) {
        try {
          const img = document.createElement("img");
          img.src = p.image;
        } catch {}
      }
    },
    [prefetchProduct],
  );

  // 🚀 Predictive Init: Prefetch top recommendations (only once, only if online)
  const prefetchDoneRef = React.useRef(false);
  useEffect(() => {
    if (!isMounted || allProducts.length === 0 || prefetchDoneRef.current || !navigator.onLine) return;
    prefetchDoneRef.current = true;
    const timer = setTimeout(() => {
      allProducts.slice(0, 6).forEach((p) => prefetchProduct(p.id));
    }, 2000);
    return () => clearTimeout(timer);
  }, [isMounted, allProducts.length, allProducts, prefetchProduct]);

  // Track store views - only increment once per store per session
  const lastVisitedStoreRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedStoreId && storeViewTracked.current !== selectedStoreId) {
      storeViewTracked.current = selectedStoreId;
      incrementStoreViews(selectedStoreId);
      // Mémorise la boutique pour un retour intelligent depuis une fiche produit
      if (selectedStoreParam) {
        lastVisitedStoreRef.current = selectedStoreParam;
      }
      setStoreTab("products"); // Reset to products tab on navigation
      setShowAllStoreReviews(false); // Reset see more
      setStoreDescExpanded(false);
    }
  }, [selectedStoreId, selectedStoreParam]);

  useEffect(() => {
    setShowAllProductReviews(false); // Reset see more on product change
  }, [selectedProductId]);

  // 💾 Store-wide reviews (React Query) - deduped + cached across navigation
  const storeReviewsQuery = useStoreReviews(
    selectedStoreId,
    storeTab === "reviews",
  );

  React.useEffect(() => {
    if (storeReviewsQuery.data) {
      setStoreReviews(storeReviewsQuery.data as unknown as Review[]);
    }
  }, [storeReviewsQuery.data]);

  React.useEffect(() => {
    if (storeReviewsQuery.isFetching) {
      setLoadingStoreReviews(true);
    } else {
      setLoadingStoreReviews(false);
    }
  }, [storeReviewsQuery.isFetching, storeReviewsQuery.isPending]);

  React.useEffect(() => {
    if (selectedStoreId && storeReviewsQuery.isFetching) {
      storeReviewsCacheRef.current[selectedStoreId] =
        storeReviewsQuery.data as unknown as Review[];
    }
  }, [selectedStoreId, storeReviewsQuery.isFetching, storeReviewsQuery.data]);

  const categories = useMemo(() => {
    const all = ["all", ...MAIN_CATEGORIES];
    if (selectedVertical === "all") return all;

    // Define which categories belong to which vertical
    const verticalMap: Record<string, string[]> = {
      food: ["Alimentation & Boissons", "Restauration & Livraison Rapide"],
      shopping: MAIN_CATEGORIES.filter(
        (cat) =>
          cat !== "Alimentation & Boissons" &&
          cat !== "Restauration & Livraison Rapide",
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
            (            p.mainCategory === "Restauration & Livraison Rapide"
              ? "food"
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

  // First batch computed synchronously on server AND client (identical output
  // => products are present in the SSR HTML, hydration-safe).
  const [pagedProducts, setPagedProducts] = useState<StorefrontProduct[]>(() =>
    filteredProducts.slice(0, PAGE_LIMIT),
  );

  const loadingRef = useRef(false);
  const currentPageRef = useRef(0);

  // Active store category from ?cat= query param (category page mode)
  const activeStoreCategory = useMemo(() => {
    if (!selectedStoreId) return null;
    const c = location.search ? new URLSearchParams(location.search).get("cat") : null;
    const cat = c && c !== "all" ? c : null;
    return cat || (initialCategory && selectedStoreId ? initialCategory : null);
  }, [selectedStoreId, location.search, initialCategory]);

  // Active category page on home (?cat= or /category/[slug])
  const activeHomeCategory = useMemo(() => {
    if (location.pathname !== "/" && !location.pathname.startsWith("/category")) return null;
    const c = location.search ? new URLSearchParams(location.search || "").get("cat") : null;
    return (c && c !== "all" ? c : null) || initialCategory || null;
  }, [location.pathname, location.search, initialCategory]);

  // Document title per page
  useEffect(() => {
    const cat = activeStoreCategory || activeHomeCategory;
    if (cat) {
      document.title = `${cat} · PosMarket`;
    } else if (selectedStore?.settings?.name) {
      document.title = `${selectedStore.settings.name} · PosMarket`;
    }
  }, [activeStoreCategory, activeHomeCategory, selectedStore]);

  // Keep selectedCategory in sync with the URL (back/forward support)
  useEffect(() => {
    const c = new URLSearchParams(location.search || "").get("cat");
    setSelectedCategory((c && c !== "all" ? c : null) || initialCategory || "all");
  }, [location.search, initialCategory]);

  // 🔥 Infinite Scroll (Client-Side from Cache) - Instant & Bug-free
  // filteredProducts est lu via une ref : un simple rafraîchissement des
  // données (nouvelles props stores) ne réinitialise plus la pagination.
  const filteredProductsRef = useRef(filteredProducts);
  filteredProductsRef.current = filteredProducts;

  const loadPagedProducts = useCallback(async (reset: boolean = false) => {
    if (loadingRef.current && !reset) return;

    loadingRef.current = true;
    setIsLoadingMore(true);

    if (reset) {
      currentPageRef.current = 0;
      setPage(0);
    }

    const source = filteredProductsRef.current;
    const start = currentPageRef.current * PAGE_LIMIT;
    const end = start + PAGE_LIMIT;
    const nextBatch = source.slice(start, end);

    setPagedProducts((prev) => (reset ? nextBatch : [...prev, ...nextBatch]));
    setHasMore(end < source.length);

    currentPageRef.current += 1;
    setPage(currentPageRef.current);

    // Small delay to allow DOM to update and avoid instant double-trigger
    setTimeout(() => {
      setIsLoadingMore(false);
      loadingRef.current = false;
    }, 100);
  }, []);

  // Reset pagination ONLY when a real filter changes (pas sur refresh data)
  useEffect(() => {
    loadPagedProducts(true);
  }, [
    selectedStoreId,
    selectedCategory,
    searchTerm,
    location.pathname,
    loadPagedProducts,
  ]);

  // Rattrapage : si la liste vient d'arriver alors que la page affichée est
  // vide (ex: premier chargement sans cache), on charge le premier lot.
  useEffect(() => {
    if (pagedProducts.length === 0 && filteredProducts.length > 0) {
      loadPagedProducts(true);
    }
  }, [pagedProducts.length, filteredProducts.length, loadPagedProducts]);

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

  const buzz = () => {
    try {
      navigator.vibrate?.(12);
    } catch {}
  };

  const addToCart = (
    product: StorefrontProduct,
    variantId?: string,
  ) => {
    setCart((prev) => {
      const vid = variantId || null;

      const existing = prev.find(
        (item) =>
          item.product.id === product.id &&
          item.product.storeId === product.storeId &&
          (item.variantId === vid || (!item.variantId && !vid)) &&
          sameSelectedOptions(item.selectedOptions, selectedOptions),
      );
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id &&
          item.product.storeId === product.storeId &&
          (item.variantId === vid || (!item.variantId && !vid)) &&
          sameSelectedOptions(item.selectedOptions, selectedOptions)
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
          selectedOptions,
        },
      ];
    });
    // Le toast affiche le prix réellement ajouté (variante > base)
    const addedVariant =
      variantId && product.variants
        ? product.variants.find((v) => v.id === variantId)
        : null;
    setLastAddedProduct(
      addedVariant ? { ...product, price: addedVariant.price } : product,
    );
    buzz();
    setCartNotif(true);
    onNotifyCartInterest(product.storeId, product.name);
    setTimeout(() => setCartNotif(false), 4000);
  };

  const buyNow = (
    product: StorefrontProduct,
    variantId?: string,
    options?: Record<string, string>,
  ) => {
    // Achat direct : remplace le panier et ouvre le checkout (livraison)
    safeNavigate("/cart", {
      action: () => {
        setCart([
          {
            product,
            quantity: 1,
            variantId: variantId || undefined,
            selectedOptions: options,
          },
        ]);
        setCheckoutStage("shipping");
        setIsAccountView(false);
      },
    });
  };

  const handleCardAddToCart = (p: Product) => addToCart(p as StorefrontProduct);
  const handleCardBuyNow = (p: Product) => buyNow(p as StorefrontProduct);

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
    buzz();
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

  // Économies réalisées grâce aux tarifs de gros (hors coupon)
  const wholesaleSavings = cart.reduce((sum, item) => {
    if (item.variantId) return sum;
    const saved =
      (Number(item.product.price) - getEffectiveItemPrice(item)) *
      (item.quantity || 1);
    return sum + (saved > 0 ? saved : 0);
  }, 0);

  const handlePromoApply = async () => {
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
    } catch {
      localNotify("Erreur lors de l'application du code promo.", "error");
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkoutStage === "shipping") handleStageChange("payment");
    else if (checkoutStage === "payment") {
      if (isProcessingPayment) return;

      const ordersData: Record<string, CheckoutStoreOrderDraft> = {};
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
        });
      });
      Object.keys(ordersData).forEach((storeId) => {
        const storeOrder = ordersData[storeId];
        storeOrder.subtotal = storeOrder.items.reduce((sum, i) => {
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
        const pendingCustomer = {
          ...customerInfo,
          address: [customerInfo.address, customerInfo.city]
            .filter(Boolean)
            .join(", "),
        };
        setPendingCustomerInfo(pendingCustomer);
        // La redirection vers FusionPay recharge la page : l'état React est
        // perdu. On persiste la commande pour pouvoir la confirmer au retour.
        try {
          sessionStorage.setItem(
            "fusionpay_pending_order",
            JSON.stringify({ ordersData, customer: pendingCustomer }),
          );
        } catch {}
        const totalAmount = Object.values(ordersData).reduce(
          (sum: number, order) => sum + order.total,
          0,
        );

        initiateFusionPayPayment(
          Math.round(totalAmount),
          "Commande sur " + (stores[0]?.name || ""),
          {
            phone: (customerInfo.phone || "").replace(/\s/g, ""),
            name: customerInfo.name || "",
          },
        );
      } else {
        setIsProcessingPayment(true);
        (async () => {
          try {
            const response = await onMarketplaceCheckout(ordersData, {
              ...customerInfo,
              phone: (customerInfo.phone || "").replace(/\s/g, ""),
              address: [customerInfo.address, customerInfo.city]
                .filter(Boolean)
                .join(", "),
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
      let result: { success?: boolean; error?: string } | undefined;
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

      queryClient.invalidateQueries({ queryKey: ["product-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["store-reviews"] });
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

  const renderStoreProfile = () => {
    if (!selectedStore) {
      // Catalogue chargé mais boutique inconnue -> 404 explicite (au lieu
      // d'une page blanche silencieuse)
      if (!isInitialLoading && activeStores.length > 0) {
        return (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-400">
              <Store size={30} />
            </div>
            <p className="text-base font-black text-gray-900">
              Boutique introuvable
            </p>
            <p className="text-xs text-gray-500 font-bold mt-1 max-w-[280px]">
              Cette boutique n&apos;existe pas ou n&apos;est plus disponible.
            </p>
            <Button
              onClick={() => safeNavigate("/")}
              loading={isNavigating}
              loadingText="Chargement..."
              variant="primary"
              size="md"
              className="mt-6"
              icon={<ArrowRight size={14} />}
              iconPosition="right"
            >
              Découvrir d&apos;autres boutiques
            </Button>
          </div>
        );
      }
      return (
        <div className="mb-5 md:mb-6">
          <div className="bg-white rounded-[24px] overflow-hidden ring-1 ring-gray-100">
            <div className="h-[72px] md:h-32 skeleton" />
            <div className="px-4 md:px-8 pb-5">
              <div className="flex items-end gap-3 -mt-7 md:-mt-10">
                <div className="w-14 h-14 md:w-20 md:h-20 rounded-xl skeleton ring-4 ring-white" />
                <div className="flex-grow space-y-2 pb-1">
                  <div className="h-5 w-1/3 skeleton rounded" />
                  <div className="h-3 w-1/4 skeleton rounded" />
                </div>
              </div>
              <div className="h-3 w-2/3 skeleton rounded mt-4" />
            </div>
          </div>
        </div>
      );
    }
    const descriptionText =
      selectedStore.description ||
      selectedStore.settings?.description ||
      "Votre destination shopping préférée pour des produits locaux et de qualité.";
    const handleStoreShare = () => {
      const url = window.location.href;
      if (navigator.share) {
        navigator.share({
          title: selectedStore.settings.name,
          url,
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(url);
        localNotify("Lien de la boutique copié !", "success");
      }
    };
    const waDigits = (
      selectedStore.phone ||
      selectedStore.settings?.phone ||
      ""
    ).replace(/[^0-9]/g, "");
    const isFollowed = followedStores.has(selectedStore.id);
    const reviewCountTotal =
      selectedStore.products?.reduce(
        (sum, p) => sum + (p.reviewCount || 0),
        0,
      ) || 0;
    return (
      <div className="mb-5 md:mb-6    duration-700">
        <div className="bg-white rounded-[24px] md:rounded-[32px] overflow-hidden shadow-sm ring-1 ring-gray-100">
          {/* Cover */}
          <div className="h-[72px] md:h-32 bg-gradient-to-r from-[#f56b2a] via-[#ff8a50] to-[#ffb26b] relative overflow-hidden">
            <div className="absolute -right-14 -top-20 w-56 h-56 rounded-full border-[24px] border-white/10" />
            <div className="absolute -left-10 -bottom-24 w-48 h-48 rounded-full border-[18px] border-white/10" />
            <button
              onClick={() => {
                safeNavigate("/", {
                  action: () => {
                    setSearchTerm("");
                    setSelectedCategory("all");
                  },
                });
              }}
              aria-label="Retour au marché"
              className="absolute top-2.5 left-3 z-30 w-11 h-11 rounded-full bg-black/25 hover:bg-black/35 backdrop-blur-md flex items-center justify-center active:scale-90 transition-all"
            >
              <ChevronLeft size={20} strokeWidth={3} className="text-white" />
            </button>
            <button
              onClick={handleStoreShare}
              aria-label="Partager la boutique"
              className="absolute top-2.5 right-3 z-30 w-11 h-11 rounded-full bg-black/25 hover:bg-black/35 backdrop-blur-md flex items-center justify-center active:scale-90 transition-all"
            >
              <Share2 size={15} className="text-white" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 md:px-8 pb-4 relative">
            {/* Logo + name */}
            <div className="flex items-end gap-3 -mt-7 md:-mt-10">
              <div className="w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-2xl bg-white ring-4 ring-white shadow-lg overflow-hidden flex-shrink-0 flex items-center justify-center z-10 relative">
                {selectedStore.settings?.logo ? (
                  <Image
                    src={selectedStore.settings.logo}
                    alt={selectedStore.name || "Boutique"}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <Store size={28} className="text-[#f56b2a]" />
                )}
              </div>
              <div className="flex-grow min-w-0 pb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h1 className="text-lg md:text-2xl font-black text-gray-900 truncate">
                    {selectedStore.settings.name}
                  </h1>
                  <ShieldCheck
                    size={15}
                    strokeWidth={3}
                    className="text-green-500 flex-shrink-0"
                  />
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Star size={12} fill="currentColor" className="text-yellow-400" />
                  <span className="text-xs font-black text-gray-900">
                    {(selectedStore.rating || 0).toFixed(1)}
                  </span>
                  <span className="text-[11px] font-bold text-gray-400">
                    ({formatNumber(reviewCountTotal)} avis)
                  </span>
                </div>
              </div>
            </div>

            {/* Meta line */}
            <div className="flex items-center gap-2.5 mt-2.5 flex-wrap text-[11px] font-bold text-gray-400">
              {(() => {
                const countryValue =
                  selectedStore.address || selectedStore.settings?.address;
                if (!countryValue) return null;
                return (
                  <div className="flex items-center gap-1">
                    <MapPin size={12} className="text-gray-300" />
                    <span className="truncate max-w-[160px]">{countryValue}</span>
                  </div>
                );
              })()}
              <span className="text-gray-200">·</span>
              <span>
                {selectedStore.products?.filter((p) => p.isOnline !== false).length || 0}{" "}
                produits en ligne
              </span>
            </div>

            {/* Description */}
            <p
              className={`mt-2 text-xs md:text-sm text-gray-500 leading-relaxed ${storeDescExpanded ? "" : "line-clamp-2"}`}
            >
              {descriptionText}
            </p>
            {descriptionText.length > 90 && (
              <button
                onClick={() => setStoreDescExpanded((v) => !v)}
                className="mt-0.5 text-[11px] font-black text-[#f56b2a]"
              >
                {storeDescExpanded ? "Réduire" : "Voir plus"}
              </button>
            )}

            {/* CTAs */}
            <div className={`grid gap-2 mt-3 ${waDigits ? "grid-cols-2" : "grid-cols-1"}`}>
              <button
                onClick={() => {
                  setFollowedStores((prev) => {
                    const next = new Set(prev);
                    if (next.has(selectedStore.id)) {
                      next.delete(selectedStore.id);
                      localNotify("Vous ne suivez plus cette boutique", "info");
                    } else {
                      next.add(selectedStore.id);
                      localNotify("Boutique suivie !", "success");
                    }
                    return next;
                  });
                }}
                className={`h-11 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.97] ${
                  isFollowed
                    ? "bg-green-50 text-green-700 border-2 border-green-200"
                    : "bg-[#f56b2a] text-white shadow-lg shadow-orange-200/60 hover:bg-[#e05f22]"
                }`}
              >
                <Heart
                  size={16}
                  fill={isFollowed ? "currentColor" : "none"}
                />
                {isFollowed ? "Suivi" : "Suivre"}
              </button>
              {waDigits && (
                <a
                  href={`https://wa.me/${waDigits}?text=${encodeURIComponent(`Bonjour ${selectedStore.settings.name}, je vous contacte depuis PosMarket.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 rounded-xl font-black text-sm flex items-center justify-center gap-2 border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white transition-all active:scale-[0.97]"
                >
                  <MessageCircle size={16} />
                  Contacter
                </a>
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 divide-x divide-gray-200/60 border-t border-gray-100 bg-gray-50/60">
            <div className="py-2.5 px-2 flex flex-col items-center">
              <span className="text-sm md:text-xl font-black text-gray-900 leading-none">
                {selectedStore.products?.filter((p) => p.isOnline !== false && p.image).length || 0}
              </span>
              <span className="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                Produits
              </span>
            </div>
            <div className="py-2.5 px-2 flex flex-col items-center">
              <span className="text-sm md:text-xl font-black text-gray-900 leading-none">
                {formatNumber((selectedStore.views || 0) + (selectedStore.products?.filter((p) => p.isOnline !== false).reduce((sum, p) => sum + (p.views || 0), 0) || 0))}
              </span>
              <span className="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                Visiteurs
              </span>
            </div>
            <div className="py-2.5 px-2 flex flex-col items-center">
              <span className="text-sm md:text-xl font-black text-gray-900 leading-none">
                {(selectedStore.rating || 0).toFixed(1)}/5
              </span>
              <span className="text-[8px] md:text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                Note
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProductDetails = () => {
    const product = selectedProductDetails;
    if (!product) {
      // Catalogue chargé mais produit introuvable -> 404 explicite
      if (!isInitialLoading && allProducts.length > 0) {
        return (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-400">
              <Package size={30} />
            </div>
            <p className="text-base font-black text-gray-900">
              Produit introuvable
            </p>
            <p className="text-xs text-gray-500 font-bold mt-1 max-w-[280px]">
              Ce produit n&apos;existe plus ou n&apos;est pas disponible
              actuellement.
            </p>
            <Button
              onClick={() => safeNavigate("/")}
              loading={isNavigating}
              loadingText="Chargement..."
              variant="primary"
              size="md"
              className="mt-6"
              icon={<ArrowRight size={14} />}
              iconPosition="right"
            >
              Retour à l&apos;accueil
            </Button>
          </div>
        );
      }
      return (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="aspect-square rounded-[24px] skeleton" />
            <div className="space-y-4">
              <div className="h-4 w-1/3 skeleton rounded" />
              <div className="h-7 w-3/4 skeleton rounded" />
              <div className="h-24 w-full skeleton rounded-2xl" />
              <div className="h-12 w-full skeleton rounded-full" />
            </div>
          </div>
        </div>
      );
    }

    const relatedProducts = allProducts
      .filter(
        (p) =>
          ((p.category && p.category === product.category) ||
            p.storeId === product.storeId) &&
          p.id !== product.id &&
          p.isOnline !== false,
      )
      .slice(0, 10);

    const mainCat = product.mainCategory || product.category || "Boutique";
    const isFood =
      product.businessType === "food" ||
      mainCat === "Restauration & Livraison Rapide";
    const descriptionText =
      product.description ||
      "Découvrez cet article exceptionnel sélectionné avec soin par votre boutique pour sa qualité et son style unique.";

    // --- Pricing & variants ---
    const options = product.options || [];
    const hasOptions = options.length > 0;
    const allSelected =
      !hasOptions || options.every((o) => !!selectedOptions[o.id]);
    const matchedVariant = hasOptions
      ? product.variants?.find(
          (v) => sameSelectedOptions(v.optionValues, selectedOptions),
        )
      : undefined;

    const basePrice = matchedVariant ? matchedVariant.price : product.price;
    const discountPct =
      product.originalPrice && product.originalPrice > basePrice
        ? Math.round(
            ((product.originalPrice - basePrice) / product.originalPrice) *
              100,
          )
        : 0;

    // --- Stock ---
    const stockValue =
      product.stock != null ? (product.stock as number) : null;
    const isOutOfStock = stockValue === 0;
    const isLowStock =
      stockValue !== null && stockValue > 0 && stockValue <= 5;
    const stockFill =
      stockValue === null
        ? 0
        : Math.min(Math.round((stockValue / 20) * 100), 100);

    // --- Gallery ---
    const galleryImages = [
      ...(product.image ? [product.image] : []),
      ...(product.images || []),
    ].filter((img, i, arr) => !!img && arr.indexOf(img) === i);
    const currentImage = selectedDetailImage || product.image;

    // --- Actions (options-aware) ---
    const resolveVariantId = () => {
      if (!hasOptions || !product.variants) return undefined;
      const variant = product.variants.find(
        (v) => sameSelectedOptions(v.optionValues, selectedOptions),
      );
      return variant?.id;
    };

    const handleAddToCart = () => {
      if (!allSelected) {
        localNotify(
          "Veuillez sélectionner toutes les options",
          "warning",
        );
        return;
      }
      addToCart(product, resolveVariantId());
    };

    const handleBuyNow = () => {
      if (!allSelected) {
        localNotify(
          "Veuillez sélectionner toutes les options",
          "warning",
        );
        return;
      }
      buyNow(product, resolveVariantId(), selectedOptions);
    };

    const handleShare = (e: React.MouseEvent) => {
      e.stopPropagation();
      const url = window.location.href;
      if (navigator.share) {
        navigator.share({
          title: product.name,
          text: descriptionText,
          url: url,
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(url);
        localNotify("Lien produit copié dans le presse-papiers !", "success");
      }
    };

    const reviewTotal =
      product.reviewCount || product.reviews?.length || 0;
    const accentText = isFood ? "text-green-600" : "text-[#f56b2a]";

    const openZoom = (img: string) => {
      setCurrentZoomImage(img);
      setZoomGallery(galleryImages);
      setIsImageModalOpen(true);
    };

    const onGalleryScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const idx = Math.min(
        galleryImages.length - 1,
        Math.max(0, Math.round(el.scrollLeft / el.clientWidth)),
      );
      if (idx !== productSwipeIdx) {
        setProductSwipeIdx(idx);
        setSelectedDetailImage(galleryImages[idx]);
      }
    };

    const scrollToSection = (id: string) => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-40 lg:pb-12 bg-[#f8f9fc] lg:bg-transparent -mx-4 lg:mx-auto">
        {/* Breadcrumb (desktop only) */}
        <nav
          aria-label="Fil d'Ariane"
          className="hidden md:flex items-center gap-2 mb-6 text-[11px] font-bold text-gray-400 uppercase tracking-widest px-4 lg:px-0 pt-4"
        >
          <button
            onClick={() => safeNavigate("/")}
            className="hover:text-[#f56b2a] transition-colors cursor-pointer"
          >
            Accueil
          </button>
          <ChevronRight size={11} />
          <button
            onClick={() =>
              safeNavigate("/", {
                action: () => setSelectedCategory(mainCat),
              })
            }
            className="hover:text-[#f56b2a] transition-colors cursor-pointer truncate max-w-[220px]"
          >
            {mainCat}
          </button>
          <ChevronRight size={11} />
          <span
            className="text-gray-900 truncate max-w-[280px]"
            aria-current="page"
          >
            {product.name}
          </span>
        </nav>

        {/* ================= MOBILE APP-BAR (M3 style) ================= */}
        <div className="lg:hidden sticky top-0 z-[100] bg-white border-b border-gray-100/80 px-3 py-2 flex items-center justify-between -mx-4" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <button
            onClick={() =>
              // Retour intelligent : vers la boutique d'où l'utilisateur vient,
              // sinon l'accueil.
              safeNavigate(
                lastVisitedStoreRef.current
                  ? `/store/${lastVisitedStoreRef.current}`
                  : "/",
              )
            }
            aria-label="Retour"
            className="w-11 h-11 flex items-center justify-center rounded-full text-gray-800 hover:bg-gray-100/80 active:scale-95 transition-all"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <span className="text-xs font-black tracking-[0.1em] uppercase text-gray-500 max-w-[60%] truncate">
            {product.storeName}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleShare}
              aria-label="Partager"
              className="w-11 h-11 flex items-center justify-center rounded-full text-gray-800 hover:bg-gray-100/80 active:scale-95 transition-all"
            >
              <Share2 size={19} />
            </button>
          </div>
        </div>

        {/* ================= PRODUIT ================= */}
        <div id="pd-produit" className="scroll-mt-14">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-14 items-start">
            {/* ---------- Gallery ---------- */}
            <div className="relative lg:sticky lg:top-24">
              {/* Mobile: Swipeable Carousel inside an M3 Card */}
              <div className="lg:hidden relative bg-white overflow-hidden rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] mb-3.5 aspect-square">
                <div
                  className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory h-full"
                  onScroll={onGalleryScroll}
                >
                  {galleryImages.map((img, idx) => (
                    <div
                      key={idx}
                      className="min-w-full snap-center h-full relative"
                      onClick={() => openZoom(galleryImages[productSwipeIdx])}
                    >
                      <Image
                        src={img}
                        alt={`${product.name} - vue ${idx + 1}`}
                        fill
                        priority={idx === 0}
                        sizes="100vw"
                        className="object-cover pointer-events-none"
                      />
                    </div>
                  ))}
                </div>

                {/* Expand overlay button */}
                <button
                  onClick={() => openZoom(currentImage)}
                  aria-label="Agrandir l'image"
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md border border-gray-100 shadow-md flex items-center justify-center text-gray-700 active:scale-95 transition-all z-10"
                >
                  <Maximize2 size={14} />
                </button>

                {/* Discount badge */}
                {discountPct > 0 && (
                  <div className="absolute top-3 left-3 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full shadow-lg shadow-red-500/30 flex items-center gap-0.5 z-10">
                    <Zap size={10} fill="currentColor" /> -{discountPct}%
                  </div>
                )}

                {/* Freshness strip (food) */}
                {isFood && (
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-green-50 text-green-700 text-[8px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full shadow-sm z-10">
                    <Clock size={10} className="flex-shrink-0" />
                    Fraîchement préparé · {product.preparationTime || product.deliveryTime || "30-45 min"}
                  </div>
                )}

                {/* Counter badge */}
                {galleryImages.length > 1 && (
                  <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[9px] font-black px-2.5 py-1 rounded-full z-10">
                    {productSwipeIdx + 1}/{galleryImages.length}
                  </div>
                )}
              </div>

              {/* Desktop: main image + thumbnails */}
              <div className="hidden lg:block space-y-3">
                <div className="relative w-full aspect-square rounded-[32px] overflow-hidden bg-gradient-to-br from-gray-50 to-white border border-gray-100 shadow-[0_20px_60px_rgba(0,0,0,0.06)] group/main">
                  <Image
                    src={currentImage}
                    width={1000}
                    height={1000}
                    priority
                    alt={product.name}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover/main:scale-[1.04]"
                  />

                  {discountPct > 0 && (
                    <div className="absolute top-4 left-4 bg-gradient-to-r from-red-500 to-red-600 text-white text-[11px] font-black uppercase tracking-widest pl-3 pr-4 py-2 rounded-full shadow-lg shadow-red-500/30 flex items-center gap-1">
                      <Zap size={12} fill="currentColor" /> -{discountPct}%
                    </div>
                  )}

                  <button
                    onClick={() => openZoom(currentImage)}
                    aria-label="Agrandir l'image"
                    className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur-md border border-gray-100 shadow-md flex items-center justify-center text-gray-700 hover:bg-white hover:text-[#f56b2a] hover:scale-105 transition-all active:scale-95"
                  >
                    <Maximize2 size={15} />
                  </button>

                  {isFood && (
                    <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-white/90 backdrop-blur-md border border-green-100 text-green-700 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm">
                      <Clock size={11} />
                      Fraîchement préparé · {product.preparationTime || product.deliveryTime || "30-45 min"}
                    </div>
                  )}
                </div>

                {galleryImages.length > 1 && (
                  <div className="grid grid-cols-6 gap-2">
                    {galleryImages.slice(0, 6).map((img, idx) => {
                      const isActive =
                        currentImage === img ||
                        (!selectedDetailImage && idx === 0);
                      return (
                        <button
                          key={idx}
                          onMouseEnter={() => setSelectedDetailImage(img)}
                          onFocus={() => setSelectedDetailImage(img)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDetailImage(img);
                          }}
                          aria-label={`Voir l'image ${idx + 1}`}
                          className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                            isActive
                              ? "border-[#f56b2a] ring-2 ring-orange-100 scale-[1.03]"
                              : "border-transparent opacity-70 hover:opacity-100"
                          }`}
                        >
                          <Image
                            src={img}
                            alt={`${product.name} - vue ${idx + 1}`}
                            width={120}
                            height={120}
                            className="w-full h-full object-cover"
                            sizes="80px"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ---------- Details Layout ---------- */}
            <div className="space-y-3.5">
              {/* CARD 1: MAIN INFO (Title, Price, Store, Rating) */}
              <div className="bg-white rounded-[24px] lg:rounded-none border lg:border-none border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] lg:shadow-none p-4 lg:p-0">
                {/* Store Row */}
                <div className="mb-3">
                  <Link
                    to={`/store/${product.storeSlug || product.storeId}`}
                    className="inline-flex items-center gap-1 text-[9px] font-bold text-gray-500 hover:text-[#f56b2a] transition-colors"
                  >
                    Vendu par
                    <span className="font-black text-gray-900 max-w-[180px] truncate inline-block align-bottom">
                      {product.storeName}
                    </span>
                  </Link>
                </div>

                {/* Title */}
                <h2 className="text-sm md:text-3xl font-black text-gray-900 leading-[1.2] tracking-tight mb-2">
                  {product.name}
                  {product.unit && (
                    <span className="block md:inline md:ml-2 text-[9px] md:text-base text-gray-400 font-bold align-middle">
                      {product.unit}
                    </span>
                  )}
                </h2>

                {/* Rating & Sales Row */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-4 border-b border-gray-50 pb-3">
                  <div className="flex items-center gap-1">
                    <div className="flex text-yellow-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={12}
                          fill={
                            s <= Math.round(product.rating || 0)
                              ? "currentColor"
                              : "none"
                          }
                        />
                      ))}
                    </div>
                    <span className="text-xs font-black text-gray-900">
                      {(product.rating || 0).toFixed(1)}
                    </span>
                    <button
                      onClick={() => scrollToSection("pd-avis")}
                      className="text-[10px] font-bold text-gray-400 underline underline-offset-2 decoration-gray-200 hover:text-[#f56b2a]"
                    >
                      ({formatNumber(reviewTotal)} avis)
                    </button>
                  </div>
                  <span className="w-1 h-1 bg-gray-200 rounded-full" />
                  <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                    <ShoppingBag size={11} className={accentText} />
                    {formatNumber(product.salesCount || 0)} {isFood ? 'commandes' : 'vendus'}
                  </span>
                  {!isFood && product.views != null && (
                    <>
                      <span className="w-1 h-1 bg-gray-200 rounded-full" />
                      <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                        <Eye size={11} />
                        {formatNumber(product.views)} vues
                      </span>
                    </>
                  )}
                </div>

                {/* Price block - Premium Inside Card */}
                <div className="relative overflow-hidden rounded-[20px] border border-[#f56b2a]/10 bg-gradient-to-br from-[#f56b2a]/5 via-white to-white p-3.5">
                  <span className="block text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">
                    {hasOptions && !allSelected ? "À partir de" : (isFood ? "Prix" : "Tarif unique")}
                  </span>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className={`text-lg md:text-4xl font-black tracking-tight leading-none ${accentText}`}
                    >
                      {formatCurrency(basePrice)}
                    </span>
                    {product.originalPrice && product.originalPrice > basePrice && (
                      <>
                        <span className="text-[9px] md:text-xs text-gray-400 line-through font-bold">
                          {formatCurrency(product.originalPrice)}
                        </span>
                        <span className="text-[9px] font-black text-white bg-red-500 px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                          -{discountPct}%
                        </span>
                      </>
                    )}
                  </div>
                  {product.originalPrice && product.originalPrice > basePrice && (
                    <span className="mt-1.5 inline-flex text-[9px] font-black text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Économisez {formatCurrency(product.originalPrice - basePrice)}
                    </span>
                  )}
                </div>
              </div>

              {/* CARD 2: OPTIONS / VARIANTS (M3 Chips) */}
              {hasOptions && (
                <div className="bg-white rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-4">
                  <div className="space-y-4">
                    {options.map((option) => (
                      <div key={option.id}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em]">
                            {option.name}
                          </h4>
                          {selectedOptions[option.id] && (
                            <span className="text-[10px] font-black text-[#f56b2a]">
                              {selectedOptions[option.id]}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {option.values.map((val) => {
                            const isSelected = selectedOptions[option.id] === val;
                            return (
                              <button
                                key={val}
                                onClick={() =>
                                  setSelectedOptions((prev) => ({
                                    ...prev,
                                    [option.id]: val,
                                  }))
                                }
                                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[10px] md:text-xs font-semibold transition-all border active:scale-95 ${
                                  isSelected
                                    ? "bg-[#f56b2a] text-white border-[#f56b2a] shadow-md shadow-orange-500/10 font-black"
                                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-900"
                                }`}
                              >
                                {isSelected && <Check size={11} strokeWidth={3} />}
                                {val}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {!allSelected && (
                      <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2 rounded-xl">
                        <AlertCircle size={12} className="flex-shrink-0" />
                        Sélectionnez toutes les options pour continuer
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* CARD 3: WHOLESALE (If available) */}
              {product.wholesalePrice && !isFood && (
                <div className="bg-gray-900 text-white rounded-[24px] p-4 shadow-lg shadow-gray-900/10 border border-gray-800">
                  <button
                    onClick={() => addWholesaleToCart(product)}
                    className="w-full flex items-center justify-between group/ws"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-[#f56b2a] flex-shrink-0">
                        <Package size={16} />
                      </div>
                      <div className="text-left min-w-0">
                        <span className="block text-[9px] font-black uppercase tracking-[0.15em] text-[#f56b2a]">
                          Offre grossiste
                        </span>
                        <span className="text-xs font-black truncate">
                          {formatCurrency(product.wholesalePrice)}{" "}
                          <span className="text-gray-400 font-bold">
                            · dès {product.wholesaleMinQty} unités
                          </span>
                        </span>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-gray-300 group-hover/ws:text-white transition-colors flex-shrink-0 ml-2">
                      Lot <ArrowRight size={12} />
                    </span>
                  </button>
                </div>
              )}

              {/* CARD 4: AVAILABILITY & DELIVERY */}
              <div className="hidden md:block bg-white rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-4">
                {/* Stock meter */}
                <div className="mb-4">
                  {stockValue !== null && stockValue > 0 && (
                    <>
                      <div className="flex items-center justify-end mb-1.5">
                        {isLowStock && (
                          <span className="text-[9px] font-black text-amber-600 animate-pulse">
                            Dernières unités ({stockValue}) !
                          </span>
                        )}
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            isLowStock ? "bg-amber-400" : "bg-green-400"
                          }`}
                          style={{
                            width: `${isLowStock ? Math.max(stockFill, 12) : stockFill}%`,
                          }}
                        />
                      </div>
                    </>
                  )}
                  {isOutOfStock && (
                    <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
                      <AlertCircle size={12} /> Rupture de stock temporaire
                    </p>
                  )}
                  {stockValue === null && (
                    <p className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400">
                      <AlertCircle size={11} /> Disponibilité à confirmer en boutique
                    </p>
                  )}
                </div>
              </div>

              {/* CARD 5: DESCRIPTION */}
              <div className="bg-white rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="hidden md:block h-0.5 w-6 bg-[#f56b2a] rounded-full" />
                  <h3 className="text-[9px] font-black text-gray-900 uppercase tracking-[0.15em]">
                    {isFood ? 'Détails du plat' : 'Description produit'}
                  </h3>
                </div>
                <div
                  className={`text-gray-600 text-[9px] md:text-xs leading-relaxed font-medium ${
                    !isDescriptionExpanded ? "line-clamp-4 md:line-clamp-none" : ""
                  }`}
                  style={{ whiteSpace: "pre-line" }}
                >
                  {descriptionText}
                </div>
                {descriptionText.length > 180 && (
                  <button
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    className={`mt-2.5 md:hidden font-black text-[9px] uppercase tracking-widest flex items-center gap-0.5 active:scale-95 transition-all ${accentText}`}
                  >
                    {isDescriptionExpanded ? "Réduire" : "Lire la suite"}
                    <ChevronRight
                      size={10}
                      className={`transition-transform duration-300 ${
                        isDescriptionExpanded ? "-rotate-90" : "rotate-90"
                      }`}
                    />
                  </button>
                )}
              </div>

              {/* CTAs — desktop only */}
              <div className="hidden lg:flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  variant="primary"
                  fullWidth
                  size="xl"
                  className="sm:flex-[1.4]"
                  icon={<ShoppingCart size={19} strokeWidth={2.5} />}
                >
                  {isFood ? "Commander" : "Ajouter au panier"}
                </Button>
                <Button
                  onClick={handleBuyNow}
                  disabled={isOutOfStock}
                  variant="outline"
                  fullWidth
                  size="xl"
                  className="!border-gray-900 !text-gray-900 hover:!bg-gray-900 hover:!text-white"
                >
                  {isFood ? "Commander maintenant" : "Acheter maintenant"}
                </Button>
              </div>

              {/* Trust band */}
              {isFood ? (
                <div className="hidden lg:flex items-center justify-center gap-4 pt-3 text-[9px] font-bold text-gray-400">
                  <span className="flex items-center gap-1"><Clock size={10} /> Préparé à la commande</span>
                  <span className="w-1 h-1 bg-gray-200 rounded-full" />
                  <span className="flex items-center gap-1"><ShieldCheck size={10} /> Fraîcheur garantie</span>
                  <span className="w-1 h-1 bg-gray-200 rounded-full" />
                  <span className="flex items-center gap-1"><Truck size={10} /> Livraison rapide</span>
                </div>
              ) : (
                <div className="hidden lg:flex items-center justify-center gap-4 pt-3 text-[9px] font-bold text-gray-400">
                  <span className="flex items-center gap-1"><ShieldCheck size={10} /> Paiement à la livraison</span>
                  <span className="w-1 h-1 bg-gray-200 rounded-full" />
                  <span className="flex items-center gap-1"><RotateCcw size={10} /> Retour 7 jours</span>
                  <span className="w-1 h-1 bg-gray-200 rounded-full" />
                  <span className="flex items-center gap-1"><Truck size={10} /> Livraison sécurisée</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= AVIS (CARD-BASED) ================= */}
        <section
          id="pd-avis"
          className="mt-3.5 bg-white rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)] p-4 lg:p-10 scroll-mt-14"
        >
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="hidden md:block h-0.5 w-6 bg-yellow-400 rounded-full" />
              <h3 className="text-[9px] md:text-sm font-black text-gray-900 uppercase tracking-[0.15em]">
                Avis {isFood ? 'sur le repas' : 'sur le produit'}
              </h3>
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
              icon={<MessageCircle size={12} />}
            >
              {isFood ? 'Noter ce repas' : 'Donner mon avis'}
            </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-6 md:gap-12">
            {/* Score summary */}
            <div className="flex md:flex-col items-center md:items-start gap-3 md:min-w-[180px] md:border-r md:border-gray-100 md:pr-12">
              <div className="text-center md:text-left">
                <div className="flex items-baseline gap-1 justify-center md:justify-start">
                  <span className="text-xl md:text-5xl font-black text-gray-900 tracking-tighter leading-none">
                    {(product.rating || 0).toFixed(1)}
                  </span>
                  <span className="text-xs font-black text-gray-300">/5</span>
                </div>
                <div className="flex text-yellow-400 mt-1 justify-center md:justify-start">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={12}
                      fill={
                        s <= Math.round(product.rating || 0)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  ))}
                </div>
                <p className="text-[8px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
                  {formatNumber(reviewTotal)} {isFood ? 'avis clients' : 'notes et avis'}
                </p>
              </div>
            </div>

            {/* Distribution + list */}
            <div className="flex-grow min-w-0">
              {(product.reviews?.length || 0) > 0 && (
                <div className="mb-4 space-y-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count =
                      product.reviews?.filter((r) => r.rating === star).length || 0;
                    const total = product.reviews?.length || 1;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={star} className="flex items-center gap-3">
                        <span className="text-[9px] font-black text-gray-500 w-8 flex items-center gap-0.5">
                          {star}{" "}
                          <Star size={8} className="text-yellow-400" fill="currentColor" />
                        </span>
                        <div className="flex-grow h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-yellow-300 to-yellow-400 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-black text-gray-400 w-9 text-right">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="divide-y divide-gray-50">
                {selectedProductId && loadingReviews[selectedProductId] ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-[#f56b2a] animate-spin" />
                  </div>
                ) : (product.reviews?.length || 0) > 0 ? (
                  <>
                    {(showAllProductReviews
                      ? product.reviews
                      : product.reviews?.slice(0, 3)
                    )?.map((review, idx) => (
                      <div key={idx} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                        <div
                          className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] md:text-xs font-black ${
                            [
                              "bg-gradient-to-br from-orange-100 to-orange-200 text-[#d55a20]",
                              "bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700",
                              "bg-gradient-to-br from-rose-100 to-rose-200 text-rose-600",
                            ][idx % 3]
                          }`}
                        >
                          {review.author?.[0]?.toUpperCase() || "A"}
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center justify-between gap-3 mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <h4 className="text-[9px] md:text-xs font-black text-gray-900 truncate">
                                {review.author}
                              </h4>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    size={8}
                                    className="text-yellow-400"
                                    fill={s <= review.rating ? "currentColor" : "none"}
                                  />
                                ))}
                              </div>
                            </div>
                            <span className="text-[9px] font-medium text-gray-400 flex-shrink-0">
                              {new Date(review.date).toLocaleDateString("fr-FR", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          <p className="text-[9px] md:text-xs text-gray-600 leading-relaxed font-medium">
                            {review.comment}
                          </p>
                        </div>
                      </div>
                    ))}

                    {product.reviews && product.reviews.length > 3 && !showAllProductReviews && (
                      <button
                        onClick={() => setShowAllProductReviews(true)}
                        className="w-full py-2.5 mt-2 bg-gray-50 text-gray-900 text-[8px] md:text-[10px] font-black uppercase tracking-wider rounded-xl border border-gray-100 hover:bg-gray-100 transition-all flex items-center justify-center gap-1.5"
                      >
                        Voir les {product.reviews.length - 3} autres avis
                        <ChevronRight size={12} className="rotate-90" />
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6 bg-gray-50/60 rounded-xl border border-dashed border-gray-200">
                    <MessageCircle size={18} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-xs font-black text-gray-600">
                      Aucun avis rédigé
                    </p>
                    <p className="text-[9px] text-gray-400 mt-0.5 font-medium">
                      {isFood ? 'Soyez le premier à donner votre avis !' : 'Partagez votre avis pour aider la communauté !'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ================= SIMILAIRES ================= */}
        {relatedProducts.length > 0 && (
          <section id="pd-similaires" className="mt-3.5 scroll-mt-14">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="hidden md:block h-0.5 w-6 bg-[#f56b2a] rounded-full" />
              <h3 className="text-[9px] md:text-sm font-black text-gray-900 uppercase tracking-[0.15em]">
                {isFood ? 'Vous aimerez aussi' : 'Recommandations similaires'}
              </h3>
            </div>
            <div className="flex overflow-x-auto no-scrollbar gap-3 snap-x snap-mandatory pb-4 pr-4 -mr-4 md:mr-0 md:pb-0 md:pr-0 md:grid md:grid-cols-5 md:gap-6">
              {relatedProducts.map((relProduct) => (
                <ProductCard
                  key={`${relProduct.storeId}-${relProduct.id}`}
                  product={relProduct}
                  onAddToCart={handleCardAddToCart}
                  onBuyNow={handleCardBuyNow}
                  onStoreSelect={(id) =>
                    safeNavigate(`/store/${relProduct.storeSlug || id}`)
                  }
                  onClick={() =>
                    safeNavigate(`/product/${generateProductSlug(relProduct)}`)
                  }
                  onPrefetch={() => warmProduct({ id: relProduct.id, image: relProduct.image })}
                  className="w-[145px] xs:w-[160px] md:w-auto flex-shrink-0 md:flex-shrink snap-start"
                />
              ))}
            </div>
          </section>
        )}

        {/* ================= STICKY MOBILE ACTION BAR (M3 Floating style) ================= */}
        {(
          <div
            className="lg:hidden fixed left-0 right-0 bottom-0 z-[998] bg-white/95 backdrop-blur-xl border-t border-gray-100/80 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] px-4 pt-3"
            style={{
              paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {isFood ? (
              <div className="flex items-center justify-center gap-3 pb-2 text-[8px] font-bold text-gray-400">
                <span className="flex items-center gap-1"><Clock size={8} /> Fraîcheur garantie</span>
                <span className="w-0.5 h-0.5 bg-gray-200 rounded-full" />
                <span className="flex items-center gap-1"><Truck size={8} /> Livraison rapide</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3 pb-2 text-[8px] font-bold text-gray-400">
                <span className="flex items-center gap-1"><ShieldCheck size={8} /> Paiement à la livraison</span>
                <span className="w-0.5 h-0.5 bg-gray-200 rounded-full" />
                <span className="flex items-center gap-1"><RotateCcw size={8} /> Retour 7j</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="flex-1 border-2 border-gray-900 bg-white hover:bg-gray-50 text-gray-900 rounded-full font-black text-xs py-3.5 flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
              >
                <ShoppingCart size={14} strokeWidth={2.5} />
                {isFood ? 'Commander' : 'Panier'}
              </button>
              <button
                onClick={handleBuyNow}
                disabled={isOutOfStock}
                className="flex-[1.2] bg-[#f56b2a] hover:bg-orange-600 text-white rounded-full font-black text-xs py-3.5 flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-orange-500/10 transition-all disabled:opacity-50"
              >
                <Zap size={14} fill="currentColor" />
                {isOutOfStock ? "Rupture" : (isFood ? "Commander" : "Acheter")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCart = () => {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col">
        <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-white text-gray-900 z-10 shrink-0">
          <h2 className="text-sm md:text-lg font-black flex items-center gap-2 leading-tight min-w-0">
            {checkoutStage === "cart" ? (
              <ShoppingCart className="text-[#f56b2a] shrink-0" size={16} />
            ) : (
              <ShieldCheck className="text-green-500 shrink-0" size={16} />
            )}
            <span className="truncate">
              {checkoutStage === "cart"
                ? "Mon Panier"
                : checkoutStage === "shipping"
                  ? "Livraison"
                  : checkoutStage === "payment"
                    ? "Paiement"
                    : "Commande Validée"}
            </span>
            {checkoutStage === "cart" && cartItemsCount > 0 && (
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-orange-50 text-[#f56b2a] text-[10px] font-black tabular-nums">
                {cartItemsCount}
              </span>
            )}
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
            className="px-3 py-2 -mr-1 hover:bg-gray-100 rounded-full transition-colors text-gray-500 font-black text-[10px] uppercase tracking-tight flex items-center gap-1 whitespace-nowrap"
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
                { id: "shipping", label: "Livraison", icon: MapPin },
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

        <div className="flex-grow overflow-y-auto custom-scrollbar bg-gray-50/50 p-2.5 sm:p-3 md:p-8">
          {(checkoutStage === "cart" && cart.length > 0) && (
            <div className="space-y-3">
              {/* Réassurance */}
              <div className="flex items-center justify-center gap-5 py-2.5 bg-white rounded-full border border-gray-100 shadow-sm text-[9px] font-black uppercase tracking-widest text-gray-500">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-green-500" />
                  Paiement sécurisé
                </span>
                <span className="flex items-center gap-1.5">
                  <Truck size={13} className="text-[#f56b2a]" />
                  Payez à la livraison
                </span>
              </div>

              {Array.from(
                new Set(
                  cart
                    .filter((i) => i.product?.storeId)
                    .map((item) => item.product.storeId),
                ),
              ).map((storeId) => {
                const storeItems = cart.filter(
                  (i) => i.product?.storeId === storeId,
                );
                const storeName = storeItems[0]?.product.storeName || "Boutique";
                const storeCount = storeItems.reduce(
                  (sum, i) => sum + (i.quantity || 1),
                  0,
                );
                const isStoreExpanded =
                  expandedCartStores.has(storeId);
                const visibleItems = isStoreExpanded
                  ? storeItems
                  : storeItems.slice(0, 3);
                return (
                  <div
                    key={storeId}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gray-50/70 border-b border-gray-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <Store size={12} className="text-[#f56b2a] shrink-0" />
                        <span className="text-[9px] md:text-[11px] font-black text-gray-900 truncate">
                          {storeName}
                        </span>
                      </div>
                      <span className="shrink-0 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                        {storeCount} article{storeCount > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {visibleItems.map((item) => {
                        const unitPrice = getEffectiveItemPrice(item);
                        const qty = item.quantity || 1;
                        const hasWholesale = !!(
                          item.product.wholesalePrice &&
                          Number(item.product.wholesaleMinQty) > 0
                        );
                        const wholesaleActive =
                          hasWholesale &&
                          qty >= Number(item.product.wholesaleMinQty);
                        const wholesaleLeft = hasWholesale
                          ? Math.max(
                              0,
                              Number(item.product.wholesaleMinQty) - qty,
                            )
                          : 0;
                        const itemKey = `${item.product.id}-${item.variantId || "base"}`;
                        const isSwipeOpen = swipeState?.key === itemKey;
                        const swipeDx = isSwipeOpen ? Math.min(swipeState.dx, 0) : 0;
                        return (
                          <div
                            key={itemKey}
                            className="relative bg-white overflow-hidden"
                          >
                                {/* Couche supprimable (cachée derrière) */}
                                <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center">
                                  <button
                                    onClick={() => {
                                      removeFromCart(
                                        item.product.id,
                                        item.product.storeId,
                                        item.variantId,
                                      );
                                      setSwipeState(null);
                                      localNotify("Article retiré du panier", "info");
                                    }}
                                    className="text-white flex flex-col items-center gap-1 p-2"
                                    aria-label="Supprimer"
                                  >
                                    <Trash2 size={16} />
                                    <span className="text-[9px] font-black uppercase">Retirer</span>
                                  </button>
                                </div>
                                {/* Contenu glissant */}
                                <div
                                  className="relative p-3 flex gap-3 bg-white"
                                  style={{ transform: `translateX(${swipeDx}px)`, transition: swipeStartRef.current ? 'none' : 'transform 0.25s ease' }}
                                  onTouchStart={(e) => {
                                    swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                                  }}
                                  onTouchMove={(e) => {
                                    const st = swipeStartRef.current;
                                    if (!st) return;
                                    const dy = e.touches[0].clientY - st.y;
                                    const ddx = e.touches[0].clientX - st.x;
                                    if (Math.abs(dy) > Math.abs(ddx)) return;
                                    e.preventDefault();
                                    setSwipeState({ key: itemKey, dx: Math.max(-96, Math.min(0, ddx)) });
                                  }}
                                  onTouchEnd={() => {
                                    setSwipeState((s) => (s && s.dx < -56 ? { key: s.key, dx: -80 } : null));
                                    swipeStartRef.current = null;
                                  }}
                                >
                            <div className="w-16 h-16 shrink-0">
                              <ProductImage
                                src={item.product.image}
                                alt={item.product.name || "Product Image"}
                                containerClassName="rounded-xl border border-gray-100 shadow-sm"
                                showZoomEffect={false}
                              />
                            </div>
                            <div className="flex-grow min-w-0 flex flex-col">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-[10px] md:text-sm font-bold text-gray-900 leading-tight line-clamp-1">
                                  {item.product.name || "Unknown Product"}
                                </h4>
                                <button
                                  onClick={() =>
                                    removeFromCart(
                                      item.product.id,
                                      item.product.storeId,
                                      item.variantId,
                                    )
                                  }
                                  aria-label={`Retirer ${item.product.name || "le produit"} du panier`}
                                  className="shrink-0 p-2.5 -m-1.5 text-gray-300 hover:text-red-500 active:text-red-500 transition-colors"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap min-h-[18px]">
                                {item.variantId && item.product.variants && (
                                  <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-full px-2 py-px text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                                    <Tag size={9} />
                                    {
                                      item.product.variants.find(
                                        (v) => v.id === item.variantId,
                                      )?.name
                                    }
                                  </span>
                                )}
                                {promoApplied &&
                                  promoApplied.store_id ===
                                    item.product.storeId && (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-green-600 uppercase tracking-wider">
                                      <CheckCircle2 size={9} /> Coupon
                                    </span>
                                  )}
                              </div>
                              <div className="mt-auto pt-2 flex items-end justify-between gap-3">
                                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-full p-1 md:p-0.5">
                                  <button
                                    onClick={() =>
                                      updateQuantity(
                                        item.product.id,
                                        item.product.storeId,
                                        -1,
                                        item.variantId,
                                      )
                                    }
                                    aria-label="Diminuer la quantité"
                                    className="w-9 h-9 md:w-7 md:h-7 grid place-items-center rounded-full font-black text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-sm transition-all"
                                  >
                                    −
                                  </button>
                                  <span className="w-7 text-center text-xs font-black text-gray-900 tabular-nums">
                                    {qty}
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
                                    aria-label="Augmenter la quantité"
                                    className="w-9 h-9 md:w-7 md:h-7 grid place-items-center rounded-full font-black text-[#f56b2a] hover:bg-orange-50 active:bg-orange-100 transition-all"
                                  >
                                    +
                                  </button>
                                </div>
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="text-[10px] md:text-sm font-black text-gray-900 whitespace-nowrap tabular-nums">
                                    {formatCurrency(unitPrice * qty)}
                                  </span>
                                  {hasWholesale && (
                                    <span
                                      className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wide ${wholesaleActive ? "text-green-600" : "text-[#f56b2a]"}`}
                                    >
                                      {wholesaleActive ? (
                                        <>
                                          <CheckCircle2 size={9} /> Prix de gros
                                        </>
                                      ) : (
                                        <>
                                          <Zap size={9} fill="currentColor" />{" "}
                                          +{wholesaleLeft} = prix de gros
                                        </>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                    {storeItems.length > 3 && (
                      <button
                        onClick={() =>
                          setExpandedCartStores((prev) => {
                            const next = new Set(prev);
                            if (next.has(storeId)) next.delete(storeId);
                            else next.add(storeId);
                            return next;
                          })
                        }
                        aria-expanded={isStoreExpanded}
                        className="w-full flex items-center justify-center gap-1.5 py-3 border-t border-gray-50 text-[10px] font-black uppercase tracking-widest text-[#f56b2a] hover:bg-orange-50/50 active:bg-orange-100/60 transition-colors"
                      >
                        {isStoreExpanded ? (
                          <>
                            Réduire <ChevronUp size={12} />
                          </>
                        ) : (
                          <>
                            Voir tout ({storeItems.length})
                            <ChevronDown size={12} />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {(checkoutStage === "cart" && cart.length === 0) && (
            <div className="h-full flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="relative mb-5">
                <div className="absolute inset-0 bg-orange-100 rounded-full blur-2xl opacity-60 scale-125" />
                <div className="relative w-20 h-20 bg-white border border-gray-100 rounded-3xl grid place-items-center shadow-sm">
                  <ShoppingCart size={30} className="text-[#f56b2a]/60" />
                </div>
              </div>
              <p className="text-lg font-black text-gray-900">
                Votre panier est vide
              </p>
              <p className="text-xs font-bold text-gray-500 mt-1 max-w-[240px] leading-relaxed">
                Parcourez les boutiques et ajoutez vos produits favoris.
              </p>
              <Button
                onClick={() => safeNavigate("/")}
                loading={isNavigating}
                loadingText="Chargement..."
                variant="primary"
                size="md"
                className="mt-6"
                icon={<ArrowRight size={14} />}
                iconPosition="right"
              >
                Découvrir la boutique
              </Button>
            </div>
          )}
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
                                phone: formatPhoneSN(e.target.value),
                              })
                            }
                            className={`w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border rounded-2xl font-bold text-gray-700 focus:bg-white transition-all no-global-border ${customerInfo.phone && !isValidPhoneSN(customerInfo.phone) ? "border-red-200 bg-red-50/40" : "border-gray-100"}`}
                          />
                          {customerInfo.phone && !isValidPhoneSN(customerInfo.phone) && (
                            <p className="text-[9px] font-bold text-red-500 ml-1 mt-1">Numéro invalide — ex : +221 77 123 45 67</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

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
                      const waMsg = `NOUVELLE COMMANDE #${Date.now().toString().slice(-6)}\n\nClient: ${customerInfo.name || "Anonyme"}\nTelephone: ${customerInfo.phone || "Non fourni"}\n\nArticles:\n${completedOrderItems.map((item) => `• ${item.quantity}x ${item.name} - ${formatCurrency(item.price * item.quantity)}`).join("\n")}\n\nTotal: ${formatCurrency(completedOrderTotal)}\nMode de paiement: ${paymentMethod === "cod" ? "Especes" : "Carte"}`;
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
                {isPushSupported() && (
                  <button
                    onClick={async () => {
                      const r = await enablePushNotifications();
                      localNotify(
                        r.ok ? "Notifications activées" : r.reason === "denied" ? "Notifications refusées" : "Notifications indisponibles",
                        r.ok ? "success" : "info",
                      );
                    }}
                    className="mt-4 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#f56b2a] transition-colors"
                  >
                    <Bell size={12} className="inline -mt-0.5" /> M&apos;alerter de ma commande
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        {checkoutStage !== "success" && cart.length > 0 && (
          <>
            <div className="p-4 md:p-5 bg-white border-t border-gray-100 pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-5">
              {/* Récapitulatif */}
              <div className="rounded-2xl bg-gray-50/80 border border-gray-100 p-3.5 space-y-1.5 mb-4">
                <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                  <span>
                    Sous-total · {cartItemsCount} article
                    {cartItemsCount > 1 ? "s" : ""}
                  </span>
                  <span className="font-black text-gray-700 tabular-nums">
                    {formatCurrency(Number(baseCartTotal) || 0)}
                  </span>
                </div>
                {wholesaleSavings > 0 && (
                  <div className="flex justify-between items-center text-xs font-bold text-green-600">
                    <span>Économies prix de gros</span>
                    <span className="tabular-nums">
                      -{formatCurrency(wholesaleSavings)}
                    </span>
                  </div>
                )}
                {promoApplied && (
                  <div className="flex justify-between items-center text-xs font-bold text-green-600">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={11} /> Code {promoApplied.code}
                    </span>
                    <span className="tabular-nums">
                      -{formatCurrency(Number(discountAmount) || 0)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1.5 border-t border-gray-200/70 text-base font-black text-gray-900">
                  <span>Total</span>
                  <span className="text-[#f56b2a] tabular-nums">
                    {formatCurrency(Number(cartTotal) || 0)}
                  </span>
                </div>
              </div>

              {/* Code promo */}
              {checkoutStage === "cart" && !promoApplied && (
                <div className="mb-4">
                  {isPromoOpen ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={promoCodeInput}
                        onChange={(e) => setPromoCodeInput(e.target.value)}
                        placeholder="Votre code promo"
                        autoFocus
                        className="flex-grow px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl font-bold text-xs sm:text-sm uppercase w-full no-global-border"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handlePromoApply}
                          disabled={!promoCodeInput.trim()}
                          loading={isApplyingPromo}
                          loadingText="Vérification..."
                          variant="primary"
                          size="sm"
                          className="flex-1 sm:flex-initial"
                        >
                          Appliquer
                        </Button>
                        {!isApplyingPromo && (
                          <button
                            onClick={() => setIsPromoOpen(false)}
                            className="px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            Annuler
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsPromoOpen(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-[#f56b2a] hover:border-[#f56b2a]/40 transition-colors"
                    >
                      <Tag size={12} /> Ajouter un code promo
                    </button>
                  )}
                </div>
              )}

              {promoApplied && (
                <div className="mb-4 flex items-center justify-between gap-2 bg-green-50 px-3.5 py-2 rounded-xl border border-green-100">
                  <span className="flex items-center gap-1.5 text-green-700 font-black text-xs">
                    <CheckCircle2 size={12} /> Code {promoApplied.code} appliqué
                  </span>
                  <button
                    onClick={() => setPromoApplied(null)}
                    aria-label="Retirer le code promo"
                    className="p-2 -m-1 text-green-600/60 hover:text-red-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="hidden md:flex flex-col gap-3">
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
                    icon={<ArrowRight size={18} />}
                    iconPosition="right"
                  >
                    Passer à la livraison
                  </Button>
                )}
                {(checkoutStage === "shipping" ||
                  checkoutStage === "payment") && (
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
                )}
              </div>

              {(checkoutStage === "shipping" ||
                checkoutStage === "payment") && (
                <div className="mt-3 md:mt-0">
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
                    ← Retour à l&apos;étape précédente
                  </Button>
                </div>
              )}
            </div>

            {/* Barre fixe mobile : Total + action principale */}
            <div
              className="md:hidden fixed left-0 right-0 bottom-0 z-[3000] bg-white/95 backdrop-blur-xl border-t border-gray-100"
              style={{
                paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
                bottom: keyboardOffset || 0,
              }}
            >
              <div className="px-3 pt-2.5">
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
                    size="lg"
                    className="!py-4 !text-sm uppercase tracking-wide"
                    icon={<ArrowRight size={16} />}
                    iconPosition="right"
                  >
                    Passer à la livraison
                  </Button>
                )}
                {(checkoutStage === "shipping" ||
                  checkoutStage === "payment") && (
                  <Button
                    form="checkout-form"
                    type="submit"
                    loading={isProcessingPayment}
                    loadingText="Chargement..."
                    fullWidth
                    size="lg"
                    className="!py-4 !text-sm uppercase tracking-wide"
                    icon={<ArrowRight size={16} />}
                    iconPosition="right"
                  >
                    {checkoutStage === "shipping"
                      ? "Passer au paiement"
                      : "Confirmer la commande"}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-gray-50/50 font-sans md:min-h-screen md:pb-0 overflow-x-hidden w-full max-w-[100vw]">
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
            user={{ id: user.id, name: user.name, email: user.email }}
            accountTab={location.pathname.split('/mon-compte/')[1] || 'commandes'}
            onBack={() => {
              if (isAccountViewUrl) safeNavigate("/");
              else setIsAccountView(false);
            }}
            notify={notify}
            onLogout={handleLogout}
            onUserUpdate={handleUserUpdate}
          />
        </div>
      )}

      {/* Global Notifications (Toasts) — contraintes mobile : pleine largeur
          bornée + respect de l'encoche (safe-area-top) */}
      <div className="fixed z-[99999] flex flex-col gap-3 sm:gap-4 pointer-events-none items-end left-3 right-3 sm:left-auto sm:right-6 top-[calc(env(safe-area-inset-top,0px)+14px)] sm:top-6">
        {toastNotifications.map((notif) => (
          <Toast key={notif.id} notification={notif} onRemove={removeToast} />
        ))}
      </div>

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
        <header className="bg-white border-b border-gray-100 sticky top-0 z-[100]" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <div className="container mx-auto px-4">
            {/* Top Utility Bar - Hidden on scroll or simplified for mobile */}

            {/* Main Interaction Bar */}
            <div className="flex items-center justify-between py-4">
              {/* Logo with modern typography */}
              <Link
                to="/"
                className="flex items-center cursor-pointer group flex-shrink-0"
                aria-label="PosMarket - Retour à l'accueil"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("all");
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
                    Pos<span className="text-[#f56b2a]">Market</span>
                  </span>
                  <span className="hidden md:block text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] leading-none mt-1">
                    Local & Express
                  </span>
                </div>
              </Link>

              {/* Search Bar - Desktop Only version */}
              <form
                className="hidden md:block flex-grow max-w-[600px] mx-8 relative"
                onSubmit={(e) => {
                  e.preventDefault();
                  // La recherche est live : on amène l'utilisateur sur la
                  // grille de résultats (accueil) si nécessaire.
                  if (!location.pathname.startsWith("/store/")) {
                    safeNavigate("/");
                  }
                }}
              >
                <div className="flex items-center bg-white rounded-2xl overflow-hidden border-[1.5px] border-[rgba(245,107,42,0.2)] hover:border-[rgba(245,107,42,0.5)] focus-within:border-[#f56b2a] focus-within:shadow-xl focus-within:shadow-orange-100/20 transition-all group">
                  <div className="pl-4 text-gray-600 group-focus-within:text-[#f56b2a]">
                    <Search size={18} strokeWidth={2.5} />
                  </div>
                  <input
                    id="desktop-search-input"
                    type="text"
                    aria-label="Rechercher un produit ou une boutique"
                    placeholder="Chercher un produit, une boutique..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-transparent py-3 px-3 text-sm font-bold text-gray-800 focus:outline-none placeholder-gray-400 no-global-border border-none"
                  />
                  <button
                    type="submit"
                    aria-label="Lancer la recherche"
                    className="bg-[#f56b2a] hover:bg-[#d55a20] active:bg-[#c04e15] text-white px-6 py-3 font-black text-sm transition-all cursor-pointer select-none"
                  >
                    Rechercher
                  </button>
                </div>
              </form>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <div className="relative group">
                  <Link
                    to="/cart"
                    aria-label={`Panier${cartItemsCount > 0 ? ` (${cartItemsCount} articles)` : ""}`}
                    onClick={() => {
                      if (checkoutStage === "success") {
                        setCheckoutStage("cart");
                        setCompletedOrderStores([]);
                        setCompletedOrderItems([]);
                        setCompletedOrderTotal(0);
                      }
                    }}
                    className="w-11 h-11 md:w-12 md:h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-900 group-hover:bg-[#f56b2a] group-hover:text-white transition-all active:scale-90"
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
                      <div key={cartItemsCount} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#f56b2a] border-2 border-white rounded-full flex items-center justify-center text-[10px] font-black text-white animate-pop">
                        {cartItemsCount}
                      </div>
                    )}
                  </Link>
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
                    className={`flex items-center gap-2.5 p-2 md:px-4 md:py-2.5 rounded-2xl transition-all active:scale-[0.98] group/auth border-[1.5px] ${user ? "bg-[#f56b2a]/5 border-[#f56b2a]/20 text-[#f56b2a]" : "bg-gray-50 border-gray-100 text-gray-700 hover:bg-[#f56b2a]/10 hover:text-[#f56b2a] hover:border-[#f56b2a]/20"}`}
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

            {/* Full Width Search Bar - Mobile Only (se replie au scroll) */}
            <div
              className={`md:hidden overflow-hidden ${headerCompact ? "h-0 opacity-0" : "opacity-100"}`}
            >
              <div className="flex items-center bg-white rounded-xl overflow-hidden border-[1.5px] border-[rgba(245,107,42,0.2)] hover:border-[rgba(245,107,42,0.5)] focus-within:border-[#f56b2a] focus-within:shadow-xl transition-all group">
                <div className="pl-3 text-gray-600 group-focus-within:text-[#f56b2a]">
                  <Search size={16} strokeWidth={2.5} />
                </div>
                <input
                  id="mobile-search-input"
                  type="text"
                  aria-label="Rechercher un produit ou une boutique"
                  placeholder="Je cherche..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setIsSearchOpen(true)}
                  className="w-full bg-transparent py-2 px-3 text-[11px] font-bold text-gray-800 focus:outline-none placeholder-gray-400 no-global-border border-none cursor-pointer"
                />
              </div>
            </div>

            {/* Dynamic Horizontal Categories - Desktop only (causes jitter on mobile sticky header) */}
            <div
              className={`relative overflow-hidden hidden md:block ${headerCompact ? "h-0 opacity-0 md:h-auto md:opacity-100" : "opacity-100"}`}
            >
              {/* En vue catégorie (?cat=), le header de page affiche déjà le
                  titre : pas de rangée de chips en doublon (mobile ET desktop). */}
              <div className={`items-center gap-2 py-2 overflow-x-auto no-scrollbar mask-fade-right -mx-4 px-4 whitespace-nowrap scroll-smooth ${!searchTerm && activeHomeCategory ? "hidden" : "flex"}`}>
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
            </div>
          </div>
        </header>
      )}

      {cartNotif && lastAddedProduct && (
        <div className="fixed top-4 right-4 left-4 md:left-auto md:w-[340px] z-[1100] duration-300 px-2 md:px-0">
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
                    placeholder="blur"
                    blurDataURL={PRODUCT_BLUR_DATA_URL}
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
                className="h-full bg-green-500/50"
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
              onClick={() => {
                // Fermer = abandon : on ne garde pas un filtre fantôme qui
                // fausserait la grille d'accueil au retour.
                setIsSearchOpen(false);
                setSearchTerm("");
              }}
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
                              action: () => {
                                setIsSearchOpen(false);
                                setSearchTerm("");
                              },
                            });
                          }}
                          className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group active:scale-[0.98]"
                        >
                          <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-inner overflow-hidden border-2 border-orange-50 relative">
                            {store.settings?.logo ? (
                              <Image
                                src={store.settings.logo ?? ""}
                                alt={store.name || "Boutique"}
                                fill
                                sizes="56px"
                                className="object-cover"
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
                              if (searchTerm.trim().length >= 2) setRecentSearches(saveRecentSearch(searchTerm));
                              safeNavigate(
                                `/product/${generateProductSlug(product)}`,
                                {
                                  action: () => {
                                    setIsSearchOpen(false);
                                    setSearchTerm("");
                                  },
                                },
                              );
                            }}
                            className="cursor-pointer"
                          >
                            <ProductCard
                              product={product}
                              onAddToCart={handleCardAddToCart}
                              onStoreSelect={(id) => {
                                safeNavigate(
                                  `/store/${product.storeSlug || id}`,
                                  {
                                    action: () => {
                                      setIsSearchOpen(false);
                                      setSearchTerm("");
                                    },
                                  },
                                );
                              }}
                              onPrefetch={() => warmProduct({ id: product.id, image: product.image })}
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
                        Pas de résultats pour &quot;{searchTerm}&quot;
                      </p>
                      <p className="text-gray-600 text-xs mt-1 font-bold">
                        Vérifiez l&apos;orthographe ou essayez un autre mot.
                      </p>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Recherches récentes */}
                {recentSearches.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                        <RotateCcw size={12} /> Recherches récentes
                      </h3>
                      <button
                        onClick={() => {
                          localStorage.removeItem(RECENT_SEARCHES_KEY);
                          setRecentSearches([]);
                        }}
                        className="text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Effacer
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((term) => (
                        <button
                          key={term}
                          onClick={() => {
                            setSearchTerm(term);
                            setRecentSearches(saveRecentSearch(term));
                          }}
                          className="px-3.5 py-2 bg-white hover:bg-orange-50 hover:text-[#f56b2a] rounded-full text-xs font-bold text-gray-600 border border-gray-100 transition-all active:scale-95"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                      onClick={() => {
                        setSearchTerm(tag);
                        setRecentSearches(saveRecentSearch(tag));
                      }}
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
        className={`container mx-auto ${selectedProductId ? "px-0" : "px-4"} ${selectedStoreParam || selectedProductId ? "pt-0 pb-4" : "py-4"} md:py-8`}
      >
        <Routes>
          <Route
            index
            element={
              <>
                {/* Hidden H1 for SEO - Important for index page */}
                <h1 className="sr-only">
                  PosMarket - Marketplace Express Premium
                </h1>

                {/* Hero Bannière Premium - Carousel */}
                {!searchTerm && selectedCategory === "all" && (
                  <div
                    className="mb-6 mt-1 md:mb-10 md:mt-6 relative group overflow-hidden rounded-[24px] md:rounded-[32px]"
                    onMouseEnter={() => setHeroPaused(true)}
                    onMouseLeave={() => setHeroPaused(false)}
                  >
                    <div
                      className="relative w-full flex transition-transform duration-700 ease-in-out"
                      style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                    >
                      {/* Slide 1 - Vendre */}
                      <div className="min-w-full relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#fff7f3] via-white to-[#fff1eb]" />
                        <div className="absolute -right-16 -top-16 w-64 h-64 md:w-80 md:h-80 bg-[#f56b2a]/8 rounded-full blur-3xl" />
                        <div className="absolute -left-10 bottom-0 w-40 h-40 bg-blue-100/40 rounded-full blur-3xl" />
                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-12 px-6 md:px-12 py-8 md:py-10 min-h-[240px] md:min-h-[280px]">
                          <div className="flex-1 text-center md:text-left">
                            <div className="inline-flex items-center gap-1.5 bg-[#f56b2a]/10 px-3 py-1 rounded-full mb-4 font-black text-[10px] text-[#f56b2a] uppercase tracking-widest">
                              <Zap size={12} fill="currentColor" /> Offre Commerçant
                            </div>
                            <h2 className="text-[26px] md:text-[38px] font-black text-gray-900 mb-3 tracking-tight leading-[1.1]">
                              C&apos;est le moment <br className="hidden md:block" />
                              <span className="text-[#f56b2a]">de vendre</span>
                            </h2>
                            <p className="text-gray-500 text-[13px] md:text-[15px] font-semibold mb-5 max-w-md mx-auto md:mx-0 leading-relaxed">
                              Boostez votre visibilité et attirez plus de clients
                              dès aujourd&apos;hui.
                            </p>
                            <Button
                              onClick={() => safeNavigate(user ? "/dashboard" : "/login")}
                              loading={isNavigating}
                              variant="secondary"
                              size="lg"
                            >
                              Commencer maintenant
                            </Button>
                          </div>
                          <div className="hidden md:flex items-center justify-center flex-shrink-0">
                            <div className="w-24 h-24 bg-[#f56b2a]/10 rounded-3xl flex items-center justify-center">
                              <Zap size={40} className="text-[#f56b2a]" fill="currentColor" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Slide 2 - Gestion */}
                      <div className="min-w-full relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#f0f9ff] via-white to-[#e0f2fe]/40" />
                        <div className="absolute -right-16 -top-16 w-64 h-64 md:w-80 md:h-80 bg-blue-400/8 rounded-full blur-3xl" />
                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-12 px-6 md:px-12 py-8 md:py-10 min-h-[240px] md:min-h-[280px]">
                          <div className="flex-1 text-center md:text-left">
                            <div className="inline-flex items-center gap-1.5 bg-blue-500/10 px-3 py-1 rounded-full mb-4 font-black text-[10px] text-blue-600 uppercase tracking-widest">
                              <ShieldCheck size={12} /> Gestion Pro
                            </div>
                            <h2 className="text-[26px] md:text-[38px] font-black text-gray-900 mb-3 tracking-tight leading-[1.1]">
                              Gérez votre <br className="hidden md:block" />
                              <span className="text-blue-500">stock facilement</span>
                            </h2>
                            <p className="text-gray-500 text-[13px] md:text-[15px] font-semibold mb-5 max-w-md mx-auto md:mx-0 leading-relaxed">
                              Un inventaire synchronisé et des alertes
                              automatiques pour ne jamais manquer une vente.
                            </p>
                            <Button
                              onClick={() => safeNavigate(user ? "/dashboard" : "/login")}
                              loading={isNavigating}
                              variant="secondary"
                              size="lg"
                            >
                              Commencer maintenant
                            </Button>
                          </div>
                          <div className="hidden md:flex items-center justify-center flex-shrink-0">
                            <div className="w-24 h-24 bg-blue-500/10 rounded-3xl flex items-center justify-center">
                              <ShieldCheck size={40} className="text-blue-500" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Slide 3 - Communauté */}
                      <div className="min-w-full relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#fff5f5] via-white to-[#fef2f2]" />
                        <div className="absolute -right-16 -top-16 w-64 h-64 md:w-80 md:h-80 bg-red-400/8 rounded-full blur-3xl" />
                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-12 px-6 md:px-12 py-8 md:py-10 min-h-[240px] md:min-h-[280px]">
                          <div className="flex-1 text-center md:text-left">
                            <div className="inline-flex items-center gap-1.5 bg-red-500/10 px-3 py-1 rounded-full mb-4 font-black text-[10px] text-red-500 uppercase tracking-widest">
                              <Heart size={12} fill="currentColor" /> Communauté
                            </div>
                            <h2 className="text-[26px] md:text-[38px] font-black text-gray-900 mb-3 tracking-tight leading-[1.1]">
                              Rejoignez <br className="hidden md:block" />
                              <span className="text-red-500">le succès</span>
                            </h2>
                            <p className="text-gray-500 text-[13px] md:text-[15px] font-semibold mb-5 max-w-md mx-auto md:mx-0 leading-relaxed">
                              Faites partie des 500+ commerçants qui ont déjà
                              transformé leur manière de vendre.
                            </p>
                            <Button
                              onClick={() => safeNavigate(user ? "/dashboard" : "/login")}
                              loading={isNavigating}
                              variant="secondary"
                              size="lg"
                            >
                              Commencer maintenant
                            </Button>
                          </div>
                          <div className="hidden md:flex items-center justify-center flex-shrink-0">
                            <div className="w-24 h-24 bg-red-500/10 rounded-3xl flex items-center justify-center">
                              <Heart size={40} className="text-red-500" fill="currentColor" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pagination Dots */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                      {[0, 1, 2].map((idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentSlide(idx)}
                          aria-label={`Slide ${idx + 1}`}
                          className="p-2 -m-1 flex items-center cursor-pointer"
                        >
                          <span
                            className={`h-[6px] rounded-full transition-all duration-300 ${currentSlide === idx ? "w-6 bg-gray-900" : "w-[6px] bg-gray-300"}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Partners */}
                {!searchTerm &&
                  selectedCategory === "all" &&
                  partnerStores.length > 0 && (
                    <div className="mb-7 md:mb-12">
                      <h2 className="text-xl font-black text-gray-900 mb-4 md:mb-6 tracking-tight">
                        Boutiques partenaires
                      </h2>
                      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
                        {partnerStores.slice(0, 6).map((store) => (
                          <div
                            key={store.id}
                            onClick={() =>
                              safeNavigate(`/store/${store.slug || store.id}`)
                            }
                            className="min-w-[200px] max-w-[220px] bg-white rounded-2xl border border-gray-100 shadow-sm cursor-pointer group active:scale-[0.98] transition-all overflow-hidden flex-shrink-0"
                          >
                            <div className="p-4">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner overflow-hidden border border-gray-100 relative flex-shrink-0">
                                  {store.settings?.logo ? (
                                    <Image
                                      src={store.settings.logo ?? ""}
                                      alt={store.settings?.name || "Boutique"}
                                      fill
                                      sizes="44px"
                                      className="object-cover"
                                    />
                                  ) : (
                                    <Store className="text-[#f56b2a]" size={22} />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-bold text-gray-900 text-[12px] leading-tight line-clamp-1">
                                    {store.settings?.name || "Boutique"}
                                  </h3>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                                <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md">
                                  {(store.products || []).filter(
                                    (p) => p.isOnline !== false && p.image,
                                  ).length}{" "}
                                  prod.
                                </span>
                                <span className="text-[10px] font-bold text-[#f56b2a] bg-orange-50 px-2 py-0.5 rounded-md">
                                  {formatNumber((store.views || 0) +
                                    (store.products?.reduce(
                                      (sum, p) => sum + (p.views || 0),
                                      0,
                                    ) || 0))}{" "}
                                  vues
                                </span>
                              </div>
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
                          <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-inner overflow-hidden border-2 border-orange-50 relative">
                            {store.settings?.logo ? (
                              <Image
                                src={store.settings.logo ?? ""}
                                alt={store.name || "Boutique"}
                                fill
                                sizes="56px"
                                className="object-cover"
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

                {/* Titre de section — masqué en page catégorie dédiée (?cat=)
                    car le header « ← Catégorie · N produits » fait déjà foi */}
                {!activeHomeCategory && (
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
                )}

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
                    {/* Home category page header */}
                    {!searchTerm && activeHomeCategory && (
                      <div className="flex items-center justify-between mb-5">
                        <Link
                          to="/"
                          className="flex items-center gap-2.5 min-w-0 active:opacity-60 transition-opacity"
                        >
                          <span className="w-9 h-9 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                            <ChevronLeft size={18} strokeWidth={3} />
                          </span>
                          <span className="text-base md:text-xl font-black text-gray-900 truncate max-w-[55vw]">
                            {activeHomeCategory}
                          </span>
                        </Link>
                        <span className="text-[11px] font-bold text-gray-400 flex-shrink-0">
                          {filteredProducts.length} produits
                        </span>
                      </div>
                    )}

                    <div className="relative space-y-7 md:space-y-12">
                      {searchTerm || activeHomeCategory ? (
                        /* Simple grid for search results / category page */
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6">
                          {pagedProducts.map((product) => (
                              <ProductCard
                                key={`${product.storeId}-${product.id}`}
                                product={product}
                                onAddToCart={handleCardAddToCart}
                                onBuyNow={handleCardBuyNow}
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
                                onPrefetch={() => warmProduct({ id: product.id, image: product.image })}
                                className="w-full"
                              />
                          ))}
                        </div>
                      ) : (
                        /* Grouped sections for browsing - 4 products per category on mobile */
                        (() => {
                          const groups: Record<string, typeof pagedProducts> =
                            {};
                          pagedProducts.forEach((p) => {
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

                          const renderCard = (product: StorefrontProduct) => (
                            <ProductCard
                              key={`${product.storeId}-${product.id}`}
                              product={product}
                              onAddToCart={handleCardAddToCart}
                              onBuyNow={handleCardBuyNow}
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
                              onPrefetch={() => warmProduct({ id: product.id, image: product.image })}
                              className="w-full"
                            />
                          );

                          // Mobile: max 4, avoid odd trailing card (3 -> 2),
                          // and hide single-product categories entirely
                          const mobileSlice = (arr: typeof pagedProducts) => {
                            const n = Math.min(4, arr.length);
                            return arr.slice(0, n === 3 ? 2 : n);
                          };

                          return sortedCats.map((cat) => {
                            const isSingle = groups[cat].length <= 1;
                            // Le titre de section fait doublon avec la chip
                            // active quand cette catégorie est filtrée.
                            const showGroupHeader =
                              selectedCategory === "all" ||
                              cat !== selectedCategory;
                            return (
                            <div
                              key={cat}
                              className="   duration-500"
                            >
                              {showGroupHeader && (
                                <div className={`${isSingle ? "hidden md:flex" : "flex"} items-center justify-between gap-3 mb-4`}>
                                  <h3 className="text-sm md:text-base font-black text-gray-900 truncate">
                                    {cat}
                                  </h3>
                                  <button
                                    onClick={() => {
                                      window.location.href = `/category/${categoryToSlug(cat)}`;
                                    }}
                                    onMouseEnter={() => {
                                      const catUrl = `/category/${categoryToSlug(cat)}`;
                                      const link = document.createElement("link");
                                      link.rel = "prefetch";
                                      link.href = catUrl;
                                      document.head.appendChild(link);
                                    }}
                                    className="flex-shrink-0 flex items-center gap-0.5 text-[11px] md:text-xs font-black text-[#f56b2a] active:opacity-60 transition-opacity"
                                  >
                                    Voir tout
                                    <ChevronRight size={13} strokeWidth={3} />
                                  </button>
                                </div>
                              )}
                              <div className={`${isSingle ? "hidden md:grid" : "grid"} grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-4 lg:grid-cols-5 md:gap-6`}>
                                {mobileSlice(groups[cat]).map(renderCard)}
                                {/* Desktop only: full category */}
                                <div className="hidden md:contents">
                                  {groups[cat].slice(4).map(renderCard)}
                                </div>
                              </div>
                            </div>
                            );
                          });
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
                ) : isInitialLoading ? (
                  null
                ) : activeStores.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                    <AlertCircle size={64} className="opacity-20 mb-4" />
                    <p className="text-xl font-black text-gray-600 text-center">
                      Impossible de charger le catalogue.
                    </p>
                    <p className="text-xs font-bold text-gray-400 mt-2 mb-6">
                      Vérifiez votre connexion internet puis réessayez.
                    </p>
                    <Button
                      onClick={() => window.location.reload()}
                      variant="primary"
                      size="md"
                      icon={<RotateCcw size={14} />}
                    >
                      Réessayer
                    </Button>
                  </div>
                ) : !isLoadingMore ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                    <Search size={64} className="opacity-20 mb-4" />
                    {searchTerm || selectedCategory !== "all" ? (
                      <>
                        <p className="text-xl font-black text-gray-600">
                          Aucun produit trouvé.
                        </p>
                        <p className="text-xs font-bold text-gray-400 mt-2 mb-6">
                          Essayez un autre terme ou élargissez vos filtres.
                        </p>
                        <Button
                          onClick={() => {
                            setSearchTerm("");
                            setSelectedCategory("all");
                          }}
                          variant="outline"
                          size="md"
                        >
                          Voir tout le catalogue
                        </Button>
                      </>
                    ) : (
                      <p className="text-xl font-black text-gray-600">
                        Aucun produit trouvé.
                      </p>
                    )}
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
                <div className={`grid grid-cols-2 gap-1 p-1 bg-white rounded-[20px] mb-5 max-w-full md:max-w-fit md:flex md:items-center md:mx-0 border border-gray-100/60 sticky top-0 md:static z-30 shadow-sm md:shadow-none ${tabsHidden ? "-translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"} transition-all duration-300`}>
                  <button
                    onClick={() => setStoreTab("products")}
                    className={`px-6 py-3 rounded-[16px] font-black text-[13px] md:text-sm transition-all flex items-center justify-center gap-2 ${storeTab === "products" ? "bg-white text-gray-900 shadow-md shadow-gray-200/50" : "text-gray-500 active:bg-gray-200/50"}`}
                  >
                    <ShoppingBasketIcon size={14} /> Produits
                  </button>
                  <button
                    onClick={() => setStoreTab("reviews")}
                    className={`px-6 py-3 rounded-[16px] font-black text-[13px] md:text-sm transition-all flex items-center justify-center gap-2 ${storeTab === "reviews" ? "bg-white text-gray-900 shadow-md shadow-gray-200/50" : "text-gray-500 active:bg-gray-200/50"}`}
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
                    {/* Store search */}
                    <div className="relative group mb-4">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#f56b2a] transition-colors">
                        <Search size={16} strokeWidth={2.5} />
                      </div>
                      <input
                        type="text"
                        placeholder="Chercher dans cette boutique..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-transparent rounded-full font-bold text-xs md:text-sm text-gray-700 focus:bg-white focus:border-[#f56b2a] focus:shadow-lg focus:shadow-orange-100/40 transition-all no-global-border placeholder:text-gray-400"
                      />
                    </div>

                    {/* Category page header */}
                    {activeStoreCategory && (
                      <div className="flex items-center justify-between mb-5">
                        <a
                          href={location.pathname}
                          onClick={(e) => {
                            e.preventDefault();
                            safeNavigate(location.pathname);
                          }}
                          className="flex items-center gap-2.5 min-w-0 active:opacity-60 transition-opacity"
                        >
                          <span className="w-9 h-9 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                            <ChevronLeft size={18} strokeWidth={3} />
                          </span>
                          <span className="text-base md:text-xl font-black text-gray-900 truncate max-w-[55vw]">
                            {activeStoreCategory}
                          </span>
                        </a>
                        <span className="text-[11px] font-bold text-gray-400 flex-shrink-0">
                          {filteredProducts.length} produits
                        </span>
                      </div>
                    )}

                    <div className="relative space-y-7 md:space-y-12">
                      {pagedProducts.length > 0 ? (
                        activeStoreCategory ? (
                          /* Full category grid */
                          <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-4 lg:grid-cols-5 md:gap-6">
                            {pagedProducts.map((product) => (
                              <ProductCard
                                key={`${product.storeId}-${product.id}`}
                                product={product}
                                onAddToCart={handleCardAddToCart}
                                onBuyNow={handleCardBuyNow}
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
                                onPrefetch={() => warmProduct({ id: product.id, image: product.image })}
                                className="w-full"
                              />
                            ))}
                          </div>
                        ) : (
                          /* Grouped sections - 4 products per category on mobile */
                          (() => {
                            const groups: Record<string, typeof pagedProducts> =
                              {};
                            pagedProducts.forEach((p) => {
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

                            const renderCard = (product: StorefrontProduct) => (
                              <ProductCard
                                key={`${product.storeId}-${product.id}`}
                                product={product}
                                onAddToCart={handleCardAddToCart}
                                onBuyNow={handleCardBuyNow}
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
                                onPrefetch={() => warmProduct({ id: product.id, image: product.image })}
                                className="w-full"
                              />
                            );

                            // Mobile: max 4, avoid odd trailing card (3 -> 2),
                            // and hide single-product categories entirely
                            const mobileSlice = (arr: typeof pagedProducts) => {
                              const n = Math.min(4, arr.length);
                              return arr.slice(0, n === 3 ? 2 : n);
                            };

                            return sortedCats.map((cat) => {
                              const isSingle = groups[cat].length <= 1;
                              // Pas de titre de groupe redondant avec la
                              // catégorie déjà filtrée via les chips.
                              const showGroupHeader =
                                selectedCategory === "all" ||
                                cat !== selectedCategory;
                              return (
                              <div
                                key={cat}
                                className="   duration-500"
                              >
                                {showGroupHeader && (
                                  <div className={`${isSingle ? "hidden md:flex" : "flex"} items-center justify-between gap-3 mb-4`}>
                                    <h3 className="text-sm md:text-base font-black text-gray-900 truncate">
                                      {cat}
                                    </h3>
                                    <button
                                      onClick={() => {
                                        window.location.href = `/category/${categoryToSlug(cat)}`;
                                      }}
                                      onMouseEnter={() => {
                                        const catUrl = `/category/${categoryToSlug(cat)}`;
                                        const link = document.createElement("link");
                                        link.rel = "prefetch";
                                        link.href = catUrl;
                                        document.head.appendChild(link);
                                      }}
                                      className="flex-shrink-0 flex items-center gap-0.5 text-[11px] md:text-xs font-black text-[#f56b2a] active:opacity-60 transition-opacity"
                                    >
                                      Voir tout
                                      <ChevronRight size={13} strokeWidth={3} />
                                    </button>
                                  </div>
                                )}
                                <div className={`${isSingle ? "hidden md:grid" : "grid"} grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-4 lg:grid-cols-5 md:gap-6`}>
                                  {mobileSlice(groups[cat]).map(renderCard)}
                                  {/* Desktop only: full category */}
                                  <div className="hidden md:contents">
                                    {groups[cat].slice(4).map(renderCard)}
                                  </div>
                                </div>
                              </div>
                              );
                            });
                          })()
                        )
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
                        {/* Rating Summary */}
                        {(() => {
                          const avg =
                            storeReviews.reduce(
                              (s, r) => s + (r.rating || 0),
                              0,
                            ) / storeReviews.length;
                          const dist = [5, 4, 3, 2, 1].map((n) => ({
                            n,
                            count: storeReviews.filter(
                              (r) => Math.round(r.rating) === n,
                            ).length,
                          }));
                          return (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5 flex items-center gap-5">
                              <div className="text-center flex-shrink-0">
                                <p className="text-3xl md:text-4xl font-black text-gray-900 leading-none">
                                  {avg.toFixed(1)}
                                </p>
                                <div className="flex gap-0.5 justify-center mt-1.5">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      size={12}
                                      fill={
                                        i < Math.round(avg)
                                          ? "currentColor"
                                          : "none"
                                      }
                                      className={
                                        i < Math.round(avg)
                                          ? "text-yellow-400"
                                          : "text-gray-200"
                                      }
                                    />
                                  ))}
                                </div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mt-1">
                                  {storeReviews.length} avis
                                </p>
                              </div>
                              <div className="flex-grow space-y-1">
                                {dist.map(({ n, count }) => (
                                  <div
                                    key={n}
                                    className="flex items-center gap-2"
                                  >
                                    <span className="text-[9px] font-black text-gray-400 w-6 text-right flex items-center justify-end gap-0.5">
                                      {n}<Star size={8} fill="currentColor" />
                                    </span>
                                    <div className="flex-grow h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                                        style={{
                                          width: `${storeReviews.length ? (count / storeReviews.length) * 100 : 0}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-[9px] font-bold text-gray-400 w-4">
                                      {count}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
                          {(showAllStoreReviews
                            ? storeReviews
                            : storeReviews.slice(0, 5)
                          ).map((review) => (
                            <div
                              key={review.id}
                              className="w-full bg-white p-4 rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md"
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

                        {storeReviews.length > 5 && !showAllStoreReviews && (
                          <button
                            onClick={() => setShowAllStoreReviews(true)}
                            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-sm shadow-xl transition-all hover:bg-[#f56b2a] flex items-center justify-center gap-2"
                          >
                            Voir plus d&apos;avis ({storeReviews.length - 5})
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
                          Les avis des clients sur les produits s&apos;afficheront
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

      {/* Footer - Home only */}
      {(location.pathname === "/" ||
        !location.pathname ||
        location.pathname === "") && <MarketplaceFooter />}

      {/* Sticky cart button - discovery pages only (home/store).
          Exclut /product : la fiche produit a sa propre barre d'action fixe. */}
      {cartItemsCount > 0 &&
        !isCartView &&
        !isFeedView &&
        checkoutStage !== "success" &&
        (location.pathname === "/" ||
          location.pathname.startsWith("/store/")) && (
        <div
          className="fixed left-0 right-0 z-[3000] px-3 pt-2"
          style={{
            bottom: keyboardOffset || "env(safe-area-inset-bottom, 0px)",
            paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <button
            onClick={() => {
              setIsCartButtonLoading(true);
              safeNavigate("/cart");
            }}
            disabled={isCartButtonLoading}
            className="pointer-events-auto w-full bg-[#f56b2a] text-white py-4 px-6 rounded-2xl shadow-[0_-10px_40px_rgba(245,107,42,0.45)] flex items-center justify-center gap-3 font-black transition-all active:scale-[0.98] hover:bg-[#e55a1b] relative overflow-hidden group disabled:opacity-80"
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
                <div className="relative flex-shrink-0">
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
                <span className="text-sm uppercase font-black whitespace-nowrap">
                  Voir mon panier <span className="opacity-40 mx-1">•</span>{" "}
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
                Rejoignez nos commerçants d&apos;élite et bénéficiez d&apos;une visibilité
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
                      Bénéficiez d&apos;un badge exclusif qui rassure vos acheteurs.
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
                    <PartyPopper size={20} className="inline text-[#f56b2a] -mt-1" /> Merci !
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
      {isImageModalOpen && (() => {
        const zoomSrc =
          currentZoomImage ||
          selectedDetailImage ||
          selectedProductDetails?.image ||
          "";
        const zoomIdx = zoomGallery.indexOf(zoomSrc);
        const canNavigate = zoomGallery.length > 1;
        const step = (dir: 1 | -1) => {
          if (!canNavigate || zoomIdx === -1) return;
          const next =
            (zoomIdx + dir + zoomGallery.length) % zoomGallery.length;
          setCurrentZoomImage(zoomGallery[next]);
        };
        return (
          <div
            className="fixed inset-0 z-[1200] bg-black/95 backdrop-blur-xl flex items-center justify-center duration-300"
            onClick={() => setIsImageModalOpen(false)}
          >
            <button
              onClick={() => setIsImageModalOpen(false)}
              className="absolute top-5 right-5 w-11 h-11 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all active:scale-95 z-50 flex items-center justify-center"
              aria-label="Fermer l'image"
            >
              <X size={22} />
            </button>
            <div
              className="w-full h-full p-4 md:p-14 flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative w-full h-full">
                <Image
                  src={zoomSrc}
                  fill
                  sizes="100vw"
                  className="object-contain shadow-2xl rounded-2xl select-none"
                  style={{ touchAction: "pinch-zoom" }}
                  alt="Full Size Product"
                />
                {canNavigate && (
                  <>
                    <button
                      onClick={() => step(-1)}
                      aria-label="Image précédente"
                      className="absolute left-1 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/10 hover:bg-white/25 rounded-full text-white flex items-center justify-center transition-all active:scale-90"
                    >
                      <ChevronLeft size={22} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => step(1)}
                      aria-label="Image suivante"
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/10 hover:bg-white/25 rounded-full text-white flex items-center justify-center transition-all active:scale-90"
                    >
                      <ChevronRight size={22} strokeWidth={2.5} />
                    </button>
                    <span className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] font-black px-2.5 py-1 rounded-full tabular-nums">
                      {zoomIdx + 1}/{zoomGallery.length}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 📲 Bannière installation PWA (mobile, accueil uniquement) */}
      {canInstallPwa && location.pathname === "/" && (
        <div
          className="md:hidden fixed left-3 right-3 z-[880]"
          style={{
            bottom: "calc(76px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="bg-gray-900 text-white rounded-2xl p-3 flex items-center gap-3 shadow-2xl">
            <div className="w-9 h-9 bg-[#f56b2a] rounded-xl grid place-items-center shrink-0">
              <ShoppingBasketIcon size={18} />
            </div>
            <div className="flex-grow min-w-0">
              <p className="text-xs font-black">Installer PosMarket</p>
              <p className="text-[10px] text-white/60 font-bold">
                Accès rapide depuis ton écran d&apos;accueil
              </p>
            </div>
            <button
              onClick={installPwa}
              className="px-3 py-2 bg-white text-gray-900 rounded-xl text-[10px] font-black uppercase shrink-0 active:scale-95 transition-transform"
            >
              Installer
            </button>
            <button
              onClick={dismissInstall}
              aria-label="Fermer"
              className="p-1.5 -m-1 text-white/50 hover:text-white shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
