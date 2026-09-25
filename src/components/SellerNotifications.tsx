'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  X,
  ShoppingCart,
  User,
  Star,
  PackageX,
  AlertTriangle,
  CreditCard,
  Store,
  Receipt,
  Info,
  BellOff,
} from 'lucide-react';
import { fetchSellerNotificationsAction, type SellerNotificationItem } from '@/app/actions/notifications';
import Toast from '@/components/Toast';
import { playAlertSound } from '@/utils/alert-sound';
import type { ToastNotification, NotificationType } from '@/types';

const STORAGE_KEY = 'seller_inapp_seen_v1';
const POLL_INTERVAL_MS = 1000;
const MAX_FEED_ITEMS = 50;

const TOAST_EVENT_TYPES: Record<string, NotificationType> = {
  NOUVELLE_COMMANDE: 'success',
  COMMANDE_A_PREPARER: 'info',
  NOUVEAU_CLIENT: 'info',
  NOUVEL_AVIS: 'info',
  RUPTURE_STOCK: 'error',
  ALERTE_STOCK_BAS: 'warning',
  RECU_PAIEMENT: 'success',
  PAIEMENT_INCIDENT: 'error',
  VENTE_POS: 'info',
  FACTURE_PAYEE: 'success',
  ABONNEMENT_ACTIVE: 'success',
  ABONNEMENT_EXPIRANT: 'warning',
  ABONNEMENT_EXPIRE: 'error',
  BOUTIQUE_APPROUVEE: 'success',
  BOUTIQUE_REJETEE: 'error',
  RECAP_VENTES_JOUR: 'info',
};

const PRIORITY_EVENTS: string[] = [
  'NOUVELLE_COMMANDE',
  'COMMANDE_A_PREPARER',
  'RUPTURE_STOCK',
  'ALERTE_STOCK_BAS',
  'NOUVEAU_CLIENT',
  'NOUVEL_AVIS',
  'ABONNEMENT_ACTIVE',
  'ABONNEMENT_EXPIRANT',
  'ABONNEMENT_EXPIRE',
  'RECAP_VENTES_JOUR',
];

function priorityRank(eventType: string): number {
  const idx = PRIORITY_EVENTS.indexOf(eventType);
  return idx === -1 ? PRIORITY_EVENTS.length : idx;
}

const EVENT_META: Record<string, { label: string; icon: React.ReactNode; tone: string }> = {
  NOUVELLE_COMMANDE: { label: 'Nouvelle commande', icon: <ShoppingCart size={15} />, tone: 'bg-orange-50 text-[#f56b2a]' },
  COMMANDE_A_PREPARER: { label: 'Commande à préparer', icon: <ShoppingCart size={15} />, tone: 'bg-blue-50 text-blue-600' },
  NOUVEAU_CLIENT: { label: 'Nouveau client', icon: <User size={15} />, tone: 'bg-emerald-50 text-emerald-600' },
  NOUVEL_AVIS: { label: 'Nouvel avis', icon: <Star size={15} />, tone: 'bg-amber-50 text-amber-600' },
  RUPTURE_STOCK: { label: 'Rupture de stock', icon: <PackageX size={15} />, tone: 'bg-red-50 text-red-600' },
  ALERTE_STOCK_BAS: { label: 'Stock bas', icon: <AlertTriangle size={15} />, tone: 'bg-amber-50 text-amber-600' },
  RECU_PAIEMENT: { label: 'Reçu de paiement', icon: <Receipt size={15} />, tone: 'bg-emerald-50 text-emerald-600' },
  PAIEMENT_INCIDENT: { label: 'Paiement en erreur', icon: <AlertTriangle size={15} />, tone: 'bg-red-50 text-red-600' },
  VENTE_POS: { label: 'Vente en boutique', icon: <Receipt size={15} />, tone: 'bg-orange-50 text-[#f56b2a]' },
  FACTURE_PAYEE: { label: 'Facture payée', icon: <Receipt size={15} />, tone: 'bg-green-50 text-green-600' },
  ABONNEMENT_ACTIVE: { label: 'Abonnement activé', icon: <CreditCard size={15} />, tone: 'bg-green-50 text-green-600' },
  ABONNEMENT_EXPIRANT: { label: 'Abonnement expirant', icon: <CreditCard size={15} />, tone: 'bg-amber-50 text-amber-600' },
  ABONNEMENT_EXPIRE: { label: 'Abonnement expiré', icon: <CreditCard size={15} />, tone: 'bg-red-50 text-red-600' },
  BOUTIQUE_APPROUVEE: { label: 'Boutique approuvée', icon: <Store size={15} />, tone: 'bg-green-50 text-green-600' },
  BOUTIQUE_REJETEE: { label: 'Boutique rejetée', icon: <Store size={15} />, tone: 'bg-red-50 text-red-600' },
  BOUTIQUE_EN_ATTENTE: { label: 'Boutique en attente', icon: <Store size={15} />, tone: 'bg-amber-50 text-amber-600' },
  RECAP_VENTES_JOUR: { label: 'Récap des ventes', icon: <Info size={15} />, tone: 'bg-gray-100 text-gray-600' },
  RAPPORT_VENDEUR_HEBDO: { label: 'Rapport hebdomadaire', icon: <Info size={15} />, tone: 'bg-gray-100 text-gray-600' },
};

const FALLBACK_META = { label: 'Notification', icon: <Bell size={15} />, tone: 'bg-gray-100 text-gray-600' };

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return 'à l\'instant';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'hier';
  return `il y a ${diffD} jours`;
}

export default function SellerNotifications() {
  const [items, setItems] = useState<SellerNotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const knownIdsRef = useRef<Set<string>>(new Set());
  const bootRef = useRef(true);
  const pollingRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const signatureRef = useRef('');

  const saveSeen = useCallback((ids: Set<string>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {}
  }, []);

  const pushToast = useCallback((title: string, message: string, type: NotificationType) => {
    const id = Math.random().toString(36).substr(2, 9);
    playAlertSound();
    setToasts((prev) => [...prev.slice(-3), { id, message, type, title }]);
  }, []);

  const loadSeen = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) seenRef.current = new Set(JSON.parse(raw) as string[]);
    } catch {}
  }, []);

  const poll = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const res = await fetchSellerNotificationsAction(MAX_FEED_ITEMS);
      if (!res || !res.items) return;

      const signature = res.items.map((i) => i.id).join('|');
      if (signatureRef.current === signature) return;
      signatureRef.current = signature;

      setItems(res.items);
      const nowIds = new Set(res.items.map((i) => i.id));
      const isBoot = bootRef.current;

      if (!isBoot) {
        for (const item of res.items) {
          if (!knownIdsRef.current.has(item.id)) {
            const type = TOAST_EVENT_TYPES[item.eventType];
            if (type) {
              pushToast(
                EVENT_META[item.eventType]?.label || FALLBACK_META.label,
                item.body,
                type,
              );
            }
          }
        }
      }

      knownIdsRef.current = nowIds;
      bootRef.current = false;
    } finally {
      pollingRef.current = false;
    }
  }, [pushToast]);

  useEffect(() => {
    loadSeen();
    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadSeen, poll]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unreadCount = items.filter((i) => !seenRef.current.has(i.id)).length;

  const orderedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      const rankA = priorityRank(a.eventType);
      const rankB = priorityRank(b.eventType);
      if (rankA !== rankB) return rankA - rankB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items]);

  const markAllRead = () => {
    const ids = new Set(items.map((i) => i.id));
    seenRef.current = new Set([...seenRef.current, ...ids]);
    saveSeen(seenRef.current);
  };

  const markItemRead = (id: string) => {
    if (!seenRef.current.has(id)) {
      seenRef.current = new Set([...seenRef.current, id]);
      saveSeen(seenRef.current);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative w-8 h-8 md:w-10 md:h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-800 active:scale-90 transition-all"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#f56b2a] text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Toast stack (nouveaux événements, visible sur n'importe quelle page vendeur) */}
      <div className="fixed top-16 md:top-24 right-3 md:right-8 z-[9998] flex flex-col gap-3 pointer-events-none items-end max-w-[90vw]">
        {toasts.map((t) => (
          <Toast key={t.id} notification={t} onRemove={(id) => setToasts((prev) => prev.filter((n) => n.id !== id))} />
        ))}
      </div>

      {open && (
        <div className="absolute right-0 top-10 md:top-12 w-[330px] md:w-[380px] bg-white rounded-2xl border border-gray-100 shadow-2xl z-[9998] overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <h4 className="text-sm font-bold text-gray-900">Notifications</h4>
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mt-0.5">
                {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est à jour'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-[10px] font-bold text-gray-600 transition-colors"
                >
                  <CheckCheck size={13} />
                  Tout lire
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors"
                aria-label="Fermer"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[55vh] min-h-[80px] divide-y divide-gray-50">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                  <BellOff size={20} className="text-gray-300" />
                </div>
                <p className="text-xs font-bold text-gray-500">Aucune notification</p>
                <p className="text-[9px] font-semibold text-gray-400 mt-1">
                  Les nouvelles commandes, alertes stock et avis apparaîtront ici.
                </p>
              </div>
            ) : (
              orderedItems.map((item) => {
                const meta = EVENT_META[item.eventType] || FALLBACK_META;
                const read = seenRef.current.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => markItemRead(item.id)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors ${
                      read ? 'bg-white hover:bg-gray-50' : 'bg-orange-50/40 hover:bg-orange-50/70'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.tone}`}>
                      {meta.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[11px] font-bold text-gray-900 truncate">{meta.label}</span>
                          {priorityRank(item.eventType) < PRIORITY_EVENTS.length && (
                            <span className="text-[7px] font-bold uppercase px-1 py-px rounded bg-[#f56b2a]/10 text-[#f56b2a] flex-shrink-0">
                              Prioritaire
                            </span>
                          )}
                        </span>
                        <span className="text-[9px] font-semibold text-gray-400 flex-shrink-0">{timeAgo(item.createdAt)}</span>
                      </span>
                      <span className="block text-[10px] font-medium text-gray-500 leading-snug mt-0.5 line-clamp-2">
                        {item.body}
                      </span>
                    </span>
                    {!read && <span className="w-2 h-2 rounded-full bg-[#f56b2a] flex-shrink-0 mt-1.5" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}