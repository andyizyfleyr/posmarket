/**
 * Modale de confirmation — copie mobile du `ConfirmationModal` du web :
 * icône par type (danger, warning, info, success), titre, message et boutons.
 */

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AlertTriangle, CheckCircle, Info, Trash2, X } from 'lucide-react-native';
import { ToastViewport } from '@/components/ToastProvider';

export type ConfirmationType = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmationType;
  isLoading?: boolean;
  isAlertOnly?: boolean;
}

const TYPE_CONFIG = {
  danger: {
    Icon: Trash2,
    color: '#E11D48',
    background: '#FFF1F2',
    border: '#FFE4E6',
    button: '#E11D48',
  },
  warning: {
    Icon: AlertTriangle,
    color: '#D97706',
    background: '#FFFBEB',
    border: '#FEF3C7',
    button: '#D97706',
  },
  info: {
    Icon: Info,
    color: '#2563EB',
    background: '#EFF6FF',
    border: '#DBEAFE',
    button: '#2563EB',
  },
  success: {
    Icon: CheckCircle,
    color: '#059669',
    background: '#ECFDF5',
    border: '#D1FAE5',
    button: '#059669',
  },
} as const;

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

  const config = TYPE_CONFIG[type];
  const Icon = config.Icon;
  const defaultConfirmText = isAlertOnly
    ? "J'ai compris"
    : type === 'danger'
      ? 'Supprimer'
      : 'Confirmer';

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => !isLoading && onClose()}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => !isLoading && onClose()}
          accessibilityLabel="Fermer"
        />
        <View style={styles.panel}>
          <View style={styles.topRow}>
            <View
              style={[
                styles.iconBox,
                { backgroundColor: config.background, borderColor: config.border },
              ]}
            >
              <Icon size={24} color={config.color} />
            </View>
            <Pressable
              onPress={onClose}
              disabled={isLoading}
              hitSlop={8}
              style={styles.closeBtn}
              accessibilityLabel="Fermer"
            >
              <X size={18} color="#9CA3AF" />
            </Pressable>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            {!isAlertOnly && (
              <Pressable
                onPress={onClose}
                disabled={isLoading}
                style={[styles.cancelBtn, isLoading && styles.disabled]}
              >
                <Text style={styles.cancelText}>{cancelText}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={onConfirm}
              disabled={isLoading}
              style={[
                styles.confirmBtn,
                { backgroundColor: config.button },
                isLoading && styles.disabled,
              ]}
            >
              {isLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
              <Text style={styles.confirmText}>{confirmText || defaultConfirmText}</Text>
            </Pressable>
          </View>
        </View>

        {/* Les messages (déconnexion, suppression…) restent visibles au-dessus. */}
        <ToastViewport />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EEF0F2',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconBox: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  closeBtn: {
    padding: 6,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 25,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 21,
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 8,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.5,
  },
});
