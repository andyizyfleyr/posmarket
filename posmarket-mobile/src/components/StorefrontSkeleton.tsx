import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Skeleton, SkeletonProvider } from '@/components/Skeleton';
import { productColumnsForWidth } from '@/utils';

/**
 * Squelette de chargement du storefront mobile.
 *
 * Header + recherche, hero, carrousel « Boutiques partenaires » et grille de
 * produits, avec le shimmer gris #E5E7EB → #F3F4F6.
 */
export function StorefrontSkeleton() {
  const { width: screenWidth } = useWindowDimensions();

  const horizontalPadding = 16;
  const contentWidth = Math.max(0, screenWidth - horizontalPadding * 2);
  const partnerGap = 12;
  const partnerWidth = Math.min((screenWidth - 44) / 2, 210);
  const gridGap = 8;
  const gridColumns = productColumnsForWidth(screenWidth);
  const gridWidth = screenWidth - 16;
  const cardWidth =
    (gridWidth - gridGap * (gridColumns - 1)) / gridColumns;
  const skeletonCount = 8;
  const skeletonRows = Math.ceil(skeletonCount / gridColumns);

  return (
    <SkeletonProvider>
      <View style={styles.container}>
        {/* Header + recherche */}
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Skeleton style={styles.headerLogo} />
                <Skeleton style={styles.headerName} />
              </View>
              <View style={styles.headerRight}>
                <Skeleton style={styles.headerAction} />
                <Skeleton style={styles.headerAction} />
              </View>
            </View>
            <Skeleton style={styles.searchBar} />
          </View>
        </SafeAreaView>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <Skeleton style={[styles.hero, { width: contentWidth }]} />

          {/* Boutiques partenaires */}
          <View style={styles.partnersHeader}>
            <Skeleton style={styles.partnersAccent} />
            <View style={styles.partnersHeading}>
              <Skeleton style={styles.partnersTitle} />
              <Skeleton style={styles.partnersSubtitle} />
            </View>
          </View>
          <View style={[styles.partnersRow, { gap: partnerGap }]}>
            {[0, 1, 2].map((index) => (
              <View key={index} style={[styles.partnerCard, { width: partnerWidth }]}>
                <Skeleton style={styles.partnerCover} />
                <View style={styles.partnerBody}>
                  <Skeleton style={styles.partnerAvatar} />
                  <Skeleton style={styles.partnerName} />
                  <Skeleton style={styles.partnerCountry} />
                  <Skeleton style={styles.partnerMeta} />
                </View>
              </View>
            ))}
          </View>

          {/* Grille produits — cartes compactes alignées sur ProductRow */}
          <View
            style={[
              styles.grid,
              { gap: gridGap, marginHorizontal: -8 },
            ]}
          >
            {Array.from({ length: skeletonRows }).map((_, rowIndex) => (
              <View
                key={`skeleton-row-${rowIndex}`}
                style={[
                  styles.gridLine,
                  {
                    gap: gridGap,
                    marginBottom: rowIndex < skeletonRows - 1 ? 14 : 0,
                  },
                ]}
              >
                {Array.from({ length: gridColumns }).map(
                  (__, columnIndex) => {
                    const index = rowIndex * gridColumns + columnIndex;
                    if (index >= skeletonCount) {
                      return (
                        <View
                          key={`skeleton-empty-${index}`}
                          style={{ width: cardWidth }}
                        />
                      );
                    }
                    return (
                      <View
                        key={`skeleton-card-${index}`}
                        style={{ width: cardWidth }}
                      >
                        <Skeleton
                          style={[styles.cardImage, { height: cardWidth }]}
                        />
                        <Skeleton
                          style={[styles.line, { width: '92%', height: 10, marginTop: 6 }]}
                        />
                        <Skeleton
                          style={[styles.line, { width: '68%', height: 8, marginTop: 2 }]}
                        />
                        <Skeleton
                          style={[styles.line, { width: '52%', height: 14, marginTop: 3 }]}
                        />
                      </View>
                    );
                  },
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  headerSafe: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 16,
  },
  headerName: {
    width: 112,
    height: 20,
    borderRadius: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 16,
  },
  searchBar: {
    width: '100%',
    height: 44,
    borderRadius: 12,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
  },
  hero: {
    height: 128,
    borderRadius: 24,
    marginBottom: 24,
  },
  partnersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  partnersAccent: {
    width: 3,
    height: 24,
    borderRadius: 2,
    marginRight: 9,
  },
  partnersHeading: {
    flex: 1,
    gap: 6,
  },
  partnersTitle: {
    width: 190,
    height: 18,
    borderRadius: 6,
  },
  partnersSubtitle: {
    width: 160,
    height: 10,
    borderRadius: 4,
  },
  partnersRow: {
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 32,
  },
  partnerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0F1F3',
    overflow: 'hidden',
  },
  partnerCover: {
    height: 44,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  partnerBody: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  partnerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginTop: -21,
  },
  partnerName: {
    width: 110,
    height: 13,
    borderRadius: 4,
    marginTop: 6,
  },
  partnerCountry: {
    width: 52,
    height: 8,
    borderRadius: 4,
    marginTop: 3,
  },
  partnerMeta: {
    width: 76,
    height: 8,
    borderRadius: 4,
    marginTop: 3,
  },
  grid: {
    flexDirection: 'column',
  },
  gridLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardImage: {
    width: '100%',
    borderRadius: 10,
  },
  line: {
    borderRadius: 4,
  },
});
