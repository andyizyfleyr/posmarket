'use client';

import React, { useEffect, useState } from 'react';
import { Mail, Phone, User as UserIcon, LogOut, Save, Loader2 } from 'lucide-react';
import { updateBuyerProfileAction, fetchBuyerProfileAction } from '@/app/actions/marketplace';
import { isValidPhoneNumber, formatPhoneNumber } from '@/utils';
import { PhoneInput } from '@/components/PhoneInput';
import { NotifyFn } from './accountTypes';

interface ProfileTabProps {
  user: { id?: string; name: string; email: string };
  onUserUpdate: (name: string) => void;
  onLogout: () => void;
  notify?: NotifyFn;
}

const PROFILE_CACHE_KEY = 'buyer_profile_cache';

function readProfileCache(): { phone?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function patchProfileCache(patch: { phone?: string }) {
  if (typeof window === 'undefined') return;
  try {
    const current = readProfileCache() || {};
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {}
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  user,
  onUserUpdate,
  onLogout,
  notify,
}) => {
  const initialProfile = readProfileCache();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(() => initialProfile?.phone || '');
  const [loadingProfile, setLoadingProfile] = useState(() => !initialProfile);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<{ name?: string; phone?: string }>({});

  useEffect(() => {
    setName(user.name);
  }, [user.name]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchBuyerProfileAction();
        if (active && res?.success && res.profile) {
          const rawPhone = res.profile.phone || '';
          setPhone(rawPhone);
          patchProfileCache({ phone: rawPhone });
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

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    setValidation((v) => ({ ...v, phone: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const errors: { name?: string; phone?: string } = {};

    if (trimmedName.length < 2) errors.name = 'Le nom doit contenir au moins 2 caractères.';
    if (phone && !isValidPhoneNumber(phone)) errors.phone = 'Numéro de téléphone invalide.';
    setValidation(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const res = await updateBuyerProfileAction({
        fullName: trimmedName,
        phone: phone.trim(),
      });
      if (res?.success) {
        notify?.('Profil mis à jour', 'success');
        onUserUpdate(trimmedName);
        patchProfileCache({ phone: phone.trim() });
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
              Numéro de téléphone
            </label>
            <PhoneInput
              value={phone}
              onChange={handlePhoneChange}
              disabled={loadingProfile}
              error={validation.phone}
            />
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