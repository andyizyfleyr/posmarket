'use client';

import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  busy?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  title,
  subtitle,
  icon,
  busy = false,
  onClose,
  children,
  maxWidth = 'max-w-sm',
}) => {
  const titleId = useId();
  const subtitleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // `onClose` et `busy` sont stabilisationes dans des refs : l'effet de
  // piégeage du focus ne doit dependre que du montage. Avec des dependances
  // directes, chaque render du parent recraitait `onClose` (arrow inline) et
  // rejouait l'effet, dont le `focus()` sur le premier focusable (le bouton de
  // fermeture) : le textarea perdait le focus et le clavier virtuel se
  // refermait sur mobile.
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  });

  // Échap pour fermer, piégeage du focus, focus initial et restauration.
  useEffect(() => {
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus initial uniquement si rien dans la modale n'a déjà le focus, et
    // jamais sur le champ de saisie : ouvrir le clavier sans que l'utilisateur
    // l'ait demandé est agressif, surtout sur mobile.
    if (!panel?.contains(document.activeElement)) {
      const focusables = panel?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const initial = Array.from(focusables || []).find(
        (el) => el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT',
      );
      initial?.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Ne rend le focus que si la modale le tenait encore (démontage, ou
      // fermeture alors qu'un champ avait le focus). Ne pas l'arracher à un
      // élément extérieur à la modale.
      if (previouslyFocused?.focus && panel?.contains(document.activeElement)) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-modal flex items-end md:items-center justify-center">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={`relative bg-white w-full ${maxWidth} rounded-t-panel md:rounded-panel shadow-2xl flex flex-col max-h-[90vh] md:max-h-[92vh]`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
      >
        <div className="p-5 border-b border-line flex items-center gap-3 shrink-0 sticky top-0 bg-white z-10">
          {icon && (
            <div className="w-10 h-10 bg-brand-soft rounded-2xl flex items-center justify-center text-brand shrink-0">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 id={titleId} className="text-base font-bold text-ink tracking-tight truncate">
              {title}
            </h3>
            {subtitle && (
              <p id={subtitleId} className="text-sm text-gray-500 font-medium truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            disabled={busy}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors disabled:opacity-50"
            aria-label="Fermer"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};