/**
 * Éléments partagés de l'espace vendeur mobile : case à cocher (les listes
 * commandes/clients du web utilisent `<input type="checkbox">`) et champ de
 * recherche avec icône.
 */

import React from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextStyle } from 'react-native';
import { Check, Search } from 'lucide-react-native';
import { COLORS } from '@/theme';

interface SellerCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  /** Taille de la case (web : 14 px mobile, 16 px desktop). */
  size?: number;
}

export function SellerCheckbox({ checked, onToggle, size = 14 }: SellerCheckboxProps) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={[
        styles.checkbox,
        { width: size, height: size, borderRadius: 4 },
        checked ? styles.checkboxChecked : styles.checkboxIdle,
      ]}
    >
      {checked ? <Check size={size - 4} color="#FFFFFF" strokeWidth={3.5} /> : null}
    </Pressable>
  );
}

interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  /** Icône affichée à droite (ex. le spinner de recherche). */
  accessory?: React.ReactNode;
  style?: TextStyle;
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
  accessory,
  style,
}: SearchFieldProps) {
  return (
    <View style={styles.searchWrap}>
      <View pointerEvents="none" style={styles.searchIcon}>
        <Search size={14} color="#9CA3AF" />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#C4C9D1"
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.searchInput, style]}
      />
      {accessory ? <View style={styles.searchAccessory}>{accessory}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  checkbox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  checkboxIdle: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  checkboxChecked: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
  },
  searchWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  searchAccessory: {
    position: 'absolute',
    right: 12,
    zIndex: 1,
  },
  searchInput: {
    paddingLeft: 34,
    paddingRight: 34,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
});
