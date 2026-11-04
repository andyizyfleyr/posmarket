'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  PencilLine,
  CheckCircle2,
  AlertCircle,
  Loader2,
  DollarSign,
  Package,
  Tag,
  Ruler,
  Monitor,
  ShoppingBag,
  Info,
} from 'lucide-react';
import { BusinessVertical, Product } from '@/types';
import { formatCurrency } from '@/utils';
import { bulkUpdateProductsAction } from '@/app/actions/inventory';
import {
  applyPriceOperation,
  applyStockOperation,
  validateBulkPatch,
  type BulkPriceMode,
  type BulkProductPatch,
  type BulkStockMode,
  type BulkUpdateSummary,
} from '@/utils/bulk-product-edit';

interface BulkEditProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  businessType?: BusinessVertical;
  selectedProductIds: string[];
  selectedProducts: Product[];
  /** Catégories parentes autorisées pour la verticale de la boutique. */
  mainCategories: string[];
  /** Sous-catégorie → catégorie parente. */
  categoryMapping: Record<string, string>;
  onSuccess: (summary: BulkUpdateSummary) => void;
}

const UNIT_SUGGESTIONS = [
  'pièce',
  'kg',
  'g',
  'L',
  'cl',
  'm',
  'carton',
  'sachet',
  'paquet',
  'boîte',
  'portion',
];

const FieldCard: React.FC<{
  enabled: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ enabled, onToggle, icon, title, hint, children }) => (
  <div
    className={`rounded-2xl border-2 transition-all ${
      enabled ? 'border-brand/40 bg-orange-50/20' : 'border-gray-100 bg-white'
    }`}
  >
    <label className="flex items-start gap-3 p-4 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={enabled}
        onChange={onToggle}
        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
      />
      <span
        className={`p-2 rounded-xl ${
          enabled ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-500'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-gray-900">{title}</span>
        {hint && <span className="block text-[11px] text-gray-500 mt-0.5">{hint}</span>}
      </span>
    </label>
    {enabled && <div className="px-4 pb-4 pl-[4.5rem] space-y-3">{children}</div>}
  </div>
);

export default function BulkEditProductsModal({
  isOpen,
  onClose,
  storeId,
  businessType = 'shopping',
  selectedProductIds,
  selectedProducts,
  mainCategories,
  categoryMapping,
  onSuccess,
}: BulkEditProductsModalProps) {
  const [priceEnabled, setPriceEnabled] = useState(false);
  const [priceMode, setPriceMode] = useState<BulkPriceMode>('percent');
  const [priceValue, setPriceValue] = useState('');

  const [stockEnabled, setStockEnabled] = useState(false);
  const [stockMode, setStockMode] = useState<BulkStockMode>('set');
  const [stockValue, setStockValue] = useState('');

  const [categoryEnabled, setCategoryEnabled] = useState(false);
  const [mainCategory, setMainCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');

  const [unitEnabled, setUnitEnabled] = useState(false);
  const [unit, setUnit] = useState('pièce');

  const [channelEnabled, setChannelEnabled] = useState(false);
  const [channel, setChannel] = useState<'online' | 'pos'>('online');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<BulkUpdateSummary | null>(null);

  // Réinitialise la modale à chaque ouverture : une modification précédente ne
  // doit pas rester cochée par accident sur une nouvelle sélection.
  useEffect(() => {
    if (!isOpen) return;
    setPriceEnabled(false);
    setPriceMode('percent');
    setPriceValue('');
    setStockEnabled(false);
    setStockMode('set');
    setStockValue('');
    setCategoryEnabled(false);
    setMainCategory(mainCategories[0] ?? '');
    setSubCategory('');
    setUnitEnabled(false);
    setUnit('pièce');
    setChannelEnabled(false);
    setChannel('online');
    setIsSubmitting(false);
    setErrorMessage(null);
    setResult(null);
  }, [isOpen, mainCategories]);

  if (!isOpen) return null;

  const subCategories = Object.entries(categoryMapping)
    .filter(([, parent]) => !mainCategory || parent === mainCategory)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b, 'fr'));

  const handleToggleCategory = () => {
    const next = !categoryEnabled;
    setCategoryEnabled(next);
    if (next) {
      const nextMain = mainCategory || mainCategories[0] || '';
      setMainCategory(nextMain);
      const firstSub =
        Object.entries(categoryMapping).find(([, parent]) => !nextMain || parent === nextMain)?.[0] ?? '';
      setSubCategory(firstSub);
    }
  };

  const handleMainCategoryChange = (value: string) => {
    setMainCategory(value);
    const firstSub =
      Object.entries(categoryMapping).find(([, parent]) => parent === value)?.[0] ?? '';
    setSubCategory(firstSub);
  };

  const buildPatch = (): BulkProductPatch => {
    const patch: BulkProductPatch = {};
    if (priceEnabled) {
      patch.price = { mode: priceMode, value: Number(priceValue) };
    }
    if (stockEnabled) {
      patch.stock = { mode: stockMode, value: Number(stockValue) };
    }
    if (categoryEnabled) {
      patch.category = {
        ...(mainCategory ? { mainCategory } : {}),
        ...(subCategory ? { category: subCategory } : {}),
      };
    }
    if (unitEnabled) patch.unit = unit.trim();
    if (channelEnabled) patch.isOnline = channel === 'online';
    return patch;
  };

  const patch = buildPatch();
  const validationError = validateBulkPatch(patch);
  const previewProduct = selectedProducts[0];
  const parsedPrice = Number(priceValue);
  const hasPricePreview =
    priceEnabled &&
    !!previewProduct &&
    priceValue.trim() !== '' &&
    Number.isFinite(parsedPrice) &&
    (priceMode === 'set' ? parsedPrice > 0 : parsedPrice !== 0);
  const parsedStock = Number(stockValue);
  const hasStockPreview =
    stockEnabled &&
    !!previewProduct &&
    stockValue.trim() !== '' &&
    Number.isFinite(parsedStock);

  const handleSubmit = async () => {
    const currentPatch = buildPatch();
    const error = validateBulkPatch(currentPatch);
    if (error) {
      setErrorMessage(error);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await bulkUpdateProductsAction(selectedProductIds, storeId, currentPatch);
      if (!res.success) {
        throw new Error(res.error || 'Erreur lors de la modification.');
      }
      const summary: BulkUpdateSummary = {
        updated: res.updated,
        stockSkipped: res.stockSkipped,
        skipped: res.skipped,
        errors: res.errors ?? [],
        updates: res.updates ?? [],
      };
      setResult(summary);
      onSuccess(summary);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Erreur lors de la modification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const count = selectedProductIds.length;

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-gray-100 flex flex-col animate-in zoom-in-95 duration-200 max-h-[92vh]">
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-br from-gray-50 via-white to-orange-50/40">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand/10 text-brand rounded-2xl">
              <PencilLine size={22} />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">Modification en masse</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {count} produit{count > 1 ? 's' : ''} sélectionné{count > 1 ? 's' : ''}
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
        <div className="p-5 md:p-6 space-y-4 overflow-y-auto flex-grow">
          {errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-start gap-3">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-red-500" />
              <span className="font-semibold leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {!result ? (
            <>
              <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-2xl flex items-start gap-3">
                <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Seuls les champs cochés seront appliqués. Les autres informations des produits
                  restent inchangées.
                </p>
              </div>

              {/* Prix */}
              <FieldCard
                enabled={priceEnabled}
                onToggle={() => setPriceEnabled((prev) => !prev)}
                icon={<DollarSign size={16} />}
                title="Prix de vente"
                hint="Appliquer un prix fixe ou une variation à toute la sélection"
              >
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'set', label: 'Prix fixe' },
                    { id: 'percent', label: 'Variation %' },
                    { id: 'amount', label: 'Montant +/-' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setPriceMode(mode.id as BulkPriceMode)}
                      className={`px-2 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                        priceMode === mode.id
                          ? 'border-brand bg-brand text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={priceValue}
                    onChange={(e) => setPriceValue(e.target.value)}
                    placeholder={
                      priceMode === 'set' ? 'Ex: 2500' : priceMode === 'percent' ? 'Ex: 10 ou -5' : 'Ex: 500 ou -200'
                    }
                    className="w-36 px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                  <span className="text-[11px] text-gray-500">
                    {priceMode === 'set'
                      ? 'Nouveau prix en FCFA'
                      : priceMode === 'percent'
                        ? 'Pourcentage de hausse ou de baisse'
                        : 'Montant ajouté ou retiré (FCFA)'}
                  </span>
                </div>
                {hasPricePreview && previewProduct && (
                  <p className="text-[11px] font-semibold text-gray-600">
                    Exemple : {previewProduct.name} — {formatCurrency(previewProduct.price)} →{' '}
                    <span className="text-brand font-black">
                      {formatCurrency(
                        applyPriceOperation(previewProduct.price, {
                          mode: priceMode,
                          value: parsedPrice,
                        }),
                      )}
                    </span>
                  </p>
                )}
              </FieldCard>

              {/* Stock */}
              <FieldCard
                enabled={stockEnabled}
                onToggle={() => setStockEnabled((prev) => !prev)}
                icon={<Package size={16} />}
                title="Stock"
                hint="Les produits à variantes ne sont pas modifiés ici"
              >
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'set', label: 'Définir' },
                    { id: 'add', label: 'Ajouter' },
                    { id: 'remove', label: 'Retirer' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setStockMode(mode.id as BulkStockMode)}
                      className={`px-2 py-2 rounded-xl text-[11px] font-bold border transition-all ${
                        stockMode === mode.id
                          ? 'border-brand bg-brand text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={stockValue}
                    onChange={(e) => setStockValue(e.target.value)}
                    placeholder={stockMode === 'set' ? 'Ex: 50' : 'Ex: 10'}
                    className="w-32 px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                  <span className="text-[11px] text-gray-500">
                    {stockMode === 'set'
                      ? 'Nouvelle quantité en stock'
                      : stockMode === 'add'
                        ? 'Quantité à ajouter'
                        : 'Quantité à retirer'}
                  </span>
                </div>
                {hasStockPreview && previewProduct && (
                  <p className="text-[11px] font-semibold text-gray-600">
                    Exemple : {previewProduct.name} — {previewProduct.stock} →{' '}
                    <span className="text-brand font-black">
                      {applyStockOperation(previewProduct.stock, {
                        mode: stockMode,
                        value: parsedStock,
                      })}
                    </span>
                  </p>
                )}
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  Les produits qui ont des variantes gardent leur stock actuel : modifiez leur
                  matrice depuis la fiche produit.
                </p>
              </FieldCard>

              {/* Catégorie */}
              <FieldCard
                enabled={categoryEnabled}
                onToggle={handleToggleCategory}
                icon={<Tag size={16} />}
                title="Catégorie"
                hint="Ranger les produits sélectionnés dans une même catégorie"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="block">
                    <span className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Catégorie principale
                    </span>
                    <select
                      value={mainCategory}
                      onChange={(e) => handleMainCategoryChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/30"
                    >
                      {mainCategories.length === 0 && <option value="">Aucune catégorie</option>}
                      {mainCategories.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Sous-catégorie
                    </span>
                    <select
                      value={subCategory}
                      onChange={(e) => setSubCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/30"
                    >
                      {subCategories.length === 0 && <option value="">Aucune sous-catégorie</option>}
                      {subCategories.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </FieldCard>

              {/* Unité */}
              <FieldCard
                enabled={unitEnabled}
                onToggle={() => setUnitEnabled((prev) => !prev)}
                icon={<Ruler size={16} />}
                title="Unité de vente"
                hint="Par exemple pièce, kg, litre ou carton"
              >
                <input
                  type="text"
                  list="bulk-unit-suggestions"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Ex: pièce"
                  className="w-48 px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
                <datalist id="bulk-unit-suggestions">
                  {UNIT_SUGGESTIONS.map((suggestion) => (
                    <option key={suggestion} value={suggestion} />
                  ))}
                </datalist>
              </FieldCard>

              {/* Canal de vente */}
              <FieldCard
                enabled={channelEnabled}
                onToggle={() => setChannelEnabled((prev) => !prev)}
                icon={<ShoppingBag size={16} />}
                title="Canal de vente"
                hint="Basculer entre marketplace et point de vente"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setChannel('online')}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                      channel === 'online'
                        ? 'border-brand bg-orange-50/40'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <ShoppingBag size={16} className={channel === 'online' ? 'text-brand' : 'text-gray-400'} />
                    <span>
                      <span className="block text-xs font-bold text-gray-900">Marketplace + POS</span>
                      <span className="block text-[10px] text-gray-500">Visible en ligne et en caisse</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel('pos')}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                      channel === 'pos'
                        ? 'border-blue-500 bg-blue-50/40'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <Monitor size={16} className={channel === 'pos' ? 'text-blue-600' : 'text-gray-400'} />
                    <span>
                      <span className="block text-xs font-bold text-gray-900">POS uniquement</span>
                      <span className="block text-[10px] text-gray-500">Masqué de la marketplace</span>
                    </span>
                  </button>
                </div>
                {businessType === 'food' && (
                  <p className="text-[11px] text-gray-500">
                    Les plats restent dans le flux restauration de la boutique.
                  </p>
                )}
              </FieldCard>
            </>
          ) : (
            /* Result Summary */
            <div className="py-6 space-y-5 text-center">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-100">
                <CheckCircle2 size={34} />
              </div>

              <div>
                <h3 className="text-lg font-black text-gray-900">
                  {result.updated} produit{result.updated > 1 ? 's' : ''} mis à jour
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {result.updated > 0
                    ? 'Vos changements sont enregistrés et visibles immédiatement.'
                    : 'Aucun produit modifiable dans la sélection.'}
                </p>
              </div>

              {result.stockSkipped > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-left flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    <strong>{result.stockSkipped}</strong> produit
                    {result.stockSkipped > 1 ? 's' : ''} à variantes : le stock n&apos;a pas été
                    modifié (il se gère depuis la fiche produit).
                  </p>
                </div>
              )}

              {result.skipped > 0 && (
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-left flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    {result.skipped} produit{result.skipped > 1 ? 's' : ''} de la sélection n&apos;a
                    pas été trouvé dans cette boutique.
                  </p>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-left">
                  <p className="text-[11px] font-bold text-red-700 mb-1">Points à vérifier</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {result.errors.slice(0, 5).map((error, index) => (
                      <li key={`${error}-${index}`} className="text-[11px] text-red-700">
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 md:p-5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2">
          {result ? (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-brand hover:bg-[#d55a20] text-white rounded-xl text-sm font-bold transition-all active:scale-95"
            >
              Fermer
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-gray-600 hover:text-gray-900 text-sm font-bold transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !!validationError}
                title={validationError ?? undefined}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand hover:bg-[#d55a20] text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-orange-100 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin spinner-always" />
                ) : (
                  <PencilLine size={16} />
                )}
                {isSubmitting ? 'Application...' : `Appliquer à ${count}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
