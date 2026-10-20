/**
 * Squelette de grille produit — utilisé pendant une recherche à l'accueil.
 * La largeur des cartes correspond exactement à `ProductRow`.
 */

import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  PRODUCT_GRID_COLUMN_GAP,
  PRODUCT_GRID_PADDING,
} from '@/components/ProductRow';
import { Skeleton, SkeletonProvider } from '@/components/Skeleton';
import { productColumnsForWidth } from '@/utils';

interface ProductGridSkeletonProps {
  count?: number;
  paddingHorizontal?: number;
  columnGap?: number;
  rowGap?: number;
}

export function ProductGridSkeleton({
  count = 6,
  paddingHorizontal = PRODUCT_GRID_PADDING,
  columnGap = PRODUCT_GRID_COLUMN_GAP,
  rowGap = 14,
}: ProductGridSkeletonProps) {
  const { width } = useWindowDimensions();
  const columns = productColumnsForWidth(width);
  const cardWidth = Math.max(
    0,
    (width - paddingHorizontal * 2 - columnGap * (columns - 1)) / columns,
  );
  const rowCount = Math.ceil(count / columns);

  return (
    <SkeletonProvider>
      <View
        style={{ paddingHorizontal }}
        accessibilityRole="progressbar"
        accessibilityLabel="Chargement des produits"
      >
        {Array.from({ length: rowCount }).map((_, rowIndex) => (
          <View
            key={`skeleton-row-${rowIndex}`}
            style={[
              styles.row,
              {
                gap: columnGap,
                marginBottom: rowIndex < rowCount - 1 ? rowGap : 0,
              },
            ]}
          >
            {Array.from({ length: columns }).map((__, columnIndex) => {
              const itemIndex = rowIndex * columns + columnIndex;
              if (itemIndex >= count) {
                return (
                  <View
                    key={`skeleton-empty-${itemIndex}`}
                    style={{ width: cardWidth }}
                  />
                );
              }
              return (
                <View
                  key={`skeleton-card-${itemIndex}`}
                  style={{ width: cardWidth }}
                >
                  <Skeleton
                    style={[styles.image, { height: cardWidth }]}
                  />
                  <Skeleton style={[styles.line, styles.lineWide]} />
                  <Skeleton style={[styles.line, styles.lineStats]} />
                  <Skeleton style={[styles.line, styles.linePrice]} />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  image: {
    width: '100%',
    borderRadius: 10,
  },
  line: {
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  lineWide: {
    width: '91%',
    height: 10,
    marginTop: 6,
  },
  lineStats: {
    width: '64%',
  },
  linePrice: {
    width: '49%',
    height: 13,
    marginTop: 4,
  },
});
