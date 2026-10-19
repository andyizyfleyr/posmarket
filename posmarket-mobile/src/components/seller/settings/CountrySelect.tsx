/**
 * Sélecteur de pays — copie du composant `CountrySelect` du web (rendu mobile) :
 * bouton drapeau + nom, liste déroulante avec recherche, coche sur l'élément
 * sélectionné, état vide « Aucun pays trouvé ».
 */

import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, ChevronDown, Globe } from 'lucide-react-native';
import { COUNTRIES } from '@/constants/countries';

interface CountrySelectProps {
  value?: string;
  onChange: (countryName: string) => void;
}

export function CountrySelect({ value, onChange }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = useMemo(
    () => COUNTRIES.find((country) => country.name === value),
    [value],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return COUNTRIES;
    return COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(term) ||
        country.dialCode.includes(term) ||
        country.code.toLowerCase().includes(term),
    );
  }, [search]);

  return (
    <View>
      <Pressable
        onPress={() => {
          setSearch('');
          setOpen(true);
        }}
        style={styles.button}
        accessibilityLabel="Choisir le pays"
      >
        {selected ? (
          <Text style={styles.flag}>{selected.flag}</Text>
        ) : (
          <Globe size={15} color="#94A3B8" />
        )}
        <Text style={selected ? styles.value : styles.placeholder}>
          {selected ? selected.name : 'Sélectionner un pays'}
        </Text>
        <ChevronDown size={15} color="#94A3B8" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher un pays..."
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              style={styles.search}
            />
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {filtered.length === 0 ? (
                <Text style={styles.empty}>Aucun pays trouvé</Text>
              ) : (
                filtered.map((country) => {
                  const active = country.name === value;
                  return (
                    <Pressable
                      key={country.code}
                      onPress={() => {
                        onChange(country.name);
                        setOpen(false);
                      }}
                      style={styles.row}
                    >
                      <Text style={styles.flag}>{country.flag}</Text>
                      <Text style={styles.rowName}>{country.name}</Text>
                      {active ? <Check size={16} color="#F56B2A" /> : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(249,250,251,0.7)',
    borderRadius: 16,
  },
  flag: { fontSize: 18 },
  value: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  placeholder: { flex: 1, fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.25)',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 120,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  search: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: '#111827',
  },
  list: { maxHeight: 240, marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  rowName: { flex: 1, fontSize: 13, color: '#111827' },
  empty: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 16,
  },
});