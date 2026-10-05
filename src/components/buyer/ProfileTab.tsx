'use client';

import React, { useEffect, useState } from 'react';
import { Mail, User as UserIcon, LogOut, Save, Loader2 } from 'lucide-react';
import { updateBuyerProfileAction, fetchBuyerProfileAction } from '@/app/actions/marketplace';
import { isValidPhoneNumber } from '@/utils';
import { PhoneInput } from '@/components/PhoneInput';
import { NotifyFn } from './accountTypes';

interface ProfileTabProps {
  user: { id?: string; name: string; email: string; avatarUrl?: string | null };
  onUserUpdate: (updates: { name: string; avatarUrl?: string | null }) => void;
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl || null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [loadingProfile, setLoadingProfile] = useState(() => !initialProfile);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<{ name?: string; phone?: string }>({});

useEffect(() => {
    setName(user.name);
  }, [user.name]);

  useEffect(() => {
    if (user.avatarUrl) setAvatarUrl(user.avatarUrl);
  }, [user.avatarUrl]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchBuyerProfileAction();
        setAvatarUrl((res?.profile as { avatarUrl?: string | null } | undefined)?.avatarUrl || null);
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
        avatarUrl,
      });
if (res?.success) {
        notify?.('Profil mis à jour', 'success');
        onUserUpdate({
          name: trimmedName,
          avatarUrl: res.user?.avatarUrl ?? avatarUrl,
        });
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

  const handleAvatarPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Repartir de zero : sinon choisir le meme fichier deux fois ne declenche
    // pas l'evenement change.
    event.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      notify?.('Format non pris en charge. Utilisez JPEG, PNG ou WebP.', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      notify?.('La photo ne doit pas dépasser 2 Mo.', 'error');
      return;
    }
    setAvatarBusy(true);
    try {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('read'));
        reader.readAsDataURL(file);
      });
      setAvatarUrl(dataUri);
      notify?.('Photo prête. Enregistrez pour la appliquer.', 'info');
    } catch {
      notify?.('Impossible de lire cette image.', 'error');
    } finally {
      setAvatarBusy(false);
    }
  };

  const inputClass = (hasError?: string) =>
    `w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm font-semibold outline-none transition-all focus:ring-2 ${
      hasError
        ? 'border-red-200 focus:ring-red-200/30'
        : 'border-transparent focus:ring-brand/20'
    }`;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-5 space-y-5">
        <div className="flex items-center gap-4">
<div className="w-14 h-14 bg-gradient-to-tr from-brand to-orange-400 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-orange-200/50 overflow-hidden shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              (user.name || 'U')[0].toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-ink truncate">{user.name}</p>
            <p className="text-[10px] text-gray-400 font-semibold">Membre Marketplace</p>
          </div>
        </div>

        {/* Photo de profil */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-gray-400 px-1">Photo de profil</label>
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-tr from-brand to-orange-400 flex items-center justify-center text-white text-base font-bold shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (user.name || 'U')[0].toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-500 font-medium truncate">
                JPEG ou PNG, 2 Mo maximum.
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarBusy || saving}
                  className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-[11px] font-bold text-ink hover:border-brand disabled:opacity-50"
                >
                  {avatarBusy ? 'Envoi...' : avatarUrl ? 'Changer' : 'Choisir une photo'}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    disabled={avatarBusy || saving}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    Retirer
                  </button>
                )}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarPick}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-400 px-1">
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
              <p className="text-[10px] font-semibold text-red-400 px-1">{validation.name}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-400 px-1">E-mail</label>
            <div className="px-4 py-3 bg-gray-50 rounded-xl text-xs font-medium text-gray-500 flex items-center gap-2">
              <Mail size={14} />
              <span className="truncate">{user.email}</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-400 px-1">
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
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand text-white rounded-2xl font-bold text-xs shadow-md shadow-orange-100 hover:bg-[#e55a1b] active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Enregistrer mes informations
          </button>
        </form>
      </div>

      <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-4">
        <button
          onClick={onLogout}
          className="flex items-center gap-2 w-full py-3 px-3 bg-red-50 text-red-500 font-semibold text-xs rounded-xl border border-red-100 active:bg-red-100 active:scale-[0.98] transition-all"
        >
          <LogOut size={18} />
          Me déconnecter
        </button>
      </div>
    </div>
  );
};