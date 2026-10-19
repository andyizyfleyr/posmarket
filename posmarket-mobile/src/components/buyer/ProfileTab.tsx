/**
 * Onglet « Profil » — copie mobile de `src/components/buyer/ProfileTab.tsx` du
 * web : photo de profil, nom d'affichage, e-mail (lecture seule), téléphone et
 * déconnexion.
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
import { LinearGradient } from 'expo-linear-gradient';
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
          void AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ phone: rawPhone }));
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
        void AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ phone: phone.trim() }));
      } else if (res?.error === 'Unauthorized') {
        sessionExpired();
      } else {
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
      notify('Photo prête. Enregistrez pour la appliquer.', 'info');
    } catch {
      notify('Impossible de lire cette image.', 'error');
    } finally {
      setAvatarBusy(false);
    }
  }, [notify]);

  const initials = (name || user?.name || 'U')[0].toUpperCase();

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.identityRow}>
          <LinearGradient
            colors={[COLORS.brand, '#FB923C']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.identityAvatar}
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
                contentFit="cover"
                alt=""
              />
            ) : (
              <Text style={styles.identityInitials}>{initials}</Text>
            )}
          </LinearGradient>
          <View style={styles.identityText}>
            <Text style={styles.identityName} numberOfLines={1}>
              {user?.name}
            </Text>
            <Text style={styles.identityRole}>Membre Marketplace</Text>
          </View>
        </View>

        {/* Photo de profil */}
        <View>
          <Text style={styles.fieldLabel}>Photo de profil</Text>
          <View style={styles.avatarRow}>
            <LinearGradient
              colors={[COLORS.brand, '#FB923C']}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={styles.avatarCircle}
            >
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
            </LinearGradient>
            <View style={styles.avatarText}>
              <Text style={styles.avatarHint} numberOfLines={1}>
                JPEG ou PNG, 2 Mo maximum.
              </Text>
              <View style={styles.avatarButtons}>
                <Pressable
                  onPress={handleAvatarPick}
                  disabled={avatarBusy || saving}
                  style={[styles.chooseBtn, (avatarBusy || saving) && styles.disabled]}
                >
                  <Text style={styles.chooseText}>
                    {avatarBusy ? 'Envoi...' : avatarUrl ? 'Changer' : 'Choisir une photo'}
                  </Text>
                </Pressable>
                {avatarUrl ? (
                  <Pressable
                    onPress={() => setAvatarUrl(null)}
                    disabled={avatarBusy || saving}
                    style={(avatarBusy || saving) && styles.disabled}
                  >
                    <Text style={styles.removeText}>Retirer</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.form}>
          <View>
            <Text style={styles.fieldLabel}>Nom d&apos;affichage</Text>
            <View
              style={[styles.inputWrap, validation.name ? styles.inputError : null]}
            >
              <UserIcon size={15} color="#D1D5DB" />
              <TextInput
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  setValidation((v) => ({ ...v, name: undefined }));
                }}
                placeholder="Votre nom"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />
            </View>
            {validation.name ? <Text style={styles.errorText}>{validation.name}</Text> : null}
          </View>

          <View>
            <Text style={styles.fieldLabel}>E-mail</Text>
            <View style={styles.readOnlyField}>
              <Mail size={14} color="#6B7280" />
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
            style={[styles.saveBtn, (saving || loadingProfile) && styles.disabled]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Save size={16} color="#FFFFFF" />
            )}
            <Text style={styles.saveText}>Enregistrer mes informations</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.logoutCard}>
        <Pressable onPress={onLogout} style={styles.logoutBtn}>
          <LogOut size={18} color="#F43F5E" />
          <Text style={styles.logoutText}>Me déconnecter</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  identityAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  identityInitials: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  identityName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
  },
  identityRole: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  avatarText: {
    flex: 1,
    minWidth: 0,
  },
  avatarHint: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  avatarButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  chooseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chooseText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.ink,
  },
  removeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F43F5E',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  form: {
    gap: 16,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
  },
  inputError: {
    borderColor: '#FECDD3',
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    padding: 0,
  },
  errorText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FB7185',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  readOnlyText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: COLORS.brand,
    borderRadius: 16,
    shadowColor: '#FFEDD5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  saveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFF1F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F43F5E',
  },
  disabled: {
    opacity: 0.6,
  },
});

export default ProfileTab;
