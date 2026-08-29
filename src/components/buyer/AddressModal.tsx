'use client';

import React, { useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { BuyerAddress, SaveAddressPayload } from './accountTypes';
import { formatPhoneSN, isValidPhoneSN } from '@/utils';

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

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '');
    setField('phone', formatPhoneSN(digits));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: FieldErrors = {};
    const name = form.name.trim();
    const fullName = form.fullName.trim();
    const city = form.city.trim();
    const addr = form.address.trim();
    const phoneDigits = form.phone.replace(/\D/g, '');

    if (!name) errs.name = 'Ajoutez un label (ex : Maison).';
    if (!fullName) errs.fullName = 'Nom complet requis.';
    if (!city) errs.city = 'Ville requise.';
    if (!addr) errs.address = 'Adresse requise.';
    if (!phoneDigits) errs.phone = 'Téléphone requis.';
    else if (!isValidPhoneSN(phoneDigits)) errs.phone = 'Numéro invalide (ex : 77 000 00 00).';

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const ok = await onSave({ id: address?.id, name, fullName, phone: phoneDigits, city, address: addr, isDefault: form.isDefault });
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputClass = (hasError?: string) =>
    `w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm font-bold outline-none transition-all focus:ring-2 ${
      hasError
        ? 'border-red-200 focus:ring-red-200/30'
        : 'border-transparent focus:ring-[#f56b2a]/20'
    }`;

  return (
    <Modal
      title={address ? 'Modifier l\'adresse' : 'Ajouter une adresse'}
      subtitle="Livraison de vos commandes"
      icon={<MapPin size={20} />}
      busy={saving}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400">Label</label>
            <input
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Maison, Bureau..."
              className={inputClass(errors.name)}
            />
            {errors.name && <p className="text-[10px] font-bold text-red-400">{errors.name}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400">Téléphone</label>
            <input
              value={form.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              inputMode="tel"
              placeholder="77 000 00 00"
              className={inputClass(errors.phone)}
            />
            {errors.phone && <p className="text-[10px] font-bold text-red-400">{errors.phone}</p>}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400">Nom complet</label>
          <input
            value={form.fullName}
            onChange={(e) => setField('fullName', e.target.value)}
            placeholder="Nom et prénom du destinataire"
            className={inputClass(errors.fullName)}
          />
          {errors.fullName && <p className="text-[10px] font-bold text-red-400">{errors.fullName}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400">Adresse exacte</label>
          <input
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            placeholder="Quartier, rue, repère..."
            className={inputClass(errors.address)}
          />
          {errors.address && <p className="text-[10px] font-bold text-red-400">{errors.address}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400">Ville</label>
          <input
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
            placeholder="Dakar, Thiès..."
            className={inputClass(errors.city)}
          />
          {errors.city && <p className="text-[10px] font-bold text-red-400">{errors.city}</p>}
        </div>

        <label
          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
            form.isDefault ? 'bg-orange-50 border border-orange-100' : 'bg-gray-50 border border-transparent'
          }`}
        >
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setField('isDefault', e.target.checked)}
            className="w-5 h-5 rounded accent-[#f56b2a]"
          />
          <span className="text-xs font-bold text-gray-600">Définir par défaut</span>
        </label>

        <div className="flex gap-3 pt-2 pb-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 px-4 border-2 border-gray-100 text-gray-700 font-bold text-xs rounded-2xl hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-[2] py-3 px-4 bg-[#f56b2a] text-white font-bold text-xs rounded-2xl shadow-md shadow-orange-100 hover:bg-[#e55a1b] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
};