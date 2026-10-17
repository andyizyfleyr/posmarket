'use client';

import React from 'react';
import { X } from 'lucide-react';

/**
 * Bottom sheet mobile.
 *
 * Panneau qui monte du bas de l'écran, par-dessus le contenu courant, sans
 * changer d'URL. Utilisé par la marketplace mobile (dépliage d'une catégorie
 * via « Voir tout »). Masqué à partir de `md` : la navigation classique reprend
 * la main sur grand écran.
 *
 * Caractéristiques :
 * - animation d'entrée/sortie (glissement + fondu du fond) ;
 * - fermeture par le fond, le bouton, la touche Échap ou un glissement vers le
 *   bas depuis l'en-tête ;
 * - verrouillage du scroll de la page tant que le sheet est ouvert ;
 * - réserve basse optionnelle (`bottomInset`) pour laisser visible et cliquable
 *   une barre fixe du bas de page (barre panier) ;
 * - le corps du sheet est son propre conteneur de scroll (les `sticky top-0`
 *   internes, comme la barre produit, restent collés en haut du sheet).
 */
type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** `full` : feuille presque plein écran ; `auto` : hauteur libre (max 85vh). */
  size?: 'auto' | 'full';
  /**
   * Hauteur (px) de la barre fixe du bas de page (ex : « Voir mon panier »).
   * La feuille s'arrête juste au-dessus : la barre reste visible et cliquable,
   * et les derniers éléments de la liste ne passent jamais dessous.
   */
  bottomInset?: number;
  /** Contenu collé en bas, hors zone de scroll. */
  footer?: React.ReactNode;
  /** Quand cette valeur change, le corps du sheet revient en haut. */
  resetScrollKey?: string | number;
  children: React.ReactNode;
};

const CLOSE_DRAG_THRESHOLD = 90;

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  size = 'auto',
  bottomInset = 0,
  footer,
  resetScrollKey,
  children,
}: BottomSheetProps) {
  const [mounted, setMounted] = React.useState(open);
  const [shown, setShown] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState(0);
  const dragRef = React.useRef({ startY: 0, active: false });
  const bodyRef = React.useRef<HTMLDivElement>(null);

  // Montage/démontage différés pour laisser jouer l'animation de sortie.
  React.useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setShown(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setShown(false);
    setDragOffset(0);
    const timer = window.setTimeout(() => setMounted(false), 300);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Échap pour fermer + blocage du scroll de la page derrière le sheet.
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Coupe aussi le pull-to-refresh natif du navigateur : un glissement vers
    // le bas depuis la feuille pouvait déclencher un vrai rechargement de page
    // (flash blanc + retour en haut) et donc fermer la feuille.
    const previousOverscroll = document.documentElement.style.overscrollBehaviorY;
    document.documentElement.style.overscrollBehaviorY = 'none';

    // Le sheet est masqué en CSS à partir de `md` : si l'écran s'élargit
    // pendant qu'il est ouvert (rotation, redimensionnement), on le referme
    // pour ne pas laisser la page verrouillée derrière une feuille invisible.
    const desktopQuery = window.matchMedia('(min-width: 768px)');
    const onBreakpointChange = (e: MediaQueryListEvent) => {
      if (e.matches) onClose();
    };
    desktopQuery.addEventListener('change', onBreakpointChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overscrollBehaviorY = previousOverscroll;
      desktopQuery.removeEventListener('change', onBreakpointChange);
    };
  }, [open, onClose]);

  const onHeaderTouchStart = (e: React.TouchEvent) => {
    dragRef.current = { startY: e.touches[0].clientY, active: true };
  };

  const onHeaderTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current.active) return;
    const dy = e.touches[0].clientY - dragRef.current.startY;
    setDragOffset(dy > 0 ? dy : 0);
  };

  const onHeaderTouchEnd = () => {
    dragRef.current.active = false;
    setDragOffset((current) => {
      if (current > CLOSE_DRAG_THRESHOLD) onClose();
      return 0;
    });
  };

  // Changement de contenu (ex : autre produit) : on repart du haut.
  React.useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [resetScrollKey]);

  if (!mounted) return null;

  // La feuille s'arrête au-dessus de la barre fixe du bas (barre panier) :
  // la barre garde son z-index supérieur et reste visible/cliquable.
  const hasInset = bottomInset > 0;
  const panelMaxHeight = hasInset
    ? `min(${size === 'full' ? '94vh' : '85vh'}, calc(100dvh - ${
        bottomInset + 8
      }px))`
    : undefined;

  return (
    <div
      // Marqueur lu par `usePullToRefresh` : aucune glissade démarrée ici ne
      // doit recharger la page (sinon le sheet se referme "tout seul").
      data-no-pull-refresh
      className="md:hidden fixed inset-0 z-[2500] flex items-end justify-center"
      style={hasInset ? { paddingBottom: `${bottomInset}px` } : undefined}
    >
      {/* Fond assombri : cliquer dessus ferme le sheet. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Fermer"
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          shown ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden ${
          size === 'full' ? 'h-[94vh]' : 'max-h-[85vh]'
        }`}
        style={{
          transform: shown ? `translateY(${dragOffset}px)` : 'translateY(100%)',
          transition: dragOffset > 0 ? 'none' : 'transform 300ms cubic-bezier(0.2, 0, 0, 1)',
          ...(panelMaxHeight ? { maxHeight: panelMaxHeight } : {}),
        }}
      >
        {/* En-tête : poignée de glissement + titre + fermeture. */}
        <div
          className="flex-none select-none bg-white"
          style={{ touchAction: 'none' }}
          onTouchStart={onHeaderTouchStart}
          onTouchMove={onHeaderTouchMove}
          onTouchEnd={onHeaderTouchEnd}
        >
          <div className="flex justify-center pt-2.5 pb-1">
            <span className="h-1 w-10 rounded-full bg-gray-200" aria-hidden="true" />
          </div>
          <div className="relative flex items-center justify-center gap-2 px-14 pb-2.5">
            {title ? (
              <h2 className="text-sm font-bold text-gray-900 text-center truncate">{title}</h2>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:bg-gray-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          {subtitle ? (
            <p className="px-4 pb-2 text-[11px] font-medium text-gray-400 text-center">
              {subtitle}
            </p>
          ) : null}
        </div>

        {/* Corps défilant (conteneur de scroll du sheet). */}
        <div ref={bodyRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {children}
        </div>

        {footer ? (
          <div className="flex-none border-t border-gray-100 bg-white">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export default BottomSheet;
