/**
 * Barre de navigation basse — copie de `src/components/BottomNav.tsx` du web
 * (rendu mobile) : 5 onglets (Accueil, Vente, Commandes, Stocks, Clients),
 * pastille active orange.
 *
 * Le bouton « Plus » du web n'est pas repris : il masquait l'onglet « Clients »
 * (4 onglets + menu). Les 5 onglets restent donc visibles en permanence et
 * « Rapports » reste accessible depuis le menu profil de la navbar.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  ShoppingBasket,
  Users,
} from 'lucide-react-native';
import { COLORS } from '@/theme';
import type { SellerRole } from '@/api/seller';

export type SellerView =
  | 'dashboard'
  | 'pos'
  | 'orders'
  | 'inventory'
  | 'customers'
  | 'invoices'
  | 'reports'
  | 'settings'
  | 'subscription';

interface BottomNavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onPress: () => void;
}

function BottomNavItem({ icon, label, active = false, onPress }: BottomNavItemProps) {
  const color = active ? COLORS.brand : '#9CA3AF';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={styles.item}
    >
      <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
        {React.isValidElement(icon)
          ? React.cloneElement(
              icon as React.ReactElement<{ size?: number; strokeWidth?: number; color?: string }>,
              { size: 20, strokeWidth: active ? 2.5 : 1.8, color },
            )
          : icon}
      </View>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      {active ? <View style={styles.activePill} /> : null}
    </Pressable>
  );
}

interface SellerBottomNavProps {
  currentView: SellerView;
  onViewChange: (view: SellerView) => void;
  userRole?: SellerRole;
}

export function SellerBottomNav({ currentView, onViewChange }: SellerBottomNavProps) {
  const insets = useSafeAreaInsets();

  const primaryItems: Array<{
    icon: React.ReactNode;
    label: string;
    view: SellerView;
  }> = [
    { icon: <LayoutDashboard />, label: 'Accueil', view: 'dashboard' },
    { icon: <ShoppingBasket />, label: 'Vente', view: 'pos' },
    { icon: <ShoppingBag />, label: 'Commandes', view: 'orders' },
    { icon: <Package />, label: 'Stocks', view: 'inventory' },
    { icon: <Users />, label: 'Clients', view: 'customers' },
  ];

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <View style={styles.barRow}>
        {primaryItems.map((item) => (
          <BottomNavItem
            key={item.view}
            icon={item.icon}
            label={item.label}
            active={currentView === item.view}
            onPress={() => onViewChange(item.view)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: 6,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    transform: [{ scale: 1.1 }],
  },
  iconWrapOpen: {
    backgroundColor: '#FFF7ED',
  },
  label: {
    fontSize: 9,
    marginTop: 2,
    fontWeight: '600',
    color: '#9CA3AF',
    opacity: 0.6,
  },
  labelActive: {
    color: COLORS.brand,
    opacity: 1,
    fontWeight: '700',
  },
  activePill: {
    position: 'absolute',
    top: -2,
    width: 20,
    height: 3,
    borderRadius: 999,
    backgroundColor: COLORS.brand,
  },
  overlayWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
  },
  overflowMenu: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
    minWidth: 180,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  overflowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  overflowItemActive: {
    backgroundColor: '#FFF7ED',
  },
  overflowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  overflowLabelActive: {
    color: COLORS.brand,
  },
});
