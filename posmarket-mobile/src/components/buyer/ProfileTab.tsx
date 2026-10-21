/**
 * Onglet « Profil » — photo, nom d'affichage, e-mail (lecture seule),
 * téléphone et déconnexion. Design aligné sur le reste de l'espace client.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { LogOut, Mail, Save, User as UserIcon } from 'lucide-react-native';
import { fetchBuyerProfile, updateBuyerProfile } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import { PhoneField } from '@/components/PhoneField';
import { isValidPhoneNumber } from '@/constants/countries';
import { COLORS } from '@/theme';

const PROFILE_CACHE_KEY = 'buyer_profile_cache';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

interface ProfileTabProps {
  onLogout: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({ onLogout }) => {
  const { user, updateUser, sessionExpired } = useAuth();
  const { notify } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<{ name?: string; phone?: string }>({});

  useEffect(() => {
    setName(user?.name || '');
  }, [user?.name]);

  useEffect(() => {
    if (user?.avatarUrl) setAvatarUrl(user.avatarUrl);
  }, [user?.avatarUrl]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchBuyerProfile();
        if (!active) return;
        if (res?.success && res.profile) {
          setAvatarUrl(res.profile.avatarUrl || null);
          const rawPhone = res.profile.phone || '';
          setPhone(rawPhone);
          void AsyncStorage.setItem(
            PROFILE_CACHE_KEY,
            JSON.stringify({ phone: rawPhone }),
          );
        } else if (res?.error === 'Unauthorized') {
          sessionExpired();
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
  }, [sessionExpired]);

  const handleSubmit = useCallback(async () => {
    const trimmedName = name.trim();
    const errors: { name?: string; phone?: string } = {};
    if (trimmedName.length < 2) errors.name = 'Le nom doit contenir au moins 2 caractères.';
    if (phone && !isValidPhoneNumber(phone)) errors.phone = 'Numéro de téléphone invalide.';
    setValidation(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const res = await updateBuyerProfile({
        fullName: trimmedName,
        phone: phone.trim(),
        avatarUrl,
      });
      if (res?.success) {
        notify('Profil mis à jour', 'success');
        updateUser({ name: trimmedName, avatarUrl: res.user?.avatarUrl ?? avatarUrl });
        void AsyncStorage.setItem(
          PROFILE_CACHE_KEY,
          JSON.stringify({ phone: phone.trim() }),
        );
      } else if (res?.error === 'Unauthorized') {
        sessionExpired();
      } else if (res?.error !== 'UnauthorizedStale') {
        notify(res?.error || 'Erreur lors de la mise à jour du profil.', 'error');
      }
    } catch {
      notify('Erreur de connexion. Veuillez réessayer.', 'error');
    } finally {
      setSaving(false);
    }
  }, [avatarUrl, name, notify, phone, sessionExpired, updateUser]);

  const handleAvatarPick = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        notify("Autorisez l'accès à vos photos pour choisir une image.", 'error');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      const mime = asset.mimeType || 'image/jpeg';
      if (!/^image\/(png|jpeg|jpg|webp)$/.test(mime)) {
        notify('Format non pris en charge. Utilisez JPEG, PNG ou WebP.', 'error');
        return;
      }
      if (asset.fileSize && asset.fileSize > MAX_AVATAR_BYTES) {
        notify('La photo ne doit pas dépasser 2 Mo.', 'error');
        return;
      }
      if (!asset.base64) {
        notify('Impossible de lire cette image.', 'error');
        return;
      }

      setAvatarBusy(true);
      setAvatarUrl(`data:${mime};base64,${asset.base64}`);
      notify('Photo prête. Enregistrez pour l’appliquer.', 'info');
    } catch {
      notify('Impossible de lire cette image.', 'error');
    } finally {
      setAvatarBusy(false);
    }
  }, [notify]);

  const initials = (name || user?.name || 'U')[0].toUpperCase();
  const busy = avatarBusy || saving;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        {/* Identité et photo : un seul bloc, pas deux avatars. */}
        <View style={styles.identity}>
          <View style={styles.avatarBox}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
                contentFit="cover"
                alt=""
              />
            ) : (
              <Text style={styles.avatarInitials}>{initials}</Text>
            )}
          </View>
          <View style={styles.identityText}>
            <Text style={styles.identityName} numberOfLines={1}>
              {user?.name}
            </Text>
            <Text style={styles.identityMail} numberOfLines={1}>
              {user?.email}
            </Text>
            <View style={styles.identityActions}>
              <Pressable
                onPress={handleAvatarPick}
                disabled={busy}
                style={({ pressed }) => [pressed && styles.pressed, busy && styles.disabled]}
              >
                <Text style={styles.linkText}>
                  {avatarBusy ? 'Chargement…' : 'Changer la photo'}
                </Text>
              </Pressable>
              {avatarUrl ? (
                <Pressable
                  onPress={() => setAvatarUrl(null)}
                  disabled={busy}
                  style={({ pressed }) => [pressed && styles.pressed, busy && styles.disabled]}
                >
                  <Text style={styles.linkDangerText}>Retirer</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.form}>
          <View>
            <Text style={styles.fieldLabel}>Nom d’affichage</Text>
            <View
              style={[styles.inputWrap, validation.name ? styles.inputError : null]}
            >
              <UserIcon size={14} color={COLORS.textFaint} />
              <TextInput
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  setValidation((v) => ({ ...v, name: undefined }));
                }}
                placeholder="Votre nom"
                placeholderTextColor={COLORS.textFaint}
                style={styles.input}
              />
            </View>
            {validation.name ? (
              <Text style={styles.errorText}>{validation.name}</Text>
            ) : null}
          </View>

          <View>
            <Text style={styles.fieldLabel}>E-mail</Text>
            <View style={styles.readOnlyField}>
              <Mail size={14} color={COLORS.textMuted} />
              <Text style={styles.readOnlyText} numberOfLines={1}>
                {user?.email}
              </Text>
            </View>
          </View>

          <View>
            <Text style={styles.fieldLabel}>Numéro de téléphone</Text>
            <PhoneField
              value={phone}
              onChange={(value) => {
                setPhone(value);
                setValidation((v) => ({ ...v, phone: undefined }));
              }}
              error={validation.phone}
            />
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={saving || loadingProfile}
            style={({ pressed }) => [
              styles.saveBtn,
              (saving || loadingProfile) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Save size={14} color="#FFFFFF" />
            )}
            <Text style={styles.saveText}>Enregistrer</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={onLogout}
        style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}
        accessibilityLabel="Me déconnecter"
      >
        <LogOut size={14} color={COLORS.danger} />
        <Text style={styles.logoutText}>Me déconnecter</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    color: COLORS.brand,
    fontSize: 18,
    fontWeight: '800',
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  identityName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
    letterSpacing: -0.2,
  },
  identityMail: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  identityActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  linkText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.brand,
  },
  linkDangerText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.danger,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.line,
    marginVertical: 14,
  },
  form: {
    gap: 14,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginBottom: 5,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.lineStrong,
    borderRadius: 12,
  },
  inputError: {
    borderColor: '#FECDD3',
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    padding: 0,
  },
  errorText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.danger,
    marginTop: 4,
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.lineStrong,
    borderRadius: 12,
  },
  readOnlyText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textMuted,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: COLORS.brand,
    borderRadius: 12,
  },
  saveText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.surface,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.danger,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default ProfileTab;
