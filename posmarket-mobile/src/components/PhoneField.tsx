/**
 * Champ téléphone avec indicatif — copie mobile du `PhoneInput` du web :
 * sélecteur de pays collé au champ, feuille « Pays et indicatif » (liste des
 * pays desservis), numéro national affiché sans l'indicatif, erreur éventuelle
 * sous le champ.
 */

import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, Globe, X } from 'lucide-react-native';
import { COLORS } from '@/theme';
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  parsePhoneNumber,
  type Country,
} from '@/constants/countries';

interface PhoneFieldProps {
  /** Numéro E.164 (indicatif + national) — comme le web. */
  value: string;
  onChange: (e164: string) => void;
  error?: string;
  onSubmitEditing?: () => void;
}

export function PhoneField({ value, onChange, error, onSubmitEditing }: PhoneFieldProps) {
  const insets = useSafeAreaInsets();
  const [countryOverride, setCountryOverride] = useState<Country | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Le pays affiché est *dérivé* du numéro (comme le web) : coller un numéro
  // étranger change le drapeau sans effet de synchronisation.
  const fallbackCountry = countryOverride || DEFAULT_COUNTRY;
  const parsed = parsePhoneNumber(value || '', fallbackCountry);
  const selectedCountry = parsed.country;

  const nationalDigits = useMemo(() => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    const dialDigits = selectedCountry.dialCode.replace(/\D/g, '');
    return digits.startsWith(dialDigits) ? digits.slice(dialDigits.length) : digits;
  }, [value, selectedCountry.dialCode]);

  const handleCountrySelect = (country: Country) => {
    setCountryOverride(country);
    setIsOpen(false);
    onChange(nationalDigits ? `${country.dialCode}${nationalDigits}` : '');
  };

  const handleChange = (raw: string) => {
    // Collage d'un numéro international : on re-parse entièrement.
    if (raw.startsWith('+') || raw.startsWith('00')) {
      const p = parsePhoneNumber(raw, selectedCountry);
      setCountryOverride(p.country);
      onChange(p.e164);
      return;
    }

    const digits = raw.replace(/\D/g, '');
    const dialDigits = selectedCountry.dialCode.replace(/\D/g, '');
    let nat = digits;
    if (nat.startsWith(dialDigits)) nat = nat.slice(dialDigits.length);
    onChange(nat ? `${selectedCountry.dialCode}${nat}` : '');
  };

  return (
    <View>
      <View style={[styles.field, error ? styles.fieldError : null]}>
        <Pressable
          style={styles.countryBtn}
          onPress={() => setIsOpen(true)}
          accessibilityLabel="Choisir le pays"
        >
          <Text style={styles.flag}>{selectedCountry.flag}</Text>
          <ChevronDown size={14} color={isOpen ? COLORS.brand : '#9CA3AF'} />
        </Pressable>
        <TextInput
          value={nationalDigits}
          onChangeText={handleChange}
          onSubmitEditing={onSubmitEditing}
          placeholder="Numéro de téléphone"
          placeholderTextColor="#D1D5DB"
          keyboardType="phone-pad"
          style={styles.input}
        />
      </View>
      {Boolean(error) && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetIcon}>
                <Globe size={18} color={COLORS.brand} />
              </View>
              <View style={styles.sheetTitles}>
                <Text style={styles.sheetTitle}>Pays et indicatif</Text>
                <Text style={styles.sheetSubtitle}>Sélectionnez le pays du numéro</Text>
              </View>
              <Pressable onPress={() => setIsOpen(false)} hitSlop={8} accessibilityLabel="Fermer">
                <X size={22} color="#9CA3AF" />
              </Pressable>
            </View>

            <FlatList
              data={COUNTRIES}
              keyExtractor={(c) => c.code}
              style={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = item.code === selectedCountry.code;
                return (
                  <Pressable
                    style={[styles.row, isSelected && styles.rowSelected]}
                    onPress={() => handleCountrySelect(item)}
                  >
                    <View style={styles.rowLeft}>
                      <Text style={styles.rowFlag}>{item.flag}</Text>
                      <Text
                        style={[styles.rowName, isSelected && styles.rowNameSelected]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.rowDial}>{item.dialCode}</Text>
                      {isSelected && <Check size={14} color={COLORS.brand} />}
                    </View>
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    width: '100%',
    backgroundColor: 'rgba(249,250,251,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(229,231,235,0.8)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  fieldError: {
    borderColor: '#FCA5A5',
  },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 14,
    paddingRight: 4,
    height: '100%',
  },
  flag: {
    fontSize: 18,
    lineHeight: 22,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 0,
  },
  errorText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F2',
  },
  sheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: '#FFF3ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitles: {
    flex: 1,
    minWidth: 0,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#002F34',
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(243,244,246,0.7)',
  },
  rowSelected: {
    backgroundColor: 'rgba(255,247,237,0.8)',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
    marginRight: 8,
  },
  rowFlag: {
    fontSize: 16,
    lineHeight: 20,
  },
  rowName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    flexShrink: 1,
  },
  rowNameSelected: {
    fontWeight: '700',
    color: COLORS.brand,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowDial: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: undefined }),
  },
});
