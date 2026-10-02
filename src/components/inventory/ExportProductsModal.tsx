'use client';

import React, { useState } from 'react';
import {
  X,
  Download,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Product, BusinessVertical } from '@/types';
import { exportStoreProductsAction } from '@/app/actions/inventory';
import {
  generateProductsCSV,
  generateProductsJSON,
  triggerFileDownload,
} from '@/utils/product-import-export';

interface ExportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStoreId: string;
  storeName?: string;
  businessType?: BusinessVertical;
  selectedProductsCount: number;
  selectedProductIds: string[];
  totalProductsCount: number;
  localProducts?: Product[];
}

export default function ExportProductsModal({
  isOpen,
  onClose,
  currentStoreId,
  storeName = 'Boutique',
  businessType = 'shopping',
  selectedProductsCount,
  selectedProductIds,
  totalProductsCount,
  localProducts = [],
}: ExportProductsModalProps) {
  const [scope, setScope] = useState<'all' | 'selected'>(
    selectedProductsCount > 0 ? 'selected' : 'all'
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

      // Si scope sélectionné et qu'on a déjà les produits localement
      if (scope === 'selected' && localProducts.length > 0 && selectedProductIds.length <= localProducts.length) {
        const selectedMap = new Set(selectedProductIds);
        const filtered = localProducts.filter((p) => selectedMap.has(p.id));
        if (filtered.length === selectedProductIds.length) {
          productsToExport = filtered;
        }
      }

      // Si besoin de récupérer l'ensemble depuis le serveur
      if (productsToExport.length === 0) {
        const res = await exportStoreProductsAction(currentStoreId, filterIds);
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
        const jsonContent = generateProductsJSON(productsToExport, {
          id: currentStoreId,
          name: storeName,
          businessType,
        });
        const filename = `export-produits-${safeStoreSlug}-${dateStr}.json`;
        triggerFileDownload(jsonContent, filename, 'application/json;charset=utf-8');
      } else {
        const csvContent = generateProductsCSV(productsToExport, { delimiter: ';' });
        const filename = `export-produits-${safeStoreSlug}-${dateStr}.csv`;
        triggerFileDownload(csvContent, filename, 'text/csv;charset=utf-8');
      }

      setExportSuccess(true);
      setTimeout(() => {
        onClose();
        setExportSuccess(false);
      }, 1200);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Erreur lors de l’export.');
    } finally {
      setIsExporting(false);
    }
  };

  const countToExport = scope === 'selected' ? selectedProductsCount : totalProductsCount;

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-br from-gray-50 via-white to-orange-50/20">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#f56b2a]/10 text-[#f56b2a] rounded-2xl">
              <Download size={24} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">
                Exporter les produits
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {storeName} • {totalProductsCount} produit{totalProductsCount > 1 ? 's' : ''} au total
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

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-start gap-3">
              <span className="font-semibold">{errorMessage}</span>
            </div>
          )}

          {/* 1. Périmètre */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
              1. Périmètre de l&apos;export
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`relative flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  scope === 'all'
                    ? 'border-[#f56b2a] bg-orange-50/20 shadow-sm'
                    : 'border-gray-100 hover:border-gray-200 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="mt-1 text-[#f56b2a] focus:ring-[#f56b2a]"
                />
                <div className="min-w-0">
                  <span className="block text-sm font-bold text-gray-900">
                    Tous les produits
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Catalogue complet ({totalProductsCount})
                  </span>
                </div>
              </label>

              <label
                className={`relative flex items-start gap-3 p-4 rounded-2xl border-2 transition-all ${
                  selectedProductsCount === 0
                    ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50'
                    : scope === 'selected'
                    ? 'border-[#f56b2a] bg-orange-50/20 shadow-sm cursor-pointer'
                    : 'border-gray-100 hover:border-gray-200 bg-white cursor-pointer'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="selected"
                  disabled={selectedProductsCount === 0}
                  checked={scope === 'selected'}
                  onChange={() => setScope('selected')}
                  className="mt-1 text-[#f56b2a] focus:ring-[#f56b2a]"
                />
                <div className="min-w-0">
                  <span className="block text-sm font-bold text-gray-900">
                    Sélection ({selectedProductsCount})
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {selectedProductsCount > 0
                      ? 'Produits cochés dans la liste'
                      : 'Aucun produit coché'}
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* 2. Format de fichier */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
              2. Format de fichier
            </label>
            <div className="space-y-3">
              {/* Option JSON */}
              <div
                onClick={() => setFormat('json')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                  format === 'json'
                    ? 'border-[#f56b2a] bg-orange-50/20 shadow-sm'
                    : 'border-gray-100 hover:border-gray-200 bg-white'
                }`}
              >
                <div className={`p-2.5 rounded-xl ${format === 'json' ? 'bg-[#f56b2a] text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <FileCode size={20} />
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">
                      JSON Structuré
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-extrabold rounded-full uppercase">
                      Recommandé
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Sauvegarde 100% fidèle avec l&apos;intégralité des variantes, options complexes, galeries photos et tarifs de gros.
                  </p>
                </div>
              </div>

              {/* Option CSV */}
              <div
                onClick={() => setFormat('csv')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                  format === 'csv'
                    ? 'border-[#f56b2a] bg-orange-50/20 shadow-sm'
                    : 'border-gray-100 hover:border-gray-200 bg-white'
                }`}
              >
                <div className={`p-2.5 rounded-xl ${format === 'csv' ? 'bg-[#f56b2a] text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <FileSpreadsheet size={20} />
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">
                      Tableur CSV (Excel / Sheets)
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-extrabold rounded-full uppercase">
                      Tableur
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Fichier UTF-8 séparé par des points-virgules, prêt à ouvrir dans Microsoft Excel, Google Sheets ou LibreOffice.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Info note */}
          <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl flex items-center gap-3 text-xs text-gray-600">
            <Sparkles size={18} className="text-[#f56b2a] flex-shrink-0" />
            <span>
              Les fichiers exportés peuvent être directement réimportés dans n&apos;importe laquelle de vos boutiques.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={isExporting || countToExport === 0}
            onClick={handleExport}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs md:text-sm font-bold text-white transition-all shadow-lg ${
              exportSuccess
                ? 'bg-emerald-600 shadow-emerald-200'
                : 'bg-[#f56b2a] hover:bg-[#d55a20] shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {isExporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Génération en cours...
              </>
            ) : exportSuccess ? (
              <>
                <CheckCircle2 size={16} />
                Téléchargé !
              </>
            ) : (
              <>
                <Download size={16} />
                Télécharger {countToExport} produit{countToExport > 1 ? 's' : ''} ({format.toUpperCase()})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
