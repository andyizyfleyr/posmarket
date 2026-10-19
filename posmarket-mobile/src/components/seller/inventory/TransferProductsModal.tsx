/**
 * Modale « Copier / Transférer vers une autre boutique » — copie fidèle de
 * `src/components/inventory/TransferProductsModal.tsx` du web (rendu mobile).
 *
 * Adaptations mobiles : liste des boutiques en une colonne, champ
 * d'ajustement tarifaire numérique natif.
 */

import React, { useEffect, useState } from 'react';
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
import { AlertCircle, ArrowRightLeft, CheckCircle2, Store, X } from 'lucide-react-native';
import { COLORS } from '@/theme';
import { fetchSellerManageableStores, transferSellerProducts } from '@/api/seller';
import type { Product } from '@/types';

interface ManageableStore {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  isOwner: boolean;
}

interface TransferProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceStoreId: string;
  sourceStoreName?: string;
  selectedProductIds: string[];
  selectedProductsCount: number;
  totalProductsCount: number;
  localProducts?: Product[];
  onTransferSuccess: (summary: {
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
  }) => void;
}

export function TransferProductsModal({
  isOpen,
  onClose,
  sourceStoreId,
  sourceStoreName = 'Boutique source',
  selectedProductIds,
  selectedProductsCount,
  totalProductsCount,
  onTransferSuccess,
}: TransferProductsModalProps) {
  const [scope, setScope] = useState<'all' | 'selected'>(
    selectedProductsCount > 0 ? 'selected' : 'all',
  );
  const [availableStores, setAvailableStores] = useState<ManageableStore[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [targetStoreId, setTargetStoreId] = useState('');

  const [copyStock, setCopyStock] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update' | 'create_new'>(
    'skip',
  );
  const [priceAdjustmentType, setPriceAdjustmentType] = useState<'none' | 'percent' | 'fixed'>(
    'none',
  );
  const [priceAdjustmentValue, setPriceAdjustmentValue] = useState('');
  const [forceOnlineStatus] = useState<'keep' | 'online' | 'pos'>('keep');

  const [isTransferring, setIsTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState<{
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    errors: string[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setIsLoadingStores(true);
    fetchSellerManageableStores()
      .then((res) => {
        if (!active) return;
        if (res.success && res.stores) {
          const filtered = res.stores.filter((s) => s.id !== sourceStoreId);
          setAvailableStores(filtered);
          if (filtered.length > 0) {
            setTargetStoreId((prev) => prev || filtered[0].id);
          }
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsLoadingStores(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, sourceStoreId]);

  if (!isOpen) return null;

  const countToTransfer = scope === 'selected' ? selectedProductsCount : totalProductsCount;
  const targetStore = availableStores.find((s) => s.id === targetStoreId);

  const handleTransfer = async () => {
    if (!targetStoreId) {
      setErrorMessage('Veuillez sélectionner une boutique de destination.');
      return;
    }

    setIsTransferring(true);
    setErrorMessage(null);
    setTransferResult(null);

    try {
      const productIds = scope === 'selected' ? selectedProductIds : [];
      const adjustment = parseFloat(priceAdjustmentValue.replace(',', '.')) || 0;
      const percentAdj = priceAdjustmentType === 'percent' ? adjustment : undefined;
      const fixedAdj = priceAdjustmentType === 'fixed' ? adjustment : undefined;

      const res = await transferSellerProducts(sourceStoreId, targetStoreId, productIds, {
        duplicateStrategy,
        copyStock,
        priceAdjustmentPercent: percentAdj,
        priceAdjustmentFixed: fixedAdj,
        forceOnlineStatus,
      });

      if (!res.success) {
        throw new Error(res.error || 'Erreur lors du transfert.');
      }

      setTransferResult({
        createdCount: res.createdCount,
        updatedCount: res.updatedCount,
        skippedCount: res.skippedCount,
        errors: res.errors || [],
      });

      onTransferSuccess({
        createdCount: res.createdCount,
        updatedCount: res.updatedCount,
        skippedCount: res.skippedCount,
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Erreur lors du transfert.');
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          {/* En-tête */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <ArrowRightLeft size={24} color="#2563EB" />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.headerTitle}>
                  Copier / Transférer vers une autre boutique
                </Text>
                <Text style={styles.headerSubtitle}>
                  De : <Text style={styles.headerStrong}>{sourceStoreName}</Text>
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Fermer">
              <X size={20} color="#9CA3AF" />
            </Pressable>
          </View>

          {/* Contenu */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {errorMessage ? (
              <View style={styles.errorBox}>
                <AlertCircle size={18} color="#EF4444" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {!transferResult ? (
              <>
                {/* 1. Boutique de destination */}
                <View>
                  <Text style={styles.sectionLabel}>1. Boutique de destination</Text>

                  {isLoadingStores ? (
                    <View style={styles.loadingStores}>
                      <ActivityIndicator size="small" color="#2563EB" />
                      <Text style={styles.loadingStoresText}>Chargement de vos boutiques...</Text>
                    </View>
                  ) : availableStores.length === 0 ? (
                    <View style={styles.noStoreBox}>
                      <Text style={styles.noStoreTitle}>Aucune autre boutique disponible</Text>
                      <Text style={styles.noStoreText}>
                        Vous n&apos;avez pas d&apos;autre boutique sous votre compte. Créez une
                        nouvelle boutique depuis le menu pour pouvoir transférer des produits entre
                        boutiques.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {availableStores.map((s) => (
                        <Pressable
                          key={s.id}
                          onPress={() => setTargetStoreId(s.id)}
                          style={[
                            styles.storeCard,
                            targetStoreId === s.id && styles.storeCardActive,
                          ]}
                        >
                          <View
                            style={[
                              styles.storeIcon,
                              s.businessType === 'food'
                                ? styles.storeIconFood
                                : styles.storeIconShopping,
                            ]}
                          >
                            <Store
                              size={18}
                              color={s.businessType === 'food' ? '#B45309' : '#C2410C'}
                            />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.storeName} numberOfLines={1}>
                              {s.name}
                            </Text>
                            <Text style={styles.storeMeta}>
                              {s.businessType === 'food' ? 'Resto' : 'Shop'} •{' '}
                              {s.isOwner ? 'Propriétaire' : 'Équipe'}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>

                {/* 2. Produits */}
                <View>
                  <Text style={styles.sectionLabel}>2. Produits à transférer</Text>
                  <View style={styles.scopeRow}>
                    <Pressable
                      onPress={() => setScope('all')}
                      style={[styles.scopeCard, scope === 'all' && styles.scopeCardActive]}
                    >
                      <View style={[styles.radio, scope === 'all' && styles.radioActive]}>
                        {scope === 'all' ? <View style={styles.radioDot} /> : null}
                      </View>
                      <Text style={styles.scopeText}>
                        Tous les produits ({totalProductsCount})
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        if (selectedProductsCount > 0) setScope('selected');
                      }}
                      style={[
                        styles.scopeCard,
                        scope === 'selected' && styles.scopeCardActive,
                        selectedProductsCount === 0 && { opacity: 0.4 },
                      ]}
                    >
                      <View style={[styles.radio, scope === 'selected' && styles.radioActive]}>
                        {scope === 'selected' ? <View style={styles.radioDot} /> : null}
                      </View>
                      <Text style={styles.scopeText}>Sélection ({selectedProductsCount})</Text>
                    </Pressable>
                  </View>
                </View>

                {/* 3. Options & ajustements */}
                <View style={styles.optionsSection}>
                  <Text style={styles.sectionLabel}>3. Options & Ajustements</Text>

                  <View style={styles.copyStockBox}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.optionTitle}>Copier les quantités en stock</Text>
                      <Text style={styles.optionSubtitle}>
                        {copyStock
                          ? 'Conserve les mêmes stocks dans la nouvelle boutique'
                          : 'Initialise les stocks à 0 dans la boutique de destination (Recommandé)'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setCopyStock((prev) => !prev)}
                      style={[styles.checkbox, copyStock && styles.checkboxBlue]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: copyStock }}
                    >
                      {copyStock ? <CheckCircle2 size={16} color="#FFFFFF" /> : null}
                    </Pressable>
                  </View>

                  <Text style={styles.optionTitle}>Ajustement tarifaire pour la boutique cible :</Text>
                  <View style={styles.threeRow}>
                    {[
                      { id: 'none', label: 'Prix identiques' },
                      { id: 'percent', label: 'Pourcentage (+/- %)' },
                      { id: 'fixed', label: 'Montant fixe (+/-)' },
                    ].map((m) => (
                      <Pressable
                        key={m.id}
                        onPress={() =>
                          setPriceAdjustmentType(m.id as 'none' | 'percent' | 'fixed')
                        }
                        style={[
                          styles.choiceBtn,
                          priceAdjustmentType === m.id && styles.choiceBtnBlue,
                        ]}
                      >
                        <Text
                          style={[
                            styles.choiceText,
                            priceAdjustmentType === m.id && styles.choiceTextActive,
                          ]}
                        >
                          {m.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {priceAdjustmentType !== 'none' ? (
                    <View style={styles.adjustRow}>
                      <Text style={styles.adjustLabel}>
                        {priceAdjustmentType === 'percent'
                          ? 'Variation (%) :'
                          : 'Montant (+/- FCFA) :'}
                      </Text>
                      <TextInput
                        value={priceAdjustmentValue}
                        onChangeText={setPriceAdjustmentValue}
                        placeholder="Ex: 10 ou -5"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numbers-and-punctuation"
                        style={styles.adjustInput}
                      />
                      <Text style={styles.adjustHint}>
                        {priceAdjustmentType === 'percent' ? 'ex: +10% ou -5%' : 'ex: +1000 FCFA'}
                      </Text>
                    </View>
                  ) : null}

                  <Text style={styles.optionTitle}>
                    Si le produit existe déjà dans la boutique cible :
                  </Text>
                  <View style={styles.threeRow}>
                    {[
                      { id: 'skip', label: 'Ignorer' },
                      { id: 'update', label: 'Mettre à jour' },
                      { id: 'create_new', label: 'Créer doublon' },
                    ].map((d) => (
                      <Pressable
                        key={d.id}
                        onPress={() =>
                          setDuplicateStrategy(d.id as 'skip' | 'update' | 'create_new')
                        }
                        style={[
                          styles.choiceBtn,
                          duplicateStrategy === d.id && styles.choiceBtnDark,
                        ]}
                      >
                        <Text
                          style={[
                            styles.choiceText,
                            duplicateStrategy === d.id && styles.choiceTextActive,
                          ]}
                        >
                          {d.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            ) : (
              /* Résultat */
              <View style={styles.resultBox}>
                <View style={styles.resultIcon}>
                  <CheckCircle2 size={36} color="#2563EB" />
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.resultTitle}>Transfert terminé avec succès !</Text>
                  <Text style={styles.resultText}>
                    Les produits ont été dupliqués vers{' '}
                    <Text style={styles.headerStrong}>{targetStore?.name}</Text>.
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <View style={[styles.resultCard, styles.resultCardGreen]}>
                    <Text style={[styles.resultValue, { color: '#047857' }]}>
                      +{transferResult.createdCount}
                    </Text>
                    <Text style={[styles.resultLabel, { color: '#059669' }]}>Créés</Text>
                  </View>
                  <View style={[styles.resultCard, styles.resultCardBlue]}>
                    <Text style={[styles.resultValue, { color: '#1D4ED8' }]}>
                      {transferResult.updatedCount}
                    </Text>
                    <Text style={[styles.resultLabel, { color: '#2563EB' }]}>Mis à jour</Text>
                  </View>
                  <View style={[styles.resultCard, styles.resultCardGray]}>
                    <Text style={[styles.resultValue, { color: '#4B5563' }]}>
                      {transferResult.skippedCount}
                    </Text>
                    <Text style={[styles.resultLabel, { color: '#6B7280' }]}>Ignorés</Text>
                  </View>
                </View>
                {transferResult.errors.length > 0 ? (
                  <View style={styles.resultErrors}>
                    <Text style={styles.resultErrorsTitle}>
                      Avertissements ({transferResult.errors.length}) :
                    </Text>
                    {transferResult.errors.map((e, idx) => (
                      <Text key={idx} style={styles.resultErrorLine}>
                        • {e}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>

          {/* Pied */}
          <View style={styles.footer}>
            {!transferResult ? (
              <>
                <Pressable onPress={onClose} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Annuler</Text>
                </Pressable>
                <Pressable
                  onPress={handleTransfer}
                  disabled={isTransferring || availableStores.length === 0 || countToTransfer === 0}
                  style={[
                    styles.transferBtn,
                    (isTransferring || availableStores.length === 0 || countToTransfer === 0) && {
                      opacity: 0.5,
                    },
                  ]}
                >
                  {isTransferring ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.transferText}>Transfert en cours...</Text>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft size={16} color="#FFFFFF" />
                      <Text style={styles.transferText}>
                        Transférer {countToTransfer} produit{countToTransfer > 1 ? 's' : ''}
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            ) : (
              <Pressable onPress={onClose} style={styles.darkBtn}>
                <Text style={styles.darkBtnText}>Fermer</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 12,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: 'rgba(249,250,251,0.9)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  headerIcon: { padding: 12, backgroundColor: 'rgba(37,99,235,0.1)', borderRadius: 16 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  headerStrong: { fontWeight: '700', color: '#1F2937' },
  closeBtn: { padding: 8 },
  body: { flexGrow: 0 },
  bodyContent: { padding: 20, gap: 20 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
  },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#B91C1C', lineHeight: 17 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  loadingStores: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
  },
  loadingStoresText: { fontSize: 12, color: '#6B7280' },
  noStoreBox: {
    padding: 16,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    gap: 4,
  },
  noStoreTitle: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  noStoreText: { fontSize: 12, color: '#92400E', lineHeight: 17 },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  storeCardActive: { borderColor: '#3B82F6', backgroundColor: 'rgba(239,246,255,0.5)' },
  storeIcon: { padding: 8, borderRadius: 12 },
  storeIconFood: { backgroundColor: '#FEF3C7' },
  storeIconShopping: { backgroundColor: '#FFEDD5' },
  storeName: { fontSize: 12, fontWeight: '700', color: '#111827' },
  storeMeta: {
    fontSize: 10,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  scopeRow: { flexDirection: 'row', gap: 10 },
  scopeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  scopeCardActive: { borderColor: '#3B82F6', backgroundColor: 'rgba(239,246,255,0.4)' },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: '#2563EB' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' },
  scopeText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#111827' },
  optionsSection: { gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  copyStockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
  },
  optionTitle: { fontSize: 12, fontWeight: '700', color: '#111827' },
  optionSubtitle: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBlue: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  threeRow: { flexDirection: 'row', gap: 6 },
  choiceBtn: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  choiceBtnBlue: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  choiceBtnDark: { backgroundColor: '#111827', borderColor: '#111827' },
  choiceText: { fontSize: 10, fontWeight: '700', color: '#4B5563', textAlign: 'center' },
  choiceTextActive: { color: '#FFFFFF' },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(239,246,255,0.5)',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 12,
  },
  adjustLabel: { fontSize: 12, fontWeight: '600', color: '#374151' },
  adjustInput: {
    width: 112,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  adjustHint: { fontSize: 11, color: '#6B7280' },
  resultBox: { paddingVertical: 24, gap: 20, alignItems: 'center' },
  resultIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: { fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center' },
  resultText: { fontSize: 12, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  resultRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  resultCard: { flex: 1, padding: 12, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  resultCardGreen: { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' },
  resultCardBlue: { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' },
  resultCardGray: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  resultValue: { fontSize: 20, fontWeight: '900' },
  resultLabel: { fontSize: 11, fontWeight: '700' },
  resultErrors: {
    alignSelf: 'stretch',
    padding: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    gap: 4,
  },
  resultErrorsTitle: { fontSize: 12, fontWeight: '700', color: '#92400E', marginBottom: 2 },
  resultErrorLine: { fontSize: 12, color: '#92400E' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelText: { fontSize: 13, fontWeight: '700', color: '#4B5563' },
  transferBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: '#2563EB',
  },
  transferText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  darkBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: '#111827',
  },
  darkBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});
