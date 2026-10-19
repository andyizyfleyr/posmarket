/**
 * Modale « Exporter les produits » — copie fidèle de
 * `src/components/inventory/ExportProductsModal.tsx` du web (rendu mobile).
 *
 * Seul écart : le téléchargement navigateur est remplacé par la feuille de
 * partage native (`triggerFileDownload` → `shareTextFile`).
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CheckCircle2,
  Download,
  FileCode,
  FileSpreadsheet,
  Sparkles,
  X,
} from 'lucide-react-native';
import { COLORS } from '@/theme';
import type { BusinessVertical, Product } from '@/types';
import { exportSellerProducts } from '@/api/seller';
import {
  generateProductsCSV,
  generateProductsJSON,
  triggerFileDownload,
} from '@/utils/product-import-export';

interface ExportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  storeName?: string;
  businessType?: BusinessVertical;
  selectedProductsCount: number;
  selectedProductIds: string[];
  totalProductsCount: number;
  localProducts?: Product[];
}

export function ExportProductsModal({
  isOpen,
  onClose,
  storeId,
  storeName = 'Boutique',
  businessType = 'shopping',
  selectedProductsCount,
  selectedProductIds,
  totalProductsCount,
  localProducts = [],
}: ExportProductsModalProps) {
  const [scope, setScope] = useState<'all' | 'selected'>(
    selectedProductsCount > 0 ? 'selected' : 'all',
  );
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    setExportSuccess(false);

    try {
      const filterIds = scope === 'selected' ? selectedProductIds : undefined;
      let productsToExport: Product[] = [];

      // Si portée « sélection » et produits déjà connus localement.
      if (
        scope === 'selected' &&
        localProducts.length > 0 &&
        selectedProductIds.length <= localProducts.length
      ) {
        const selectedMap = new Set(selectedProductIds);
        const filtered = localProducts.filter((p) => selectedMap.has(p.id));
        if (filtered.length === selectedProductIds.length) {
          productsToExport = filtered;
        }
      }

      if (productsToExport.length === 0) {
        const res = await exportSellerProducts(storeId, filterIds);
        if (!res.success || !res.products) {
          throw new Error(res.error || "Impossible d'exporter les produits.");
        }
        productsToExport = res.products as unknown as Product[];
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      const safeStoreSlug = storeName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      if (format === 'json') {
        const jsonContent = generateProductsJSON(productsToExport as never, {
          id: storeId,
          name: storeName,
          businessType,
        });
        const filename = `export-produits-${safeStoreSlug}-${dateStr}.json`;
        await triggerFileDownload(jsonContent, filename, 'application/json;charset=utf-8');
      } else {
        const csvContent = generateProductsCSV(productsToExport as never, { delimiter: ';' });
        const filename = `export-produits-${safeStoreSlug}-${dateStr}.csv`;
        await triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8');
      }

      setExportSuccess(true);
      setTimeout(() => {
        onClose();
        setExportSuccess(false);
      }, 1200);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Erreur lors de l'export.");
    } finally {
      setIsExporting(false);
    }
  };

  const countToExport = scope === 'selected' ? selectedProductsCount : totalProductsCount;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          {/* En-tête */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Download size={24} color={COLORS.brand} />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.headerTitle}>Exporter les produits</Text>
                <Text style={styles.headerSubtitle}>
                  {storeName} • {totalProductsCount} produit{totalProductsCount > 1 ? 's' : ''} au
                  total
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Fermer">
              <X size={20} color="#9CA3AF" />
            </Pressable>
          </View>

          {/* Corps */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* 1. Périmètre */}
            <View>
              <Text style={styles.sectionLabel}>1. Périmètre de l&apos;export</Text>
              <Pressable
                onPress={() => setScope('all')}
                style={[styles.scopeCard, scope === 'all' && styles.scopeCardActive]}
              >
                <View style={[styles.radio, scope === 'all' && styles.radioActive]}>
                  {scope === 'all' ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.scopeTitle}>Tous les produits</Text>
                  <Text style={styles.scopeSubtitle}>Catalogue complet ({totalProductsCount})</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (selectedProductsCount > 0) setScope('selected');
                }}
                style={[
                  styles.scopeCard,
                  scope === 'selected' && styles.scopeCardActive,
                  selectedProductsCount === 0 && styles.scopeCardDisabled,
                ]}
              >
                <View style={[styles.radio, scope === 'selected' && styles.radioActive]}>
                  {scope === 'selected' ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.scopeTitle}>Sélection ({selectedProductsCount})</Text>
                  <Text style={styles.scopeSubtitle}>
                    {selectedProductsCount > 0
                      ? 'Produits cochés dans la liste'
                      : 'Aucun produit coché'}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* 2. Format */}
            <View>
              <Text style={styles.sectionLabel}>2. Format de fichier</Text>
              <Pressable
                onPress={() => setFormat('json')}
                style={[styles.formatCard, format === 'json' && styles.formatCardActive]}
              >
                <View style={[styles.formatIcon, format === 'json' && styles.formatIconActive]}>
                  <FileCode size={20} color={format === 'json' ? '#FFFFFF' : '#4B5563'} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.formatTitleRow}>
                    <Text style={styles.formatTitle}>JSON Structuré</Text>
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedText}>Recommandé</Text>
                    </View>
                  </View>
                  <Text style={styles.formatText}>
                    Inclut les variantes, les options, les galeries photos et les tarifs de gros.
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => setFormat('csv')}
                style={[styles.formatCard, format === 'csv' && styles.formatCardActive]}
              >
                <View style={[styles.formatIcon, format === 'csv' && styles.formatIconActive]}>
                  <FileSpreadsheet size={20} color={format === 'csv' ? '#FFFFFF' : '#4B5563'} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.formatTitleRow}>
                    <Text style={styles.formatTitle}>Tableur CSV (Excel / Sheets)</Text>
                    <View style={styles.spreadsheetBadge}>
                      <Text style={styles.spreadsheetText}>Tableur</Text>
                    </View>
                  </View>
                  <Text style={styles.formatText}>
                    Fichier UTF-8 séparé par des points-virgules, prêt à ouvrir dans Microsoft
                    Excel, Google Sheets ou LibreOffice.
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Note */}
            <View style={styles.noteBox}>
              <Sparkles size={18} color={COLORS.brand} />
              <Text style={styles.noteText}>
                Les fichiers exportés peuvent être directement réimportés dans n&apos;importe
                laquelle de vos boutiques.
              </Text>
            </View>
          </ScrollView>

          {/* Pied */}
          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              onPress={handleExport}
              disabled={isExporting || countToExport === 0}
              style={[
                styles.exportBtn,
                exportSuccess && styles.exportBtnSuccess,
                (isExporting || countToExport === 0) && { opacity: 0.5 },
              ]}
            >
              {isExporting ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.exportText}>Génération en cours...</Text>
                </>
              ) : exportSuccess ? (
                <>
                  <CheckCircle2 size={16} color="#FFFFFF" />
                  <Text style={styles.exportText}>Téléchargé !</Text>
                </>
              ) : (
                <>
                  <Download size={16} color="#FFFFFF" />
                  <Text style={styles.exportText}>
                    Télécharger {countToExport} produit{countToExport > 1 ? 's' : ''} (
                    {format.toUpperCase()})
                  </Text>
                </>
              )}
            </Pressable>
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
  headerIcon: {
    padding: 12,
    backgroundColor: 'rgba(245,107,42,0.1)',
    borderRadius: 16,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  closeBtn: { padding: 8 },
  body: { flexGrow: 0 },
  bodyContent: { padding: 20, gap: 22 },
  errorBox: {
    padding: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
  },
  errorText: { fontSize: 12, fontWeight: '600', color: '#B91C1C' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  scopeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  scopeCardActive: { borderColor: COLORS.brand, backgroundColor: 'rgba(255,247,237,0.35)' },
  scopeCardDisabled: { opacity: 0.4 },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: COLORS.brand },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brand },
  scopeTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  scopeSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  formatCardActive: { borderColor: COLORS.brand, backgroundColor: 'rgba(255,247,237,0.35)' },
  formatIcon: { padding: 10, borderRadius: 12, backgroundColor: '#F3F4F6' },
  formatIconActive: { backgroundColor: COLORS.brand },
  formatTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  formatTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  recommendedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#D1FAE5',
    borderRadius: 999,
  },
  recommendedText: { fontSize: 10, fontWeight: '800', color: '#047857', textTransform: 'uppercase' },
  spreadsheetBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
  },
  spreadsheetText: { fontSize: 10, fontWeight: '800', color: '#1D4ED8', textTransform: 'uppercase' },
  formatText: { fontSize: 12, color: '#6B7280', marginTop: 4, lineHeight: 17 },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 16,
  },
  noteText: { flex: 1, fontSize: 12, color: '#4B5563' },
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
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: COLORS.brand,
  },
  exportBtnSuccess: { backgroundColor: '#059669' },
  exportText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});
