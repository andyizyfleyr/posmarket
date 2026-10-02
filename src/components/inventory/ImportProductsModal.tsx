'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
  FileDown,
  RefreshCw,
} from 'lucide-react';
import { BusinessVertical } from '@/types';
import { importProductsBatchAction } from '@/app/actions/inventory';
import {
  parseProductsCSV,
  parseProductsJSON,
  generateCSVTemplate,
  generateCSVExample,
  triggerFileDownload,
  ImportParseResult,
} from '@/utils/product-import-export';
import { formatCurrency } from '@/utils';
import ProductImage from '@/components/ProductImage';

interface ImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetStoreId: string;
  targetStoreName?: string;
  businessType?: BusinessVertical;
  onImportSuccess: (summary: { createdCount: number; updatedCount: number; skippedCount: number }) => void;
}

export default function ImportProductsModal({
  isOpen,
  onClose,
  targetStoreId,
  targetStoreName = 'Boutique',
  businessType = 'shopping',
  onImportSuccess,
}: ImportProductsModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<'csv' | 'json'>('csv');
  const [parseResult, setParseResult] = useState<ImportParseResult | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update' | 'create_new'>('skip');
  const [resetStock, setResetStock] = useState<boolean>(false);
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('upload');
    setFileName('');
    setParseResult(null);
    setImportResult(null);
    setGeneralError(null);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
  };

  const processSelectedFile = (file: File) => {
    setFileName(file.name);
    setGeneralError(null);

    const isJson = file.name.endsWith('.json') || file.type === 'application/json';
    const isCsv = file.name.endsWith('.csv') || file.type === 'text/csv' || file.name.endsWith('.txt');

    if (!isJson && !isCsv) {
      setGeneralError('Veuillez sélectionner un fichier valide (.csv ou .json).');
      return;
    }

    setFileType(isJson ? 'json' : 'csv');

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result;
      if (typeof content !== 'string') {
        setGeneralError('Impossible de lire le contenu du fichier.');
        return;
      }

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

    reader.onerror = () => {
      setGeneralError('Une erreur est survenue lors du chargement du fichier.');
    };

    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = generateCSVTemplate(businessType);
    triggerFileDownload(csvContent, `modele-produits-${businessType}.csv`, 'text/csv;charset=utf-8');
  };

  const handleDownloadExample = () => {
    const csvContent = generateCSVExample(businessType);
    triggerFileDownload(csvContent, `exemple-produits-${businessType}.csv`, 'text/csv;charset=utf-8');
  };

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.valid.length === 0) return;

    setIsProcessing(true);
    setStep('importing');
    setGeneralError(null);

    try {
      const res = await importProductsBatchAction(targetStoreId, parseResult.valid, {
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
      setGeneralError(err instanceof Error ? err.message : 'Erreur lors de l’importation.');
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-br from-gray-50 via-white to-orange-50/20">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#f56b2a]/10 text-[#f56b2a] rounded-2xl">
              <Upload size={24} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">
                Importer des produits
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Destination : <span className="font-semibold text-gray-800">{targetStoreName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content depending on step */}
        <div className="p-6 space-y-6 overflow-y-auto flex-grow">
          {generalError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-start gap-3">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-red-500" />
              <span className="font-semibold leading-relaxed">{generalError}</span>
            </div>
          )}

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 hover:border-[#f56b2a] hover:bg-orange-50/20 rounded-3xl p-8 md:p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-4 bg-gray-50/50 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".csv,.json,text/csv,application/json"
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-[#f56b2a] group-hover:scale-110 transition-all">
                  <Upload size={30} />
                </div>
                <div>
                  <p className="text-sm md:text-base font-bold text-gray-800 group-hover:text-[#f56b2a] transition-colors">
                    Glissez votre fichier ici ou cliquez pour parcourir
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Formats acceptés : <strong className="text-gray-600">CSV</strong> (séparateur point-virgule/virgule) ou <strong className="text-gray-600">JSON</strong>
                  </p>
                </div>
              </div>

              {/* Template Helpers */}
              <div className="bg-orange-50/40 border border-orange-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={20} className="text-[#f56b2a] flex-shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">
                      Besoin d&apos;un modèle pour vos fichiers Excel ?
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Téléchargez un modèle avec toutes les colonnes requises.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-xs font-bold text-gray-700 shadow-sm transition-all"
                  >
                    <FileDown size={14} /> Modèle vierge
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadExample}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-[#f56b2a] hover:bg-[#d55a20] rounded-xl text-xs font-bold text-white shadow-sm transition-all"
                  >
                    <Sparkles size={14} /> Exemple complet
                  </button>
                </div>
              </div>

              {/* Feature Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-600">
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Variantes & Galeries :</strong> Compatible avec les matrices multi-variantes (tailles, couleurs...) et photos.
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Tarifs de gros & Catégories :</strong> Crée et associe automatiquement les rayons dans votre boutique.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Preview & Options */}
          {step === 'preview' && parseResult && (
            <div className="space-y-6">
              {/* Summary Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white border border-gray-200 rounded-xl">
                    {fileType === 'json' ? <FileCode size={20} className="text-[#f56b2a]" /> : <FileSpreadsheet size={20} className="text-blue-600" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-900 block truncate max-w-[220px]">
                      {fileName}
                    </span>
                    <span className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">
                      Format {fileType.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                    {parseResult.valid.length} valide{parseResult.valid.length > 1 ? 's' : ''}
                  </span>
                  {parseResult.errors.length > 0 && (
                    <button
                      onClick={() => setShowErrorDetails(!showErrorDetails)}
                      className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-full text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      {parseResult.errors.length} anomalie{parseResult.errors.length > 1 ? 's' : ''}
                    </button>
                  )}
                  <button
                    onClick={handleReset}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors ml-1"
                    title="Changer de fichier"
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
              </div>

              {/* Error Details Accordion */}
              {showErrorDetails && parseResult.errors.length > 0 && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs space-y-2 max-h-40 overflow-y-auto">
                  <div className="font-bold text-amber-900 flex items-center gap-2">
                    <AlertCircle size={14} /> Lignes ignorées lors de l&apos;analyse :
                  </div>
                  {parseResult.errors.map((err, idx) => (
                    <div key={idx} className="text-amber-800 pl-4 border-l-2 border-amber-300">
                      Ligne {err.row} {err.name ? `("${err.name}")` : ''} : {err.reason}
                    </div>
                  ))}
                </div>
              )}

              {/* Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Aperçu des produits ({Math.min(parseResult.valid.length, 5)} sur {parseResult.valid.length})
                  </label>
                </div>
                <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-bold sticky top-0">
                        <tr>
                          <th className="p-2.5 pl-3">Produit</th>
                          <th className="p-2.5">Catégorie</th>
                          <th className="p-2.5">Prix</th>
                          <th className="p-2.5">Stock</th>
                          <th className="p-2.5 pr-3">Variantes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parseResult.valid.slice(0, 5).map((p, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="p-2.5 pl-3 font-semibold text-gray-900 flex items-center gap-2">
                              <ProductImage
                                src={p.image}
                                alt={p.name}
                                className="w-7 h-7 rounded-lg object-cover bg-gray-100 border border-gray-200 flex-shrink-0"
                              />
                              <span className="truncate max-w-[140px]">{p.name}</span>
                            </td>
                            <td className="p-2.5 text-gray-500 truncate max-w-[100px]">
                              {p.category || 'Général'}
                            </td>
                            <td className="p-2.5 font-bold text-gray-900">
                              {formatCurrency(p.price)}
                            </td>
                            <td className="p-2.5">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                p.stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {p.stock}
                              </span>
                            </td>
                            <td className="p-2.5 pr-3 text-gray-500">
                              {p.variants && p.variants.length > 0 ? (
                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded text-[10px]">
                                  {p.variants.length} var.
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Import Options */}
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Options d&apos;importation
                </label>

                {/* Duplicates Strategy */}
                <div>
                  <span className="block text-xs font-semibold text-gray-700 mb-2">
                    Si un produit avec le même nom existe déjà dans la boutique :
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'skip', label: 'Ignorer le doublon', desc: 'Conserve la fiche actuelle' },
                      { id: 'update', label: 'Mettre à jour', desc: 'Écrase avec les données' },
                      { id: 'create_new', label: 'Créer une copie', desc: 'Ajoute un nouveau produit' },
                    ].map((opt) => (
                      <label
                        key={opt.id}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col ${
                          duplicateStrategy === opt.id
                            ? 'border-[#f56b2a] bg-orange-50/20'
                            : 'border-gray-100 hover:border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="duplicateStrategy"
                            value={opt.id}
                            checked={duplicateStrategy === opt.id}
                            onChange={() => setDuplicateStrategy(opt.id as 'skip' | 'update' | 'create_new')}
                            className="text-[#f56b2a] focus:ring-[#f56b2a]"
                          />
                          <span className="text-xs font-bold text-gray-900">{opt.label}</span>
                        </div>
                        <span className="text-[10px] text-gray-500 mt-1 pl-5">{opt.desc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Reset Stock Option */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">
                      Réinitialiser les stocks à 0
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Utile si vous souhaitez réapprovisionner manuellement par la suite.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={resetStock}
                    onChange={(e) => setResetStock(e.target.checked)}
                    className="w-4 h-4 rounded text-[#f56b2a] focus:ring-[#f56b2a] border-gray-300"
                  />
                </div>

                {/* Force Online Option */}
                <div>
                  <span className="block text-xs font-semibold text-gray-700 mb-2">
                    Visibilité des produits importés :
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'keep', label: 'Conserver du fichier' },
                      { id: 'online', label: 'En ligne (Store + POS)' },
                      { id: 'pos', label: 'Point de Vente seul' },
                    ].map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setForceOnlineStatus(v.id as 'keep' | 'online' | 'pos')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                          forceOnlineStatus === v.id
                            ? 'border-[#f56b2a] bg-[#f56b2a] text-white shadow-sm'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Importing loader */}
          {step === 'importing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-4">
              <div className="p-4 bg-orange-50 text-[#f56b2a] rounded-full animate-bounce">
                <Loader2 size={36} className="animate-spin text-[#f56b2a]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Importation en cours...
                </h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm">
                  Création des fiches produits, association des catégories et calcul des matrices de variantes.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: Complete Summary */}
          {step === 'complete' && importResult && (
            <div className="py-8 space-y-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-100">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Importation terminée avec succès !
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Vos produits sont prêts et immédiatement disponibles dans votre inventaire.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
                  <span className="block text-xl font-extrabold text-emerald-700">
                    +{importResult.createdCount}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-600">Créés</span>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl">
                  <span className="block text-xl font-extrabold text-blue-700">
                    {importResult.updatedCount}
                  </span>
                  <span className="text-[11px] font-bold text-blue-600">Mis à jour</span>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl">
                  <span className="block text-xl font-extrabold text-gray-600">
                    {importResult.skippedCount}
                  </span>
                  <span className="text-[11px] font-bold text-gray-500">Ignorés</span>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-800 max-h-32 overflow-y-auto">
                  <div className="font-bold mb-1">Avertissements ({importResult.errors.length}) :</div>
                  {importResult.errors.map((e, idx) => (
                    <div key={idx}>• {e}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          {step === 'upload' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#f56b2a] hover:bg-[#d55a20] rounded-xl text-xs md:text-sm font-bold text-white shadow-md shadow-orange-100 transition-all"
              >
                <Upload size={16} /> Choisir un fichier
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Retour
              </button>
              <button
                type="button"
                disabled={isProcessing || !parseResult || parseResult.valid.length === 0}
                onClick={handleConfirmImport}
                className="flex items-center gap-2 px-6 py-3 bg-[#f56b2a] hover:bg-[#d55a20] rounded-2xl text-xs md:text-sm font-bold text-white shadow-lg shadow-orange-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload size={16} /> Importer {parseResult?.valid.length} produit{(parseResult?.valid.length || 0) > 1 ? 's' : ''}
              </button>
            </>
          )}

          {step === 'complete' && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-2xl text-xs md:text-sm font-bold shadow-md transition-all"
            >
              Fermer et voir les produits
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
