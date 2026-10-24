/**
 * Modale « Télécharger toutes les images » (mobile).
 *
 * Même parcours que le web (`src/components/inventory/ExportProductImagesModal`)
 * : compteur de photos, périmètre (catalogue ou sélection) puis téléchargement
 * d'une archive ZIP construite par le serveur. Sur mobile, le fichier est écrit
 * dans le cache de l'application puis proposé via la feuille de partage native.
 */

import React, { useEffect, useState } from 'react';
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
  AlertCircle,
  CheckCircle2,
  Download,
  FolderArchive,
  Image as ImageIcon,
  Info,
  X,
} from 'lucide-react-native';
import { COLORS } from '@/theme';
import {
  downloadSellerProductImagesZip,
  fetchSellerImagesSummary,
  type SellerImagesSummary,
} from '@/api/seller';

/**
 * Plafonds partagés avec le serveur (`src/lib/product-images-limits.ts`).
 * La sélection voyage dans l'URL de téléchargement (GET natif) : au-delà de
 * 300 produits, l'URL dépasserait les limites des proxys.
 */
const MAX_SELECTED_PRODUCTS = 300;
const MAX_ARCHIVE_IMAGES = 500;

interface ExportProductImagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  storeName?: string;
  selectedProductIds: string[];
  selectedProductsCount: number;
  totalProductsCount: number;
  /** Session expirée ou compte sans accès vendeur → purge côté parent. */
  onUnauthorized: () => void;
}

function countLabel(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value > 1 ? plural : singular}`;
}

export function ExportProductImagesModal({
  isOpen,
  onClose,
  storeId,
  storeName = 'Boutique',
  selectedProductIds,
  selectedProductsCount,
  totalProductsCount,
  onUnauthorized,
}: ExportProductImagesModalProps) {
  const canUseSelection =
    selectedProductsCount > 0 && selectedProductsCount <= MAX_SELECTED_PRODUCTS;

  const [scope, setScope] = useState<'all' | 'selected'>(
    canUseSelection ? 'selected' : 'all',
  );
  const [summary, setSummary] = useState<SellerImagesSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const selectionKey = selectedProductIds.join(',');

  // Réinitialise le périmètre à chaque ouverture.
  useEffect(() => {
    if (!isOpen) return;
    setScope(canUseSelection ? 'selected' : 'all');
    setDownloadSuccess(false);
    setErrorMessage(null);
    setIsDownloading(false);
  }, [isOpen, canUseSelection]);

  // Compteurs du périmètre actif.
  useEffect(() => {
    if (!isOpen || !storeId) return;
    // Sélection hors plafond : l'effet de réinitialisation repasse en « Tous ».
    if (scope === 'selected' && !canUseSelection) return;
    let active = true;

    setIsLoadingSummary(true);
    setSummary(null);
    setErrorMessage(null);
    setDownloadSuccess(false);

    const ids =
      scope === 'selected' && selectionKey ? selectionKey.split(',') : undefined;

    fetchSellerImagesSummary(storeId, ids)
      .then((response) => {
        if (!active) return;
        if (!response.success) {
          if (response.error === 'Unauthorized') {
            onUnauthorized();
            return;
          }
          setErrorMessage(
            response.error || 'Impossible de compter les images de la boutique.',
          );
          return;
        }
        setSummary(response);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Impossible de compter les images de la boutique.',
        );
      })
      .finally(() => {
        if (active) setIsLoadingSummary(false);
      });

    return () => {
      active = false;
    };
    // `onUnauthorized` est stable côté parent ; l'omettre évite un refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, storeId, scope, canUseSelection, selectionKey]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (!storeId || isDownloading || downloadSuccess) return;
    if (scope === 'selected' && !canUseSelection) return;
    setIsDownloading(true);
    setErrorMessage(null);
    setDownloadSuccess(false);

    const ids =
      scope === 'selected' && selectedProductIds.length > 0
        ? selectedProductIds
        : undefined;

    const result = await downloadSellerProductImagesZip(storeId, ids, storeName);
    setIsDownloading(false);

    if (!result.ok) {
      if (result.error === 'Unauthorized') {
        onUnauthorized();
        return;
      }
      setErrorMessage(result.error);
      return;
    }

    setDownloadSuccess(true);
    setTimeout(() => {
      setDownloadSuccess(false);
      onClose();
    }, 1400);
  };

  const imageCount = summary?.imageCount ?? 0;
  const canDownload = !!summary && imageCount > 0 && !isLoadingSummary && !isDownloading;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.panel}>
          {/* En-tête */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <FolderArchive size={24} color={COLORS.brand} />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.headerTitle}>Télécharger les images</Text>
                <Text style={styles.headerSubtitle}>
                  {storeName} • toutes les photos produits dans un ZIP
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
                <AlertCircle size={16} color="#B91C1C" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Compteurs */}
            <View style={styles.countCard}>
              {isLoadingSummary ? (
                <View style={styles.countRow}>
                  <ActivityIndicator size="small" color={COLORS.brand} />
                  <Text style={styles.countSubtitle}>Comptage des photos en cours…</Text>
                </View>
              ) : !summary ? (
                <View style={styles.countRow}>
                  <Info size={18} color="#9CA3AF" />
                  <Text style={styles.countSubtitle}>
                    Compteurs indisponibles pour le moment.
                  </Text>
                </View>
              ) : imageCount === 0 ? (
                <View style={styles.countRow}>
                  <View style={styles.countIconMuted}>
                    <ImageIcon size={20} color="#B45309" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.countTitle}>Aucune photo à télécharger</Text>
                    <Text style={styles.countSubtitle}>
                      {scope === 'selected'
                        ? 'Les produits sélectionnés n’ont pas encore de photo.'
                        : 'Ajoutez des photos à vos produits puis revenez ici.'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.countRow}>
                  <View style={styles.countIcon}>
                    <ImageIcon size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.countTitle}>
                      {countLabel(imageCount, 'photo')} prête{imageCount > 1 ? 's' : ''} à
                      télécharger
                    </Text>
                    <Text style={styles.countSubtitle}>
                      {countLabel(summary?.productsWithImages ?? 0, 'produit')} avec image
                      {summary?.productsWithoutImages
                        ? ` • ${summary.productsWithoutImages} sans photo`
                        : ''}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* 1. Périmètre */}
            <View>
              <Text style={styles.sectionLabel}>1. Périmètre</Text>
              <Pressable
                onPress={() => setScope('all')}
                style={[styles.scopeCard, scope === 'all' && styles.scopeCardActive]}
              >
                <View style={[styles.radio, scope === 'all' && styles.radioActive]}>
                  {scope === 'all' ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.scopeTitle}>Tous les produits</Text>
                  <Text style={styles.scopeSubtitle}>
                    Catalogue complet ({totalProductsCount})
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  if (canUseSelection) setScope('selected');
                }}
                style={[
                  styles.scopeCard,
                  scope === 'selected' && styles.scopeCardActive,
                  !canUseSelection && styles.scopeCardDisabled,
                ]}
              >
                <View style={[styles.radio, scope === 'selected' && styles.radioActive]}>
                  {scope === 'selected' ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.scopeTitle}>Sélection ({selectedProductsCount})</Text>
                  <Text style={styles.scopeSubtitle}>
                    {selectedProductsCount === 0
                      ? 'Aucun produit coché'
                      : canUseSelection
                        ? 'Produits cochés dans la liste'
                        : `Maximum ${MAX_SELECTED_PRODUCTS} produits — utilisez « Tous les produits »`}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* 2. Contenu */}
            <View>
              <Text style={styles.sectionLabel}>2. Contenu de l’archive</Text>
              <View style={styles.infoBox}>
                <View style={styles.infoRow}>
                  <Info size={14} color={COLORS.brand} style={styles.infoIcon} />
                  <Text style={styles.infoText}>
                    Toutes les photos dans un seul dossier. Les produits qui ont plusieurs
                    photos reçoivent leur propre sous-dossier.
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Info size={14} color={COLORS.brand} style={styles.infoIcon} />
                  <Text style={styles.infoText}>
                    Un fichier manifeste-images.csv relie chaque photo au produit, à son rôle
                    et à sa taille.
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Info size={14} color={COLORS.brand} style={styles.infoIcon} />
                  <Text style={styles.infoText}>
                    Vous pourrez enregistrer l’archive ou l’envoyer par WhatsApp, e-mail ou
                    Drive.
                  </Text>
                </View>
              </View>
              {imageCount > MAX_ARCHIVE_IMAGES ? (
                <Text style={styles.limitNote}>
                  Une archive contient au plus {MAX_ARCHIVE_IMAGES} images. Le reste peut être
                  récupéré en relançant l’export sur une sélection de produits.
                </Text>
              ) : null}
            </View>
          </ScrollView>

          {/* Pied */}
          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Annuler</Text>
            </Pressable>
            <Pressable
              onPress={handleDownload}
              disabled={!canDownload || downloadSuccess}
              style={[
                styles.downloadBtn,
                downloadSuccess && styles.downloadBtnSuccess,
                !canDownload && { opacity: 0.5 },
              ]}
            >
              {isDownloading ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.downloadText}>Préparation du ZIP…</Text>
                </>
              ) : downloadSuccess ? (
                <>
                  <CheckCircle2 size={16} color="#FFFFFF" />
                  <Text style={styles.downloadText}>Archive prête !</Text>
                </>
              ) : (
                <>
                  <Download size={16} color="#FFFFFF" />
                  <Text style={styles.downloadText}>
                    {imageCount > 0
                      ? `Télécharger ${countLabel(imageCount, 'image')}`
                      : 'Télécharger les images'}
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
  },
  errorText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#B91C1C' },
  countCard: {
    padding: 16,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 16,
  },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  countIcon: { padding: 10, backgroundColor: COLORS.brand, borderRadius: 12 },
  countIconMuted: { padding: 10, backgroundColor: '#FEF3C7', borderRadius: 12 },
  countTitle: { fontSize: 14, fontWeight: '800', color: '#111827' },
  countSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2, lineHeight: 17 },
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
  infoBox: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 16,
    gap: 10,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoIcon: { marginTop: 2 },
  infoText: { flex: 1, fontSize: 12, color: '#4B5563', lineHeight: 17 },
  limitNote: { fontSize: 11, color: '#B45309', lineHeight: 16, marginTop: 10 },
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
  downloadBtn: {
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
  downloadBtnSuccess: { backgroundColor: '#059669' },
  downloadText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});
