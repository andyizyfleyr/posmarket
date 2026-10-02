'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRightLeft,
  Store,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { BusinessVertical, Product } from '@/types';
import {
  getUserManageableStoresAction,
  transferProductsBetweenStoresAction,
} from '@/app/actions/inventory';

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
  businessType?: BusinessVertical;
  selectedProductIds: string[];
  selectedProductsCount: number;
  totalProductsCount: number;
  localProducts?: Product[];
  onTransferSuccess: (summary: { createdCount: number; updatedCount: number; skippedCount: number }) => void;
}

export default function TransferProductsModal({
  isOpen,
  onClose,
  sourceStoreId,
  sourceStoreName = 'Boutique source',
  businessType: _businessType = 'shopping',
  selectedProductIds,
  selectedProductsCount,
  totalProductsCount,
  localProducts: _localProducts = [],
  onTransferSuccess,
}: TransferProductsModalProps) {
  const [scope, setScope] = useState<'all' | 'selected'>(
    selectedProductsCount > 0 ? 'selected' : 'all'
  );
  const [availableStores, setAvailableStores] = useState<ManageableStore[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [targetStoreId, setTargetStoreId] = useState<string>('');
  
  // Options
  const [copyStock, setCopyStock] = useState<boolean>(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update' | 'create_new'>('skip');
  const [priceAdjustmentType, setPriceAdjustmentType] = useState<'none' | 'percent' | 'fixed'>('none');
  const [priceAdjustmentValue, setPriceAdjustmentValue] = useState<number>(0);
  const [forceOnlineStatus] = useState<'keep' | 'online' | 'pos'>('keep');

  // Execution state
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
    getUserManageableStoresAction()
      .then((res) => {
        if (!active) return;
        if (res.success && res.stores) {
          const filtered = res.stores.filter((s) => s.id !== sourceStoreId);
          setAvailableStores(filtered);
          if (filtered.length > 0 && !targetStoreId) {
            setTargetStoreId(filtered[0].id);
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
  }, [isOpen, sourceStoreId, targetStoreId]);

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
      const percentAdj = priceAdjustmentType === 'percent' ? Number(priceAdjustmentValue) || 0 : undefined;
      const fixedAdj = priceAdjustmentType === 'fixed' ? Number(priceAdjustmentValue) || 0 : undefined;

      const res = await transferProductsBetweenStoresAction(
        sourceStoreId,
        targetStoreId,
        productIds,
        {
          duplicateStrategy,
          copyStock,
          priceAdjustmentPercent: percentAdj,
          priceAdjustmentFixed: fixedAdj,
          forceOnlineStatus,
        }
      );

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
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-br from-gray-50 via-white to-blue-50/30">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-2xl">
              <ArrowRightLeft size={24} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">
                Copier / Transférer vers une autre boutique
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                De : <strong className="text-gray-800">{sourceStoreName}</strong>
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

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-grow">
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-start gap-3">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-red-500" />
              <span className="font-semibold leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {!transferResult ? (
            <>
              {/* 1. Sélection de la boutique cible */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  1. Boutique de destination
                </label>

                {isLoadingStores ? (
                  <div className="p-4 bg-gray-50 rounded-2xl flex items-center justify-center gap-2 text-xs text-gray-500">
                    <Loader2 size={16} className="animate-spin text-blue-600" /> Chargement de vos boutiques...
                  </div>
                ) : availableStores.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
                    <p className="font-bold">Aucune autre boutique disponible</p>
                    <p className="mt-1">
                      Vous n&apos;avez pas d&apos;autre boutique sous votre compte. Créez une nouvelle boutique depuis le menu pour pouvoir transférer des produits entre boutiques.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {availableStores.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => setTargetStoreId(s.id)}
                        className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                          targetStoreId === s.id
                            ? 'border-blue-500 bg-blue-50/30 shadow-sm'
                            : 'border-gray-100 hover:border-gray-200 bg-white'
                        }`}
                      >
                        <div className={`p-2 rounded-xl ${
                          s.businessType === 'food' ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          <Store size={18} />
                        </div>
                        <div className="min-w-0 flex-grow">
                          <span className="block text-xs font-bold text-gray-900 truncate">
                            {s.name}
                          </span>
                          <span className="block text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">
                            {s.businessType === 'food' ? 'Resto' : 'Shop'} • {s.isOwner ? 'Propriétaire' : 'Équipe'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Périmètre des produits */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  2. Produits à transférer
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-2 ${
                      scope === 'all'
                        ? 'border-blue-500 bg-blue-50/20'
                        : 'border-gray-100 hover:border-gray-200 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="transferScope"
                      value="all"
                      checked={scope === 'all'}
                      onChange={() => setScope('all')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-gray-900">
                      Tous les produits ({totalProductsCount})
                    </span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2 ${
                      selectedProductsCount === 0
                        ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50'
                        : scope === 'selected'
                        ? 'border-blue-500 bg-blue-50/20 cursor-pointer'
                        : 'border-gray-100 hover:border-gray-200 bg-white cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="transferScope"
                      value="selected"
                      disabled={selectedProductsCount === 0}
                      checked={scope === 'selected'}
                      onChange={() => setScope('selected')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs font-bold text-gray-900">
                      Sélection ({selectedProductsCount})
                    </span>
                  </label>
                </div>
              </div>

              {/* 3. Options de transfert */}
              <div className="space-y-3.5 pt-2 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  3. Options & Ajustements
                </label>

                {/* Gestion des stocks */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">
                      Copier les quantités en stock
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {copyStock
                        ? 'Conserve les mêmes stocks dans la nouvelle boutique'
                        : 'Initialise les stocks à 0 dans la boutique de destination (Recommandé)'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={copyStock}
                    onChange={(e) => setCopyStock(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                </div>

                {/* Ajustement des prix */}
                <div>
                  <span className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Ajustement tarifaire pour la boutique cible :
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'none', label: 'Prix identiques' },
                      { id: 'percent', label: 'Pourcentage (+/- %)' },
                      { id: 'fixed', label: 'Montant fixe (+/-)' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPriceAdjustmentType(m.id as 'none' | 'percent' | 'fixed')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                          priceAdjustmentType === m.id
                            ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {priceAdjustmentType !== 'none' && (
                    <div className="mt-2.5 flex items-center gap-2 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                      <span className="text-xs font-semibold text-gray-700">
                        {priceAdjustmentType === 'percent' ? 'Variation (%) :' : 'Montant (+/- FCFA) :'}
                      </span>
                      <input
                        type="number"
                        value={priceAdjustmentValue}
                        onChange={(e) => setPriceAdjustmentValue(parseFloat(e.target.value) || 0)}
                        placeholder="Ex: 10 ou -5"
                        className="w-28 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-[11px] text-gray-500">
                        {priceAdjustmentType === 'percent' ? 'ex: +10% ou -5%' : 'ex: +1000 FCFA'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Conflits / Doublons */}
                <div>
                  <span className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Si le produit existe déjà dans la boutique cible :
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'skip', label: 'Ignorer' },
                      { id: 'update', label: 'Mettre à jour' },
                      { id: 'create_new', label: 'Créer doublon' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDuplicateStrategy(d.id as 'skip' | 'update' | 'create_new')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                          duplicateStrategy === d.id
                            ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Result Summary */
            <div className="py-8 space-y-6 text-center">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-blue-100">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Transfert terminé avec succès !
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Les produits ont été dupliqués vers <strong className="text-gray-800">{targetStore?.name}</strong>.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
                  <span className="block text-xl font-extrabold text-emerald-700">
                    +{transferResult.createdCount}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-600">Créés</span>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl">
                  <span className="block text-xl font-extrabold text-blue-700">
                    {transferResult.updatedCount}
                  </span>
                  <span className="text-[11px] font-bold text-blue-600">Mis à jour</span>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl">
                  <span className="block text-xl font-extrabold text-gray-600">
                    {transferResult.skippedCount}
                  </span>
                  <span className="text-[11px] font-bold text-gray-500">Ignorés</span>
                </div>
              </div>

              {transferResult.errors.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-800 max-h-32 overflow-y-auto">
                  <div className="font-bold mb-1">Avertissements ({transferResult.errors.length}) :</div>
                  {transferResult.errors.map((e, idx) => (
                    <div key={idx}>• {e}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          {!transferResult ? (
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
                disabled={isTransferring || availableStores.length === 0 || countToTransfer === 0}
                onClick={handleTransfer}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-2xl text-xs md:text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTransferring ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Transfert en cours...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft size={16} /> Transférer {countToTransfer} produit{countToTransfer > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-2xl text-xs md:text-sm font-bold shadow-md transition-all"
            >
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
