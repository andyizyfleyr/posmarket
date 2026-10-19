/**
 * Modale produit (création / édition, 3 étapes) — copie fidèle de la modale
 * de `src/views/InventoryView.tsx` (web, rendu mobile).
 *
 * Adaptations mobiles assumées :
 * - les `<select>` (catégorie, unité, durée) passent par `PickerSheet` ;
 * - la galerie photo utilise `expo-image-picker` (appareil photo ou galerie),
 *   les images sont compressées et envoyées en base64 comme au web ;
 * - la matrice des variantes (5 colonnes au web) devient des cartes empilées.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Globe,
  Image as ImageIcon,
  Info,
  Layers,
  Monitor,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react-native';
import { COLORS } from '@/theme';
import { formatCurrency } from '@/utils';
import { CATEGORY_MAPPING } from '@/constants';
import {
  normalizeOptions,
  normalizeVariants,
  type ProductOptionDef,
  type ProductVariantDef,
} from '@/utils/variants';
import { saveSellerProduct, type SellerCategoryNode } from '@/api/seller';
import type { BusinessVertical, Product, WholesaleTier } from '@/types';
import { VariantMatrixEditor } from './VariantMatrixEditor';
import { PickerSheet, type PickerOption } from './PickerSheet';

const KNOWN_UNITS = [
  'pièce', 'unité', 'paquet', 'carton', 'boîte', 'sac', 'bouteille', 'lot', 'douzaine',
  'kg', 'g', 'tonne', 'L', 'ml', 'cl', 'm', 'cm', 'm²', 'nuitée', 'heure', 'jour', 'service', 'ticket',
];

const UNIT_OPTIONS: PickerOption[] = [
  { value: 'pièce', label: 'Pièce', group: 'Standard' },
  { value: 'unité', label: 'Unité (u)', group: 'Standard' },
  { value: 'douzaine', label: 'Douzaine', group: 'Standard' },
  { value: 'paquet', label: 'Paquet', group: 'Standard' },
  { value: 'carton', label: 'Carton', group: 'Standard' },
  { value: 'boîte', label: 'Boîte / Box', group: 'Standard' },
  { value: 'sac', label: 'Sac', group: 'Standard' },
  { value: 'bouteille', label: 'Bouteille', group: 'Standard' },
  { value: 'lot', label: 'Lot', group: 'Standard' },
  { value: 'kg', label: 'Kilogramme (kg)', group: 'Poids & Mesures' },
  { value: 'g', label: 'Gramme (g)', group: 'Poids & Mesures' },
  { value: 'L', label: 'Litre (L)', group: 'Poids & Mesures' },
  { value: 'm', label: 'Mètre (m)', group: 'Poids & Mesures' },
  { value: 'm²', label: 'Mètre Carré (m²)', group: 'Poids & Mesures' },
  { value: 'service', label: 'Service / Forfait', group: 'Services & Événements' },
  { value: 'ticket', label: 'Ticket / Entrée', group: 'Services & Événements' },
  { value: 'heure', label: 'Heure', group: 'Services & Événements' },
  { value: 'jour', label: 'Jour', group: 'Services & Événements' },
  { value: 'custom', label: 'Autre (Saisie libre)...', group: '' },
];

const DELIVERY_OPTIONS: PickerOption[] = [
  { value: '', label: 'Sélectionnez une durée indicative...' },
  { value: '15 min', label: '15 minutes', group: 'Restauration & Immédiat' },
  { value: '30 min', label: '30 minutes', group: 'Restauration & Immédiat' },
  { value: '45 min', label: '45 minutes', group: 'Restauration & Immédiat' },
  { value: '1h', label: '1 heure', group: 'Restauration & Immédiat' },
  { value: '24h', label: '24 heures (1 jour)', group: 'Livraison Express & Rapide' },
  { value: '48h', label: '48 heures (2 jours)', group: 'Livraison Express & Rapide' },
  { value: '72h', label: '72 heures (3 jours)', group: 'Livraison Express & Rapide' },
  { value: '3-5 jours', label: '3 à 5 jours', group: 'Livraison Standard & Sur-Mesure' },
  { value: '1 semaine', label: '1 semaine', group: 'Livraison Standard & Sur-Mesure' },
  { value: '2 semaines', label: '2 semaines', group: 'Livraison Standard & Sur-Mesure' },
  { value: 'Sur commande', label: 'Sur commande / Fabrication sur-mesure', group: 'Livraison Standard & Sur-Mesure' },
];

interface ProductFormState {
  name?: string;
  price?: number;
  stock?: number;
  category: string;
  mainCategory: string;
  image: string;
  images: string[];
  unit: string;
  description: string;
  isOnline: boolean;
  wholesalePrice?: number;
  wholesaleMinQty?: number;
  wholesaleTiers: WholesaleTier[];
  deliveryTime: string;
  preparationTime: string;
  businessType: BusinessVertical;
  options: ProductOptionDef[];
  variants: ProductVariantDef[];
}

interface ProductFormModalProps {
  visible: boolean;
  editingProduct: Product | null;
  /** Canal de création : « pos » ou « store » (boutons + POS / + Store & POS). */
  initialChannel: 'pos' | 'store';
  businessType: BusinessVertical;
  storeId: string;
  categoryTree: SellerCategoryNode[];
  useLiveCategories: boolean;
  onClose: () => void;
  onSaved: (product: Product, isEdit: boolean, warnings?: string[]) => void;
}

export function ProductFormModal({
  visible,
  editingProduct,
  initialChannel,
  businessType,
  storeId,
  categoryTree,
  useLiveCategories,
  onClose,
  onSaved,
}: ProductFormModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [deliveryPickerOpen, setDeliveryPickerOpen] = useState(false);
  const [photoSourceOpen, setPhotoSourceOpen] = useState(false);
  const [formData, setFormData] = useState<ProductFormState>(() =>
    buildInitialForm(editingProduct, initialChannel, businessType),
  );

  /** Réinitialise le formulaire à chaque ouverture (voir handleOpenModal web). */
  const [lastKey, setLastKey] = useState('');
  const openKey = `${visible ? 'open' : 'closed'}-${editingProduct?.id ?? 'new'}-${initialChannel}`;
  if (openKey !== lastKey) {
    setLastKey(openKey);
    if (visible) {
      setCurrentStep(1);
      setSubmitError(null);
      setFormData(buildInitialForm(editingProduct, initialChannel, businessType));
    }
  }

  // ── Taxonomie (arbre en base, repli sur les constantes) ────────────
  const filteredMainCategories = useMemo(() => {
    if (useLiveCategories) {
      return categoryTree
        .filter((n) => (businessType === 'food' ? n.businessType === 'food' : n.businessType !== 'food'))
        .map((n) => n.name);
    }
    if (businessType === 'food') return ['Restauration & Livraison Rapide'];
    return Object.values(CATEGORY_MAPPING)
      .concat(['Divers'])
      .filter(
        (c, i, arr) =>
          arr.indexOf(c) === i &&
          c !== 'Restauration & Livraison Rapide' &&
          c !== 'Séjours, Expériences & Immobilier' &&
          c !== 'Produits Digitaux & Services',
      );
  }, [businessType, categoryTree, useLiveCategories]);

  const filteredCategoryMapping = useMemo(() => {
    if (useLiveCategories) {
      const mapping: Record<string, string> = {};
      categoryTree.forEach((parent) => {
        parent.children.forEach((child) => {
          mapping[child.name] = parent.name;
        });
      });
      return mapping;
    }
    const mapping: Record<string, string> = {};
    Object.entries(CATEGORY_MAPPING).forEach(([sub, main]) => {
      if (filteredMainCategories.includes(main)) {
        mapping[sub] = main;
      }
    });
    return mapping;
  }, [filteredMainCategories, categoryTree, useLiveCategories]);

  const categoryOptions = useMemo<PickerOption[]>(() => {
    const options: PickerOption[] = [];
    filteredMainCategories.forEach((mainCat) => {
      const subCats = Object.keys(filteredCategoryMapping).filter(
        (sub) => filteredCategoryMapping[sub] === mainCat,
      );
      if (subCats.length === 0) {
        options.push({ value: mainCat, label: mainCat });
      } else {
        subCats.forEach((sub) => options.push({ value: sub, label: sub, group: mainCat }));
      }
    });
    return options;
  }, [filteredMainCategories, filteredCategoryMapping]);

  // ── Photos ─────────────────────────────────────────────────────────
  const pickImages = useCallback(
    async (fromCamera: boolean) => {
      try {
        if (fromCamera) {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            setSubmitError("L'accès à l'appareil photo a été refusé.");
            return;
          }
        }
        if (formData.images.length >= 8) {
          setSubmitError('Vous ne pouvez pas ajouter plus de 8 images.');
          return;
        }
        const remaining = 8 - formData.images.length;
        const result = fromCamera
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.6,
              base64: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsMultipleSelection: true,
              selectionLimit: remaining,
              quality: 0.6,
              base64: true,
            });
        if (result.canceled || !result.assets) return;
        const added: string[] = [];
        for (const asset of result.assets.slice(0, remaining)) {
          if (asset.base64) {
            added.push(`data:image/jpeg;base64,${asset.base64}`);
          }
        }
        if (added.length === 0) return;
        setFormData((prev) => {
          const newImages = [...prev.images, ...added].slice(0, 8);
          return { ...prev, images: newImages, image: prev.image || newImages[0] || '' };
        });
        setSubmitError(null);
      } catch (error) {
        console.error("Erreur lors de l'ajout d'images:", error);
        setSubmitError("Impossible de charger l'image choisie.");
      }
    },
    [formData.images.length],
  );

  // ── Enregistrement ─────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload = editingProduct
        ? { ...(editingProduct as unknown as Record<string, unknown>), ...formData }
        : { ...formData };
      const result = await saveSellerProduct(storeId, payload as Record<string, unknown>);
      if ((result.success && result.product) || result.success) {
        const saved = result.product
          ? ({
              ...result.product,
              price: Number(result.product.price) || 0,
            } as unknown as Product)
          : null;
        onSaved(saved as Product, Boolean(editingProduct), result.warnings);
        onClose();
      } else {
        setSubmitError(result.error || "Impossible d'enregistrer le produit");
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  }, [editingProduct, formData, onClose, onSaved, storeId]);

  // ── Pied de page (validations + étapes) ────────────────────────────
  const goNext = () => {
    if (currentStep === 1) {
      if (!formData.name || !formData.name.trim()) {
        setSubmitError('Veuillez renseigner le nom du produit avant de continuer.');
        return;
      }
    } else if (currentStep === 2) {
      if (
        formData.price === undefined ||
        formData.price === null ||
        Number.isNaN(Number(formData.price)) ||
        Number(formData.price) < 0
      ) {
        setSubmitError('Veuillez renseigner un prix de vente valide.');
        return;
      }
    }
    setSubmitError(null);
    setCurrentStep((prev) => Math.min(3, prev + 1));
  };

  const isCustomUnit = !KNOWN_UNITS.includes(formData.unit || '') || formData.unit === '';
  const wholesaleEnabled =
    (formData.wholesaleTiers && formData.wholesaleTiers.length > 0) ||
    formData.wholesalePrice !== undefined;

  const steps = [
    { s: 1, icon: Package, label: '1. Identité & Médias' },
    { s: 2, icon: DollarSign, label: '2. Tarifs & Stock' },
    { s: 3, icon: Layers, label: '3. Variantes' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          {/* ── En-tête ─────────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.headerBadges}>
                  <View style={styles.modeBadge}>
                    <Text style={styles.modeBadgeText}>
                      {editingProduct ? 'Modification' : 'Création'}
                    </Text>
                  </View>
                  <Text style={styles.stepText}>Étape {currentStep} sur 3</Text>
                </View>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {editingProduct
                    ? editingProduct.name || 'Modifier le produit'
                    : formData.isOnline
                      ? 'Nouveau produit (boutique)'
                      : 'Nouveau produit (caisse)'}
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Fermer">
                <X size={20} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Barre d'étapes */}
            <View style={styles.stepsRow}>
              <View style={styles.stepsLine} />
              {steps.map((step) => {
                const isActive = currentStep === step.s;
                const isCompleted = currentStep > step.s;
                const Icon = step.icon;
                return (
                  <Pressable
                    key={step.s}
                    onPress={() => {
                      if (step.s < currentStep) {
                        setCurrentStep(step.s);
                        setSubmitError(null);
                      } else if (step.s === 2 && formData.name?.trim()) {
                        setCurrentStep(2);
                        setSubmitError(null);
                      } else if (
                        step.s === 3 &&
                        formData.name?.trim() &&
                        formData.price !== undefined
                      ) {
                        setCurrentStep(3);
                        setSubmitError(null);
                      }
                    }}
                    style={styles.stepItem}
                  >
                    <View
                      style={[
                        styles.stepCircle,
                        isActive && styles.stepCircleActive,
                        isCompleted && styles.stepCircleCompleted,
                      ]}
                    >
                      {isCompleted ? (
                        <Check size={16} color="#FFFFFF" strokeWidth={3} />
                      ) : (
                        <Icon
                          size={16}
                          color={isActive ? '#FFFFFF' : '#9CA3AF'}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        isActive && styles.stepLabelActive,
                        isCompleted && styles.stepLabelCompleted,
                      ]}
                    >
                      {step.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Corps ───────────────────────────────────────────────── */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {currentStep === 1 ? (
              <>
                {/* Nom du produit */}
                <View>
                  <View style={styles.labelRow}>
                    <View style={styles.labelLeft}>
                      <Package size={14} color={COLORS.brand} />
                      <Text style={styles.labelText}>
                        Nom du Produit <Text style={{ color: COLORS.brand }}>*</Text>
                      </Text>
                    </View>
                    <View style={styles.requiredBadge}>
                      <Text style={styles.requiredBadgeText}>Requis</Text>
                    </View>
                  </View>
                  <TextInput
                    value={formData.name}
                    onChangeText={(value) => {
                      setFormData((prev) => ({ ...prev, name: value }));
                      if (submitError) setSubmitError(null);
                    }}
                    placeholder="Ex : T-shirt Oversize Bio, Burger Double Fromage, Robe d'été…"
                    placeholderTextColor="#9CA3AF"
                    style={styles.nameInput}
                  />
                </View>

                {/* Catégorie */}
                <View>
                  <View style={styles.labelLeft}>
                    <Tag size={14} color={COLORS.brand} />
                    <Text style={styles.labelText}>Catégorie & Rayon</Text>
                  </View>
                  <Pressable
                    onPress={() => setCategoryPickerOpen(true)}
                    style={[styles.selectField, { marginTop: 8 }]}
                  >
                    <Text style={styles.selectFieldText} numberOfLines={1}>
                      {formData.category}
                    </Text>
                    <ChevronRight size={16} color="#9CA3AF" />
                  </Pressable>
                </View>

                {/* Description */}
                <View>
                  <View style={styles.labelRow}>
                    <Text style={styles.labelText}>Description détaillée</Text>
                    <Text style={styles.labelHint}>Recommandé pour la boutique</Text>
                  </View>
                  <TextInput
                    value={formData.description}
                    onChangeText={(value) => setFormData((prev) => ({ ...prev, description: value }))}
                    placeholder="Décrivez votre produit : matière, caractéristiques, ingrédients, conseils d'utilisation…"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={3}
                    style={styles.textarea}
                  />
                </View>

                {/* Photos */}
                <View>
                  <View style={styles.labelRow}>
                    <View style={styles.labelLeft}>
                      <ImageIcon size={14} color={COLORS.brand} />
                      <Text style={styles.labelText}>Photos du Produit</Text>
                    </View>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>
                        {formData.images.length} photo{formData.images.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.photosBox}>
                    <View style={styles.photosGrid}>
                      {formData.images.map((img, idx) => (
                        <View key={`${idx}-${img.slice(0, 24)}`} style={styles.photoTile}>
                          <Image source={{ uri: img }} style={styles.photoImg} contentFit="cover" />
                          <Pressable
                            onPress={() => {
                              const newImages = formData.images.filter((_, i) => i !== idx);
                              setFormData((prev) => ({
                                ...prev,
                                images: newImages,
                                image: newImages[0] || '',
                              }));
                            }}
                            style={styles.photoDelete}
                            accessibilityLabel="Supprimer la photo"
                          >
                            <Trash2 size={12} color="#FFFFFF" />
                          </Pressable>
                          {idx === 0 ? (
                            <View style={styles.photoMainBadge}>
                              <Text style={styles.photoMainBadgeText}>Principale</Text>
                            </View>
                          ) : null}
                        </View>
                      ))}
                      <Pressable
                        onPress={() => setPhotoSourceOpen(true)}
                        style={styles.addPhotoTile}
                        accessibilityLabel="Ajouter une photo"
                      >
                        <View style={styles.addPhotoIcon}>
                          <Plus size={18} color={COLORS.brand} strokeWidth={2.5} />
                        </View>
                        <Text style={styles.addPhotoText}>Ajouter</Text>
                      </Pressable>
                    </View>
                    <View style={styles.photoHintRow}>
                      <Info size={12} color={COLORS.brand} />
                      <Text style={styles.photoHint}>
                        La première photo est l&apos;image principale. Vous pourrez aussi assigner des
                        photos par variante à l&apos;étape 3.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Canal & visibilité */}
                <View style={styles.channelCard}>
                  <View style={styles.channelLeft}>
                    <View
                      style={[
                        styles.channelIcon,
                        { backgroundColor: formData.isOnline ? COLORS.brand : '#9CA3AF' },
                      ]}
                    >
                      {formData.isOnline ? (
                        <Globe size={20} color="#FFFFFF" />
                      ) : (
                        <Monitor size={20} color="#FFFFFF" />
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.channelTitle}>
                        {formData.isOnline
                          ? 'Publier sur la boutique en ligne'
                          : 'Disponible uniquement en Caisse (POS)'}
                      </Text>
                      <Text style={styles.channelSubtitle}>
                        {formData.isOnline
                          ? 'Visible publiquement par vos clients sur votre catalogue web'
                          : 'Usage interne : encaissement sur place uniquement'}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => setFormData((prev) => ({ ...prev, isOnline: !prev.isOnline }))}
                    style={[
                      styles.switchTrack,
                      { backgroundColor: formData.isOnline ? COLORS.brand : '#D1D5DB' },
                    ]}
                    accessibilityLabel="Basculer la visibilité boutique"
                  >
                    <View
                      style={[
                        styles.switchThumb,
                        { left: formData.isOnline ? 28 : 4 },
                      ]}
                    />
                  </Pressable>
                </View>
              </>
            ) : null}

            {currentStep === 2 ? (
              <>
                {/* Prix & stock */}
                <View>
                  <View style={styles.labelLeft}>
                    <Tag size={14} color={COLORS.brand} />
                    <Text style={styles.labelText}>
                      Prix de Vente <Text style={{ color: COLORS.brand }}>*</Text>
                    </Text>
                  </View>
                  <View style={styles.priceWrap}>
                    <TextInput
                      value={formData.price !== undefined ? String(formData.price) : ''}
                      onChangeText={(value) => {
                        setFormData((prev) => ({
                          ...prev,
                          price: value ? parseInt(value, 10) || 0 : undefined,
                        }));
                        if (submitError) setSubmitError(null);
                      }}
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      style={styles.priceInput}
                    />
                    <Text style={styles.priceSuffix}>XOF</Text>
                  </View>
                  <Text style={styles.fieldHint}>Prix de base unitaire standard</Text>
                </View>

                <View>
                  <View style={styles.labelLeft}>
                    <Package size={14} color={COLORS.brand} />
                    <Text style={styles.labelText}>Stock Initial Disponible</Text>
                  </View>
                  <TextInput
                    value={formData.stock !== undefined ? String(formData.stock) : ''}
                    onChangeText={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        stock: value ? parseInt(value, 10) || 0 : undefined,
                      }))
                    }
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    style={styles.stockInput}
                  />
                  <Text style={styles.fieldHint}>
                    {formData.variants.length > 0
                      ? 'Des variantes existent : le stock total sera calculé depuis vos déclinaisons.'
                      : 'Quantité totale disponible en réserve ou rayon.'}
                  </Text>
                </View>

                {/* Unité de vente (shopping) */}
                {formData.businessType === 'shopping' ? (
                  <View>
                    <View style={styles.labelLeft}>
                      <Tag size={14} color={COLORS.brand} />
                      <Text style={styles.labelText}>Unité de vente</Text>
                    </View>
                    <Pressable
                      onPress={() => setUnitPickerOpen(true)}
                      style={[styles.selectField, { marginTop: 8 }]}
                    >
                      <Text style={styles.selectFieldText} numberOfLines={1}>
                        {isCustomUnit
                          ? 'Autre (Saisie libre)...'
                          : UNIT_OPTIONS.find((o) => o.value === formData.unit)?.label ||
                            formData.unit}
                      </Text>
                      <ChevronRight size={16} color="#9CA3AF" />
                    </Pressable>
                    {isCustomUnit ? (
                      <View style={{ marginTop: 12 }}>
                        <TextInput
                          value={formData.unit}
                          onChangeText={(value) => setFormData((prev) => ({ ...prev, unit: value }))}
                          placeholder="Ex: Pack de 100, Fagot, Palette, Flacon..."
                          placeholderTextColor="#9CA3AF"
                          style={styles.customUnitInput}
                        />
                        <Text style={styles.customUnitHint}>
                          Tapez l&apos;unité personnalisée de votre choix
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {/* Durée de livraison / préparation */}
                <View>
                  <View style={styles.labelLeft}>
                    <Clock size={14} color={COLORS.brand} />
                    <Text style={styles.labelText}>Durée de Livraison / Préparation</Text>
                  </View>
                  <Pressable
                    onPress={() => setDeliveryPickerOpen(true)}
                    style={[styles.selectField, { marginTop: 8 }]}
                  >
                    <Text
                      style={[
                        styles.selectFieldText,
                        !formData.deliveryTime && { color: '#9CA3AF' },
                      ]}
                      numberOfLines={1}
                    >
                      {DELIVERY_OPTIONS.find((o) => o.value === formData.deliveryTime)?.label ||
                        'Sélectionnez une durée indicative...'}
                    </Text>
                    <ChevronRight size={16} color="#9CA3AF" />
                  </Pressable>
                </View>

                {/* Tarifs de gros (shopping) */}
                {formData.businessType === 'shopping' ? (
                  <View style={styles.wholesaleSection}>
                    <View style={styles.wholesaleHead}>
                      <View style={styles.wholesaleLeft}>
                        <View style={styles.b2bBadge}>
                          <Text style={styles.b2bBadgeText}>B2B</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.wholesaleTitle}>Tarifs de Gros &amp; Vente B2B</Text>
                          <Text style={styles.wholesaleSubtitle}>
                            Remises automatiques par quantité pour vos clients grossistes
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => {
                          if (wholesaleEnabled) {
                            setFormData((prev) => ({
                              ...prev,
                              wholesalePrice: undefined,
                              wholesaleMinQty: undefined,
                              wholesaleTiers: [],
                            }));
                          } else {
                            const baseP = Number(formData.price) || 0;
                            const initialTier: WholesaleTier = {
                              minQty: 50,
                              price: baseP > 0 ? Math.round(baseP * 50 * 0.85) : 0,
                              unitPrice: baseP > 0 ? Math.round(baseP * 0.85) : 0,
                            };
                            setFormData((prev) => ({
                              ...prev,
                              wholesalePrice: initialTier.price,
                              wholesaleMinQty: initialTier.minQty,
                              wholesaleTiers: [initialTier],
                            }));
                          }
                        }}
                        style={[styles.wholesaleToggle, wholesaleEnabled && styles.wholesaleToggleOn]}
                      >
                        <Text
                          style={[
                            styles.wholesaleToggleText,
                            wholesaleEnabled && styles.wholesaleToggleTextOn,
                          ]}
                        >
                          {wholesaleEnabled ? 'Actif' : 'Activer'}
                        </Text>
                      </Pressable>
                    </View>

                    {wholesaleEnabled ? (
                      <View style={styles.tiersBox}>
                        <View style={styles.tiersHeader}>
                          <Text style={styles.tiersHeaderText}>
                            Paliers de gros configurés ({formData.wholesaleTiers.length})
                          </Text>
                          <Pressable
                            onPress={() => {
                              const tiers = [...formData.wholesaleTiers];
                              const baseP = Number(formData.price) || 0;
                              const lastMinQty = tiers.length > 0 ? tiers[tiers.length - 1].minQty : 50;
                              const nextQty = lastMinQty >= 50 ? lastMinQty + 50 : lastMinQty * 2;
                              const unitRatio = tiers.length > 0 ? 0.75 : 0.85;
                              const nextPrice = baseP > 0 ? Math.round(baseP * nextQty * unitRatio) : 0;
                              tiers.push({
                                minQty: nextQty,
                                price: nextPrice,
                                unitPrice: nextQty > 0 ? Math.round(nextPrice / nextQty) : 0,
                              });
                              const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);
                              setFormData((prev) => ({
                                ...prev,
                                wholesaleTiers: sorted,
                                wholesaleMinQty: sorted[0]?.minQty,
                                wholesalePrice: sorted[0]?.price,
                              }));
                            }}
                            style={styles.addTierBtn}
                          >
                            <Plus size={12} color={COLORS.brand} strokeWidth={3} />
                            <Text style={styles.addTierText}>Ajouter un palier</Text>
                          </Pressable>
                        </View>

                        {formData.wholesaleTiers.map((tier, idx) => {
                          const baseUnitPrice = Number(formData.price) || 0;
                          const minQty = Math.max(1, Number(tier.minQty) || 1);
                          const tierPrice = Number(tier.price) || 0;
                          const effectiveUnit =
                            tierPrice >= baseUnitPrice && minQty > 1
                              ? Math.round(tierPrice / minQty)
                              : tierPrice > 0
                                ? tierPrice
                                : baseUnitPrice;
                          const normalTotal = baseUnitPrice * minQty;
                          const packageTotal =
                            tierPrice >= baseUnitPrice && minQty > 1 ? tierPrice : tierPrice * minQty;
                          const savings = normalTotal > packageTotal ? normalTotal - packageTotal : 0;
                          const savingsPct =
                            normalTotal > 0 && savings > 0
                              ? Math.round((savings / normalTotal) * 100)
                              : 0;
                          return (
                            <View key={idx} style={styles.tierCard}>
                              <View style={styles.tierRow}>
                                <View style={styles.tierNumber}>
                                  <Text style={styles.tierNumberText}>#{idx + 1}</Text>
                                </View>
                                <View style={{ width: 96 }}>
                                  <Text style={styles.tierFieldLabel}>Dès (qté min)</Text>
                                  <TextInput
                                    value={String(tier.minQty)}
                                    onChangeText={(value) => {
                                      const tiers = [...formData.wholesaleTiers];
                                      const newQty = parseInt(value, 10) || 1;
                                      tiers[idx] = {
                                        ...tiers[idx],
                                        minQty: newQty,
                                        unitPrice:
                                          newQty > 0
                                            ? Math.round((tiers[idx].price || 0) / newQty)
                                            : 0,
                                      };
                                      setFormData((prev) => ({
                                        ...prev,
                                        wholesaleTiers: tiers,
                                        wholesaleMinQty: tiers[0]?.minQty,
                                        wholesalePrice: tiers[0]?.price,
                                      }));
                                    }}
                                    keyboardType="number-pad"
                                    placeholder="50"
                                    placeholderTextColor="#9CA3AF"
                                    style={styles.tierInput}
                                  />
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={styles.tierFieldLabel}>Prix total du lot (XOF)</Text>
                                  <TextInput
                                    value={String(tier.price)}
                                    onChangeText={(value) => {
                                      const tiers = [...formData.wholesaleTiers];
                                      const newPrice = parseInt(value, 10) || 0;
                                      const q = Math.max(1, tiers[idx].minQty || 1);
                                      tiers[idx] = {
                                        ...tiers[idx],
                                        price: newPrice,
                                        unitPrice: q > 0 ? Math.round(newPrice / q) : 0,
                                      };
                                      setFormData((prev) => ({
                                        ...prev,
                                        wholesaleTiers: tiers,
                                        wholesaleMinQty: tiers[0]?.minQty,
                                        wholesalePrice: tiers[0]?.price,
                                      }));
                                    }}
                                    keyboardType="number-pad"
                                    placeholder="100000"
                                    placeholderTextColor="#9CA3AF"
                                    style={[styles.tierInput, { color: COLORS.brand }]}
                                  />
                                </View>
                                <Pressable
                                  onPress={() => {
                                    const tiers = formData.wholesaleTiers.filter((_, i) => i !== idx);
                                    setFormData((prev) => ({
                                      ...prev,
                                      wholesaleTiers: tiers,
                                      wholesaleMinQty: tiers[0]?.minQty,
                                      wholesalePrice: tiers[0]?.price,
                                    }));
                                  }}
                                  style={styles.tierDelete}
                                  hitSlop={6}
                                >
                                  <Trash2 size={14} color="#9CA3AF" />
                                </Pressable>
                              </View>
                              <View style={styles.tierSummary}>
                                <Text style={styles.tierSummaryText}>
                                  Soit :{' '}
                                  <Text style={styles.tierSummaryStrong}>
                                    {formatCurrency(effectiveUnit)} / unité
                                  </Text>
                                </Text>
                                {savings > 0 ? (
                                  <View style={styles.tierSavings}>
                                    <Text style={styles.tierSavingsText}>
                                      Économie : −{formatCurrency(savings)}
                                    </Text>
                                    <View style={styles.tierSavingsBadge}>
                                      <Text style={styles.tierSavingsBadgeText}>−{savingsPct}%</Text>
                                    </View>
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : null}

            {currentStep === 3 ? (
              <>
                {/* Bannière d'introduction */}
                <View style={styles.variantBanner}>
                  <View style={styles.variantBannerIcon}>
                    <Sparkles size={18} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.variantBannerTitle}>
                      Options &amp; Déclinaisons du Produit
                    </Text>
                    <Text style={styles.variantBannerText}>
                      Ajoutez des options (ex : <Text style={styles.boldText}>Taille</Text>,{' '}
                      <Text style={styles.boldText}>Couleur</Text>,{' '}
                      <Text style={styles.boldText}>Format</Text>) pour générer automatiquement vos
                      variantes avec leur propre prix, stock et photo.
                    </Text>
                  </View>
                </View>

                <View style={styles.variantEditorBox}>
                  <VariantMatrixEditor
                    options={formData.options}
                    variants={formData.variants}
                    basePrice={Number(formData.price) || 0}
                    images={formData.images}
                    onChange={(options, variants) => {
                      setFormData((prev) => ({ ...prev, options, variants }));
                    }}
                  />
                </View>

                {/* Aperçu avant enregistrement */}
                <View style={styles.previewCard}>
                  <View style={styles.previewHeader}>
                    <View style={styles.labelLeft}>
                      <Check size={14} color="#059669" />
                      <Text style={styles.labelText}>Aperçu avant enregistrement</Text>
                    </View>
                    <View style={styles.readyBadge}>
                      <Text style={styles.readyBadgeText}>Prêt</Text>
                    </View>
                  </View>
                  <View style={styles.previewBody}>
                    <View style={styles.previewThumb}>
                      {formData.images[0] ? (
                        <Image
                          source={{ uri: formData.images[0] }}
                          style={styles.previewImg}
                          contentFit="cover"
                        />
                      ) : (
                        <Package size={20} color="#D1D5DB" />
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.previewName} numberOfLines={1}>
                        {formData.name || 'Sans titre'}
                      </Text>
                      <Text style={styles.previewCategory} numberOfLines={1}>
                        {formData.category} • {formData.isOnline ? 'En ligne' : 'Caisse seule'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.previewPrice}>
                        {(() => {
                          const variantPrices = formData.variants
                            .map((v) => Number(v.price) || 0)
                            .filter((p) => p > 0);
                          if (variantPrices.length > 0) {
                            const min = Math.min(...variantPrices);
                            const max = Math.max(...variantPrices);
                            return min === max
                              ? formatCurrency(min)
                              : `${formatCurrency(min)} - ${formatCurrency(max)}`;
                          }
                          return formData.price !== undefined
                            ? formatCurrency(formData.price)
                            : '0 FCFA';
                        })()}
                      </Text>
                      <Text style={styles.previewStock}>
                        {(() => {
                          const count = formData.variants.length;
                          if (count > 0) {
                            const totalStock = formData.variants.reduce(
                              (acc, v) => acc + (Number(v.stock) || 0),
                              0,
                            );
                            return `${count} variante${count > 1 ? 's' : ''} (${totalStock} en stock)`;
                          }
                          return `${formData.stock ?? 0} en stock`;
                        })()}
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </ScrollView>

          {/* ── Pied ────────────────────────────────────────────────── */}
          <View style={styles.footer}>
            {submitError ? (
              <View style={styles.errorBanner}>
                <AlertCircle size={14} color="#E11D48" />
                <Text style={styles.errorBannerText}>{submitError}</Text>
                <Pressable onPress={() => setSubmitError(null)} hitSlop={8}>
                  <X size={12} color="#FB7185" />
                </Pressable>
              </View>
            ) : null}
            <View style={styles.footerButtons}>
              <Pressable
                onPress={() => {
                  setCurrentStep((prev) => Math.max(1, prev - 1));
                  setSubmitError(null);
                }}
                disabled={currentStep === 1 || isSubmitting}
                style={[styles.prevBtn, (currentStep === 1 || isSubmitting) && { opacity: 0.4 }]}
              >
                <ChevronLeft size={16} color="#6B7280" />
                <Text style={styles.prevBtnText}>Précédent</Text>
              </Pressable>

              {currentStep < 3 ? (
                <Pressable onPress={goNext} style={styles.nextBtn}>
                  <Text style={styles.nextBtnText}>Suivant</Text>
                  <ChevronRight size={14} color="#FFFFFF" />
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  style={[styles.saveBtn, isSubmitting && { opacity: 0.7 }]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ShoppingBag size={15} color="#FFFFFF" />
                  )}
                  <Text style={styles.saveBtnText}>
                    {isSubmitting ? 'Enregistrement...' : 'Enregistrer le produit'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Feuilles de sélection */}
      <PickerSheet
        visible={categoryPickerOpen}
        title="Catégorie & Rayon"
        options={categoryOptions}
        value={formData.category}
        onSelect={(value) =>
          setFormData((prev) => ({
            ...prev,
            category: value,
            mainCategory:
              filteredCategoryMapping[value] || filteredMainCategories[0] || 'Divers',
          }))
        }
        onClose={() => setCategoryPickerOpen(false)}
      />
      <PickerSheet
        visible={unitPickerOpen}
        title="Unité de vente"
        options={UNIT_OPTIONS}
        value={isCustomUnit ? 'custom' : formData.unit}
        onSelect={(value) => {
          if (value === 'custom') {
            setFormData((prev) => ({ ...prev, unit: '' }));
          } else {
            setFormData((prev) => ({ ...prev, unit: value }));
          }
        }}
        onClose={() => setUnitPickerOpen(false)}
      />
      <PickerSheet
        visible={deliveryPickerOpen}
        title="Durée de livraison / préparation"
        options={DELIVERY_OPTIONS}
        value={formData.deliveryTime}
        onSelect={(value) => setFormData((prev) => ({ ...prev, deliveryTime: value }))}
        onClose={() => setDeliveryPickerOpen(false)}
      />

      {/* Source de la photo */}
      <Modal
        visible={photoSourceOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoSourceOpen(false)}
      >
        <Pressable style={styles.photoOverlay} onPress={() => setPhotoSourceOpen(false)}>
          <View style={styles.photoSheet}>
            <Text style={styles.photoSheetTitle}>Ajouter une photo</Text>
            <Pressable
              onPress={() => {
                setPhotoSourceOpen(false);
                void pickImages(false);
              }}
              style={styles.photoSheetRow}
            >
              <ImageIcon size={18} color={COLORS.brand} />
              <Text style={styles.photoSheetRowText}>Choisir dans la galerie</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setPhotoSourceOpen(false);
                void pickImages(true);
              }}
              style={styles.photoSheetRow}
            >
              <Plus size={18} color={COLORS.brand} />
              <Text style={styles.photoSheetRowText}>Prendre une photo</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </Modal>
  );
}

function buildInitialForm(
  product: Product | null,
  channel: 'pos' | 'store',
  businessType: BusinessVertical,
): ProductFormState {
  if (product) {
    const safeOptions = normalizeOptions(product.options);
    const safeVariants = normalizeVariants(product.variants, safeOptions);
    return {
      name: product.name || '',
      price: product.price ?? undefined,
      stock: product.stock ?? undefined,
      category: product.category || 'Général',
      mainCategory:
        product.mainCategory || CATEGORY_MAPPING[product.category || ''] || 'Divers',
      image: product.image || '',
      images:
        Array.isArray(product.images) && product.images.length > 0
          ? product.images
          : product.image
            ? [product.image]
            : [],
      unit: product.unit || 'pièce',
      description: product.description || '',
      isOnline: product.isOnline ?? true,
      wholesalePrice: product.wholesalePrice,
      wholesaleMinQty: product.wholesaleMinQty,
      wholesaleTiers:
        product.wholesaleTiers && product.wholesaleTiers.length > 0
          ? product.wholesaleTiers
          : product.wholesalePrice && product.wholesaleMinQty
            ? [
                {
                  minQty: Number(product.wholesaleMinQty),
                  price: Number(product.wholesalePrice),
                },
              ]
            : [],
      deliveryTime: product.deliveryTime || '',
      preparationTime: product.preparationTime || '',
      businessType,
      options: safeOptions,
      variants: safeVariants,
    };
  }

  return {
    name: '',
    price: undefined,
    stock: undefined,
    category: businessType === 'food' ? 'Plats Cuisinés' : 'Général',
    mainCategory: businessType === 'food' ? 'Restauration & Livraison Rapide' : 'Divers',
    image: '',
    images: [],
    unit: 'pièce',
    description: '',
    isOnline: channel === 'store',
    wholesalePrice: undefined,
    wholesaleMinQty: undefined,
    wholesaleTiers: [],
    deliveryTime: '',
    preparationTime: '',
    businessType,
    options: [],
    variants: [],
  };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'center',
    padding: 12,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
    maxHeight: '92%',
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  headerBadges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FFEDD5',
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.brand,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  stepText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginTop: 4,
  },
  closeBtn: { padding: 8 },

  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    position: 'relative',
  },
  stepsLine: {
    position: 'absolute',
    top: 18,
    left: 40,
    right: 40,
    height: 2,
    backgroundColor: '#F3F4F6',
  },
  stepItem: { alignItems: 'center', flex: 1, gap: 6 },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  stepCircleActive: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
    transform: [{ scale: 1.05 }],
  },
  stepCircleCompleted: { backgroundColor: '#10B981', borderColor: '#10B981' },
  stepLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textAlign: 'center' },
  stepLabelActive: { color: '#111827', fontWeight: '800' },
  stepLabelCompleted: { color: '#047857' },

  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 24, paddingBottom: 32 },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  labelLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  labelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  labelHint: { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
  requiredBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  requiredBadgeText: { fontSize: 10, color: '#EA580C', fontWeight: '700' },
  countBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countBadgeText: { fontSize: 10, color: '#6B7280', fontWeight: '700' },

  nameInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(249,250,251,0.8)',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  textarea: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(249,250,251,0.8)',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 90,
    textAlignVertical: 'top',
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(249,250,251,0.8)',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
  },
  selectFieldText: { fontSize: 14, fontWeight: '600', color: '#111827', flexShrink: 1 },

  photosBox: {
    padding: 16,
    backgroundColor: 'rgba(249,250,251,0.7)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    borderRadius: 16,
  },
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoTile: {
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  photoImg: { width: '100%', height: '100%' },
  photoDelete: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    padding: 4,
  },
  photoMainBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.brand,
    paddingVertical: 2,
  },
  photoMainBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  addPhotoTile: {
    width: 88,
    height: 88,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#FDBA74',
    backgroundColor: 'rgba(255,247,237,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addPhotoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7C2D12',
    textTransform: 'uppercase',
  },
  photoHintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12 },
  photoHint: { flex: 1, fontSize: 10, color: '#6B7280', fontWeight: '500' },

  channelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(255,247,237,0.7)',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 16,
  },
  channelLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  channelIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  channelSubtitle: { fontSize: 12, color: '#6B7280', fontWeight: '500', marginTop: 2 },
  switchTrack: {
    width: 48,
    height: 24,
    borderRadius: 999,
    justifyContent: 'center',
  },
  switchThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },

  priceWrap: { position: 'relative', justifyContent: 'center' },
  priceInput: {
    paddingLeft: 16,
    paddingRight: 56,
    paddingVertical: 12,
    backgroundColor: 'rgba(249,250,251,0.8)',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.brand,
  },
  priceSuffix: {
    position: 'absolute',
    right: 16,
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  fieldHint: { fontSize: 10, color: '#9CA3AF', marginTop: 6, fontWeight: '500' },
  stockInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(249,250,251,0.8)',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  customUnitInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FDBA74',
    borderRadius: 16,
    fontSize: 14,
    fontWeight: '600',
  },
  customUnitHint: { fontSize: 10, color: COLORS.brand, fontWeight: '700', marginTop: 6 },

  wholesaleSection: { paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  wholesaleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(255,247,237,0.5)',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 16,
    marginBottom: 12,
  },
  wholesaleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  b2bBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  b2bBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  wholesaleTitle: { fontSize: 12, fontWeight: '700', color: '#111827' },
  wholesaleSubtitle: { fontSize: 10, color: '#6B7280', fontWeight: '500' },
  wholesaleToggle: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  wholesaleToggleOn: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  wholesaleToggleText: { fontSize: 12, fontWeight: '700', color: '#4B5563' },
  wholesaleToggleTextOn: { color: '#FFFFFF' },
  tiersBox: {
    padding: 12,
    backgroundColor: 'rgba(249,250,251,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(229,231,235,0.8)',
    borderRadius: 16,
    gap: 8,
  },
  tiersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tiersHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  addTierBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  addTierText: { fontSize: 11, fontWeight: '700', color: COLORS.brand },
  tierCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  tierRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  tierNumber: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierNumberText: { fontSize: 12, fontWeight: '700', color: '#C2410C' },
  tierFieldLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  tierInput: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  tierDelete: { padding: 6 },
  tierSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tierSummaryText: { fontSize: 10, fontWeight: '600', color: '#9CA3AF' },
  tierSummaryStrong: { color: '#111827', fontWeight: '700' },
  tierSavings: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tierSavingsText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  tierSavingsBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  tierSavingsBadgeText: { fontSize: 9, color: '#047857', fontWeight: '700' },

  variantBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(255,247,237,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,237,213,0.8)',
    borderRadius: 16,
  },
  variantBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantBannerTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  variantBannerText: { fontSize: 12, color: '#4B5563', marginTop: 2, lineHeight: 18 },
  boldText: { fontWeight: '700', color: '#111827' },
  variantEditorBox: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },

  previewCard: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    gap: 12,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readyBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  readyBadgeText: { fontSize: 10, fontWeight: '700', color: '#065F46' },
  previewBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  previewThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewImg: { width: '100%', height: '100%' },
  previewName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  previewCategory: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  previewPrice: { fontSize: 14, fontWeight: '900', color: COLORS.brand },
  previewStock: { fontSize: 10, fontWeight: '700', color: '#6B7280' },

  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: 'rgba(249,250,251,0.5)',
    gap: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: 12,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#E11D48',
  },
  footerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  prevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  prevBtnText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#111827',
  },
  nextBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: COLORS.brand,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  photoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  photoSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingVertical: 16,
    paddingBottom: 28,
    paddingHorizontal: 12,
  },
  photoSheetTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  photoSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  photoSheetRowText: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
});
