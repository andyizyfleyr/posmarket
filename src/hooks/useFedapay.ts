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
    if (typeof (w as { FedaPay?: unknown }).FedaPay === 'object' || typeof (w as { FedaPay?: unknown }).FedaPay === 'function') {
      setReady(true);
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
    const FedaPay = (w as { FedaPay?: unknown }).FedaPay;
    if (!FedaPay || typeof FedaPay !== 'function') {
      opts.onFailed?.(new Error('Module FedaPay non chargé'));
      return;
    }

    try {
      const widget = (FedaPay as (opts: unknown) => { open: () => void; onComplete?: (handler: (res: unknown) => void) => void })({
        public_key: opts.publicKey,
        environment: opts.environment || 'sandbox',
        transaction: {
          amount: opts.amount,
          description: opts.description || '',
          custom_metadata: opts.description ? { partnerId: opts.description.split(':').pop() || '' } : {},
        },
        customer: opts.customer || {},
        container: undefined,
      });

      if (widget && typeof (widget as { onComplete?: unknown }).onComplete === 'function') {
        (widget as { onComplete: (handler: (res: unknown) => void) => void }).onComplete((res: unknown) => {
          const r = res as { reason?: number; transaction?: Record<string, unknown> };
          if (r.reason === 1 || (r.transaction && r.transaction.status === 'approved')) {
            opts.onSuccess?.(r.transaction || {});
          } else {
            opts.onFailed?.(r);
          }
        });
      }

      if (widget && typeof widget.open === 'function') {
        widget.open();
      }
    } catch (e) {
      opts.onFailed?.(e);
    }
  }, []);

  return { ready, openWidget };
};
