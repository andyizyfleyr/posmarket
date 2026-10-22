/**
 * Rendu riche & automatique de la description produit — refonte mobile.
 *
 * Nouvelle hiérarchie : points clés en tuiles, description éditoriale (lead +
 * sections + listes) et caractéristiques présentées en liste lisible (icône /
 * libellé / valeur) plutôt qu'en grille de petites cases.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Check,
  Clock,
  Hash,
  Layers,
  Package,
  Ruler,
  SlidersHorizontal,
  Store as StoreIcon,
  Tag,
  Truck,
  Zap,
} from 'lucide-react-native';
import { COLORS } from '@/theme';
import {
  parseDescription,
  type AutoSpec,
} from '@/utils/product-description';

const LINE = {
  fontSize: 12.5,
  lineHeight: 20,
  color: '#4B5563',
};

export function RichDescription({ text }: { text: string }) {
  const blocks = parseDescription(text);

  if (blocks.length === 0) {
    return text ? <Text style={styles.lead}>{text}</Text> : null;
  }

  let leadUsed = false;

  return (
    <View style={styles.blocks}>
      {blocks.map((b, i) => {
        if (b.type === 'heading') {
          return (
            <View key={i} style={styles.headingRow}>
              <View style={styles.headingTick} />
              <Text style={styles.headingText}>{b.text}</Text>
            </View>
          );
        }
        if (b.type === 'paragraph') {
          const isLead = !leadUsed;
          leadUsed = true;
          return (
            <Text key={i} style={isLead ? styles.lead : styles.paragraph}>
              {b.text}
            </Text>
          );
        }
        if (b.type === 'label') {
          return (
            <View key={i} style={styles.labelRow}>
              <Text style={styles.labelKey}>{b.label}</Text>
              <Text style={styles.labelValue}>{b.value}</Text>
            </View>
          );
        }
        if (b.type === 'list' && !b.ordered) {
          return (
            <View key={i} style={styles.list}>
              {b.items.map((item, j) => (
                <View key={j} style={styles.bulletRow}>
                  <View style={styles.bulletIconWrap}>
                    <Check size={9} strokeWidth={3.5} color={COLORS.brand} />
                  </View>
                  <Text style={[LINE, styles.flex1]}>{item}</Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <View key={i} style={styles.list}>
            {b.items.map((item, j) => (
              <View key={j} style={styles.bulletRow}>
                <Text style={styles.orderedNum}>{j + 1}.</Text>
                <Text style={[LINE, styles.flex1]}>{item}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

/** Points forts auto-extraits, présentés en tuiles scannables. */
export function DescriptionHighlights({ items }: { items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionLabel}>Points clés</Text>
        <View style={styles.sectionLine} />
      </View>
      <View style={styles.highlightsGrid}>
        {items.map((item, i) => (
          <View key={i} style={styles.highlightTile}>
            <View style={styles.highlightIcon}>
              <Check size={9} strokeWidth={3.5} color={COLORS.brand} />
            </View>
            <Text style={styles.highlightText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SpecIcon({ label }: { label: string }) {
  const common = { size: 12, color: COLORS.textMuted } as const;
  switch (label) {
    case 'Catégorie':
      return <Tag {...common} />;
    case 'Boutique':
      return <StoreIcon {...common} />;
    case 'Disponibilité':
      return <Package {...common} />;
    case 'Référence':
      return <Hash {...common} />;
    case 'Format':
      return <Ruler {...common} />;
    case 'Délai de livraison':
      return <Truck {...common} />;
    case 'Préparation estimée':
      return <Clock {...common} />;
    case 'Options':
      return <SlidersHorizontal {...common} />;
    case 'Variantes':
      return <Layers {...common} />;
    case 'Prix de gros':
      return <Zap {...common} />;
    default:
      return <Package {...common} />;
  }
}

const SPEC_TONES: Record<string, string> = {
  success: '#047857',
  danger: '#DC2626',
};

export function DescriptionSpecs({ specs }: { specs: AutoSpec[] }) {
  if (!specs || specs.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionLabel}>Caractéristiques</Text>
        <View style={styles.sectionLine} />
      </View>
      <View style={styles.specsPanel}>
        {specs.map((s, i) => (
          <View
            key={`${s.label}-${i}`}
            style={[styles.specRow, i > 0 ? styles.specRowBorder : null]}
          >
            <View style={styles.specIcon}>
              <SpecIcon label={s.label} />
            </View>
            <Text style={styles.specLabel}>{s.label}</Text>
            <View style={styles.specSpacer} />
            <Text
              style={[styles.specValue, s.tone ? { color: SPEC_TONES[s.tone] } : null]}
              numberOfLines={2}
            >
              {s.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Bloc complet : points forts, description et caractéristiques. */
export function ProductDescription({
  text,
  highlights,
  specs,
}: {
  text: string;
  highlights: string[];
  specs: AutoSpec[];
}) {
  return (
    <View style={styles.root}>
      <DescriptionHighlights items={highlights} />
      <RichDescription text={text} />
      <DescriptionSpecs specs={specs} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  blocks: { gap: 10 },
  flex1: { flex: 1 },

  lead: {
    fontSize: 13.5,
    lineHeight: 22,
    color: COLORS.text,
    fontWeight: '500',
  },
  paragraph: {
    fontSize: 12.5,
    lineHeight: 20,
    color: '#4B5563',
  },

  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingTop: 4,
  },
  headingTick: {
    width: 3,
    height: 13,
    borderRadius: 2,
    backgroundColor: COLORS.brand,
  },
  headingText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 2,
  },
  labelKey: {
    width: '38%',
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  labelValue: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    color: COLORS.text,
  },

  list: { gap: 7 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletIconWrap: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  orderedNum: {
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.brand,
    fontWeight: '700',
    minWidth: 16,
  },

  section: { marginTop: 2 },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 9,
  },
  sectionLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: COLORS.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  sectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.lineStrong,
  },

  highlightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  highlightTile: {
    flexBasis: '46%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: COLORS.brandSoft,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 9,
  },
  highlightIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  highlightText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15.5,
    fontWeight: '600',
    color: COLORS.text,
  },

  specsPanel: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
  },
  specRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.lineStrong,
  },
  specIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    flexShrink: 0,
  },
  specSpacer: { flex: 1 },
  specValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.text,
    maxWidth: '55%',
    textAlign: 'right',
  },
});
