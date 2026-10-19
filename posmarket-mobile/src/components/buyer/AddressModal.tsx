/**
 * Modale d'adresse de livraison — copie mobile de
 * `src/components/buyer/AddressModal.tsx` du web (champs, validations,
 * « Définir par défaut »).
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MapPin } from 'lucide-react-native';
import { SheetModal } from '@/components/buyer/SheetModal';
import { PhoneField } from '@/components/PhoneField';
import { isValidPhoneNumber } from '@/constants/countries';
import type { BuyerAddress } from '@/types';
import { COLORS } from '@/theme';

export interface SaveAddressPayload {
  id?: string;
  name: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  isDefault: boolean;
}

interface AddressModalProps {
  visible: boolean;
  address?: BuyerAddress | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (data: SaveAddressPayload) => Promise<boolean>;
}

type FieldErrors = Partial<Record<'name' | 'fullName' | 'phone' | 'address' | 'city', string>>;

export function AddressModal({
  visible,
  address,
  busy = false,
  onClose,
  onSave,
}: AddressModalProps) {
  const [form, setForm] = useState({
    name: '',
    fullName: '',
    phone: '',
    city: '',
    address: '',
    isDefault: false,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  // Réinitialise le formulaire à chaque ouverture (création ou édition).
  useEffect(() => {
    if (!visible) return;
    setForm({
      name: address?.name || '',
      fullName: address?.full_name || '',
      phone: address?.phone || '',
      city: address?.city || '',
      address: address?.address || '',
      isDefault: address?.is_default || false,
    });
    setErrors({});
  }, [visible, address]);

  const setField = (key: keyof typeof form, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = async () => {
    const errs: FieldErrors = {};
    const name = form.name.trim();
    const fullName = form.fullName.trim();
    const phone = form.phone.trim();
    const street = form.address.trim();
    const city = form.city.trim();

    if (!name) errs.name = 'Ajoutez un libellé (ex : Maison).';
    if (!fullName) errs.fullName = 'Nom et prénom du destinataire requis.';
    if (!phone) errs.phone = 'Téléphone requis.';
    else if (!isValidPhoneNumber(phone)) errs.phone = 'Numéro de téléphone invalide.';
    if (!street) errs.address = 'Adresse du domicile requise.';
    if (!city) errs.city = 'Ville requise.';

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const ok = await onSave({
        id: address?.id,
        name,
        fullName,
        phone,
        city,
        address: street,
        isDefault: form.isDefault,
      });
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  const isBusy = saving || busy;

  return (
    <SheetModal
      visible={visible}
      title={address ? 'Modifier l’adresse' : 'Ajouter une adresse'}
      subtitle="Utilisée pour la livraison et la facturation"
      icon={<MapPin size={20} color={COLORS.brand} />}
      busy={isBusy}
      onClose={onClose}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.form}
      >
        <View>
          <Text style={styles.label}>Libellé</Text>
          <TextInput
            value={form.name}
            onChangeText={(v) => setField('name', v)}
            placeholder="Maison, Bureau…"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, errors.name ? styles.inputError : null]}
          />
          {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}
        </View>

        <View>
          <Text style={styles.label}>Téléphone du destinataire</Text>
          <PhoneField
            value={form.phone}
            onChange={(v) => setField('phone', v)}
            error={errors.phone}
          />
        </View>

        <View>
          <Text style={styles.label}>Nom complet</Text>
          <TextInput
            value={form.fullName}
            onChangeText={(v) => setField('fullName', v)}
            placeholder="Nom et prénom du destinataire"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, errors.fullName ? styles.inputError : null]}
          />
          {errors.fullName ? <Text style={styles.error}>{errors.fullName}</Text> : null}
        </View>

        <View>
          <Text style={styles.label}>Adresse</Text>
          <TextInput
            value={form.address}
            onChangeText={(v) => setField('address', v)}
            placeholder="Rue, quartier, repère"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, errors.address ? styles.inputError : null]}
          />
          {errors.address ? <Text style={styles.error}>{errors.address}</Text> : null}
        </View>

        <View>
          <Text style={styles.label}>Ville</Text>
          <TextInput
            value={form.city}
            onChangeText={(v) => setField('city', v)}
            placeholder="Dakar"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, errors.city ? styles.inputError : null]}
          />
          {errors.city ? <Text style={styles.error}>{errors.city}</Text> : null}
        </View>

        <Pressable
          onPress={() => setField('isDefault', !form.isDefault)}
          style={[styles.checkRow, form.isDefault && styles.checkRowActive]}
        >
          <View style={[styles.checkbox, form.isDefault && styles.checkboxChecked]}>
            {form.isDefault ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <Text style={styles.checkLabel}>Définir par défaut</Text>
        </Pressable>

        <View style={styles.actions}>
          <Pressable
            onPress={onClose}
            disabled={isBusy}
            style={[styles.cancelBtn, isBusy && styles.disabled]}
          >
            <Text style={styles.cancelText}>Annuler</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={isBusy}
            style={[styles.saveBtn, isBusy && styles.disabled]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveText}>Enregistrer</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  form: {
    padding: 24,
    gap: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  inputError: {
    borderColor: '#FDA4AF',
  },
  error: {
    fontSize: 12,
    fontWeight: '500',
    color: '#DC2626',
    marginTop: 4,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  checkRowActive: {
    backgroundColor: COLORS.brandSoft,
    borderColor: 'rgba(245,107,42,0.2)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  checkLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.6,
  },
});

export default AddressModal;
