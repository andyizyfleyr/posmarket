'use client';

import React, { useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { BuyerAddress, SaveAddressPayload } from './accountTypes';
import { isValidPhoneNumber } from '@/utils';
import { PhoneInput } from '@/components/PhoneInput';

interface AddressModalProps {
  address?: BuyerAddress | null;
  onClose: () => void;
  onSave: (data: SaveAddressPayload) => Promise<boolean>;
}

type FieldErrors = Partial<Record<'name' | 'fullName' | 'phone' | 'address' | 'city', string>>;

export const AddressModal: React.FC<AddressModalProps> = ({ address, onClose, onSave }) => {
  const [form, setForm] = useState({
    name: address?.name || '',
    fullName: address?.full_name || '',
    phone: address?.phone || '',
    city: address?.city || '',
    address: address?.address || '',
    isDefault: address?.is_default || false,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const setField = (key: keyof typeof form, value: string | boolean) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: FieldErrors = {};
    const name = form.name.trim();
    const fullName = form.fullName.trim();
    const phone = form.phone.trim();

    if (!name) errs.name = 'Ajoutez un libellé (ex : Maison).';
    if (!fullName) errs.fullName = 'Nom et prénom du destinataire requis.';
    const street = form.address.trim();
    const city = form.city.trim();

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
        isDefault: form.isDefault 
      });
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputClass = (hasError?: string) =>
    `w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm font-medium outline-none transition-colors focus:ring-2 ${
      hasError
        ? 'border-red-300 focus:ring-red-200/40'
        : 'border-line focus:ring-brand/20'
    }`;

  return (
    <Modal
title={address ? 'Modifier l’adresse' : 'Ajouter une adresse'}
      subtitle="Utilisée pour la livraison et la facturation"
      icon={<MapPin size={20} aria-hidden="true" />}
      busy={saving}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto" noValidate>
        <div className="space-y-1">
          <label htmlFor="addr-name" className="text-xs font-semibold text-gray-600">Libellé</label>
          <input
            id="addr-name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="Maison, Bureau…"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'addr-name-err' : undefined}
            className={inputClass(errors.name)}
          />
          {errors.name && (
            <p id="addr-name-err" className="text-xs font-medium text-red-600">{errors.name}</p>
          )}
        </div>

        <div className="space-y-1">
          <span className="block text-xs font-semibold text-gray-600">Téléphone du destinataire</span>
          <PhoneInput
            value={form.phone}
            onChange={(value) => setField('phone', value)}
            error={errors.phone}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="addr-fullname" className="text-xs font-semibold text-gray-600">Nom complet</label>
          <input
            id="addr-fullname"
            value={form.fullName}
            onChange={(e) => setField('fullName', e.target.value)}
            placeholder="Nom et prénom du destinataire"
            aria-invalid={!!errors.fullName}
            aria-describedby={errors.fullName ? 'addr-fullname-err' : undefined}
            className={inputClass(errors.fullName)}
          />
          {errors.fullName && (
            <p id="addr-fullname-err" className="text-xs font-medium text-red-600">{errors.fullName}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="addr-street" className="text-xs font-semibold text-gray-600">Adresse</label>
          <input
            id="addr-street"
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            placeholder="Rue, quartier, repère"
            autoComplete="street-address"
            aria-invalid={!!errors.address}
            aria-describedby={errors.address ? 'addr-street-err' : undefined}
            className={inputClass(errors.address)}
          />
          {errors.address && (
            <p id="addr-street-err" className="text-xs font-medium text-red-600">{errors.address}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="addr-city" className="text-xs font-semibold text-gray-600">Ville</label>
          <input
            id="addr-city"
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
            placeholder="Dakar"
            autoComplete="address-level2"
            aria-invalid={!!errors.city}
            aria-describedby={errors.city ? 'addr-city-err' : undefined}
            className={inputClass(errors.city)}
          />
          {errors.city && (
            <p id="addr-city-err" className="text-xs font-medium text-red-600">{errors.city}</p>
          )}
        </div>

        <label
          htmlFor="addr-default"
          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
            form.isDefault ? 'bg-brand-soft border border-brand/20' : 'bg-gray-50 border border-transparent'
          }`}
        >
          <input
            id="addr-default"
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setField('isDefault', e.target.checked)}
            className="w-5 h-5 rounded accent-brand"
          />
          <span className="text-sm font-medium text-gray-700">Définir par défaut</span>
        </label>

        <div className="flex gap-3 pt-2 pb-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 px-4 border-2 border-line text-gray-700 font-semibold text-sm rounded-2xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-[2] py-3 px-4 bg-brand text-white font-semibold text-sm rounded-2xl shadow-md shadow-orange-100 hover:bg-brand-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
};