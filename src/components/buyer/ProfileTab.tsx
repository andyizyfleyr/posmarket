'use client';

import React, { useEffect, useState } from 'react';
import { Mail, Phone, User as UserIcon, LogOut, Save, Loader2, Building2, FileSpreadsheet } from 'lucide-react';
import { updateBuyerProfileAction, fetchBuyerProfileAction } from '@/app/actions/marketplace';
import { isValidPhoneSN, formatPhoneSN } from '@/utils';
import { NotifyFn } from './accountTypes';

interface ProfileTabProps {
  user: { id?: string; name: string; email: string };
  onUserUpdate: (name: string) => void;
  onLogout: () => void;
  notify?: NotifyFn;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  user,
  onUserUpdate,
  onLogout,
  notify,
}) => {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState('');
  const [phoneRaw, setPhoneRaw] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [ninea, setNinea] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<{ name?: string; phone?: string }>({});

  useEffect(() => {
    setName(user.name);
  }, [user.name]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingProfile(true);
      try {
        const res = await fetchBuyerProfileAction();
        if (active && res?.success && res.profile) {
          setPhone(res.profile.phone || '');
          setPhoneRaw(res.profile.phone || '');
          setCompanyName((res.profile as any).companyName || '');
          setNinea((res.profile as any).ninea || '');
        }
      } catch {
        // silencieux : l'email reste visible, le téléphone reste vide
      } finally {
        if (active) setLoadingProfile(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '');
    const formatted = formatPhoneSN(digits);
    setPhoneRaw(digits);
    setPhone(formatted);
    setValidation((v) => ({ ...v, phone: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const errors: { name?: string; phone?: string } = {};

    if (trimmedName.length < 2) errors.name = 'Le nom doit contenir au moins 2 caractères.';
    if (phoneRaw && !isValidPhoneSN(phoneRaw)) errors.phone = 'Numéro de téléphone invalide.';
    setValidation(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const res = await updateBuyerProfileAction({
        fullName: trimmedName,
        phone: phoneRaw,
        companyName: companyName.trim(),
        ninea: ninea.trim(),
      });
      if (res?.success) {
        notify?.('Profil mis à jour', 'success');
        onUserUpdate(trimmedName);
        setPhoneRaw(phoneRaw);
      } else {
        notify?.(res?.error || 'Erreur lors de la mise à jour du profil.', 'error');
      }
    } catch {
      notify?.('Erreur de connexion. Veuillez réessayer.', 'error');
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
    <div className="space-y-4">
      <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-5 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-[#f56b2a] to-orange-400 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-orange-200/50">
            {(user.name || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-[#002f34] truncate">{user.name}</p>
            <p className="text-[10px] text-gray-400 font-bold">Membre Marketplace</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 px-1">
              Nom d&apos;affichage
            </label>
            <div className="relative">
              <UserIcon size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setValidation((v) => ({ ...v, name: undefined }));
                }}
                className={`${inputClass(validation.name)} pl-11`}
                placeholder="Votre nom"
              />
            </div>
            {validation.name && (
              <p className="text-[10px] font-bold text-red-400 px-1">{validation.name}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 px-1">E-mail</label>
            <div className="px-4 py-3 bg-gray-50 rounded-xl text-xs font-semibold text-gray-500 flex items-center gap-2">
              <Mail size={14} />
              <span className="truncate">{user.email}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 px-1">
              Téléphone (Sénégal)
            </label>
            <div className="relative">
              <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                inputMode="tel"
                placeholder="+221 77 000 00 00"
                className={`${inputClass(validation.phone)} pl-11 ${
                  loadingProfile ? 'opacity-50' : ''
                }`}
              />
            </div>
            {validation.phone && (
              <p className="text-[10px] font-bold text-red-400 px-1">{validation.phone}</p>
            )}
          </div>

          {/* Section B2B Pro */}
          <div className="pt-2 border-t border-gray-100 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-[#f56b2a]" />
              <span className="text-[11px] font-black uppercase tracking-wider text-gray-800">
                Informations Professionnelles (B2B / Devis)
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 px-1">
                Nom de l&apos;entreprise / Commerce
              </label>
              <div className="relative">
                <Building2 size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={`${inputClass()} pl-11`}
                  placeholder="Ex : Établissements Diallo & Frères"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 px-1">
                Numéro NINEA / RCCM
              </label>
              <div className="relative">
                <FileSpreadsheet size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  value={ninea}
                  onChange={(e) => setNinea(e.target.value)}
                  className={`${inputClass()} pl-11`}
                  placeholder="Ex : 001234567 2V3"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || loadingProfile}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#f56b2a] text-white rounded-2xl font-black text-xs shadow-md shadow-orange-100 hover:bg-[#e55a1b] active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Enregistrer mes informations
          </button>
        </form>
      </div>

      <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-4">
        <button
          onClick={onLogout}
          className="flex items-center gap-2 w-full py-3 px-3 bg-red-50 text-red-500 font-bold text-xs rounded-xl border border-red-100 active:bg-red-100 active:scale-[0.98] transition-all"
        >
          <LogOut size={18} />
          Me déconnecter
        </button>
      </div>
    </div>
  );
};