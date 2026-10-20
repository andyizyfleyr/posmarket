/**
 * ProductGrid — grille produit compacte à 2 colonnes pour le fil d'accueil.
 * Les produits sont répartis alternativement à gauche et à droite. Toutes les
 * cartes ayant une image carrée et le même bloc d'informations, les deux
 * colonnes restent parfaitement alignées.
 */

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ProductTile } from '@/components/ProductTile';
import type { StorefrontProduct } from '@/types';

interface ProductGridProps {
  products: StorefrontProduct[];
  onPress?: (product: StorefrontProduct) => void;
  paddingHorizontal?: number;
  columnGap?: number;
  rowGap?: number;
}

export function ProductGrid({
  products,
  onPress,
  paddingHorizontal = 8,
  columnGap = 8,
  rowGap = 14,
}: ProductGridProps) {
  const [leftColumn, rightColumn] = useMemo(() => {
    const left: StorefrontProduct[] = [];
    const right: StorefrontProduct[] = [];
    products.forEach((product, index) => {
      if (index % 2 === 0) {
        left.push(product);
      } else {
        right.push(product);
      }
    });
    return [left, right];
  }, [products]);

  if (products.length === 0) return null;

  return (
    <View style={[styles.row, { paddingHorizontal, gap: columnGap }]}>
      <View style={[styles.column, { gap: rowGap }]}>
        {leftColumn.map((product) => (
          <ProductTile
            key={`${product.storeId}-${product.id}`}
            product={product}
            onPress={onPress}
          />
        ))}
      </View>
      <View style={[styles.column, { gap: rowGap }]}>
        {rightColumn.map((product) => (
          <ProductTile
            key={`${product.storeId}-${product.id}`}
            product={product}
            onPress={onPress}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
  },
});
