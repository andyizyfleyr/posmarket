/**
 * Éléments partagés de l'espace acheteur — copie mobile de
 * `src/components/buyer/accountUtils.tsx` du web : badges de statut,
 * vignettes produit, nom de produit cliquable, étoiles, états vides et
 * squelettes de chargement.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Package,
  Star,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { generateProductSlug } from '@/utils';
import { resolveImageUrl } from '@/api/client';

export const normalizeImage = (uri?: string | null): string => {
  if (!uri) return '';
  if (uri.startsWith('data:')) return '';
  return uri;
};

interface StatusInfo {
  label: string;
  background: string;
  color: string;
  Icon: LucideIcon;
}

export const getStatusInfo = (status: string, businessType?: string): StatusInfo => {
  // `businessType` est conservé pour rester identique au web (libellés communs).
  void businessType;
  switch (status) {
    case 'COMPLETED':
      return { label: 'Livré', background: '#DCFCE7', color: '#15803D', Icon: CheckCircle2 };
    case 'READY':
    case 'SHIPPED':
      return { label: 'En cours', background: '#DBEAFE', color: '#1D4ED8', Icon: Clock };
    case 'PENDING':
      return { label: 'Commandé', background: '#FEF3C7', color: '#B45309', Icon: Clock };
    case 'CANCELLED':
      return { label: 'Annulé', background: '#FEE2E2', color: '#B91C1C', Icon: X };
    default:
      return { label: 'Statut inconnu', background: '#F3F4F6', color: '#374151', Icon: AlertCircle };
  }
};

/** Pastille de statut : icône seule, la couleur porte l'information. */
export const StatusBadge: React.FC<{ status: string; businessType?: string }> = ({
  status,
  businessType,
}) => {
  const info = getStatusInfo(status, businessType);
  const Icon = info.Icon;
  return (
    <View
      style={[styles.statusBadge, { backgroundColor: info.background }]}
      accessibilityRole="text"
      accessibilityLabel={`Statut : ${info.label}`}
    >
      <Icon size={12} color={info.color} strokeWidth={2.4} />
    </View>
  );
};

export const ProductThumb: React.FC<{
  src?: string | null;
  size?: number;
  iconSize?: number;
  /** Texte alternatif (vide = image décorative, le nom est affiché à côté). */
  alt?: string;
}> = ({ src, size = 48, iconSize = 20, alt = '' }) => {
  const image = resolveImageUrl(normalizeImage(src));
  if (!image) {
    return (
      <View
        style={[
          styles.thumb,
          { width: size, height: size, borderRadius: 12 },
        ]}
      >
        <Package size={iconSize} color="#D1D5DB" />
      </View>
    );
  }
  return (
    <View
      style={[
        styles.thumbImage,
        { width: size, height: size, borderRadius: 12 },
      ]}
    >
      <Image
        source={{ uri: image }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        transition={150}
        alt={alt}
      />
    </View>
  );
};

/**
 * Nom de produit cliquable vers la fiche produit. Un simple texte si
 * l'identifiant est absent (produit supprimé, ligne orpheline) : jamais de
 * lien mort, comme le web.
 */
export const ProductNameLink: React.FC<{
  product?: { id?: string | null; name?: string | null } | null;
  fallback?: string;
  style?: object;
}> = ({ product, fallback = 'Produit', style }) => {
  const router = useRouter();
  const name = product?.name || fallback;
  const id = product?.id;
  if (!id) {
    return (
      <Text style={style} numberOfLines={1}>
        {name}
      </Text>
    );
  }
  const slug = generateProductSlug({ id, name: product?.name || undefined });
  return (
    <Pressable
      onPress={() => router.push(`/product/${slug}` as never)}
      hitSlop={4}
      accessibilityLabel={`Voir ${name}`}
    >
      <Text style={[style, styles.link]} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
};

export const StarRating: React.FC<{ value: number; size?: number }> = ({
  value,
  size = 14,
}) => (
  <View style={styles.stars}>
    {[0, 1, 2, 3, 4].map((i) => (
      <Star
        key={i}
        size={size}
        color={i < value ? '#FBBF24' : '#E5E7EB'}
        fill={i < value ? '#FBBF24' : 'transparent'}
        strokeWidth={i < value ? 0 : 2.5}
      />
    ))}
  </View>
);

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}> = ({ icon, title, subtitle, action }) => (
  <View style={styles.emptyCard}>
    <View style={styles.emptyIcon}>{icon}</View>
    <Text style={styles.emptyTitle}>{title}</Text>
    {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    {action ? <View style={styles.emptyAction}>{action}</View> : null}
  </View>
);

export const PanelSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <View style={styles.skeletonWrap}>
    {Array.from({ length: rows }).map((_, index) => (
      <View key={index} style={styles.skeletonRow} />
    ))}
  </View>
);

/** Date française courte (« 12 mars 2026 »), comme le web. */
export const formatShortDate = (iso?: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const styles = StyleSheet.create({
  statusBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F9FAFB',
  },
  link: {
    textDecorationLine: 'underline',
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
  },
  emptySubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6,
    maxWidth: 260,
    textAlign: 'center',
    lineHeight: 17,
  },
  emptyAction: {
    marginTop: 24,
  },
  skeletonWrap: {
    gap: 12,
  },
  skeletonRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    height: 112,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    opacity: 0.7,
  },
});
