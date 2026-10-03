'use client';

import React, { useEffect, useId, useRef } from 'react';
import { AlertTriangle, Trash2, Info, CheckCircle, X, Loader2 } from 'lucide-react';

export type ConfirmationType = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmationType;
  isLoading?: boolean;
  isAlertOnly?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText = 'Annuler',
  type = 'danger',
  isLoading = false,
  isAlertOnly = false,
}: ConfirmationModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus au premier rendu, Échap pour fermer, focus restitué à la fermeture.
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
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
      previouslyFocused?.focus?.();
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const defaultConfirmText = isAlertOnly
    ? "J'ai compris"
    : type === 'danger'
      ? 'Supprimer'
      : 'Confirmer';
  const resolvedConfirmText = confirmText || defaultConfirmText;

  const typeConfig = {
    danger: {
      icon: <Trash2 size={24} className="text-rose-600" aria-hidden="true" />,
      iconBg: 'bg-rose-50 border-rose-100',
      confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500',
    },
    warning: {
      icon: <AlertTriangle size={24} className="text-amber-600" aria-hidden="true" />,
      iconBg: 'bg-amber-50 border-amber-100',
      confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
    },
    info: {
      icon: <Info size={24} className="text-blue-600" aria-hidden="true" />,
      iconBg: 'bg-blue-50 border-blue-100',
      confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    },
    success: {
      icon: <CheckCircle size={24} className="text-emerald-600" aria-hidden="true" />,
      iconBg: 'bg-emerald-50 border-emerald-100',
      confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500',
    },
  }[type];

  return (
    <div
      className="fixed inset-0 z-modal bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={() => !isLoading && onClose()}
    >
      <div
        ref={panelRef}
        className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-line animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-6 md:p-7">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className={`p-3 rounded-2xl border flex-shrink-0 ${typeConfig.iconBg}`}>
              {typeConfig.icon}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
              aria-label="Fermer"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <h3 id={titleId} className="text-lg md:text-xl font-bold text-gray-900 leading-snug mb-2">
            {title}
          </h3>

          <div id={descriptionId} className="text-sm text-gray-600 leading-relaxed mb-6">
            {typeof message === 'string' ? <p>{message}</p> : message}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            {!isAlertOnly && (
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50"
              >
                {cancelText}
              </button>
            )}
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-colors focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${typeConfig.confirmBtn}`}
            >
              {isLoading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              <span>{resolvedConfirmText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}