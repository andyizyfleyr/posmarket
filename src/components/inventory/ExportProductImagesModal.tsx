'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { IMAGE_EXPORT_LIMITS } from '@/lib/product-images-limits';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FolderArchive,
  Image as ImageIcon,
  Info,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';

interface ExportProductImagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  storeName?: string;
  selectedProductIds: string[];
  selectedProductsCount: number;
  totalProductsCount: number;
}

interface ImagesSummary {
  productCount: number;
  productsWithImages: number;
  productsWithoutImages: number;
  imageCount: number;
}

/** Récupère le nom de fichier proposé par le serveur (`Content-Disposition`). */
function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // En-tête mal formé : on retombe sur le nom simple.
    }
  }
  const simple = /filename="?([^";]+)"?/i.exec(header);
  return simple?.[1]?.trim() || null;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Laisse au navigateur le temps de démarrer l'écriture du fichier.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function formatCount(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value > 1 ? plural : singular}`;
}

/**
 * Modale « Télécharger toutes les images ».
 *
 * Le ZIP est construit côté serveur (route
 * `/api/marketplace/seller/inventory/images/export`) : le navigateur n'a donc
 * qu'un seul fichier à récupérer, sans ouvrir chaque fiche produit.
 */
export default function ExportProductImagesModal({
  isOpen,
  onClose,
  storeId,
  storeName = 'Boutique',
  selectedProductIds,
  selectedProductsCount,
  totalProductsCount,
}: ExportProductImagesModalProps) {
  const canUseSelection =
    selectedProductsCount > 0 &&
    selectedProductsCount <= IMAGE_EXPORT_LIMITS.maxSelectedProducts;

  const [scope, setScope] = useState<'all' | 'selected'>(
    canUseSelection ? 'selected' : 'all',
  );
  const [summary, setSummary] = useState<ImagesSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const selectionKey = selectedProductIds.join(',');

  // À chaque ouverture, on repart du périmètre le plus probable.
  useEffect(() => {
    if (!isOpen) return;
    setScope(canUseSelection ? 'selected' : 'all');
    setDownloadError(null);
    setDownloadSuccess(false);
    setIsDownloading(false);
  }, [isOpen, canUseSelection]);

  const buildQuery = useCallback(
    (targetScope: 'all' | 'selected') => {
      const params = new URLSearchParams({ storeId });
      if (targetScope === 'selected' && selectionKey) {
        params.set('ids', selectionKey);
      }
      return params.toString();
    },
    // `selectionKey` résume `selectedProductIds` sans dépendre de l'identité du tableau.
    [storeId, selectionKey],
  );

  useEffect(() => {
    if (!isOpen || !storeId) return;
    // Évite une requête avec une sélection hors plafond (l'effet de
    // réinitialisation ramène le périmètre à « Tous les produits »).
    if (scope === 'selected' && !canUseSelection) return;

    const controller = new AbortController();
    setIsLoadingSummary(true);
    setSummary(null);
    setSummaryError(null);
    setDownloadSuccess(false);
    setDownloadError(null);

    fetch(`/api/marketplace/seller/inventory/images/summary?${buildQuery(scope)}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | (ImagesSummary & { success?: boolean; error?: string })
          | null;
        if (!response.ok || !data?.success) {
          const message =
            data?.error === 'Unauthorized'
              ? 'Session expirée. Reconnectez-vous puis réessayez.'
              : data?.error || 'Impossible de compter les images de la boutique.';
          throw new Error(message);
        }
        return data;
      })
      .then((data) => {
        if (!controller.signal.aborted) setSummary(data);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSummaryError(
          error instanceof Error
            ? error.message
            : 'Impossible de compter les images de la boutique.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingSummary(false);
      });

    return () => controller.abort();
  }, [isOpen, storeId, scope, canUseSelection, buildQuery]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    if (!storeId || isDownloading || downloadSuccess) return;
    if (scope === 'selected' && !canUseSelection) return;
    setIsDownloading(true);
    setDownloadError(null);
    setDownloadSuccess(false);

    try {
      const response = await fetch(
        `/api/marketplace/seller/inventory/images/export?${buildQuery(scope)}`,
        { cache: 'no-store' },
      );

      if (!response.ok) {
        let message = 'Le téléchargement a échoué. Réessayez.';
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload?.error === 'Unauthorized') {
            message = 'Session expirée. Reconnectez-vous puis réessayez.';
          } else if (typeof payload?.error === 'string' && payload.error.trim()) {
            message = payload.error;
          }
        } catch {
          // Réponse non JSON (proxy, coupure réseau…) : message générique.
        }
        throw new Error(message);
      }

      // `requireSellerSpace` répond 200 avec un JSON « Unauthorized » : sans
      // ce contrôle, le navigateur enregistrerait ce JSON sous forme de .zip.
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('application/zip')) {
        let message = 'Le serveur n’a pas renvoyé d’archive. Réessayez.';
        try {
          const payload = (await response.clone().json()) as { error?: string };
          if (payload?.error === 'Unauthorized') {
            message = 'Session expirée. Reconnectez-vous puis réessayez.';
          } else if (typeof payload?.error === 'string' && payload.error.trim()) {
            message = payload.error;
          }
        } catch {
          // Corps inattendu : message générique.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('L’archive reçue est vide. Réessayez.');
      }

      const filename =
        filenameFromDisposition(response.headers.get('content-disposition')) ||
        `images-produits-${new Date().toISOString().slice(0, 10)}.zip`;

      saveBlob(blob, filename);
      setDownloadSuccess(true);
      setTimeout(() => {
        setDownloadSuccess(false);
        onClose();
      }, 1600);
    } catch (error: unknown) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : 'Le téléchargement a échoué. Réessayez.',
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const scopeImageCount = summary?.imageCount ?? 0;
  const canDownload =
    !!summary && summary.imageCount > 0 && !isLoadingSummary && !isDownloading;
  const noImages = !!summary && summary.imageCount === 0;

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-in zoom-in-95 duration-200">
        {/* En-tête */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-br from-gray-50 via-white to-orange-50/20">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand/10 text-brand rounded-2xl">
              <FolderArchive size={24} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">
                Télécharger les images
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {storeName} • toutes les photos produits dans un ZIP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[72vh]">
          {(downloadError || summaryError) && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-start gap-3">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span className="font-semibold leading-relaxed">
                {downloadError || summaryError}
              </span>
            </div>
          )}

          {/* Aperçu des compteurs */}
          <div className="p-4 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/60 to-white">
            {isLoadingSummary ? (
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <Loader2 size={18} className="animate-spin text-brand" />
                Comptage des photos en cours…
              </div>
            ) : !summary ? (
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <Info size={18} className="text-gray-400 flex-shrink-0" />
                Compteurs indisponibles pour le moment.
              </div>
            ) : noImages ? (
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                  <ImageIcon size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    Aucune photo à télécharger
                  </p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {scope === 'selected'
                      ? 'Les produits sélectionnés n’ont pas encore de photo. Choisissez « Tous les produits » ou ajoutez des images.'
                      : 'Ajoutez des photos à vos produits pour pouvoir les télécharger ici.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-brand text-white rounded-xl">
                    <ImageIcon size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {formatCount(summary?.imageCount ?? 0, 'photo')} prête
                      {(summary?.imageCount ?? 0) > 1 ? 's' : ''} à télécharger
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatCount(summary?.productsWithImages ?? 0, 'produit')} avec image
                      {summary?.productsWithoutImages
                        ? ` • ${summary.productsWithoutImages} sans photo`
                        : ''}
                    </p>
                  </div>
                </div>
                <Sparkles size={18} className="text-brand flex-shrink-0" />
              </div>
            )}
          </div>

          {/* Périmètre */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
              1. Périmètre
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`relative flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  scope === 'all'
                    ? 'border-brand bg-orange-50/20 shadow-sm'
                    : 'border-gray-100 hover:border-gray-200 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="images-scope"
                  value="all"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="mt-1 text-brand focus:ring-brand"
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
                  !canUseSelection
                    ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50'
                    : scope === 'selected'
                      ? 'border-brand bg-orange-50/20 shadow-sm cursor-pointer'
                      : 'border-gray-100 hover:border-gray-200 bg-white cursor-pointer'
                }`}
              >
                <input
                  type="radio"
                  name="images-scope"
                  value="selected"
                  disabled={!canUseSelection}
                  checked={scope === 'selected'}
                  onChange={() => setScope('selected')}
                  className="mt-1 text-brand focus:ring-brand"
                />
                <div className="min-w-0">
                  <span className="block text-sm font-bold text-gray-900">
                    Sélection ({selectedProductsCount})
                  </span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {selectedProductsCount === 0
                      ? 'Aucun produit coché'
                      : canUseSelection
                        ? 'Produits cochés dans la liste'
                        : `Maximum ${IMAGE_EXPORT_LIMITS.maxSelectedProducts} produits — utilisez « Tous les produits »`}
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Contenu de l'archive */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
              2. Contenu de l’archive
            </label>
            <div className="p-4 rounded-2xl border border-gray-100 bg-white space-y-2">
              <div className="flex items-start gap-2 text-xs text-gray-600">
                <Info size={14} className="text-brand mt-0.5 flex-shrink-0" />
                <span>
                  Un dossier par produit, avec l’image principale, la galerie et les
                  photos de variantes.
                </span>
              </div>
              <div className="flex items-start gap-2 text-xs text-gray-600">
                <Info size={14} className="text-brand mt-0.5 flex-shrink-0" />
                <span>
                  Un fichier <span className="font-semibold">manifeste-images.csv</span>{' '}
                  relie chaque photo au produit, à son rôle et à sa taille.
                </span>
              </div>
              <div className="flex items-start gap-2 text-xs text-gray-600">
                <Info size={14} className="text-brand mt-0.5 flex-shrink-0" />
                <span>
                  Format ZIP, lisible sur ordinateur comme sur téléphone (Windows,
                  macOS, Android, iOS).
                </span>
              </div>
            </div>
          </div>

          {summary && summary.productsWithoutImages > 0 && scope !== 'selected' && (
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Les {summary.productsWithoutImages} produit
              {summary.productsWithoutImages > 1 ? 's' : ''} sans photo seront
              simplement ignorés.
            </p>
          )}

          {summary && summary.imageCount > IMAGE_EXPORT_LIMITS.maxImages && (
            <p className="text-[11px] text-amber-600 leading-relaxed flex items-start gap-2">
              <Info size={13} className="mt-0.5 flex-shrink-0" />
              <span>
                Une archive contient au plus {IMAGE_EXPORT_LIMITS.maxImages} images. Le
                reste peut être récupéré en relançant l’export sur une sélection de
                produits.
              </span>
            </p>
          )}
        </div>

        {/* Pied */}
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
            disabled={!canDownload || downloadSuccess}
            onClick={handleDownload}
            className={`flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs md:text-sm font-bold text-white transition-all shadow-lg ${
              downloadSuccess
                ? 'bg-emerald-600 shadow-emerald-200'
                : 'bg-brand hover:bg-[#d55a20] shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {isDownloading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Préparation du ZIP…
              </>
            ) : downloadSuccess ? (
              <>
                <CheckCircle2 size={16} />
                Téléchargé !
              </>
            ) : (
              <>
                <Download size={16} />
                {scopeImageCount > 0
                  ? `Télécharger ${formatCount(scopeImageCount, 'image')}`
                  : 'Télécharger les images'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
