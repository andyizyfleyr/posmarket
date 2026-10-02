'use client';

import React from 'react';
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
  if (!isOpen) return null;

  const defaultConfirmText = isAlertOnly ? "J'ai compris" : type === 'danger' ? 'Supprimer' : 'Confirmer';
  const resolvedConfirmText = confirmText || defaultConfirmText;

  const typeConfig = {
    danger: {
      icon: <Trash2 size={24} className="text-rose-600" />,
      iconBg: 'bg-rose-50 border-rose-100 text-rose-600',
      confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 focus:ring-rose-500',
    },
    warning: {
      icon: <AlertTriangle size={24} className="text-amber-600" />,
      iconBg: 'bg-amber-50 border-amber-100 text-amber-600',
      confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200 focus:ring-amber-500',
    },
    info: {
      icon: <Info size={24} className="text-blue-600" />,
      iconBg: 'bg-blue-50 border-blue-100 text-blue-600',
      confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 focus:ring-blue-500',
    },
    success: {
      icon: <CheckCircle size={24} className="text-emerald-600" />,
      iconBg: 'bg-emerald-50 border-emerald-100 text-emerald-600',
      confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 focus:ring-emerald-500',
    },
  }[type];

  return (
    <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6 md:p-7">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className={`p-3 rounded-2xl border ${typeConfig.iconBg} flex-shrink-0 shadow-sm`}>
              {typeConfig.icon}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          <h3 className="text-lg md:text-xl font-bold text-gray-900 leading-snug mb-2">
            {title}
          </h3>

          <div className="text-xs md:text-sm text-gray-600 font-normal leading-relaxed mb-6">
            {typeof message === 'string' ? <p>{message}</p> : message}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            {!isAlertOnly && (
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50"
              >
                {cancelText}
              </button>
            )}
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${typeConfig.confirmBtn}`}
            >
              {isLoading && <Loader2 size={16} className="animate-spin" />}
              <span>{resolvedConfirmText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
