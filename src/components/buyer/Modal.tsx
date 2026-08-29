'use client';

import React from 'react';
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
}) => (
  <div className="fixed inset-0 z-[1000] flex items-end md:items-center justify-center">
    <div
      className="absolute inset-0 bg-[#002f34]/40 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
    />
    <div
      className={`relative bg-white w-full ${maxWidth} rounded-t-[32px] md:rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] md:max-h-[92vh]`}
    >
      <div className="p-5 border-b border-gray-100 flex items-center gap-3 shrink-0 sticky top-0 bg-white z-10">
        {icon && (
          <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center text-[#f56b2a] shrink-0">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-black text-[#002f34] tracking-tight truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] text-gray-400 font-bold truncate">{subtitle}</p>
          )}
        </div>
        <button
          onClick={() => !busy && onClose()}
          disabled={busy}
          className="p-2 text-gray-400 hover:text-gray-600 active:scale-90 transition-transform disabled:opacity-50"
          aria-label="Fermer"
        >
          <X size={22} />
        </button>
      </div>
      {children}
    </div>
  </div>
);