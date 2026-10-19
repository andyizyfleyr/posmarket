/**
 * Rendu riche & automatique de la description produit — portage RN de
 * src/components/storefront/RichDescription.tsx (web) : paragraphes, titres de
 * sections, puces / listes numérotées, lignes "Libellé : valeur", points forts,
 * badges et grille de caractéristiques.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import {
  parseDescription,
  type AutoBadge,
  type AutoSpec,
} from '@/utils/product-description';

const BRAND = '#F56B2A';

const LINE = {
  fontSize: 12,
  lineHeight: 19,
  color: '#4b5563',
};

export function RichDescription({ text }: { text: string }) {
  const blocks = parseDescription(text);

  if (blocks.length === 0) {
    return text ? <Text style={LINE}>{text}</Text> : null;
  }

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
          return (
            <Text key={i} style={LINE}>
              {b.text}
            </Text>
          );
        }
        if (b.type === 'label') {
          return (
            <Text key={i} style={LINE}>
              <Text style={styles.labelText}>{b.label}</Text>
              <Text style={styles.labelSep}> : </Text>
              {b.value}
            </Text>
          );
        }
        if (b.type === 'list' && !b.ordered) {
          return (
            <View key={i} style={styles.list}>
              {b.items.map((item, j) => (
                <View key={j} style={styles.bulletRow}>
                  <Check size={13} strokeWidth={3} color={BRAND} style={styles.bulletIcon} />
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

export function DescriptionHighlights({ items }: { items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Points forts</Text>
      <View style={{ gap: 6 }}>
        {items.map((item, i) => (
          <View key={i} style={styles.bulletRow}>
            <View style={styles.highlightDot} />
            <Text style={styles.highlightText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const BADGE_TONES = {
  amber: { backgroundColor: '#fffbeb', color: '#b45309', borderColor: '#fde68a' },
  green: { backgroundColor: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' },
  red: { backgroundColor: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' },
  blue: { backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' },
} as const;

export function DescriptionBadges({ badges }: { badges: AutoBadge[] }) {
  if (!badges || badges.length === 0) return null;
  return (
    <View style={[styles.section, styles.badgesRow]}>
      {badges.map((b) => (
        <View key={b.id} style={[styles.badge, BADGE_TONES[b.tone]]}>
          <Text style={[styles.badgeText, { color: BADGE_TONES[b.tone].color }]}>{b.text}</Text>
        </View>
      ))}
    </View>
  );
}

const SPEC_TONES: Record<string, string> = {
  success: '#047857',
  danger: '#dc2626',
};

export function DescriptionSpecs({ specs }: { specs: AutoSpec[] }) {
  if (!specs || specs.length === 0) return null;
  return (
    <View style={[styles.section, styles.specsGrid]}>
      {specs.map((s, i) => (
        <View key={`${s.label}-${i}`} style={styles.specCell}>
          <Text style={styles.specLabel}>{s.label}</Text>
          <Text
            style={[styles.specValue, s.tone ? { color: SPEC_TONES[s.tone] } : null]}
            numberOfLines={1}
          >
            {s.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Bloc complet : description + points forts + badges + caractéristiques. */
export function ProductDescription({
  text,
  highlights,
  badges,
  specs,
}: {
  text: string;
  highlights: string[];
  badges: AutoBadge[];
  specs: AutoSpec[];
}) {
  return (
    <View>
      <RichDescription text={text} />
      <DescriptionHighlights items={highlights} />
      <DescriptionBadges badges={badges} />
      <DescriptionSpecs specs={specs} />
    </View>
  );
}

const styles = StyleSheet.create({
  blocks: { gap: 10 },
  flex1: { flex: 1 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
  },
  headingTick: {
    width: 4,
    height: 14,
    borderRadius: 2,
    backgroundColor: BRAND,
  },
  headingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelText: { fontWeight: '600', color: '#1f2937' },
  labelSep: { color: '#9ca3af' },
  list: { gap: 6, marginVertical: 2 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletIcon: { marginTop: 3 },
  orderedNum: { fontSize: 12, lineHeight: 19, color: '#4b5563', fontWeight: '600', minWidth: 16 },
  section: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 14,
    marginTop: 14,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  highlightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND,
    marginTop: 6,
  },
  highlightText: { fontSize: 12, lineHeight: 19, color: '#374151', flex: 1 },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '600' },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specCell: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 8,
    padding: 8,
  },
  specLabel: {
    fontSize: 9,
    color: '#9ca3af',
    textTransform: 'uppercase',
    fontWeight: '500',
    marginBottom: 2,
  },
  specValue: { fontSize: 11, fontWeight: '500', color: '#1f2937' },
});
