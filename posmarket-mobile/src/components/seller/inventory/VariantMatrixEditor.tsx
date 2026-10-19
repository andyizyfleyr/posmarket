/**
 * Éditeur d'options & variantes — copie fidèle de
 * `src/components/inventory/VariantMatrixEditor.tsx` du web (rendu mobile).
 *
 * Adaptations mobiles assumées :
 * - les `<select>` deviennent des feuilles de sélection ;
 * - la matrice (5 colonnes fixes au web) devient des cartes empilées :
 *   nom + pastille couleur, puis une ligne Prix / Stock / SKU / Photo ;
 * - l'import/export CSV de la matrice passe par le partage de fichiers natif.
 */

import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  Package,
  Plus,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react-native';
import { COLORS } from '@/theme';
import { useToast } from '@/components/ToastProvider';
import { buildCsv, parseDelimited, detectDelimiter } from '@/utils/csv';
import { shareTextFile, pickTextFile } from '@/utils/files';
import {
  buildVariantMatrix,
  newVariantId,
  resolveVariantLimits,
  variantCombinationKey,
  type ProductOptionDef,
  type ProductVariantDef,
} from '@/utils/variants';

const OPTION_PRESETS: Record<string, string[]> = {
  Taille: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Taille Unique', 'Enfant', 'Adulte'],
  Couleur: [
    'Noir', 'Blanc', 'Rouge', 'Bleu', 'Marine', 'Vert', 'Kaki', 'Jaune',
    'Orange', 'Rose', 'Violet', 'Gris', 'Beige', 'Marron', 'Bordeaux', 'Or', 'Argent',
  ],
  Pointure: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
  Format: ['Petit', 'Moyen', 'Grand', 'Standard', 'Pack', 'Unité', 'Douzaine', '100ml', '250ml', '500ml', '1L'],
  Modèle: ['Standard', 'Pro', 'Max', 'Mini', 'Lite', 'Slim', 'Luxe', 'Sport', 'Classic', 'Premium'],
  Saveur: ['Vanille', 'Chocolat', 'Fraise', 'Citron', 'Caramel', 'Banane', 'Pistache', 'Menthe', 'Pimenté', 'Nature'],
  Matière: ['Coton', 'Cuir', 'Bois', 'Acier', 'Aluminium', 'Plastique', 'Verre', 'Céramique', 'Laine', 'Nylon'],
  Poids: ['50g', '100g', '200g', '250g', '500g', '1kg', '2kg', '5kg', '10kg', '25kg'],
};

/** Palette de couleurs pour distinguer visuellement les variantes. */
const VARIANT_COLORS = [
  '#F97316', '#3B82F6', '#10B981', '#8B5CF6',
  '#F43F5E', '#F59E0B', '#14B8A6', '#6366F1',
  '#EC4899', '#06B6D4', '#84CC16', '#EF4444',
];

const { maxOptions: MAX_OPTIONS } = resolveVariantLimits();

interface VariantMatrixEditorProps {
  options: ProductOptionDef[];
  variants: ProductVariantDef[];
  basePrice: number;
  images: string[];
  onChange: (
    options: ProductOptionDef[],
    variants: ProductVariantDef[],
    notice: string | null,
  ) => void;
}

export function VariantMatrixEditor({
  options,
  variants,
  basePrice,
  images,
  onChange,
}: VariantMatrixEditorProps) {
  const { notify } = useToast();
  const [notice, setNotice] = useState<string | null>(null);
  const [imagePickerFor, setImagePickerFor] = useState<string | null>(null);
  const [valueDraft, setValueDraft] = useState<Record<string, string>>({});
  const [typePickerFor, setTypePickerFor] = useState<number | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState<null | 'price' | 'stock'>(null);
  const [imageUrlDraft, setImageUrlDraft] = useState('');
  const [busyCsv, setBusyCsv] = useState(false);

  const stats = useMemo(() => {
    const total = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
    const outOfStock = variants.filter((v) => (v.stock || 0) <= 0).length;
    const prices = variants.map((v) => Number(v.price) || 0).filter((p) => p > 0);
    return {
      total,
      outOfStock,
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    };
  }, [variants]);

  const formatXof = (value: number) => `${value.toLocaleString('fr-FR')} XOF`;

  const push = (
    nextOptions: ProductOptionDef[],
    nextVariants?: ProductVariantDef[],
    message: string | null = null,
  ) => {
    setNotice(message);
    onChange(nextOptions, nextVariants ?? variants, message);
  };

  const sync = (nextOptions: ProductOptionDef[], customMessage: string | null = null) => {
    const { variants: rebuilt, dropped } = buildVariantMatrix(nextOptions, variants, basePrice);
    const message =
      customMessage ??
      (dropped.length > 0
        ? `${dropped.length} variante(s) retirée(s) car leurs options n'existent plus.`
        : null);
    setNotice(message);
    onChange(nextOptions, rebuilt, message);
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    const next = [...options, { id: newVariantId(), name: '', values: [] }];
    const { variants: rebuilt, dropped } = buildVariantMatrix(next, variants, basePrice);
    const message =
      dropped.length > 0
        ? `${dropped.length} variante(s) retirée(s) car leurs options n'existent plus.`
        : null;
    setNotice(message);
    onChange(next, rebuilt, message);
  };

  const updateOption = (index: number, patch: Partial<ProductOptionDef>) => {
    sync(options.map((option, i) => (i === index ? { ...option, ...patch } : option)));
  };

  const removeOption = (index: number) => {
    sync(
      options.filter((_, i) => i !== index),
      'Option supprimée : les variantes correspondantes ont été retirées.',
    );
  };

  const addValue = (option: ProductOptionDef, raw: string) => {
    const value = raw.trim().replace(/,$/, '').trim();
    setValueDraft((prev) => ({ ...prev, [option.id]: '' }));
    if (!value) return;
    if (option.values.some((v) => v.toLowerCase() === value.toLowerCase())) return;
    updateOption(options.indexOf(option), { values: [...option.values, value] });
  };

  const removeValue = (option: ProductOptionDef, value: string) => {
    updateOption(options.indexOf(option), { values: option.values.filter((v) => v !== value) });
  };

  const updateVariant = (id: string, patch: Partial<ProductVariantDef>) => {
    push(options, variants.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };

  const setAllPrices = () => {
    push(
      options,
      variants.map((v) => ({ ...v, price: basePrice })),
      `Prix de toutes les variantes aligné sur ${formatXof(basePrice)}.`,
    );
    setBulkConfirm(null);
  };

  const setAllStock = (stock: number) => {
    push(
      options,
      variants.map((v) => ({ ...v, stock })),
      stock > 0
        ? `Stock positionné à ${stock} sur toutes les variantes.`
        : 'Stock remis à 0 sur toutes les variantes.',
    );
    setBulkConfirm(null);
  };

  const copySkuFromIndex = (index: number) => {
    const source = variants[index];
    if (!source) return;
    let suffix = 1;
    const base = source.sku?.trim() || '';
    if (!base) return;
    const used = new Set(variants.map((v) => v.sku));
    let candidate = `${base}-${suffix}`;
    while (used.has(candidate)) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    updateVariant(variants[index + 1]?.id || source.id, { sku: candidate });
  };

  // ── CSV : export / import de la matrice des variantes ─────────────
  const exportVariantsCsv = async () => {
    if (variants.length === 0) return;
    const rows: Array<Array<unknown>> = [
      [...options.map((o) => o.name || 'Option'), 'Nom', 'Prix', 'Stock', 'SKU', 'Image', 'Activee'],
      ...variants.map((v) => [
        ...options.map((o) => v.optionValues[o.id] || ''),
        v.name || '',
        v.price ?? '',
        v.stock ?? '',
        v.sku || '',
        v.image || '',
        v.enabled === false ? '0' : '1',
      ]),
    ];
    try {
      setBusyCsv(true);
      const shared = await shareTextFile(
        `variantes-${Date.now()}.csv`,
        buildCsv(rows),
        'text/csv',
        'Exporter la matrice des variantes',
      );
      if (!shared) notify('Partage indisponible sur cet appareil.', 'error');
    } catch (error) {
      console.error('Erreur export CSV variantes:', error);
      notify("Impossible d'exporter la matrice.", 'error');
    } finally {
      setBusyCsv(false);
    }
  };

  const importVariantsCsv = async () => {
    try {
      setBusyCsv(true);
      const file = await pickTextFile({ mimeTypes: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'] });
      if (!file) return;
      const text = file.content.replace(/^\ufeff/, '').trim();
      if (!text) return;
      const delimiter = detectDelimiter(text);
      const lines = parseDelimited(text, delimiter);
      if (lines.length < 2) return;

      const existingByKey = new Map(
        variants.map((v) => [variantCombinationKey(v.optionValues), v]),
      );
      const merged: ProductVariantDef[] = [...variants];
      const mergedKeys = new Set(variants.map((v) => variantCombinationKey(v.optionValues)));

      for (const cells of lines.slice(1)) {
        if (cells.length < options.length + 2) continue;
        const optionValues: Record<string, string> = {};
        options.forEach((o, i) => {
          const val = cells[i]?.replace(/"/g, '');
          if (val) optionValues[o.id] = val;
        });
        const nbOpts = options.length;
        const name = cells[nbOpts]?.replace(/"/g, '') || '';
        const price = Math.max(0, Number(String(cells[nbOpts + 1]).replace(',', '.')) || 0);
        const stock = Math.max(0, Math.round(Number(cells[nbOpts + 2]) || 0));
        const sku = cells[nbOpts + 3]?.replace(/"/g, '') || '';
        const image = cells[nbOpts + 4]?.replace(/"/g, '') || '';
        const enabled = String(cells[nbOpts + 5] ?? '1') !== '0';

        const key = variantCombinationKey(optionValues);
        if (!key || Object.keys(optionValues).length !== options.length) continue;
        const previous = existingByKey.get(key);
        const variant: ProductVariantDef = {
          id: previous?.id || newVariantId(),
          name: name || previous?.name || '',
          nameCustom: !!(name && name !== (previous?.name || '')),
          optionValues,
          price,
          stock,
          enabled,
          ...(sku ? { sku } : {}),
          ...(image ? { image } : {}),
          ...(previous?.image && !image ? { image: previous.image } : {}),
        };
        if (mergedKeys.has(key)) {
          const idx = merged.findIndex((v) => variantCombinationKey(v.optionValues) === key);
          if (idx >= 0) merged[idx] = variant;
        } else {
          merged.push(variant);
          mergedKeys.add(key);
        }
      }
      setNotice('Importation CSV : variantes fusionnées avec la matrice existante.');
      onChange(options, merged, null);
    } catch (error) {
      console.error('Erreur import CSV variantes:', error);
      setNotice('Importation impossible : le format du fichier est invalide.');
    } finally {
      setBusyCsv(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* ── EN-TÊTE DE SECTION ─────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Layers size={17} color={COLORS.brand} />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.headerTitle}>Options &amp; Variantes</Text>
            <Text style={styles.headerSubtitle}>
              Taille, couleur… prix et stock par combinaison
            </Text>
          </View>
        </View>
        <Pressable
          onPress={addOption}
          disabled={options.length >= MAX_OPTIONS}
          style={[styles.addOptionBtn, options.length >= MAX_OPTIONS && styles.addOptionBtnDisabled]}
        >
          <Plus size={14} color="#FFFFFF" strokeWidth={3} />
          <Text style={styles.addOptionText}>Ajouter une option</Text>
        </Pressable>
      </View>

      {/* Compteur d'options */}
      {options.length > 0 ? (
        <View style={styles.optionsCounter}>
          {Array.from({ length: MAX_OPTIONS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.counterBar,
                { backgroundColor: i < options.length ? COLORS.brand : '#F3F4F6' },
              ]}
            />
          ))}
          <Text style={styles.counterLabel}>
            {options.length}/{MAX_OPTIONS}
          </Text>
        </View>
      ) : null}

      {/* Alerte max options */}
      {options.length >= MAX_OPTIONS ? (
        <View style={styles.maxAlert}>
          <AlertTriangle size={14} color="#F59E0B" />
          <Text style={styles.maxAlertText}>
            Maximum {MAX_OPTIONS} options — au-delà, la fiche devient illisible pour vos clients.
          </Text>
        </View>
      ) : null}

      {/* État vide */}
      {options.length === 0 ? (
        <View style={styles.emptyBox}>
          <View style={styles.emptyIcon}>
            <Package size={22} color="#D1D5DB" />
          </View>
          <Text style={styles.emptyTitle}>Aucune variante</Text>
          <Text style={styles.emptyText}>
            Ce produit se vend en un seul prix. Ajoutez <Text style={styles.bold}>Taille</Text> ou{' '}
            <Text style={styles.bold}>Couleur</Text> pour créer des variantes.
          </Text>
        </View>
      ) : null}

      {/* ── CARTES D'OPTIONS ──────────────────────────────────────── */}
      {options.map((option, index) => {
        const suggestions = OPTION_PRESETS[option.name] || [];
        const isPreset = Boolean(OPTION_PRESETS[option.name]);
        return (
          <View key={option.id} style={styles.optionCard}>
            <View style={styles.optionHeader}>
              <View style={styles.optionHeaderLeft}>
                <View style={styles.optionNumber}>
                  <Text style={styles.optionNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.optionHeaderTitle} numberOfLines={1}>
                  Option {index + 1}
                  {option.name ? ` — ${option.name}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => removeOption(index)} style={styles.optionDelete} hitSlop={6}>
                <Trash2 size={12} color="#9CA3AF" />
                <Text style={styles.optionDeleteText}>Supprimer</Text>
              </Pressable>
            </View>

            <View style={styles.optionBody}>
              {/* Sélecteur de type */}
              <View>
                <Text style={styles.fieldLabelSmall}>Type d&apos;option</Text>
                <Pressable onPress={() => setTypePickerFor(index)} style={styles.selectField}>
                  <Text style={styles.selectFieldText}>
                    {isPreset ? option.name : 'Nom personnalisé…'}
                  </Text>
                  <ChevronDown size={16} color="#9CA3AF" />
                </Pressable>
              </View>

              {/* Nom personnalisé */}
              {!isPreset ? (
                <View>
                  <Text style={styles.fieldLabelSmall}>Nom de l&apos;option</Text>
                  <TextInput
                    value={option.name}
                    onChangeText={(value) => updateOption(index, { name: value })}
                    placeholder="Ex : Pointure, Matière, Parfum…"
                    placeholderTextColor="#D1D5DB"
                    style={styles.customNameInput}
                  />
                </View>
              ) : null}

              {/* Zone de valeurs */}
              <View>
                <View style={styles.valuesLabelRow}>
                  <Text style={styles.fieldLabelSmall}>Valeurs ajoutées</Text>
                  {option.values.length > 0 ? (
                    <View style={styles.valuesCount}>
                      <Text style={styles.valuesCountText}>{option.values.length}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.valuesBox}>
                  {option.values.map((value) => (
                    <View key={value} style={styles.valueChip}>
                      <Text style={styles.valueChipText}>{value}</Text>
                      <Pressable onPress={() => removeValue(option, value)} hitSlop={6}>
                        <X size={10} color="#9CA3AF" />
                      </Pressable>
                    </View>
                  ))}
                  <TextInput
                    value={valueDraft[option.id] ?? ''}
                    onChangeText={(text) => {
                      if (/[,;]$/.test(text)) {
                        addValue(option, text);
                        return;
                      }
                      setValueDraft((prev) => ({ ...prev, [option.id]: text }));
                    }}
                    onSubmitEditing={() => addValue(option, valueDraft[option.id] ?? '')}
                    onKeyPress={(event) => {
                      if (
                        event.nativeEvent.key === 'Backspace' &&
                        !(valueDraft[option.id] ?? '') &&
                        option.values.length > 0
                      ) {
                        removeValue(option, option.values[option.values.length - 1]);
                      }
                    }}
                    placeholder={
                      option.values.length === 0 ? 'Saisir une valeur puis Entrée…' : '+ Ajouter…'
                    }
                    placeholderTextColor="#D1D5DB"
                    style={styles.valueInput}
                    blurOnSubmit={false}
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={() => addValue(option, valueDraft[option.id] ?? '')}
                    style={styles.valueAddBtn}
                    hitSlop={4}
                  >
                    <Plus size={12} color={COLORS.brand} strokeWidth={3} />
                  </Pressable>
                </View>

                {/* Suggestions de presets */}
                {suggestions.length > 0 ? (
                  <View style={{ marginTop: 12 }}>
                    <Text style={[styles.fieldLabelSmall, { marginBottom: 8 }]}>
                      Suggestions rapides
                    </Text>
                    <View style={styles.suggestionsWrap}>
                      {suggestions.map((suggestion) => {
                        const active = option.values.some(
                          (v) => v.toLowerCase() === suggestion.toLowerCase(),
                        );
                        return (
                          <Pressable
                            key={suggestion}
                            onPress={() =>
                              active
                                ? removeValue(option, suggestion)
                                : updateOption(index, { values: [...option.values, suggestion] })
                            }
                            style={[styles.suggestionChip, active && styles.suggestionChipActive]}
                          >
                            {active ? (
                              <Check size={11} color="#FFFFFF" />
                            ) : (
                              <Plus size={11} color="#6B7280" />
                            )}
                            <Text
                              style={[
                                styles.suggestionText,
                                active && styles.suggestionTextActive,
                              ]}
                            >
                              {suggestion}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}

      {/* ── NOTICE DE CHANGEMENT ─────────────────────────────────── */}
      {notice ? (
        <View style={styles.notice}>
          <AlertTriangle size={14} color="#F59E0B" />
          <Text style={styles.noticeText}>{notice}</Text>
          <Pressable onPress={() => setNotice(null)} hitSlop={8}>
            <X size={12} color="#FBBF24" />
          </Pressable>
        </View>
      ) : null}

      {/* ── MATRICE DE VARIANTES ─────────────────────────────────── */}
      {options.length > 0 ? (
        <View style={{ gap: 16 }}>
          {/* Stats en pills */}
          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Package size={13} color={COLORS.brand} />
              <Text style={styles.statPillText}>
                {variants.length} variante{variants.length > 1 ? 's' : ''}
              </Text>
            </View>
            {stats.total > 0 ? (
              <View style={[styles.statPill, styles.statPillGreen]}>
                <BarChart3 size={13} color="#047857" />
                <Text style={[styles.statPillText, { color: '#047857' }]}>
                  {stats.total} en stock
                </Text>
              </View>
            ) : null}
            {stats.outOfStock > 0 ? (
              <View style={[styles.statPill, styles.statPillRose]}>
                <AlertTriangle size={12} color="#E11D48" />
                <Text style={[styles.statPillText, { color: '#E11D48' }]}>
                  {stats.outOfStock} en rupture
                </Text>
              </View>
            ) : null}
            {variants.length > 0 && stats.min > 0 ? (
              <View style={[styles.statPill, styles.statPillOrange]}>
                <Tag size={12} color={COLORS.brand} />
                <Text style={[styles.statPillText, { color: COLORS.brand }]}>
                  {stats.min === stats.max
                    ? formatXof(stats.min)
                    : `${stats.min.toLocaleString('fr-FR')} – ${formatXof(stats.max)}`}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Actions groupées */}
          {variants.length > 0 ? (
            <View style={styles.bulkBar}>
              <Text style={styles.bulkLabel}>Actions groupées :</Text>
              <View style={styles.bulkButtons}>
                <Pressable onPress={importVariantsCsv} disabled={busyCsv} style={styles.bulkBtn}>
                  <Upload size={11} color="#4B5563" />
                  <Text style={styles.bulkBtnText}>Importer</Text>
                </Pressable>
                <Pressable
                  onPress={exportVariantsCsv}
                  disabled={busyCsv || variants.length === 0}
                  style={[styles.bulkBtn, (busyCsv || variants.length === 0) && styles.bulkBtnDisabled]}
                >
                  <Download size={11} color="#4B5563" />
                  <Text style={styles.bulkBtnText}>Exporter</Text>
                </Pressable>
                {bulkConfirm === 'price' ? (
                  <View style={styles.bulkConfirmRow}>
                    <Text style={styles.bulkConfirmText}>
                      Aligner tous les prix sur {formatXof(basePrice)} ?
                    </Text>
                    <Pressable onPress={setAllPrices} style={styles.bulkConfirmYes}>
                      <Text style={styles.bulkConfirmYesText}>Confirmer</Text>
                    </Pressable>
                    <Pressable onPress={() => setBulkConfirm(null)} style={styles.bulkConfirmNo}>
                      <Text style={styles.bulkConfirmNoText}>Annuler</Text>
                    </Pressable>
                  </View>
                ) : bulkConfirm === 'stock' ? (
                  <View style={styles.bulkConfirmRow}>
                    <Text style={styles.bulkConfirmText}>Remettre tout le stock à 0 ?</Text>
                    <Pressable
                      onPress={() => setAllStock(0)}
                      style={[styles.bulkConfirmYes, { backgroundColor: '#F43F5E' }]}
                    >
                      <Text style={styles.bulkConfirmYesText}>Confirmer</Text>
                    </Pressable>
                    <Pressable onPress={() => setBulkConfirm(null)} style={styles.bulkConfirmNo}>
                      <Text style={styles.bulkConfirmNoText}>Annuler</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Pressable onPress={() => setBulkConfirm('price')} style={styles.bulkBtn}>
                      <Tag size={11} color="#4B5563" />
                      <Text style={styles.bulkBtnText}>
                        Prix → {formatXof(basePrice)}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => setBulkConfirm('stock')} style={styles.bulkBtn}>
                      <Package size={11} color="#4B5563" />
                      <Text style={styles.bulkBtnText}>Stock → 0</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          ) : null}

          {/* Cartes des variantes */}
          {variants.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>La matrice est vide</Text>
              <Text style={styles.emptyText}>
                Ajoutez au moins une valeur à chaque option pour générer les variantes
                automatiquement.
              </Text>
              <Text style={styles.preservedText}>
                ✓ Vos prix, stocks et références sont toujours préservés.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {variants.map((variant, index) => {
                const priceNumber = Number(variant.price) || 0;
                const stock = variant.stock || 0;
                const color = VARIANT_COLORS[index % VARIANT_COLORS.length];
                const combination = options
                  .map((o) => variant.optionValues[o.id])
                  .filter(Boolean)
                  .join(' / ');
                return (
                  <View
                    key={variant.id}
                    style={[styles.variantCard, variant.enabled === false && styles.variantCardDisabled]}
                  >
                    <View style={styles.variantNameRow}>
                      <View
                        style={[
                          styles.variantDot,
                          { backgroundColor: variant.enabled === false ? '#D1D5DB' : color },
                        ]}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <TextInput
                          value={variant.name ?? combination}
                          onChangeText={(text) =>
                            updateVariant(variant.id, { name: text, nameCustom: true })
                          }
                          placeholder={combination || 'Nom de la variante'}
                          placeholderTextColor="#9CA3AF"
                          style={styles.variantNameInput}
                        />
                        <View style={styles.variantBadges}>
                          {variant.enabled === false ? (
                            <Text style={styles.badgeMuted}>Masquée</Text>
                          ) : null}
                          {priceNumber === 0 ? (
                            <Text style={styles.badgeRose}>Prix manquant</Text>
                          ) : null}
                          {stock === 0 && priceNumber > 0 && variant.enabled !== false ? (
                            <Text style={styles.badgeAmber}>Épuisé</Text>
                          ) : null}
                        </View>
                      </View>
                    </View>

                    <View style={styles.variantFieldsRow}>
                      <View style={styles.variantField}>
                        <Text style={styles.variantFieldLabel}>Prix XOF</Text>
                        <TextInput
                          value={String(variant.price ?? '')}
                          onChangeText={(text) => {
                            const raw = text.trim();
                            if (raw === '') {
                              updateVariant(variant.id, { price: 0 });
                              return;
                            }
                            const parsed = Number(raw.replace(',', '.'));
                            if (Number.isFinite(parsed) && parsed >= 0) {
                              updateVariant(variant.id, { price: parsed });
                            }
                          }}
                          keyboardType="numeric"
                          style={[
                            styles.variantPriceInput,
                            priceNumber > 0 ? styles.variantPriceOk : styles.variantPriceMissing,
                          ]}
                        />
                      </View>

                      <View style={styles.variantField}>
                        <Text style={styles.variantFieldLabel}>Stock</Text>
                        <TextInput
                          value={String(variant.stock ?? 0)}
                          onChangeText={(text) => {
                            if (text === '') {
                              updateVariant(variant.id, { stock: 0 });
                              return;
                            }
                            const parsed = Number(text);
                            if (Number.isFinite(parsed) && parsed >= 0) {
                              updateVariant(variant.id, { stock: Math.round(parsed) });
                            }
                          }}
                          keyboardType="numeric"
                          style={[
                            styles.variantStockInput,
                            stock === 0
                              ? styles.variantStockEmpty
                              : stock <= 3
                                ? styles.variantStockLow
                                : styles.variantStockOk,
                          ]}
                        />
                      </View>

                      <View style={[styles.variantField, { flex: 1.4 }]}>
                        <Text style={styles.variantFieldLabel}>Référence SKU</Text>
                        <View style={styles.skuRow}>
                          <TextInput
                            value={variant.sku || ''}
                            onChangeText={(text) => updateVariant(variant.id, { sku: text })}
                            placeholder={`ex: ${options
                              .map((o) => (variant.optionValues[o.id] || '').slice(0, 3).toUpperCase())
                              .join('-')}`}
                            placeholderTextColor="#D1D5DB"
                            autoCapitalize="characters"
                            style={styles.skuInput}
                          />
                          {index === 0 && variant.sku && variants.length > 1 ? (
                            <Pressable onPress={() => copySkuFromIndex(index)} hitSlop={4}>
                              <Copy size={13} color="#9CA3AF" />
                            </Pressable>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.variantActions}>
                        <Pressable
                          onPress={() => setImagePickerFor(variant.id)}
                          style={[
                            styles.variantPhotoBtn,
                            variant.image ? styles.variantPhotoBtnFilled : null,
                          ]}
                          accessibilityLabel="Photo de cette variante"
                        >
                          {variant.image ? (
                            <Image
                              source={{ uri: variant.image }}
                              style={styles.variantPhotoImg}
                              contentFit="cover"
                            />
                          ) : (
                            <ImageIcon size={15} color="#9CA3AF" />
                          )}
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            updateVariant(variant.id, {
                              enabled: variant.enabled === false ? true : false,
                            })
                          }
                          hitSlop={4}
                          style={styles.variantActionBtn}
                          accessibilityLabel={
                            variant.enabled === false
                              ? 'Réactiver cette variante'
                              : 'Masquer cette variante'
                          }
                        >
                          {variant.enabled === false ? (
                            <Eye size={13} color="#10B981" />
                          ) : (
                            <EyeOff size={13} color="#9CA3AF" />
                          )}
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            const next = variants.filter((v) => v.id !== variant.id);
                            push(options, next, 'Variante retirée de la matrice.');
                          }}
                          hitSlop={4}
                          style={styles.variantActionBtn}
                          accessibilityLabel="Retirer cette variante"
                        >
                          <Trash2 size={13} color="#9CA3AF" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      ) : null}

      {/* Feuille « Type d'option » */}
      <Modal
        visible={typePickerFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTypePickerFor(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setTypePickerFor(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Type d&apos;option</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              <Pressable
                onPress={() => {
                  if (typePickerFor !== null) updateOption(typePickerFor, { name: '' });
                  setTypePickerFor(null);
                }}
                style={styles.modalRow}
              >
                <Text style={styles.modalRowText}>Nom personnalisé…</Text>
              </Pressable>
              {Object.keys(OPTION_PRESETS).map((preset) => (
                <Pressable
                  key={preset}
                  onPress={() => {
                    if (typePickerFor !== null) {
                      const index = typePickerFor;
                      sync(options.map((o, i) => (i === index ? { ...o, name: preset } : o)));
                    }
                    setTypePickerFor(null);
                  }}
                  style={styles.modalRow}
                >
                  <Text style={styles.modalRowText}>{preset}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Feuille « Photo de la variante » */}
      <Modal
        visible={imagePickerFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePickerFor(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setImagePickerFor(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Photo de la variante</Text>
            <TextInput
              value={imageUrlDraft}
              onChangeText={setImageUrlDraft}
              onSubmitEditing={() => {
                const url = imageUrlDraft.trim();
                if (url && imagePickerFor) {
                  updateVariant(imagePickerFor, { image: url });
                  setImageUrlDraft('');
                  setImagePickerFor(null);
                }
              }}
              placeholder="Collez une URL d'image…"
              placeholderTextColor="#D1D5DB"
              autoCapitalize="none"
              style={styles.urlInput}
            />
            {images.length > 0 ? (
              <View style={styles.galleryGrid}>
                {images.map((img) => (
                  <Pressable
                    key={img}
                    onPress={() => {
                      if (imagePickerFor) updateVariant(imagePickerFor, { image: img });
                      setImageUrlDraft('');
                      setImagePickerFor(null);
                    }}
                    style={[
                      styles.galleryItem,
                      imagePickerFor &&
                        variants.find((v) => v.id === imagePickerFor)?.image === img &&
                        styles.galleryItemActive,
                    ]}
                  >
                    <Image source={{ uri: img }} style={styles.galleryImg} contentFit="cover" />
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => {
                    if (imagePickerFor) updateVariant(imagePickerFor, { image: '' });
                    setImageUrlDraft('');
                    setImagePickerFor(null);
                  }}
                  style={[styles.galleryItem, styles.galleryClear]}
                >
                  <X size={12} color="#9CA3AF" />
                </Pressable>
              </View>
            ) : (
              <Text style={styles.galleryHint}>
                Astuce : ajoutez aussi la photo à la galerie du produit pour qu&apos;elle apparaisse sur
                la fiche.
              </Text>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 20 },
  bold: { fontWeight: '700' },

  header: { gap: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 14, fontWeight: '900', color: '#111827' },
  headerSubtitle: { fontSize: 10, fontWeight: '600', color: '#9CA3AF', marginTop: 2 },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  addOptionBtnDisabled: { opacity: 0.4 },
  addOptionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  optionsCounter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counterBar: { flex: 1, height: 6, borderRadius: 999 },
  counterLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', marginLeft: 4 },

  maxAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    borderRadius: 12,
  },
  maxAlertText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#B45309' },

  emptyBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    backgroundColor: 'rgba(249,250,251,0.5)',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#6B7280', marginBottom: 4 },
  emptyText: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },
  preservedText: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },

  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  optionNumber: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: COLORS.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionNumberText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  optionHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  optionDelete: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  optionDeleteText: { fontSize: 10, fontWeight: '700', color: '#9CA3AF' },
  optionBody: { padding: 16, gap: 16 },

  fieldLabelSmall: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    borderRadius: 12,
  },
  selectFieldText: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  customNameInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FFEDD5',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },

  valuesLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  valuesCount: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
  },
  valuesCountText: { fontSize: 9, color: COLORS.brand, fontWeight: '700' },
  valuesBox: {
    minHeight: 44,
    padding: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  valueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
  },
  valueChipText: { fontSize: 12, fontWeight: '700', color: '#1F2937' },
  valueInput: {
    flex: 1,
    minWidth: 140,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    paddingVertical: 2,
  },
  valueAddBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  suggestionChipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  suggestionText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  suggestionTextActive: { color: '#FFFFFF' },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
  },
  noticeText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#B45309' },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  statPillGreen: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5' },
  statPillRose: { backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FFE4E6' },
  statPillOrange: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FFEDD5' },
  statPillText: { fontSize: 12, fontWeight: '700', color: '#4B5563' },

  bulkBar: {
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    gap: 8,
  },
  bulkLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bulkButtons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bulkBtnDisabled: { opacity: 0.4 },
  bulkBtnText: { fontSize: 10, fontWeight: '700', color: '#4B5563' },
  bulkConfirmRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  bulkConfirmText: { fontSize: 12, fontWeight: '600', color: '#4B5563' },
  bulkConfirmYes: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.brand,
  },
  bulkConfirmYesText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  bulkConfirmNo: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  bulkConfirmNoText: { fontSize: 10, fontWeight: '700', color: '#4B5563' },

  variantCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    borderRadius: 14,
    padding: 10,
    gap: 10,
  },
  variantCardDisabled: { opacity: 0.45 },
  variantNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  variantDot: { width: 10, height: 10, borderRadius: 5 },
  variantNameInput: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
    paddingVertical: 2,
  },
  variantBadges: { flexDirection: 'row', gap: 8, marginTop: 2 },
  badgeMuted: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  badgeRose: { fontSize: 9, fontWeight: '700', color: '#F43F5E' },
  badgeAmber: { fontSize: 9, fontWeight: '700', color: '#F59E0B' },

  variantFieldsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  variantField: { flex: 1, minWidth: 0 },
  variantFieldLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  variantPriceInput: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  variantPriceOk: { borderColor: '#E5E7EB', color: COLORS.brand },
  variantPriceMissing: { borderColor: '#FECDD3', color: '#F43F5E' },
  variantStockInput: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  variantStockEmpty: { backgroundColor: '#FFF1F2', borderColor: '#FECDD3', color: '#F43F5E' },
  variantStockLow: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', color: '#D97706' },
  variantStockOk: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', color: '#1F2937' },
  skuRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  skuInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  variantActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  variantPhotoBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  variantPhotoBtnFilled: { borderStyle: 'solid', borderColor: COLORS.brand },
  variantPhotoImg: { width: '100%', height: '100%' },
  variantActionBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  modalTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  modalRow: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10 },
  modalRowText: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  urlInput: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 4,
  },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  galleryItem: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  galleryItemActive: { borderColor: COLORS.brand },
  galleryImg: { width: '100%', height: '100%' },
  galleryClear: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
  },
  galleryHint: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginTop: 4 },
});
