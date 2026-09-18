import { useState, useEffect, useCallback } from 'react';

export interface FedapayWidgetOptions {
  publicKey: string;
  amount: number;
  description?: string;
  environment?: 'sandbox' | 'live';
  customer?: {
    email?: string;
    firstname?: string;
    lastname?: string;
    phone_number?: {
      number?: string;
      country?: string;
    };
  };
  onSuccess?: (transaction: { id?: number; reference?: string; status?: string; [key: string]: unknown }) => void;
  onFailed?: (err?: unknown) => void;
}

export const useFedapay = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as Record<string, unknown>;
    if (w.FedaPay && (typeof w.FedaPay === 'object' || typeof w.FedaPay === 'function')) {
      setReady(true);
      return;
    }
    const existing = document.querySelector('script[src*="fedapay.com/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => setReady(true));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.fedapay.com/checkout.js?v=1.1.7';
    script.async = true;
    script.onload = () => setReady(true);
    script.onerror = () => setReady(false);
    document.head.appendChild(script);
  }, []);

  const openWidget = useCallback((opts: FedapayWidgetOptions) => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as Record<string, unknown>;
    const FedaPayObj = w.FedaPay as {
      init?: (options: unknown) => { open: () => void };
      CHECKOUT_COMPLETED?: unknown;
      DIALOG_DISMISSED?: unknown;
    } | ((options: unknown) => { open: () => void }) | undefined;

    if (!FedaPayObj) {
      opts.onFailed?.(new Error('Module FedaPay non chargé'));
      return;
    }

    try {
      const widgetConfig = {
        public_key: opts.publicKey,
        environment: opts.environment || 'sandbox',
        transaction: {
          amount: opts.amount,
          description: opts.description || '',
          custom_metadata: opts.description ? { partnerId: opts.description.split(':').pop() || '' } : {},
        },
        currency: { iso: 'XOF' },
        customer: opts.customer || {},
        onComplete: (res: { reason?: unknown; transaction?: Record<string, unknown> } | unknown) => {
          const r = res as { reason?: unknown; transaction?: Record<string, unknown> };
          const CHECKOUT_COMPLETED = (FedaPayObj as { CHECKOUT_COMPLETED?: unknown })?.CHECKOUT_COMPLETED ?? 'CHECKOUT COMPLETE';
          const DIALOG_DISMISSED = (FedaPayObj as { DIALOG_DISMISSED?: unknown })?.DIALOG_DISMISSED ?? 'DIALOG DISMISSED';

          const reasonStr = String(r?.reason || '').trim().toUpperCase();
          const txStatus = String(r?.transaction?.status || '').trim().toLowerCase();

          if (
            r?.reason === CHECKOUT_COMPLETED ||
            reasonStr === 'CHECKOUT COMPLETE' ||
            reasonStr === 'CHECKOUT_COMPLETED' ||
            reasonStr === 'CHECKOUT_COMPLETE' ||
            r?.reason === 1 ||
            txStatus === 'approved' ||
            txStatus === 'success' ||
            txStatus === 'transferred'
          ) {
            opts.onSuccess?.(r?.transaction || {});
          } else if (
            r?.reason === DIALOG_DISMISSED ||
            reasonStr === 'DIALOG DISMISSED' ||
            reasonStr === 'DIALOG_DISMISSED' ||
            reasonStr === 'DISMISSED'
          ) {
            opts.onFailed?.({ reason: 'dismissed', message: 'Paiement annulé' });
          } else {
            opts.onFailed?.(r);
          }
        },
      };

      let widget: { open: () => void; onComplete?: (handler: (res: unknown) => void) => void } | undefined;

      if (typeof FedaPayObj === 'object' && typeof FedaPayObj.init === 'function') {
        widget = FedaPayObj.init(widgetConfig) as { open: () => void };
      } else if (typeof FedaPayObj === 'function') {
        widget = FedaPayObj(widgetConfig);
      }

      if (widget && typeof (widget as { onComplete?: unknown }).onComplete === 'function') {
        (widget as { onComplete: (handler: (res: unknown) => void) => void }).onComplete((res: unknown) => {
          const r = res as { reason?: unknown; transaction?: Record<string, unknown> };
          const CHECKOUT_COMPLETED = (FedaPayObj as { CHECKOUT_COMPLETED?: unknown })?.CHECKOUT_COMPLETED ?? 'CHECKOUT_COMPLETED';
          if (
            r?.reason === CHECKOUT_COMPLETED ||
            r?.reason === 'CHECKOUT_COMPLETED' ||
            r?.reason === 1 ||
            (r?.transaction && (r.transaction.status === 'approved' || r.transaction.status === 'success'))
          ) {
            opts.onSuccess?.(r?.transaction || {});
          } else {
            opts.onFailed?.(r);
          }
        });
      }

      if (widget && typeof widget.open === 'function') {
        widget.open();
      } else {
        opts.onFailed?.(new Error('Impossible d\'ouvrir le widget FedaPay'));
      }
    } catch (e) {
      opts.onFailed?.(e);
    }
  }, []);

  return { ready, openWidget };
};
