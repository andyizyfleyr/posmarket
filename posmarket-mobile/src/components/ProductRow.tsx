/**
 * ProductRow — une rangée de cartes produit de largeur égale.
 *
 * Utilisée par `ProductGrid` (sections) et directement par la FlatList de
 * l'accueil : la virtualisation se fait ainsi ligne par ligne, sans rendre
 * toutes les cartes d'un bloc. Les emplacements vides conservent l'alignement
 * de la dernière rangée.
 */

import React from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ProductTile } from '@/components/ProductTile';
import type { StorefrontProduct } from '@/types';

export const PRODUCT_GRID_PADDING = 8;
export const PRODUCT_GRID_COLUMN_GAP = 8;
export const PRODUCT_GRID_ROW_GAP = 14;

interface ProductRowProps {
  products: StorefrontProduct[];
  columns: number;
  onPress?: (product: StorefrontProduct) => void;
  paddingHorizontal?: number;
  columnGap?: number;
  showStore?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ProductRow({
  products,
  columns,
  onPress,
  paddingHorizontal = PRODUCT_GRID_PADDING,
  columnGap = PRODUCT_GRID_COLUMN_GAP,
  showStore = false,
  style,
}: ProductRowProps) {
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const emptyCells = Math.max(0, columns - products.length);

  return (
    <View
      style={[
        styles.row,
        { paddingHorizontal, gap: columnGap },
        style,
      ]}
    >
      {products.map((product) => (
        <View
          key={`${product.storeId}-${product.id}`}
          style={styles.cell}
        >
          <ProductTile
            product={product}
            onPress={onPress}
            showStore={showStore}
            compact={compact}
          />
        </View>
      ))}
      {Array.from({ length: emptyCells }).map((_, index) => (
        <View key={`empty-${index}`} style={styles.cell} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
});
