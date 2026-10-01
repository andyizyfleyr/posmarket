'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronLeft, Maximize2, Plus, Trash2, X } from 'lucide-react';
import { optimizeImage, fileToBase64 } from '@/utils/image-optimization';
import { labelCls } from './fieldStyles';
import { MAX_PRODUCT_IMAGES, type ProductFormData } from './types';

/**
 * Étape 1 — Photos du produit.
 *
 * Réécrite pour trois manques de la version précédente :
 *  - aucun retour visuel pendant l'upload (l'utilisateur cliquait et rien ne
 *    se passait pendant plusieurs secondes) ;
 *  - aucune erreur visible : un fichier en échec ne remontait que dans la
 *    console ;
 *  - pas de dépôt par glisser-déposer ni de réordonnancement.
 */

type Props = {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  /** Erreurs de validation du formulaire (`InventoryView.validateStep`). */
  errors?: Record<string, string>;
};

export default function ProductImagesStep({ formData, setFormData, errors = {} }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const images = formData.images || [];
  const remaining = MAX_PRODUCT_IMAGES - images.length;

  // Échap ferme d'abord la visionneuse. L'écoute est en phase de capture pour
  // passer avant celui de la modale parente, qui refermerait tout le formulaire.
  useEffect(() => {
    if (!zoomSrc) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setZoomSrc(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [zoomSrc]);

  const commitImages = (next: string[], promoted?: string) => {
    setFormData((prev) => ({
      ...prev,
      images: next,
      image: promoted ?? (next.length > 0 ? next[0] : ''),
    }));
  };

  const addFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    const room = MAX_PRODUCT_IMAGES - images.length;
    const accepted = files.slice(0, Math.max(0, room));
    const rejected = files.length - accepted.length;
    setUploading({ done: 0, total: accepted.length });

    const added: string[] = [];
    const errors: string[] = [];

    for (const [index, file] of accepted.entries()) {
      try {
        const optimized = await optimizeImage(file);
        added.push(await fileToBase64(optimized));
      } catch {
        errors.push(`${file.name} : format illisible ou trop volumineux.`);
      }
      setUploading({ done: index + 1, total: accepted.length });
    }

    if (added.length > 0) commitImages([...images, ...added]);
    setUploadErrors([
      ...(rejected > 0
        ? [`${rejected} photo(s) ignorée(s) : limite de ${MAX_PRODUCT_IMAGES} atteinte.`]
        : []),
      ...errors,
    ]);
    setUploading(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    const next = images.filter((_, i) => i !== index);
    commitImages(next, next[0] || '');
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    // La 1re image est la principale : elle doit rester la 1re.
    commitImages(next, next[0]);
  };

  return (
    <div className="space-y-4">
      <div>
        <span className={labelCls}>Photos du produit</span>
        <p className="text-[11px] text-gray-500 font-medium">
          {images.length === 0
            ? 'Au moins une photo. La première sera la photo principale.'
            : `${images.length}/${MAX_PRODUCT_IMAGES} · la première est la photo principale.`}
        </p>
      </div>

      {/* Zone de dépôt : accepte aussi le glisser-déposer */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (remaining > 0) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (remaining > 0) void addFiles(e.dataTransfer.files);
        }}
        className={`grid grid-cols-3 sm:grid-cols-4 gap-3 rounded-2xl transition-colors ${
          isDragOver ? 'bg-orange-50 ring-2 ring-[#f56b2a]/40' : ''
        }`}
      >
        {images.map((img, idx) => (
          <div
            key={`${img.slice(0, 40)}-${idx}`}
            className="relative group aspect-square rounded-xl md:rounded-2xl overflow-hidden border border-gray-100 bg-gray-50"
          >
            {/* Le fichier vient d'être optimisé puis converti en data URL
                côté client : `next/image` n'a pas d'URL R2 à optimiser ici,
                et les deux chemins (data URL, R2) coexistent déjà. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />

            {idx === 0 && (
              <span className="absolute bottom-0 left-0 right-0 bg-[#f56b2a] text-[10px] font-bold text-white text-center py-1 uppercase">
                Principale
              </span>
            )}

            {/* Actions : toujours visibles sur mobile, au survol sur desktop */}
            <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => moveImage(idx, -1)}
                  aria-label={`Déplacer la photo ${idx + 1} en photo principale`}
                  className="w-7 h-7 rounded-lg bg-white/90 text-gray-700 flex items-center justify-center shadow-sm hover:bg-white"
                  title="Déplacer avant"
                >
                  <ChevronLeft size={14} strokeWidth={3} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setZoomSrc(img)}
                aria-label={`Agrandir la photo ${idx + 1}`}
                className="w-7 h-7 rounded-lg bg-white/90 text-gray-700 flex items-center justify-center shadow-sm hover:bg-white"
                title="Agrandir"
              >
                <Maximize2 size={12} />
              </button>
              <button
                type="button"
                onClick={() => removeImage(idx)}
                aria-label={`Supprimer la photo ${idx + 1}`}
                className="w-7 h-7 rounded-lg bg-white/90 text-rose-600 flex items-center justify-center shadow-sm hover:bg-white"
                title="Supprimer"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading !== null}
            className="aspect-square flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-200 rounded-xl md:rounded-2xl hover:bg-orange-50 hover:border-orange-200 transition-all cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={20} className="text-gray-300 group-hover:text-[#f56b2a]" />
            <span className="text-[11px] font-bold text-gray-400 group-hover:text-[#f56b2a]">
              {uploading
                ? `${uploading.done}/${uploading.total}`
                : isDragOver
                  ? 'Déposez ici'
                  : 'Ajouter'}
            </span>
          </button>
        )}
      </div>

      {/* Erreur de validation du formulaire. Sans elle, « Continuer » sur une
          fiche sans photo ne faisait rien et paraissait cassé. */}
      {errors.images && (
        <p
          role="alert"
          className="flex items-center gap-2 text-[12px] font-bold text-rose-600"
        >
          <AlertCircle size={14} className="shrink-0" />
          {errors.images}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        aria-label="Ajouter des photos"
        onChange={(e) => {
          if (e.target.files?.length) void addFiles(e.target.files);
        }}
      />

      {uploading !== null && (
        <div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#f56b2a] transition-all duration-200"
              style={{ width: `${Math.round((uploading.done / uploading.total) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-500 font-medium mt-1.5">
            Optimisation des photos… {uploading.done}/{uploading.total}
          </p>
        </div>
      )}

      {uploadErrors.length > 0 && (
        <div role="alert" className="space-y-1">
          {uploadErrors.map((message) => (
            <p
              key={message}
              className="flex items-start gap-2 px-3 py-2.5 bg-rose-50 border border-rose-100 rounded-xl text-[11px] font-bold text-rose-600"
            >
              <AlertCircle size={13} className="shrink-0 mt-px" />
              {message}
            </p>
          ))}
          <button
            type="button"
            onClick={() => setUploadErrors([])}
            className="text-[11px] font-bold text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            Masquer
          </button>
        </div>
      )}

      {isDragOver && (
        <p className="text-[11px] font-bold text-[#f56b2a] text-center">
          Relâchez pour ajouter les photos
        </p>
      )}

      {/* Lightbox */}
      {zoomSrc && (
        <div
          className="fixed inset-0 z-[400] bg-slate-900/85 flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={() => setZoomSrc(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomSrc}
            alt="Aperçu de la photo"
            className="max-h-full max-w-full rounded-2xl object-contain"
          />
          <button
            type="button"
            onClick={() => setZoomSrc(null)}
            aria-label="Fermer l'aperçu"
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );
}