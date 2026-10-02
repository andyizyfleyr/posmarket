'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import ConfirmationModal, { ConfirmationType } from '@/components/ConfirmationModal';

export interface ConfirmDialogOptions {
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmationType;
}

export interface AlertDialogOptions {
  title?: string;
  message: string | React.ReactNode;
  confirmText?: string;
  type?: ConfirmationType;
}

interface ConfirmContextType {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  alert: (options: AlertDialogOptions | string) => Promise<void>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    type: ConfirmationType;
    isAlertOnly: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger',
    isAlertOnly: false,
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setModalState({
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText,
        cancelText: options.cancelText || 'Annuler',
        type: options.type || 'danger',
        isAlertOnly: false,
      });
    });
  }, []);

  const alert = useCallback((options: AlertDialogOptions | string): Promise<void> => {
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve();
      const isString = typeof options === 'string';
      setModalState({
        isOpen: true,
        title: isString ? 'Information' : options.title || 'Information',
        message: isString ? options : options.message,
        confirmText: isString ? "J'ai compris" : options.confirmText || "J'ai compris",
        type: isString ? 'info' : options.type || 'info',
        isAlertOnly: true,
      });
    });
  }, []);

  const handleClose = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  const handleConfirm = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}
      <ConfirmationModal
        isOpen={modalState.isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        type={modalState.type}
        isAlertOnly={modalState.isAlertOnly}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextType {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}
