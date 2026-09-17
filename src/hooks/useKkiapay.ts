import { useState, useEffect, useCallback } from 'react';

type PendingHandlers = {
  onSuccess: (transactionId: string) => void;
  onFailed: (err?: unknown) => void;
};

let pendingHandlers: PendingHandlers | null = null;
let listenersInstalled = false;

function extractTransactionId(res: unknown): string {
  if (typeof res === 'string') return res;
  if (res && typeof res === 'object') {
    const r = res as Record<string, unknown>;
    return String(r.transactionId || r.id || r.token || '');
  }
  return '';
}

export interface KkiapayWidgetOptions {
  amount: number;
  key: string;
  sandbox: boolean;
  partnerId: string;
  data?: string;
  name?: string;
  email?: string;
  phone?: string;
  position?: string;
  theme?: string;
  onSuccess: (transactionId: string) => void;
  onFailed: (err?: unknown) => void;
}

export const useKkiapay = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as Record<string, unknown>;
    if (typeof (w as { openKkiapayWidget?: unknown }).openKkiapayWidget === 'function') {
      setReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.kkiapay.me/k.js';
    script.async = true;
    script.onload = () => setReady(true);
    script.onerror = () => setReady(false);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!ready || typeof window === 'undefined' || listenersInstalled) return;
    const w = window as unknown as Record<string, unknown>;
    const add = (name: string, cb: (x: unknown) => void) => {
      const fn = (w as unknown as Record<string, (cb: (x: unknown) => void) => void>)[name];
      if (typeof fn === 'function') fn(cb);
    };
    try {
      add('addSuccessListener', (res: unknown) => {
        if (pendingHandlers) pendingHandlers.onSuccess(extractTransactionId(res));
      });
      add('addFailedListener', (err: unknown) => {
        if (pendingHandlers) pendingHandlers.onFailed(err);
      });
      listenersInstalled = true;
    } catch {
      // ignore
    }
  }, [ready]);

  const openWidget = useCallback((opts: KkiapayWidgetOptions) => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as Record<string, unknown>;
    const open = (w as unknown as Record<string, (opts: Record<string, unknown>) => void>).openKkiapayWidget;
    if (typeof open !== 'function') {
      opts.onFailed(new Error('Module de paiement non chargé'));
      return;
    }
    pendingHandlers = {
      onSuccess: (id: string) => opts.onSuccess(id),
      onFailed: (err?: unknown) => opts.onFailed(err),
    };
    open({
      amount: String(opts.amount),
      key: opts.key,
      sandbox: opts.sandbox,
      position: opts.position || 'center',
      theme: opts.theme || '#f56b2a',
      paymentmethod: ['momo'],
      countries: ['BJ'],
      partnerId: opts.partnerId,
      data: opts.data || '',
      name: opts.name || '',
      email: opts.email || '',
      phone: opts.phone || '',
      callback: '',
    });
  }, []);

  return { ready, openWidget };
};