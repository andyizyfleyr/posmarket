'use client';

import FeexPaySDK from 'react-sdk-feexpay';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef } from 'react';

// Le SDK v2 injecte une feuille globale (reset Tailwind v3) APRÈS le CSS de
// l'app : elle basculerait la police globale (Inter → système) et forcerait
// le conteneur sur les paliers v3 (640–1536px). On réaffirme ici les règles
// que PosMarket ne veut pas voir basculer — sélecteurs plus spécifiques que
// ceux du SDK et injectés après lui (la durée des modules suit l'ordre
// d'import). Ce module n'est chargé que sur le parcours de paiement
// (import dynamique), jamais pendant le rendu de la page d'accueil.
//
// Le SDK ne prévoit pas de bouton masquable : on masque donc SON CONTENEUR
// (0×0, overflow hidden) mais jamais la modale — un `overflow` seul ne piège
// pas un descendant en `position: fixed`. Le portail vers document.body
// (plus bas) garantit que rien, dans l'arborescence de l'app, ne peut
// recentrer, clipper ou empiler la modale (backdrop-filter / transform /
// overflow sur un ancêtre casse le positionnement fixe).
if (typeof document !== 'undefined') {
  const guard = document.createElement('style');
  guard.setAttribute('data-posmarket-feexpay-guard', '');
  guard.textContent = [
    ":root :is(html, body) { font-family: 'Inter Variable', Inter, ui-sans-serif, system-ui, -apple-system, sans-serif !important; }",
    '.container.container { width: 100% !important; max-width: 96rem !important; }',
    // La modale du SDK est livrée en z-50 : elle passerait SOUS nos couches
    // (barre panier z-3000, en-têtes). On la hisse juste sous les toasts.
    '[data-feexpay-portal] .fixed.inset-0 { z-index: 9998 !important; }',
    // Garde-fou : la barre d\'en-tête (logo, marchand, fermeture) ne doit
    // jamais être écrasée à quelques pixels par le flex en colonne de la
    // modale lorsque son contenu dépasse max-h-[90vh].
    '[data-feexpay-portal] .max-w-md > .border-b { flex: 0 0 auto !important; min-height: 44px !important; }',
  ].join('\n');
  document.head.appendChild(guard);
}

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

  // Portail vers document.body : aucun ancêtre (backdrop-filter, transform,
  // overflow…) ne peut ancrer, clipper ou empiler la modale — le guichet
  // doit couvrir tout le viewport, y compris le panier PosMarket.
  return createPortal(
    <div
      ref={rootRef}
      data-feexpay-portal
      style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, overflow: 'hidden' }}
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
    </div>,
    document.body,
  );
}
