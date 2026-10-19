/**
 * Réglages vendeur — copie fidèle de `src/views/SettingsView.tsx` du web
 * (rendu mobile < 768 px) : onglets Boutique / Profil / Équipe / Promos,
 * section B2B, modale « Nouvel Employé », confirmation de suppression.
 *
 * Adaptations mobiles assumées :
 * - les onglets sont pilotés par un état local (le web lit `?tab=` de l'URL) ;
 * - les toasts sont affichés via le système global (`notify` n'est jamais
 *   fourni par la page web : ces messages y sont donc visibles seulement ici) ;
 * - les images (logo, photo de profil) passent par `expo-image-picker` puis
 *   base64, comme les autres écrans ;
 * - le `<select>` « Attribuer à la boutique » devient `PickerSheet`.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  Building,
  Camera,
  CheckSquare,
  FileText,
  Info,
  Loader2,
  Mail,
  Plus,
  Save,
  ShieldCheck,
  Square,
  Store,
  Tag,
  Trash2,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react-native';
import { useToast } from '@/components/ToastProvider';
import ConfirmationModal from '@/components/ConfirmationModal';
import { PhoneField } from '@/components/PhoneField';
import { COLORS } from '@/theme';
import type { Coupon, StoreData, StoreSettings } from '@/types';
import {
  addSellerStaff,
  deleteSellerCoupon,
  deleteSellerStaff,
  fetchSellerSettings,
  saveSellerCoupon,
  toggleSellerCoupon,
  updateSellerProfile,
  updateSellerStoreSettings,
  type SellerSettingsStaff,
} from '@/api/seller-settings';
import { CountrySelect } from './settings/CountrySelect';
import { PickerSheet } from './inventory/PickerSheet';

type TabId = 'store' | 'user' | 'staff' | 'promos';

interface SellerSettingsViewProps {
  /** Boutique courante (`''` si l'utilisateur n'en a aucune). */
  storeId: string;
  currentUserId: string;
  permissions: Record<string, boolean>;
  stores: StoreData[];
  userName?: string;
  userEmail?: string;
  onUnauthorized: () => void;
  /** Rafraîchit le contexte après écriture (équivalent de `router.refresh()`). */
  onSaved?: () => Promise<void> | void;
}

const TABS: Array<{ id: TabId; label: string; Icon: typeof Store }> = [
  { id: 'store', label: 'Boutique', Icon: Store },
  { id: 'user', label: 'Profil', Icon: User },
  { id: 'staff', label: 'Équipe', Icon: Users },
  { id: 'promos', label: 'Promos', Icon: Tag },
];

const EMPTY_SETTINGS: StoreSettings = {
  name: 'Ma Boutique',
  email: '',
  phone: '',
  address: '',
  ninea: '',
  currency: 'XOF',
  language: 'fr',
  description: '',
};

export function SellerSettingsView({
  storeId,
  currentUserId,
  permissions,
  stores,
  userName,
  userEmail,
  onUnauthorized,
  onSaved,
}: SellerSettingsViewProps) {
  const { notify } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('store');
  const [localSettings, setLocalSettings] = useState<StoreSettings>(EMPTY_SETTINGS);
  const [staff, setStaff] = useState<SellerSettingsStaff[]>([]);
  const [localCoupons, setLocalCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const saveFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState(storeId);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const newStaffRole = 'SELLER';

  const [profileName, setProfileName] = useState(userName || '');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDiscount, setNewCouponDiscount] = useState(10);
  const [loadingCoupons, setLoadingCoupons] = useState(false);

  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);
  const [isDeletingStaff, setIsDeletingStaff] = useState(false);

  const expiredRef = useRef(false);
  const handleUnauthorized = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    onUnauthorized();
  }, [onUnauthorized]);

  const notifyError = useCallback(
    (message: string) => {
      notify(message, 'error');
    },
    [notify],
  );

  /** Recharge l'ensemble des données de l'écran (≡ `router.refresh()`). */
  const reload = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!options.silent) setIsLoading(true);
      try {
        const res = await fetchSellerSettings(storeId || null);
        if (res.success) {
          setLocalSettings((prev) => ({
            ...prev,
            ...(res.storeSettings || {}),
            address: res.storeSettings?.address || prev.address || '',
            description: res.storeSettings?.description || prev.description || '',
          }));
          setStaff(res.staff || []);
          setLocalCoupons(res.coupons || []);
        } else if (res.error === 'Unauthorized') {
          handleUnauthorized();
        } else if (res.error && res.error !== 'Forbidden') {
          notifyError(res.error);
        }
      } catch {
        notifyError('Erreur lors du chargement des réglages');
      } finally {
        setIsLoading(false);
      }
    },
    [handleUnauthorized, notifyError, storeId],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return () => {
      if (saveFeedbackTimer.current) clearTimeout(saveFeedbackTimer.current);
    };
  }, []);

  const updateSetting = useCallback(<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ── Boutique ──────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await updateSellerStoreSettings(storeId || null, localSettings);
      if (res.error === 'Unauthorized') {
        handleUnauthorized();
        return;
      }
      if (res.success) {
        setSaveFeedback(true);
        if (saveFeedbackTimer.current) clearTimeout(saveFeedbackTimer.current);
        saveFeedbackTimer.current = setTimeout(() => setSaveFeedback(false), 2500);
        notify('Réglages enregistrés !', 'success');
        await onSaved?.();
        void reload({ silent: true });
      } else {
        throw new Error(res.error);
      }
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  }, [handleUnauthorized, localSettings, notifyError, notify, onSaved, reload, storeId]);

  const handleLogoUpload = useCallback(async () => {
    try {
      const asset = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
      });
      if (asset.canceled || !asset.assets?.[0]) return;
      const data = asset.assets[0];
      if (data.base64) updateSetting('logo', `data:image/jpeg;base64,${data.base64}`);
    } catch {
      notifyError("Erreur lors de l'optimisation de l'image");
    }
  }, [notifyError, updateSetting]);

  // ── Profil ────────────────────────────────────────────────────────
  const handlePhotoUpload = useCallback(async () => {
    try {
      const asset = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
      });
      if (asset.canceled || !asset.assets?.[0]) return;
      const data = asset.assets[0];
      if (data.base64) setProfilePhoto(`data:image/jpeg;base64,${data.base64}`);
    } catch {
      notifyError("Erreur lors de l'optimisation de l'image");
    }
  }, [notifyError]);

  const handleUpdateProfileLocal = useCallback(async () => {
    if (!currentUserId) return;
    setIsUpdatingProfile(true);
    try {
      const res = await updateSellerProfile({
        fullName: profileName,
        ...(profilePhoto ? { avatarUrl: profilePhoto } : {}),
      });
      if (res.error === 'Unauthorized') {
        handleUnauthorized();
        return;
      }
      if (res.success) {
        notify('Profil mis à jour !', 'success');
        await onSaved?.();
        void reload({ silent: true });
      } else {
        throw new Error(res.error);
      }
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setIsUpdatingProfile(false);
    }
  }, [currentUserId, handleUnauthorized, notify, notifyError, onSaved, profileName, profilePhoto, reload]);

  // ── Équipe ────────────────────────────────────────────────────────
  const handleSubmitStaff = useCallback(async () => {
    if (!newStaffEmail) {
      notify("L'email de l'employé est requis", 'error');
      return;
    }
    setIsSubmittingStaff(true);
    try {
      const res = await addSellerStaff(selectedStoreId || storeId, {
        email: newStaffEmail,
        role: newStaffRole,
      });
      if (res.error === 'Unauthorized') {
        handleUnauthorized();
        return;
      }
      if (res.success) {
        notify('Employé ajouté avec succès', 'success');
        setIsStaffModalOpen(false);
        setNewStaffEmail('');
        await onSaved?.();
        void reload({ silent: true });
      } else {
        notifyError(res.error || "Erreur lors de l'ajout");
      }
    } finally {
      setIsSubmittingStaff(false);
    }
  }, [handleUnauthorized, newStaffEmail, notify, notifyError, onSaved, reload, selectedStoreId, storeId]);

  const confirmDeleteStaff = useCallback(async () => {
    if (!staffToDelete || isDeletingStaff) return;
    setIsDeletingStaff(true);
    try {
      const res = await deleteSellerStaff(staffToDelete);
      if (res.error === 'Unauthorized') {
        handleUnauthorized();
        return;
      }
      if (res.success) {
        notify('Membre supprimé', 'success');
        await onSaved?.();
        void reload({ silent: true });
      } else {
        throw new Error(res.error);
      }
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setIsDeletingStaff(false);
      setStaffToDelete(null);
    }
  }, [handleUnauthorized, isDeletingStaff, notify, notifyError, onSaved, reload, staffToDelete]);

  // ── Promos ────────────────────────────────────────────────────────
  const handleAddCoupon = useCallback(async () => {
    if (!newCouponCode.trim()) return;
    setLoadingCoupons(true);
    try {
      const res = await saveSellerCoupon(storeId, {
        code: newCouponCode.trim().toUpperCase(),
        discountPct: newCouponDiscount,
        active: true,
      });
      if (res.error === 'Unauthorized') {
        handleUnauthorized();
        return;
      }
      if (res.success) {
        notify('Code promo créé avec succès', 'success');
        setNewCouponCode('');
        setNewCouponDiscount(10);
        void reload({ silent: true });
      } else {
        notifyError(res.error || 'Erreur lors de la création');
      }
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setLoadingCoupons(false);
    }
  }, [handleUnauthorized, newCouponCode, newCouponDiscount, notify, notifyError, reload, storeId]);

  const handleDeleteCouponLocal = useCallback(
    async (id: string) => {
      setLoadingCoupons(true);
      try {
        const res = await deleteSellerCoupon(id);
        if (res.error === 'Unauthorized') {
          handleUnauthorized();
          return;
        }
        if (res.success) {
          notify('Code promo supprimé', 'success');
          void reload({ silent: true });
        } else {
          throw new Error(res.error);
        }
      } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Erreur');
      } finally {
        setLoadingCoupons(false);
      }
    },
    [handleUnauthorized, notify, notifyError, reload],
  );

  const handleToggleCoupon = useCallback(
    async (id: string) => {
      const coupon = localCoupons.find((item) => item.id === id);
      if (!coupon) return;
      // Mise à jour optimiste puis rollback (comme au web).
      setLocalCoupons((prev) =>
        prev.map((item) => (item.id === id ? { ...item, active: !item.active } : item)),
      );
      const res = await toggleSellerCoupon(id, !coupon.active);
      if (res.error === 'Unauthorized') {
        handleUnauthorized();
        return;
      }
      if (res.success) {
        void reload({ silent: true });
      } else {
        notifyError(res.error || 'Erreur de mise à jour');
        setLocalCoupons((prev) =>
          prev.map((item) => (item.id === id ? { ...item, active: coupon.active } : item)),
        );
      }
    },
    [handleUnauthorized, localCoupons, notifyError, reload],
  );

  const storeOptions = useMemo(
    () =>
      stores.map((store) => ({
        value: store.id,
        label: store.settings?.name || store.name || 'Boutique',
      })),
    [stores],
  );

  const tabs = TABS.filter((tab) => tab.id !== 'staff' || permissions?.canManageStaff);

  return (
    <View style={styles.screen}>
      {/* En-tête */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Réglages</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Gérez vos préférences.
          </Text>
        </View>
        <Pressable
          onPress={() => void handleSave()}
          disabled={isSaving}
          style={[
            styles.saveBtn,
            isSaving && { opacity: 0.7 },
            saveFeedback && { backgroundColor: '#22C55E' },
          ]}
        >
          {isSaving ? (
            <Loader2 size={16} color="#FFFFFF" />
          ) : saveFeedback ? (
            <ShieldCheck size={16} color="#FFFFFF" />
          ) : (
            <Save size={16} color="#FFFFFF" />
          )}
          <Text style={styles.saveBtnText}>
            {isSaving ? 'Traitement...' : saveFeedback ? 'Prêt !' : 'Enregistrer'}
          </Text>
        </Pressable>
      </View>

      {/* Onglets */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
        style={styles.tabsScroll}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
            >
              <tab.Icon size={18} color={active ? COLORS.brand : '#6B7280'} />
              <Text style={[styles.tabText, active && { color: COLORS.brand }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Contenu */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLORS.brand} />
          </View>
        ) : null}

        {/* ── Onglet Boutique ── */}
        {activeTab === 'store' ? (
          <View style={styles.tabBody}>
            <SectionHeader title="Informations de la Boutique" Icon={Store} />

            <Pressable onPress={() => void handleLogoUpload()} style={styles.logoWrap}>
              <View style={styles.logoBox}>
                {localSettings.logo ? (
                  <Image
                    source={{ uri: localSettings.logo }}
                    style={styles.logoImage}
                    contentFit="cover"
                  />
                ) : (
                  <Store size={32} color="#D1D5DB" />
                )}
                <View style={styles.logoCamera}>
                  <Camera size={14} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.logoCaption}>Logo de la boutique</Text>
            </Pressable>

            <View style={styles.field}>
              <Text style={styles.label}>Nom de la Boutique</Text>
              <View style={styles.inputWrap}>
                <Building size={14} color="#D1D5DB" />
                <TextInput
                  value={localSettings.name || ''}
                  onChangeText={(text) => updateSetting('name', text)}
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email de Contact</Text>
              <View style={styles.inputWrap}>
                <Mail size={14} color="#D1D5DB" />
                <TextInput
                  value={localSettings.email || ''}
                  onChangeText={(text) => updateSetting('email', text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Numéro WhatsApp (Commande)</Text>
              <PhoneField
                value={localSettings.phone || ''}
                onChange={(value) => updateSetting('phone', value)}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Pays</Text>
              <CountrySelect
                value={localSettings.country || ''}
                onChange={(name) => updateSetting('country', name)}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Description de la boutique</Text>
              <View style={styles.inputWrapTop}>
                <FileText size={14} color="#D1D5DB" />
                <TextInput
                  value={localSettings.description || ''}
                  onChangeText={(text) => {
                    // Filtrage strict : lettres, espaces et points (accents gardés).
                    const filtered = text.replace(/[^a-zA-ZÀ-ÿ\s.]/g, '').slice(0, 250);
                    updateSetting('description', filtered);
                  }}
                  placeholder="Décrivez votre univers (lettres, espaces et points uniquement, max 250 car.)..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={250}
                  style={[styles.input, styles.textarea]}
                />
                <Text style={styles.counter}>
                  {(localSettings.description || '').length} / 250
                </Text>
              </View>
              <View style={styles.noteRow}>
                <Info size={10} color="#9CA3AF" />
                <Text style={styles.note}>
                  Chiffres, liens et codes interdits (Lettres uniquement)
                </Text>
              </View>
            </View>

            {/* Vente en gros & B2B */}
            <View style={styles.b2bBlock}>
              <SectionHeader
                title="Vente en Gros & Commandes Groupées (B2B)"
                Icon={Zap}
              />
              <View style={styles.b2bCard}>
                <View style={styles.b2bLeft}>
                  <View style={styles.b2bIcon}>
                    <Zap size={20} color={COLORS.brand} fill={COLORS.brand} />
                  </View>
                  <View style={styles.b2bText}>
                    <Text style={styles.b2bTitle}>Activer les commandes de gros (B2B)</Text>
                    <Text style={styles.b2bDesc}>
                      Permet d&apos;afficher vos offres dégressives et le bouton de commande
                      rapide
                    </Text>
                  </View>
                </View>
                <Switch
                  value={!!localSettings.wholesaleEnabled}
                  onValueChange={(value) => updateSetting('wholesaleEnabled', value)}
                  trackColor={{ false: '#E5E7EB', true: COLORS.brand }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {localSettings.wholesaleEnabled ? (
                <View style={styles.b2bMinCard}>
                  <Text style={styles.b2bMinLabel}>
                    Montant Minimum de Commande Grossiste (F CFA)
                  </Text>
                  <View style={styles.b2bMinWrap}>
                    <TextInput
                      value={
                        localSettings.wholesaleMinOrderAmount !== undefined
                          ? String(localSettings.wholesaleMinOrderAmount)
                          : ''
                      }
                      onChangeText={(text) =>
                        updateSetting(
                          'wholesaleMinOrderAmount',
                          text ? Number(text.replace(/\D/g, '')) : undefined,
                        )
                      }
                      keyboardType="number-pad"
                      placeholder="Ex: 50000 (Laissez vide ou 0 pour aucun minimum)"
                      placeholderTextColor="#9CA3AF"
                      style={styles.b2bMinInput}
                    />
                    <Text style={styles.b2bSuffix}>F CFA</Text>
                  </View>
                  <Text style={styles.b2bHelp}>
                    Les acheteurs devront atteindre ce montant d&apos;achat dans votre boutique
                    pour passer une commande avec tarifs grossistes.
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* ── Onglet Profil ── */}
        {activeTab === 'user' ? (
          <View style={styles.tabBody}>
            <LinearGradient
              colors={[COLORS.brand, '#FF8C52']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileCard}
            >
              <View style={styles.profileHaloTop} />
              <View style={styles.profileHaloBottom} />

              <Pressable onPress={() => void handlePhotoUpload()} style={styles.avatarWrap}>
                <Image
                  source={{
                    uri:
                      profilePhoto ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${userEmail || ''}`,
                  }}
                  style={styles.avatar}
                  contentFit="cover"
                />
                <View style={styles.avatarCamera}>
                  <Camera size={18} color={COLORS.brand} />
                </View>
              </Pressable>

              <View style={styles.profileIdentity}>
                <Text style={styles.profileName}>{profileName || 'Gérant'}</Text>
                <View style={styles.profileEmailRow}>
                  <Mail size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.profileEmail}>{userEmail}</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.identityBlock}>
              <View style={styles.identityHeader}>
                <View style={styles.identityIcon}>
                  <User size={20} color={COLORS.brand} />
                </View>
                <Text style={styles.identityTitle}>Identité Personnelle</Text>
              </View>

              <View style={styles.identityCard}>
                <View>
                  <Text style={styles.identityLabel}>Nom Complet</Text>
                  <View style={styles.inputWrap}>
                    <User size={20} color="#D1D5DB" />
                    <TextInput
                      value={profileName}
                      onChangeText={setProfileName}
                      placeholder="Votre nom"
                      placeholderTextColor="#9CA3AF"
                      style={[styles.input, styles.identityInput]}
                    />
                  </View>
                </View>

                <Pressable
                  onPress={() => void handleUpdateProfileLocal()}
                  disabled={isUpdatingProfile}
                  style={[styles.profileSave, isUpdatingProfile && { opacity: 0.5 }]}
                >
                  {isUpdatingProfile ? (
                    <Loader2 size={18} color="#FFFFFF" />
                  ) : (
                    <Save size={18} color="#FFFFFF" />
                  )}
                  <Text style={styles.profileSaveText}>
                    {isUpdatingProfile
                      ? 'Mise à jour...'
                      : 'Sauvegarder les modifications'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Onglet Équipe ── */}
        {activeTab === 'staff' && permissions?.canManageStaff ? (
          <View style={styles.tabBody}>
            <View style={styles.staffHeaderRow}>
              <View style={styles.flex1}>
                <SectionHeader title="Gestion de l'Équipe" Icon={Users} />
              </View>
              <Pressable onPress={() => setIsStaffModalOpen(true)} style={styles.addStaffBtn}>
                <Plus size={14} color="#FFFFFF" />
                <Text style={styles.addStaffText}>Ajouter un membre</Text>
              </Pressable>
            </View>

            <View style={styles.staffList}>
              {staff.length === 0 ? (
                <View style={styles.staffEmpty}>
                  <Text style={styles.staffEmptyText}>
                    Aucun membre d&apos;équipe enregistré.
                  </Text>
                </View>
              ) : (
                staff.map((member) => (
                  <View key={member.id} style={styles.staffCard}>
                    <Pressable
                      onPress={() => setStaffToDelete(member.id)}
                      style={styles.staffDelete}
                      accessibilityLabel="Supprimer ce membre"
                    >
                      <Trash2 size={12} color="#F87171" />
                    </Pressable>
                    <View style={styles.staffAvatar}>
                      <User size={20} color={COLORS.brand} />
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.staffName} numberOfLines={1}>
                        {member.fullName || member.email || member.userId?.slice(0, 8)}
                      </Text>
                      <View style={styles.staffMetaRow}>
                        <View
                          style={[
                            styles.roleBadge,
                            member.role === 'OWNER' ? styles.roleOwner : styles.roleSeller,
                          ]}
                        >
                          <Text
                            style={[
                              styles.roleText,
                              member.role === 'OWNER'
                                ? { color: '#9333EA' }
                                : { color: COLORS.brand },
                            ]}
                          >
                            {member.role}
                          </Text>
                        </View>
                        <Text style={styles.staffStore} numberOfLines={1}>
                          <Store size={8} color="#9CA3AF" />{' '}
                          {stores.find((s) => s.id === member.storeId)?.name || 'Boutique'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : null}

        {/* ── Onglet Promos ── */}
        {activeTab === 'promos' ? (
          <View style={styles.tabBody}>
            <SectionHeader title="Campagnes Promotionnelles" Icon={Tag} />
            <Text style={styles.promosIntro}>
              Créez des codes promo uniques pour fidéliser vos clients et booster vos ventes
              en ligne.
            </Text>

            <View style={styles.promoFormCard}>
              <View style={styles.promoFormTitle}>
                <Plus size={16} color={COLORS.brand} />
                <Text style={styles.promoFormTitleText}>Nouveau Code</Text>
              </View>
              <View style={styles.promoInputs}>
                <TextInput
                  value={newCouponCode}
                  onChangeText={setNewCouponCode}
                  placeholder="Code (ex: BIENVENUE20)"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  style={styles.promoCodeInput}
                />
                <View style={styles.promoDiscountWrap}>
                  <TextInput
                    value={String(newCouponDiscount)}
                    onChangeText={(text) =>
                      setNewCouponDiscount(
                        Math.min(100, Math.max(1, Number(text.replace(/\D/g, '')) || 0)),
                      )
                    }
                    keyboardType="number-pad"
                    style={styles.promoDiscountInput}
                  />
                  <Text style={styles.promoPercent}>%</Text>
                </View>
                <Pressable
                  onPress={() => void handleAddCoupon()}
                  disabled={!newCouponCode.trim() || loadingCoupons}
                  style={[
                    styles.promoAddBtn,
                    (!newCouponCode.trim() || loadingCoupons) && { opacity: 0.5 },
                  ]}
                >
                  {loadingCoupons ? (
                    <Loader2 size={16} color="#FFFFFF" />
                  ) : (
                    <Save size={16} color="#FFFFFF" />
                  )}
                  <Text style={styles.promoAddText}>
                    {loadingCoupons ? 'Action...' : 'Ajouter'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.couponList}>
              {localCoupons.length === 0 ? (
                <View style={styles.couponEmpty}>
                  <Tag size={48} color="#9CA3AF" style={styles.couponEmptyIcon} />
                  <Text style={styles.couponEmptyText}>
                    Aucune promotion active actuellement.
                  </Text>
                </View>
              ) : (
                localCoupons.map((coupon) => (
                  <View key={coupon.id || coupon.code} style={styles.couponCard}>
                    <Pressable
                      onPress={() => coupon.id && void handleToggleCoupon(coupon.id)}
                      style={styles.couponToggle}
                    >
                      {coupon.active ? (
                        <CheckSquare size={22} color={COLORS.brand} />
                      ) : (
                        <Square size={22} color="#D1D5DB" />
                      )}
                    </Pressable>
                    <View style={styles.flex1}>
                      <Text style={styles.couponCode}>{coupon.code}</Text>
                      <View style={styles.couponMetaRow}>
                        <View style={styles.couponBadge}>
                          <Text style={styles.couponBadgeText}>
                            -{coupon.discount_pct}%
                          </Text>
                        </View>
                        <Text style={styles.couponValid}>Valide en ligne</Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => coupon.id && void handleDeleteCouponLocal(coupon.id)}
                      style={styles.couponDelete}
                      accessibilityLabel="Supprimer le code promo"
                    >
                      <Trash2 size={18} color="#D1D5DB" />
                    </Pressable>
                  </View>
                ))
              )}
            </View>

            <View style={styles.adviceCard}>
              <ShieldCheck size={18} color={COLORS.brand} />
              <Text style={styles.adviceText}>
                <Text style={styles.adviceStrong}>Conseil :</Text> Les codes promo sont
                sensibles à la casse. Vos clients verront ces remises s&apos;appliquer
                automatiquement s&apos;ils saisissent le code correspondant dans leur panier.
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Modale « Nouvel Employé » */}
      <Modal
        visible={isStaffModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsStaffModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.flex1}>
                <Text style={styles.modalTitle}>Nouvel Employé</Text>
                <Text style={styles.modalSubtitle}>
                  Ajoutez un membre de votre équipe à cette boutique.
                </Text>
              </View>
              <Pressable
                onPress={() => setIsStaffModalOpen(false)}
                style={styles.modalClose}
                accessibilityLabel="Fermer"
              >
                <X size={24} color="#9CA3AF" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View>
                <Text style={styles.modalLabel}>Email de l&apos;employé</Text>
                <View style={styles.inputWrap}>
                  <Mail size={18} color="#D1D5DB" />
                  <TextInput
                    value={newStaffEmail}
                    onChangeText={setNewStaffEmail}
                    placeholder="exemple@boutique.com"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={[styles.input, styles.modalInput]}
                  />
                </View>
                <Text style={styles.modalHint}>
                  L&apos;employé doit avoir déjà créé son compte (connexion par lien email).
                </Text>
              </View>

              {stores.length > 1 ? (
                <View>
                  <Text style={styles.modalLabel}>Attribuer à la boutique</Text>
                  <Pressable
                    onPress={() => setStorePickerOpen(true)}
                    style={styles.inputWrap}
                  >
                    <Store size={18} color="#D1D5DB" />
                    <Text style={styles.storeSelectText}>
                      {stores.find((s) => s.id === selectedStoreId)?.settings?.name ||
                        stores.find((s) => s.id === selectedStoreId)?.name ||
                        'Boutique'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View>
                <Text style={styles.modalLabel}>Niveau d&apos;accès (Rôle)</Text>
                <View style={styles.roleCard}>
                  <View style={styles.flex1}>
                    <Text style={styles.roleCardTitle}>VENDEUR (SELLER)</Text>
                    <Text style={styles.roleCardDesc}>
                      Accès au POS, commandes et inventaire.
                    </Text>
                  </View>
                  <ShieldCheck size={24} color={COLORS.brand} />
                </View>
              </View>

              <View style={styles.modalFooter}>
                <Pressable
                  onPress={() => setIsStaffModalOpen(false)}
                  style={styles.modalCancel}
                >
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleSubmitStaff()}
                  disabled={isSubmittingStaff}
                  style={[
                    styles.modalSubmit,
                    isSubmittingStaff && { opacity: 0.5 },
                  ]}
                >
                  {isSubmittingStaff ? (
                    <Loader2 size={20} color="#FFFFFF" />
                  ) : (
                    <Save size={20} color="#FFFFFF" />
                  )}
                  <Text style={styles.modalSubmitText}>
                    {isSubmittingStaff ? 'Création...' : 'Valider'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <PickerSheet
        visible={storePickerOpen}
        title="Attribuer à la boutique"
        options={storeOptions}
        value={selectedStoreId}
        onSelect={setSelectedStoreId}
        onClose={() => setStorePickerOpen(false)}
      />

      <ConfirmationModal
        isOpen={staffToDelete !== null}
        onClose={() => setStaffToDelete(null)}
        onConfirm={confirmDeleteStaff}
        title="Supprimer ce membre"
        message="Êtes-vous sûr de vouloir supprimer ce membre de l'équipe ? Cette action est irréversible."
        confirmText="Supprimer"
        type="danger"
        isLoading={isDeletingStaff}
      />
    </View>
  );
}

function SectionHeader({
  title,
  Icon,
}: {
  title: string;
  Icon: typeof Store;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Icon size={14} color="#FFFFFF" />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'rgba(249,250,251,0.3)' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 10, color: '#6B7280', marginTop: 2 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.brand,
  },
  saveBtnText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

  tabsScroll: { flexGrow: 0 },
  tabsRow: { gap: 6, paddingHorizontal: 12, paddingBottom: 12 },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  tabText: { fontSize: 10, fontWeight: '700', color: '#6B7280' },

  contentScroll: { flex: 1 },
  content: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 14,
    paddingBottom: 40,
  },
  loadingBox: { alignItems: 'center', paddingVertical: 12 },
  tabBody: { gap: 24 },
  flex1: { flex: 1 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionIcon: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: COLORS.brand,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },

  logoWrap: { alignItems: 'center', marginBottom: 24 },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: { width: '100%', height: '100%' },
  logoCamera: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCaption: { fontSize: 9, fontWeight: '600', color: '#9CA3AF', marginTop: 8 },

  field: { gap: 4 },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inputWrapTop: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  input: { flex: 1, fontSize: 11, fontWeight: '600', color: '#111827', paddingVertical: 0 },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  counter: {
    alignSelf: 'flex-end',
    fontSize: 8,
    fontWeight: '700',
    color: '#D1D5DB',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginTop: 4,
  },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingHorizontal: 4 },
  note: { fontSize: 8, color: '#9CA3AF', fontWeight: '600', fontStyle: 'italic' },

  b2bBlock: { paddingTop: 24, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  b2bCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(255,247,237,0.6)',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 16,
  },
  b2bLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  b2bIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(245,107,42,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  b2bText: { flex: 1 },
  b2bTitle: { fontSize: 12, fontWeight: '700', color: '#111827' },
  b2bDesc: { fontSize: 10, color: '#6B7280', marginTop: 2 },
  b2bMinCard: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 16,
    gap: 8,
    marginTop: 16,
  },
  b2bMinLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  b2bMinWrap: { justifyContent: 'center' },
  b2bMinInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    paddingRight: 64,
  },
  b2bSuffix: {
    position: 'absolute',
    right: 16,
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  b2bHelp: { fontSize: 9, color: '#6B7280' },

  profileCard: {
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    gap: 24,
    overflow: 'hidden',
  },
  profileHaloTop: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  profileHaloBottom: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: '#FFFFFF',
  },
  avatarCamera: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  profileIdentity: { alignItems: 'center', gap: 4 },
  profileName: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.4 },
  profileEmailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileEmail: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  identityBlock: { gap: 32, alignSelf: 'center', width: '100%', maxWidth: 672 },
  identityHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  identityIcon: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
  },
  identityTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  identityCard: {
    backgroundColor: 'rgba(249,250,251,0.5)',
    padding: 24,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 32,
  },
  identityLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginBottom: 12,
    marginLeft: 4,
  },
  identityInput: {
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  profileSave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: COLORS.brand,
  },
  profileSaveText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  staffHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  addStaffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.brand,
    borderRadius: 8,
  },
  addStaffText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  staffList: { gap: 12 },
  staffEmpty: {
    paddingVertical: 48,
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#F3F4F6',
    borderRadius: 24,
  },
  staffEmptyText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
  },
  staffDelete: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 6,
    opacity: 0.6,
    zIndex: 2,
  },
  staffAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffName: { fontSize: 12, fontWeight: '700', color: '#111827', paddingRight: 24 },
  staffMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  roleOwner: { backgroundColor: '#F3E8FF' },
  roleSeller: { backgroundColor: '#FFEDD5' },
  roleText: { fontSize: 8, fontWeight: '700' },
  staffStore: { fontSize: 9, fontWeight: '600', color: '#9CA3AF', flexShrink: 1 },

  promosIntro: { fontSize: 12, color: '#6B7280', lineHeight: 18, marginBottom: 24 },
  promoFormCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 16,
    marginBottom: 32,
    gap: 12,
  },
  promoFormTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promoFormTitleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
  },
  promoInputs: { gap: 12 },
  promoCodeInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  promoDiscountWrap: { justifyContent: 'center' },
  promoDiscountInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    paddingRight: 32,
  },
  promoPercent: {
    position: 'absolute',
    right: 32,
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  promoAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: COLORS.brand,
    borderRadius: 12,
  },
  promoAddText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  couponList: { gap: 12 },
  couponEmpty: {
    alignItems: 'center',
    paddingVertical: 48,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#F9FAFB',
    borderRadius: 24,
  },
  couponEmptyIcon: { opacity: 0.1, marginBottom: 16 },
  couponEmptyText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF', fontStyle: 'italic' },
  couponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  couponToggle: { padding: 2 },
  couponCode: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: -0.2,
  },
  couponMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  couponBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  couponBadgeText: { fontSize: 9, fontWeight: '700', color: COLORS.brand },
  couponValid: { fontSize: 10, color: '#9CA3AF' },
  couponDelete: { padding: 8 },

  adviceCard: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
    padding: 16,
    backgroundColor: 'rgba(255,247,237,0.5)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  adviceText: { flex: 1, fontSize: 10, color: COLORS.brand, lineHeight: 15 },
  adviceStrong: { fontWeight: '700' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 512,
    maxHeight: '95%',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: 'rgba(249,250,251,0.5)',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', letterSpacing: -0.4 },
  modalSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  modalClose: { padding: 8 },
  modalBody: { padding: 24, gap: 20 },
  modalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginBottom: 6,
    marginLeft: 4,
  },
  modalInput: {
    fontSize: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  modalHint: { fontSize: 11, color: '#9CA3AF', marginTop: 6, marginLeft: 4 },
  storeSelectText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111827' },
  roleCard: {
    padding: 16,
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: COLORS.brand,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roleCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.brand },
  roleCardDesc: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(245,107,42,0.7)',
    marginTop: 2,
  },
  modalFooter: { flexDirection: 'row', gap: 12, paddingTop: 24 },
  modalCancel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    borderRadius: 16,
  },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: '#9CA3AF' },
  modalSubmit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: COLORS.brand,
    borderRadius: 16,
  },
  modalSubmitText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});