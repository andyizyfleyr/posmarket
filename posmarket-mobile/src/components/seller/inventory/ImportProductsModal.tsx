/**
 * Modale « Importer des produits » — copie fidèle de
 * `src/components/inventory/ImportProductsModal.tsx` du web (rendu mobile).
 *
 * Adaptations mobiles assumées :
 * - la zone de glisser-déposer devient un bouton d'ouverture du sélecteur de
 *   fichiers natif (`expo-document-picker`) ;
 * - les modèles CSV partent par la feuille de partage native ;
 * - le tableau d'aperçu défile horizontalement (5 colonnes conservées).
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
import { Image } from 'expo-image';
import {
  AlertCircle,
  CheckCircle2,
  FileCode,
  FileDown,
  FileSpreadsheet,
  RefreshCw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react-native';
import { COLORS } from '@/theme';
import { formatCurrency } from '@/utils';
import { pickTextFile } from '@/utils/files';
import { importSellerProducts } from '@/api/seller';
import {
  generateCSVExample,
  generateCSVTemplate,
  parseProductsCSV,
  parseProductsJSON,
  triggerFileDownload,
  type ImportParseResult,
} from '@/utils/product-import-export';

interface ImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetStoreId: string;
  targetStoreName?: string;
  businessType?: 'shopping' | 'food';
  onImportSuccess: (summary: {
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
  }) => void;
}

export function ImportProductsModal({
  isOpen,
  onClose,
  targetStoreId,
  targetStoreName = 'Boutique',
  businessType = 'shopping',
  onImportSuccess,
}: ImportProductsModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<'csv' | 'json'>('csv');
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update' | 'create_new'>(
    'skip',
  );
  const [resetStock, setResetStock] = useState(false);
  const [forceOnlineStatus, setForceOnlineStatus] = useState<'keep' | 'online' | 'pos'>('keep');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<{
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    errors: string[];
  } | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('upload');
    setFileName('');
    setParseResult(null);
    setImportResult(null);
    setGeneralError(null);
    setIsProcessing(false);
  };

  const processContent = (name: string, content: string) => {
    setFileName(name);
    setGeneralError(null);

    const isJson = name.toLowerCase().endsWith('.json');
    const isCsv =
      name.toLowerCase().endsWith('.csv') || name.toLowerCase().endsWith('.txt');

    if (!isJson && !isCsv) {
      setGeneralError('Veuillez sélectionner un fichier valide (.csv ou .json).');
      return;
    }

    setFileType(isJson ? 'json' : 'csv');

    try {
      const result = isJson ? parseProductsJSON(content) : parseProductsCSV(content);

      if (result.valid.length === 0 && result.errors.length > 0) {
        setGeneralError(result.errors[0]?.reason || 'Aucun produit valide trouvé.');
        return;
      }

      setParseResult(result);
      setStep('preview');
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : 'Erreur de lecture du fichier.');
    }
  };

  const handlePickFile = async () => {
    try {
      const file = await pickTextFile({
        mimeTypes: ['text/csv', 'application/json', 'text/plain', '*/*'],
      });
      if (!file) return;
      if (!file.content || file.content.length === 0) {
        setGeneralError('Impossible de lire le contenu du fichier.');
        return;
      }
      processContent(file.name, file.content);
    } catch {
      setGeneralError('Une erreur est survenue lors du chargement du fichier.');
    }
  };

  const handleDownloadTemplate = async () => {
    const csvContent = generateCSVTemplate(businessType);
    await triggerFileDownload(
      csvContent,
      `modele-produits-${businessType}.csv`,
      'text/csv;charset=utf-8',
    );
  };

  const handleDownloadExample = async () => {
    const csvContent = generateCSVExample(businessType);
    await triggerFileDownload(
      csvContent,
      `exemple-produits-${businessType}.csv`,
      'text/csv;charset=utf-8',
    );
  };

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.valid.length === 0) return;

    setIsProcessing(true);
    setStep('importing');
    setGeneralError(null);

    try {
      const res = await importSellerProducts(targetStoreId, parseResult.valid as never, {
        duplicateStrategy,
        resetStock,
        forceOnlineStatus,
      });

      if (!res.success) {
        throw new Error(res.error || "Une erreur est survenue lors de l'import.");
      }

      setImportResult({
        createdCount: res.createdCount,
        updatedCount: res.updatedCount,
        skippedCount: res.skippedCount,
        errors: res.errors || [],
      });

      onImportSuccess({
        createdCount: res.createdCount,
        updatedCount: res.updatedCount,
        skippedCount: res.skippedCount,
      });

      setStep('complete');
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : "Erreur lors de l'importation.");
      setStep('preview');
    } finally {
      setIsProcessing(false);
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
                <Upload size={24} color={COLORS.brand} />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.headerTitle}>Importer des produits</Text>
                <Text style={styles.headerSubtitle}>
                  Destination : <Text style={styles.headerStrong}>{targetStoreName}</Text>
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Fermer">
              <X size={20} color="#9CA3AF" />
            </Pressable>
          </View>

          {/* Contenu */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {generalError ? (
              <View style={styles.errorBox}>
                <AlertCircle size={18} color="#EF4444" />
                <Text style={styles.errorText}>{generalError}</Text>
              </View>
            ) : null}

            {/* Étape 1 : fichier */}
            {step === 'upload' ? (
              <View style={{ gap: 20 }}>
                <Pressable onPress={handlePickFile} style={styles.dropZone}>
                  <View style={styles.dropIcon}>
                    <Upload size={30} color="#9CA3AF" />
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={styles.dropTitle}>
                      Glissez votre fichier ici ou cliquez pour parcourir
                    </Text>
                    <Text style={styles.dropSubtitle}>
                      Formats acceptés : <Text style={styles.dropStrong}>CSV</Text> (séparateur
                      point-virgule/virgule) ou <Text style={styles.dropStrong}>JSON</Text>
                    </Text>
                  </View>
                </Pressable>

                <View style={styles.templateBox}>
                  <View style={styles.templateLeft}>
                    <FileSpreadsheet size={20} color={COLORS.brand} />
                    <View style={{ flexShrink: 1 }}>
                      <Text style={styles.templateTitle}>
                        Besoin d&apos;un modèle pour vos fichiers Excel ?
                      </Text>
                      <Text style={styles.templateSubtitle}>
                        Téléchargez un modèle avec toutes les colonnes requises.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.templateButtons}>
                    <Pressable onPress={handleDownloadTemplate} style={styles.templateBtn}>
                      <FileDown size={14} color="#374151" />
                      <Text style={styles.templateBtnText}>Modèle vierge</Text>
                    </Pressable>
                    <Pressable onPress={handleDownloadExample} style={styles.exampleBtn}>
                      <Sparkles size={14} color="#FFFFFF" />
                      <Text style={styles.exampleBtnText}>Exemple complet</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.highlightBox}>
                  <CheckCircle2 size={16} color="#10B981" />
                  <Text style={styles.highlightText}>
                    <Text style={styles.highlightStrong}>Variantes & Galeries :</Text> Compatible
                    avec les matrices multi-variantes (tailles, couleurs...) et photos.
                  </Text>
                </View>
                <View style={styles.highlightBox}>
                  <CheckCircle2 size={16} color="#10B981" />
                  <Text style={styles.highlightText}>
                    <Text style={styles.highlightStrong}>Tarifs de gros & Catégories :</Text> Crée
                    et associe automatiquement les rayons dans votre boutique.
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Étape 2 : aperçu */}
            {step === 'preview' && parseResult ? (
              <View style={{ gap: 20 }}>
                <View style={styles.summaryBox}>
                  <View style={styles.summaryLeft}>
                    <View style={styles.fileIcon}>
                      {fileType === 'json' ? (
                        <FileCode size={20} color={COLORS.brand} />
                      ) : (
                        <FileSpreadsheet size={20} color="#2563EB" />
                      )}
                    </View>
                    <View style={{ flexShrink: 1 }}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {fileName}
                      </Text>
                      <Text style={styles.fileFormat}>Format {fileType.toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={styles.summaryBadges}>
                    <View style={styles.validBadge}>
                      <Text style={styles.validBadgeText}>
                        {parseResult.valid.length} valide
                        {parseResult.valid.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                    {parseResult.errors.length > 0 ? (
                      <Pressable
                        onPress={() => setShowErrorDetails((prev) => !prev)}
                        style={styles.errorsBadge}
                      >
                        <Text style={styles.errorsBadgeText}>
                          {parseResult.errors.length} anomalie
                          {parseResult.errors.length > 1 ? 's' : ''}
                        </Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={handleReset} style={styles.refreshBtn}>
                      <RefreshCw size={15} color="#9CA3AF" />
                    </Pressable>
                  </View>
                </View>

                {showErrorDetails && parseResult.errors.length > 0 ? (
                  <View style={styles.errorsAccordion}>
                    <View style={styles.errorsAccordionHead}>
                      <AlertCircle size={14} color="#92400E" />
                      <Text style={styles.errorsAccordionTitle}>
                        Lignes ignorées lors de l&apos;analyse :
                      </Text>
                    </View>
                    {parseResult.errors.map((err, idx) => (
                      <View key={idx} style={styles.errorLine}>
                        <Text style={styles.errorLineText}>
                          Ligne {err.row} {err.name ? `("${err.name}")` : ''} : {err.reason}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View>
                  <Text style={styles.sectionLabel}>
                    Aperçu des produits ({Math.min(parseResult.valid.length, 5)} sur{' '}
                    {parseResult.valid.length})
                  </Text>
                  <View style={styles.tableBox}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View>
                        <View style={styles.tableHead}>
                          <Text style={[styles.th, { width: 170 }]}>Produit</Text>
                          <Text style={[styles.th, { width: 110 }]}>Catégorie</Text>
                          <Text style={[styles.th, { width: 100 }]}>Prix</Text>
                          <Text style={[styles.th, { width: 60 }]}>Stock</Text>
                          <Text style={[styles.th, { width: 80, paddingRight: 12 }]}>
                            Variantes
                          </Text>
                        </View>
                        {parseResult.valid.slice(0, 5).map((p, idx) => (
                          <View key={idx} style={styles.tr}>
                            <View style={[styles.productCell, { width: 170 }]}>
                              <View style={styles.previewThumb}>
                                {p.image ? (
                                  <Image
                                    source={{ uri: p.image }}
                                    style={styles.previewImg}
                                    contentFit="cover"
                                  />
                                ) : null}
                              </View>
                              <Text style={styles.productCellText} numberOfLines={1}>
                                {p.name}
                              </Text>
                            </View>
                            <Text style={[styles.td, { width: 110 }]} numberOfLines={1}>
                              {p.category || 'Général'}
                            </Text>
                            <Text style={[styles.tdStrong, { width: 100 }]}>
                              {formatCurrency(p.price)}
                            </Text>
                            <View style={{ width: 60 }}>
                              <View
                                style={[
                                  styles.stockBadge,
                                  p.stock > 0 ? styles.stockBadgeOk : styles.stockBadgeEmpty,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.stockBadgeText,
                                    p.stock > 0
                                      ? { color: '#047857' }
                                      : { color: '#4B5563' },
                                  ]}
                                >
                                  {p.stock}
                                </Text>
                              </View>
                            </View>
                            <View style={{ width: 80, paddingRight: 12 }}>
                              {p.variants && p.variants.length > 0 ? (
                                <View style={styles.variantsBadge}>
                                  <Text style={styles.variantsBadgeText}>
                                    {p.variants.length} var.
                                  </Text>
                                </View>
                              ) : (
                                <Text style={styles.dashText}>-</Text>
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                </View>

                {/* Options d'importation */}
                <View style={styles.optionsSection}>
                  <Text style={styles.sectionLabel}>Options d&apos;importation</Text>

                  <Text style={styles.optionTitle}>
                    Si un produit avec le même nom existe déjà dans la boutique :
                  </Text>
                  {[
                    { id: 'skip', label: 'Ignorer le doublon', desc: 'Conserve la fiche actuelle' },
                    { id: 'update', label: 'Mettre à jour', desc: 'Écrase avec les données' },
                    {
                      id: 'create_new',
                      label: 'Créer une copie',
                      desc: 'Ajoute un nouveau produit',
                    },
                  ].map((opt) => (
                    <Pressable
                      key={opt.id}
                      onPress={() =>
                        setDuplicateStrategy(opt.id as 'skip' | 'update' | 'create_new')
                      }
                      style={[
                        styles.duplicateCard,
                        duplicateStrategy === opt.id && styles.duplicateCardActive,
                      ]}
                    >
                      <View style={styles.duplicateHead}>
                        <View
                          style={[
                            styles.radio,
                            duplicateStrategy === opt.id && styles.radioActive,
                          ]}
                        >
                          {duplicateStrategy === opt.id ? <View style={styles.radioDot} /> : null}
                        </View>
                        <Text style={styles.duplicateLabel}>{opt.label}</Text>
                      </View>
                      <Text style={styles.duplicateDesc}>{opt.desc}</Text>
                    </Pressable>
                  ))}

                  <View style={styles.resetBox}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.resetTitle}>Réinitialiser les stocks à 0</Text>
                      <Text style={styles.resetSubtitle}>
                        Utile si vous souhaitez réapprovisionner manuellement par la suite.
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setResetStock((prev) => !prev)}
                      style={[styles.checkbox, resetStock && styles.checkboxChecked]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: resetStock }}
                    >
                      {resetStock ? (
                        <CheckCircle2 size={16} color="#FFFFFF" />
                      ) : null}
                    </Pressable>
                  </View>

                  <Text style={styles.optionTitle}>Visibilité des produits importés :</Text>
                  <View style={styles.visibilityRow}>
                    {[
                      { id: 'keep', label: 'Conserver du fichier' },
                      { id: 'online', label: 'En ligne (Store + POS)' },
                      { id: 'pos', label: 'Point de Vente seul' },
                    ].map((v) => (
                      <Pressable
                        key={v.id}
                        onPress={() => setForceOnlineStatus(v.id as 'keep' | 'online' | 'pos')}
                        style={[
                          styles.visibilityBtn,
                          forceOnlineStatus === v.id && styles.visibilityBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.visibilityText,
                            forceOnlineStatus === v.id && styles.visibilityTextActive,
                          ]}
                        >
                          {v.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            ) : null}

            {/* Étape 3 : importation */}
            {step === 'importing' ? (
              <View style={styles.loadingBox}>
                <View style={styles.loadingIcon}>
                  <ActivityIndicator size="large" color={COLORS.brand} />
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.loadingTitle}>Importation en cours...</Text>
                  <Text style={styles.loadingText}>
                    Création des fiches produits, association des catégories et calcul des
                    matrices de variantes.
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Étape 4 : résultat */}
            {step === 'complete' && importResult ? (
              <View style={styles.completeBox}>
                <View style={styles.completeIcon}>
                  <CheckCircle2 size={36} color="#059669" />
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.completeTitle}>Importation terminée avec succès !</Text>
                  <Text style={styles.completeText}>
                    Vos produits sont prêts et immédiatement disponibles dans votre inventaire.
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <View style={[styles.resultCard, styles.resultCardGreen]}>
                    <Text style={[styles.resultValue, { color: '#047857' }]}>
                      +{importResult.createdCount}
                    </Text>
                    <Text style={[styles.resultLabel, { color: '#059669' }]}>Créés</Text>
                  </View>
                  <View style={[styles.resultCard, styles.resultCardBlue]}>
                    <Text style={[styles.resultValue, { color: '#1D4ED8' }]}>
                      {importResult.updatedCount}
                    </Text>
                    <Text style={[styles.resultLabel, { color: '#2563EB' }]}>Mis à jour</Text>
                  </View>
                  <View style={[styles.resultCard, styles.resultCardGray]}>
                    <Text style={[styles.resultValue, { color: '#4B5563' }]}>
                      {importResult.skippedCount}
                    </Text>
                    <Text style={[styles.resultLabel, { color: '#6B7280' }]}>Ignorés</Text>
                  </View>
                </View>
                {importResult.errors.length > 0 ? (
                  <View style={styles.resultErrors}>
                    <Text style={styles.resultErrorsTitle}>
                      Avertissements ({importResult.errors.length}) :
                    </Text>
                    {importResult.errors.map((e, idx) => (
                      <Text key={idx} style={styles.resultErrorLine}>
                        • {e}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          {/* Pied */}
          <View style={styles.footer}>
            {step === 'upload' ? (
              <>
                <Pressable onPress={onClose} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Annuler</Text>
                </Pressable>
                <Pressable onPress={handlePickFile} style={styles.primaryBtn}>
                  <Upload size={16} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Choisir un fichier</Text>
                </Pressable>
              </>
            ) : null}

            {step === 'preview' ? (
              <>
                <Pressable onPress={handleReset} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Retour</Text>
                </Pressable>
                <Pressable
                  onPress={handleConfirmImport}
                  disabled={isProcessing || !parseResult || parseResult.valid.length === 0}
                  style={[
                    styles.primaryBtn,
                    (isProcessing || !parseResult || parseResult.valid.length === 0) && {
                      opacity: 0.5,
                    },
                  ]}
                >
                  <Upload size={16} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>
                    Importer {parseResult?.valid.length} produit
                    {(parseResult?.valid.length || 0) > 1 ? 's' : ''}
                  </Text>
                </Pressable>
              </>
            ) : null}

            {step === 'complete' ? (
              <Pressable onPress={onClose} style={styles.darkBtn}>
                <Text style={styles.darkBtnText}>Fermer et voir les produits</Text>
              </Pressable>
            ) : null}
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
  headerIcon: { padding: 12, backgroundColor: 'rgba(245,107,42,0.1)', borderRadius: 16 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  headerStrong: { fontWeight: '700', color: '#1F2937' },
  closeBtn: { padding: 8 },
  body: { flexGrow: 0 },
  bodyContent: { padding: 20, gap: 16 },
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

  dropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(249,250,251,0.5)',
    alignItems: 'center',
    gap: 16,
  },
  dropIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937', textAlign: 'center' },
  dropSubtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
  dropStrong: { fontWeight: '700', color: '#374151' },

  templateBox: {
    backgroundColor: 'rgba(255,247,237,0.5)',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  templateLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  templateTitle: { fontSize: 12, fontWeight: '700', color: '#111827' },
  templateSubtitle: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  templateButtons: { flexDirection: 'row', gap: 8 },
  templateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
  },
  templateBtnText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  exampleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: COLORS.brand,
    borderRadius: 12,
  },
  exampleBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  highlightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 16,
  },
  highlightText: { flex: 1, fontSize: 12, color: '#4B5563', lineHeight: 17 },
  highlightStrong: { fontWeight: '700', color: '#1F2937' },

  summaryBox: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 16,
    gap: 12,
  },
  summaryLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileIcon: {
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
  },
  fileName: { fontSize: 12, fontWeight: '700', color: '#111827', maxWidth: 220 },
  fileFormat: {
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
    marginTop: 2,
  },
  summaryBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  validBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#D1FAE5',
    borderRadius: 999,
  },
  validBadgeText: { fontSize: 12, fontWeight: '700', color: '#065F46' },
  errorsBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#FDE68A',
    borderRadius: 999,
  },
  errorsBadgeText: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  refreshBtn: { padding: 6 },

  errorsAccordion: {
    padding: 14,
    backgroundColor: 'rgba(255,251,235,0.8)',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    gap: 6,
    maxHeight: 160,
  },
  errorsAccordionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorsAccordionTitle: { fontSize: 12, fontWeight: '700', color: '#78350F' },
  errorLine: { paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: '#FCD34D' },
  errorLineText: { fontSize: 12, color: '#92400E' },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  tableBox: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  tableHead: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingLeft: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  th: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  productCell: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 8 },
  previewThumb: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  previewImg: { width: '100%', height: '100%' },
  productCellText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#111827' },
  td: { fontSize: 12, color: '#6B7280', paddingRight: 8 },
  tdStrong: { fontSize: 12, fontWeight: '700', color: '#111827', paddingRight: 8 },
  stockBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  stockBadgeOk: { backgroundColor: '#ECFDF5' },
  stockBadgeEmpty: { backgroundColor: '#F3F4F6' },
  stockBadgeText: { fontSize: 10, fontWeight: '700' },
  variantsBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  variantsBadgeText: { fontSize: 10, fontWeight: '700', color: '#1D4ED8' },
  dashText: { fontSize: 12, color: '#D1D5DB' },

  optionsSection: { gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  optionTitle: { fontSize: 12, fontWeight: '600', color: '#374151' },
  duplicateCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  duplicateCardActive: { borderColor: COLORS.brand, backgroundColor: 'rgba(255,247,237,0.3)' },
  duplicateHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: COLORS.brand },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.brand },
  duplicateLabel: { fontSize: 12, fontWeight: '700', color: '#111827' },
  duplicateDesc: { fontSize: 10, color: '#6B7280', marginTop: 4, marginLeft: 24 },

  resetBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
  },
  resetTitle: { fontSize: 12, fontWeight: '700', color: '#111827' },
  resetSubtitle: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },

  visibilityRow: { flexDirection: 'row', gap: 6 },
  visibilityBtn: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  visibilityBtnActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  visibilityText: { fontSize: 10, fontWeight: '700', color: '#4B5563', textAlign: 'center' },
  visibilityTextActive: { color: '#FFFFFF' },

  loadingBox: { paddingVertical: 48, alignItems: 'center', gap: 16 },
  loadingIcon: {
    padding: 16,
    backgroundColor: '#FFF7ED',
    borderRadius: 999,
  },
  loadingTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  loadingText: { fontSize: 12, color: '#6B7280', marginTop: 4, textAlign: 'center' },

  completeBox: { paddingVertical: 24, gap: 20, alignItems: 'center' },
  completeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeTitle: { fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center' },
  completeText: { fontSize: 12, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  resultRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  resultCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
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
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: COLORS.brand,
  },
  primaryBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
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
