/**
 * Feuille de sélection — remplace les `<select>` du web (catégorie, unité,
 * durée, type d'option…). Liste groupée, défilable, avec l'option courante en
 * surbrillance orange.
 */

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { COLORS } from '@/theme';

export interface PickerOption {
  value: string;
  label: string;
  group?: string;
}

interface PickerSheetProps {
  visible: boolean;
  title?: string;
  options: PickerOption[];
  value?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function PickerSheet({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: PickerSheetProps) {
  const groups = options.reduce<Array<{ name: string | null; items: PickerOption[] }>>(
    (acc, option) => {
      const name = option.group ?? null;
      const existing = acc.find((g) => g.name === name);
      if (existing) existing.items.push(option);
      else acc.push({ name, items: [option] });
      return acc;
    },
    [],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {groups.map((group, groupIndex) => (
              <View key={group.name ?? `group-${groupIndex}`}>
                {group.name ? <Text style={styles.groupLabel}>{group.name}</Text> : null}
                {group.items.map((option) => {
                  const active = option.value === value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        onSelect(option.value);
                        onClose();
                      }}
                      style={[styles.row, active && styles.rowActive]}
                    >
                      <Text style={[styles.rowText, active && styles.rowTextActive]}>
                        {option.label}
                      </Text>
                      {active ? <Check size={16} color={COLORS.brand} strokeWidth={3} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '78%',
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  list: { paddingHorizontal: 12 },
  groupLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  rowActive: { backgroundColor: '#FFF7ED' },
  rowText: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  rowTextActive: { color: COLORS.brand, fontWeight: '700' },
});
