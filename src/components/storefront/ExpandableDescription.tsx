'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { RichDescription, AutoHighlights } from '@/components/storefront/RichDescription';
import { extractDescriptionHighlights } from '@/utils/product-description';

/**
 * Description repliable, entièrement AUTO-CONTENUE.
 *
 * Pourquoi ce composant existe : le couple état parent → props → deux
 * instances (carte mobile + section desktop) produisait un comportement
 * « déplie puis replie tout seul » sur le web. Ici, l'état vit localement :
 * aucun parent ne peut le réinitialiser, aucune double instance ne partage
 * quoi que ce soit.
 *
 * Mécanique :
 *  - mesure réelle du contenu (ResizeObserver) — plus de heuristique sur la
 *    longueur du texte pour décider si le repli sert à quelque chose ;
 *  - animation CSS pure (max-height + mask-image), jamais de classe d'un
 *    snapshot périmé ;
 *  - verrou de 400 ms contre la double activation du même appui.
 */
const COLLAPSED_HEIGHT = 128; // px — hauteur visible avant « Lire la suite »
const TOGGLE_LOCK_MS = 400;

export function ExpandableDescription({
  text,
  highlights,
  accentClass = 'text-brand',
  buttonClassName,
}: {
  text: string;
  highlights?: string[];
  accentClass?: string;
  buttonClassName?: string;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);

  const autoHighlights = highlights ?? extractDescriptionHighlights(text);
  const hasMore = contentHeight > COLLAPSED_HEIGHT + 8;

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setContentHeight(el.scrollHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
    // L'Observateur re-mesure tout changement de taille du contenu
    // (images, polices) sans jamais toucher à l'état `open`.
  }, []);

  const toggle = useCallback(() => {
    const now = Date.now();
    if (now - lockRef.current < TOGGLE_LOCK_MS) return;
    lockRef.current = now;
    setOpen((v) => !v);
  }, []);

  return (
    <div>
      <div
        className="relative overflow-hidden"
        style={{
          maxHeight: open || !hasMore ? contentHeight || 'none' : COLLAPSED_HEIGHT,
          transition: 'max-height 0.38s cubic-bezier(0.4, 0, 0.2, 1)',
          // Fondu piloté par l'état, jamais par une classe conditionnelle stale.
          WebkitMaskImage:
            !open && hasMore
              ? 'linear-gradient(to bottom, black 55%, transparent 100%)'
              : 'none',
          maskImage:
            !open && hasMore
              ? 'linear-gradient(to bottom, black 55%, transparent 100%)'
              : 'none',
        }}
      >
        <div ref={bodyRef}>
          <RichDescription text={text} accentClass={accentClass} />
          <AutoHighlights items={autoHighlights} accentClass={accentClass} />
        </div>
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={
            buttonClassName ??
            `mt-2 font-semibold text-[10px] uppercase tracking-wider flex items-center gap-0.5 active:brightness-95 transition-colors touch-manipulation select-none ${accentClass}`
          }
        >
          {open ? 'Réduire' : 'Lire la suite'}
          <ChevronRight
            size={10}
            className={`transition-transform duration-300 ${open ? '-rotate-90' : 'rotate-90'}`}
          />
        </button>
      )}
    </div>
  );
}
