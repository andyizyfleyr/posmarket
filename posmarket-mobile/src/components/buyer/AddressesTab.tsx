/**
 * Onglet « Livraison » (adresses) — copie mobile de
 * `src/components/buyer/AddressesTab.tsx` du web. Masqué de la navigation par
 * tuiles, accessible via `/account?tab=addresses` comme le web.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Briefcase, Edit2, Home, MapPin, Plus, Trash2 } from 'lucide-react-native';
import { Button } from '@/components/Button';
import type { BuyerAddress } from '@/types';
import { EmptyState, PanelSkeleton } from '@/components/buyer/ui';
import { formatPhoneNumber } from '@/constants/countries';
import { COLORS } from '@/theme';

interface AddressesTabProps {
  addresses: BuyerAddress[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (address: BuyerAddress) => void;
  onDelete: (address: BuyerAddress) => void;
  deletingId?: string | null;
}

const AddressIcon: React.FC<{ name?: string }> = ({ name }) => {
  if (name === 'Maison') return <Home size={18} color="#6B7280" />;
  if (name === 'Bureau') return <Briefcase size={18} color="#6B7280" />;
  return <MapPin size={18} color="#6B7280" />;
};

export const AddressesTab: React.FC<AddressesTabProps> = ({
  addresses,
  loading,
  onAdd,
  onEdit,
  onDelete,
  deletingId,
}) => {
  if (loading && addresses.length === 0) return <PanelSkeleton rows={2} />;

  if (addresses.length === 0) {
    return (
      <EmptyState
        icon={<MapPin size={34} color="#D1D5DB" />}
        title="Aucune adresse enregistrée"
        subtitle="Ajoutez une adresse pour pré-remplir la livraison lors de vos commandes."
        action={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} color="#FFFFFF" />}
            onPress={onAdd}
          >
            Ajouter une adresse
          </Button>
        }
      />
    );
  }

  return (
    <View style={styles.list}>
      <View style={styles.headerRow}>
        <Text style={styles.countText}>
          {addresses.length} adresse{addresses.length > 1 ? 's' : ''} enregistrée
          {addresses.length > 1 ? 's' : ''}
        </Text>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={14} color="#FFFFFF" />}
          onPress={onAdd}
          style={styles.addBtn}
        >
          Ajouter
        </Button>
      </View>

      {addresses.map((addr) => (
        <View
          key={addr.id}
          style={[
            styles.card,
            addr.is_default ? styles.cardDefault : styles.cardPlain,
          ]}
        >
          <View style={styles.cardTop}>
            <View style={styles.cardTopLeft}>
              <View style={styles.iconBox}>
                <AddressIcon name={addr.name} />
              </View>
              <View style={styles.cardTopText}>
                <Text style={styles.name} numberOfLines={1}>
                  {addr.name}
                </Text>
                {addr.is_default ? <Text style={styles.defaultTag}>Par défaut</Text> : null}
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable
                onPress={() => onEdit(addr)}
                style={styles.iconBtn}
                hitSlop={6}
                accessibilityLabel={`Modifier ${addr.name}`}
              >
                <Edit2 size={16} color="#9CA3AF" />
              </Pressable>
              <Pressable
                onPress={() => onDelete(addr)}
                disabled={deletingId === addr.id}
                style={[styles.iconBtn, deletingId === addr.id && styles.disabled]}
                hitSlop={6}
                accessibilityLabel={`Supprimer ${addr.name}`}
              >
                <Trash2 size={16} color="#F87171" />
              </Pressable>
            </View>
          </View>

          <View style={styles.addressBlock}>
            <Text style={styles.fullName}>{addr.full_name}</Text>
            <Text style={styles.line}>
              {[addr.address, addr.city].filter(Boolean).join(', ')}
            </Text>
            {addr.phone ? (
              <Text style={styles.phone}>{formatPhoneNumber(addr.phone)}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    paddingHorizontal: 4,
  },
  addBtn: {
    borderRadius: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  cardDefault: {
    borderWidth: 1,
    borderColor: COLORS.brand,
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  cardPlain: {
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTopText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
  },
  defaultTag: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.brand,
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    padding: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  addressBlock: {
    paddingLeft: 52,
  },
  fullName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  line: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 2,
  },
  phone: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
});

export default AddressesTab;
