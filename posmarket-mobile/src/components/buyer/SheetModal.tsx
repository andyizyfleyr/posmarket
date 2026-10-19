/**
 * Modale générique — copie mobile du `Modal` du web
 * (`src/components/buyer/Modal.tsx`) : feuille basse, en-tête avec icône
 * orange clair, titre + sous-titre, croix de fermeture.
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
import { X } from 'lucide-react-native';
import { ToastViewport } from '@/components/ToastProvider';
import { COLORS } from '@/theme';

interface SheetModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  busy?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function SheetModal({
  visible,
  title,
  subtitle,
  icon,
  busy = false,
  onClose,
  children,
  footer,
}: SheetModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => !busy && onClose()}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => !busy && onClose()}
          accessibilityLabel="Fermer"
        />

        <View style={styles.panel}>
          <View style={styles.header}>
            {icon ? <View style={styles.iconBox}>{icon}</View> : null}
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {busy ? (
              <ActivityIndicator size="small" color={COLORS.brand} />
            ) : (
              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={styles.closeBtn}
                accessibilityLabel="Fermer"
              >
                <X size={22} color="#9CA3AF" />
              </Pressable>
            )}
          </View>

          {children}
          {footer}
        </View>

        {/* Les messages (erreurs, succès) restent visibles au-dessus de la feuille. */}
        <ToastViewport />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,47,52,0.4)',
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    backgroundColor: '#FFFFFF',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  closeBtn: {
    padding: 8,
  },
});

export default SheetModal;
