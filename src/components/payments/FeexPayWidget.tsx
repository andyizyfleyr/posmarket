'use client';

import FeexPaySDK from 'react-sdk-feexpay';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Guichet FeexPay — React SDK officiel v2 (react-sdk-feexpay).
 *
 * Le SDK officiel v2 n'expose pas de bouton masquable : en mode
 * personnalisé, on monte donc le composant hors écran (left: -9999px, sans
 * transform/filter : la modale fixed inset-0 reste ancrée au viewport) et on
 * déclenche l'ouverture du guichet via l'événement `feexpay:trigger`, écoute
 * par le conteneur interne du SDK.
 *
 * Contrairement à l'ancien script UMD (`feexpay-javascript-sdk/index.js`), le
 * SDK v2 cible l'hôte adapté au mode choisi : `sandbox-api.feexpay.me` en
 * SANDBOX, `api-v2.feexpay.me` en LIVE — une boutique de test n'est validée
 * que si `mode="SANDBOX"` (et réciproquement en production).
 *
 * La modale n'appelle aucun callback quand l'utilisateur la referme sans
 * payer : on le détecte par son apparition puis sa disparition du DOM
 * (`reason = 'dismissed'`), faute de quoi l'appelant resterait bloqué.
 */
export interface FeexPayWidgetAttempt {
  key: string | number;
  shopId: string;
  token: string;
  amount: number;
  mode: 'SANDBOX' | 'LIVE';
  description?: string;
  /** Jeton de rapprochement serveur (stocké dans callback_info.partnerId). */
  callbackInfo?: string;
  currency?: string;
  firstName?: string;
  email?: string;
  /**
   * Appelée exactement une fois. `reference` est renseigné si le paiement est
   * encaissé ; sinon `reason` porte `'dismissed'`, `'open_timeout'` ou le
   * message remonté par le SDK.
   */
  onSettled: (reference: string | null, reason?: string) => void;
}

export default function FeexPayWidget({ attempt }: { attempt: FeexPayWidgetAttempt }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const attemptRef = useRef(attempt);
  useEffect(() => {
    attemptRef.current = attempt;
  });
  const settledRef = useRef(false);
  const seenModalRef = useRef(false);
  const startedAtRef = useRef(0);

  const emit = useCallback((reference: string | null, reason?: string) => {
    if (settledRef.current) return;
    settledRef.current = true;
    attemptRef.current.onSettled(reference, reason);
  }, []);

  useEffect(() => {
    startedAtRef.current = Date.now();
    const host = rootRef.current?.firstElementChild as HTMLElement | null;
    // Le conteneur interne du SDK écoute `feexpay:trigger` pour ouvrir la modale.
    host?.dispatchEvent(new Event('feexpay:trigger'));

    const timer = window.setInterval(() => {
      if (settledRef.current) {
        window.clearInterval(timer);
        return;
      }
      const modal = rootRef.current?.querySelector('.fixed.inset-0');
      if (modal) {
        seenModalRef.current = true;
        return;
      }
      if (seenModalRef.current) {
        window.clearInterval(timer);
        emit(null, 'dismissed');
        return;
      }
      if (Date.now() - (startedAtRef.current || Date.now()) > 12_000) {
        // La modale ne s'est jamais ouverte (boutique invalide / clé rejetée).
        window.clearInterval(timer);
        emit(null, 'open_timeout');
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [emit]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: 0 }}
    >
      <FeexPaySDK
        amount={Math.max(1, Math.round(Number(attempt.amount) || 0))}
        id={attempt.shopId.trim()}
        token={attempt.token}
        mode={attempt.mode === 'LIVE' ? 'LIVE' : 'SANDBOX'}
        currency={attempt.currency || 'XOF'}
        description={(attempt.description || '').slice(0, 40)}
        customId={attempt.callbackInfo}
        callback_info={attempt.callbackInfo ? { partnerId: attempt.callbackInfo } : undefined}
        first_name={attempt.firstName}
        email={attempt.email}
        buttonText="Payer"
        callback={(result) => {
          const status = String(result?.status || '').toUpperCase();
          if (status === 'SUCCESSFUL' || status === 'SUCCESS') {
            emit(String(result?.reference || '').trim() || null);
          } else {
            emit(null, result?.message || 'Paiement non abouti.');
          }
        }}
      />
    </div>
  );
}
