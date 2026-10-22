/**
 * Rendu riche & automatique de la description produit — refonte mobile.
 *
 * Nouvelle hiérarchie : points clés en tuiles, description éditoriale (lead +
 * sections + listes).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { COLORS } from '@/theme';
import { parseDescription } from '@/utils/product-description';

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

  const firstParagraphIndex = blocks.findIndex((b) => b.type === 'paragraph');

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
          const isLead = i === firstParagraphIndex;
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

/** Bloc complet : points forts et description. */
export function ProductDescription({
  text,
  highlights,
}: {
  text: string;
  highlights: string[];
}) {
  return (
    <View style={styles.root}>
      <DescriptionHighlights items={highlights} />
      <RichDescription text={text} />
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

  });
