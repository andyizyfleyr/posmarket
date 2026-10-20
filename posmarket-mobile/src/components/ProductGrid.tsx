/**
 * ProductGrid — grille produit responsive (2 à 4 colonnes).
 *
 * Les cartes sont rendues rangée par rangée dans l'ordre de lecture, ce qui
 * garde un alignement parfait et un ordre d'accessibilité naturel. Pour les
 * longues listes, préférer la FlatList de l'accueil (virtualisation ligne par
 * ligne) à ce composant non virtualisé.
 */

import React, { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';
import {
  PRODUCT_GRID_COLUMN_GAP,
  PRODUCT_GRID_PADDING,
  PRODUCT_GRID_ROW_GAP,
  ProductRow,
} from '@/components/ProductRow';
import { productColumnsForWidth } from '@/utils';
import type { StorefrontProduct } from '@/types';

interface ProductGridProps {
  products: StorefrontProduct[];
  onPress?: (product: StorefrontProduct) => void;
  paddingHorizontal?: number;
  columnGap?: number;
  rowGap?: number;
  showStore?: boolean;
  /** Force le nombre de colonnes (sinon calcul selon la largeur). */
  columns?: number;
}

export function ProductGrid({
  products,
  onPress,
  paddingHorizontal = PRODUCT_GRID_PADDING,
  columnGap = PRODUCT_GRID_COLUMN_GAP,
  rowGap = PRODUCT_GRID_ROW_GAP,
  showStore = false,
  columns: forcedColumns,
}: ProductGridProps) {
  const { width } = useWindowDimensions();
  const columns = forcedColumns ?? productColumnsForWidth(width);

  const rows = useMemo(() => {
    const next: StorefrontProduct[][] = [];
    for (let index = 0; index < products.length; index += columns) {
      next.push(products.slice(index, index + columns));
    }
    return next;
  }, [products, columns]);

  if (products.length === 0) return null;

  return (
    <View>
      {rows.map((row, index) => (
        <ProductRow
          key={`row-${index}`}
          products={row}
          columns={columns}
          onPress={onPress}
          paddingHorizontal={paddingHorizontal}
          columnGap={columnGap}
          showStore={showStore}
          style={index < rows.length - 1 ? { marginBottom: rowGap } : undefined}
        />
      ))}
    </View>
  );
}
