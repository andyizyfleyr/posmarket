import { useState, useEffect, useCallback, useRef } from 'react';

const FEEXPAY_SDK_SRC = 'https://api-v2.feexpay.me/feexpay-javascript-sdk/index.js';
const MOUNT_ID = 'feexpay-posmarket-mount';

export interface FeexpayWidgetOptions {
  shopId: string;
  token: string;
  amount: number;
  mode?: 'LIVE' | 'SANDBOX';
  description?: string;
  callbackInfo?: string;
  currency?: string;
  onSuccess?: (res: {
    reference?: string | null;
    status?: string;
    transaction_id?: string;
    message?: string;
    [key: string]: unknown;
  }) => void;
  onFailed?: (err?: unknown) => void;
}

interface FeexpayButtonApi {
  init: (containerId: string, options: Record<string, unknown>) => void;
  validateShop: (shopId: string) => Promise<boolean>;
  showPaymentModal: () => void;
  hidePaymentModal: () => void;
}

export const useFeexpay = () => {
  const [ready, setReady] = useState(false);
  const settledRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as Record<string, unknown>;
    if (w.FeexPayButton) {
      const id = setTimeout(() => setReady(true), 0);
      return () => clearTimeout(id);
    }
    const existing = document.querySelector(`script[src="${FEEXPAY_SDK_SRC}"]`);
    if (existing) {
      const onLoad = () => setReady(true);
      existing.addEventListener('load', onLoad);
      return () => existing.removeEventListener('load', onLoad);
    }
    const script = document.createElement('script');
    script.src = FEEXPAY_SDK_SRC;
    script.async = true;
    script.onload = () => setReady(true);
    script.onerror = () => setReady(false);
    document.head.appendChild(script);
    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, []);

  const getApi = useCallback((): FeexpayButtonApi | undefined => {
    if (typeof window === 'undefined') return undefined;
    const w = window as unknown as Record<string, unknown>;
    const api = w.FeexPayButton as FeexpayButtonApi | undefined;
    return api && typeof api.init === 'function' ? api : undefined;
  }, []);

  const openWidget = useCallback(
    (opts: FeexpayWidgetOptions) => {
      if (typeof window === 'undefined') return;
      const api = getApi();
      if (!api) {
        opts.onFailed?.(new Error('Module FeexPay non chargé'));
        return;
      }

      settledRef.current = false;
      const settle = (fn: () => void) => {
        if (settledRef.current) return;
        settledRef.current = true;
        fn();
      };

      try {
        // Chaque init crée une nouvelle modale : on nettoie la précédente.
        document.querySelectorAll('.feexpay-modal-overlay').forEach(el => el.remove());

        let mount = document.getElementById(MOUNT_ID);
        if (!mount) {
          mount = document.createElement('div');
          mount.id = MOUNT_ID;
          mount.style.display = 'none';
          document.body.appendChild(mount);
        }

        api.init(MOUNT_ID, {
          id: (opts.shopId || '').trim(),
          amount: Math.round(Number(opts.amount) || 0),
          token: opts.token,
          mode: opts.mode === 'LIVE' ? 'LIVE' : 'SANDBOX',
          currency: opts.currency || 'XOF',
          description: opts.description || '',
          callback_info: opts.callbackInfo || '',
          callback: (res: { status?: string; reference?: string | null; transaction_id?: string; message?: string }) => {
            const status = String(res?.status || '').toUpperCase();
            if (status === 'SUCCESSFUL' || status === 'SUCCESS') {
              settle(() => opts.onSuccess?.(res));
            } else {
              settle(() => opts.onFailed?.({ message: res?.message, reference: res?.reference, status }));
            }
          },
        });

        // La modale ne s'affiche qu'une fois la boutique validée (fetch async).
        let attempts = 0;
        let shown = false;
        const timer = window.setInterval(() => {
          if (settledRef.current) {
            window.clearInterval(timer);
            return;
          }
          const overlay = document.querySelector('.feexpay-modal-overlay');
          if (!overlay) {
            window.clearInterval(timer);
            settle(() => opts.onFailed?.(new Error('Guichet FeexPay indisponible.')));
            return;
          }

          if (overlay.classList.contains('active')) {
            shown = true;
            return;
          }

          if (shown) {
            // L'utilisateur a refermé la modale sans payer.
            window.clearInterval(timer);
            settle(() => opts.onFailed?.({ reason: 'dismissed', message: 'Paiement annulé' }));
            return;
          }

          api.showPaymentModal();
          attempts += 1;
          if (attempts > 60) {
            window.clearInterval(timer);
            settle(() =>
              opts.onFailed?.(
                new Error('Impossible d\'ouvrir le guichet FeexPay (shop ID ou clé API invalide).'),
              ),
            );
          }
        }, 50);
      } catch (e) {
        settle(() => opts.onFailed?.(e));
      }
    },
    [getApi],
  );

  return { ready, openWidget };
};
