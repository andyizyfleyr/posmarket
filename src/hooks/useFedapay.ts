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
    const FedaPay = (w.FedaPay || (typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>).FedaPay : undefined)) as {
      init?: (options: unknown) => { open: () => void };
    } | undefined;

    if (!FedaPay) {
      opts.onFailed?.(new Error('Module FedaPay non chargé'));
      return;
    }

    try {
      const pubKey = (opts.publicKey || '').trim();
      const detectedEnv = pubKey.startsWith('pk_live') ? 'live' : (opts.environment || 'sandbox');

      const widgetConfig = {
        public_key: pubKey,
        environment: detectedEnv,
        transaction: {
          amount: Math.round(Number(opts.amount) || 0),
          description: opts.description || '',
          custom_metadata: opts.description ? { partnerId: opts.description.split(':').pop()?.replace(/[^a-f0-9-]/gi, '') || '' } : {},
        },
        currency: { iso: 'XOF' },
        customer: {
          email: opts.customer?.email?.trim() || 'client@posmarket.com',
          firstname: opts.customer?.firstname?.trim() || 'Client',
          lastname: opts.customer?.lastname?.trim() || 'PosMarket',
        },
        onComplete: (res: { reason?: unknown; transaction?: Record<string, unknown> } | unknown) => {
          const r = res as { reason?: unknown; transaction?: Record<string, unknown> };
          const reasonStr = String(r?.reason || '').trim().toUpperCase();
          const txStatus = String(r?.transaction?.status || '').trim().toLowerCase();

          if (
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
            reasonStr === 'DIALOG DISMISSED' ||
            reasonStr === 'DIALOG_DISMISSED' ||
            reasonStr === 'DISMISSED'
          ) {
            opts.onFailed?.({ reason: 'dismissed', message: 'Paiement annulé' });
          } else {
            opts.onFailed?.(r || { message: reasonStr || 'Paiement non abouti' });
          }
        },
      };

      let widget: { open: () => void } | undefined;

      if (typeof FedaPay.init === 'function') {
        const res = FedaPay.init(widgetConfig);
        widget = (Array.isArray(res) ? res[0] : res) as { open: () => void };
      } else if (typeof FedaPay === 'function') {
        widget = (FedaPay as unknown as (cfg: unknown) => { open: () => void })(widgetConfig);
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
