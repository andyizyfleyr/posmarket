import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Skeleton, SkeletonProvider } from '@/components/Skeleton';

/**
 * Squelette de chargement du storefront.
 *
 * Reproduction fidele de `src/app/[[...slug]]/loading.tsx` du web :
 * header + recherche, hero, boutiques partenaires et grille de produits,
 * avec le shimmer gris #E5E7EB → #F3F4F6.
 */
export function StorefrontSkeleton() {
  const { width: screenWidth } = useWindowDimensions();

  const horizontalPadding = 16;
  const contentWidth = Math.max(0, screenWidth - horizontalPadding * 2);
  const partnerGap = 10;
  const partnerWidth = Math.max(0, (screenWidth - 42) / 2);
  const gridGap = 12;
  const cardWidth = (contentWidth - gridGap) / 2;

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
          <Skeleton style={styles.partnersTitle} />
          <View style={[styles.partnersRow, { gap: partnerGap }]}>
            {[0, 1, 2, 3].map((index) => (
              <View key={index} style={[styles.partnerCard, { width: partnerWidth }]}>
                <Skeleton style={styles.partnerAvatar} />
                <Skeleton style={styles.partnerName} />
                <Skeleton style={styles.partnerMeta} />
              </View>
            ))}
          </View>

          {/* Grille produits */}
          <View style={[styles.grid, { gap: gridGap }]}>
            {Array.from({ length: 8 }).map((_, index) => (
              <View key={index} style={[styles.card, { width: cardWidth }]}>
                <Skeleton style={{ width: cardWidth, height: cardWidth }} />
                <View style={styles.cardBody}>
                  <Skeleton style={[styles.line, { width: cardWidth * 0.75, height: 12 }]} />
                  <Skeleton style={[styles.line, { width: cardWidth * 0.5, height: 16 }]} />
                  <Skeleton
                    style={[styles.cardAction, { width: '100%', height: 32, marginTop: 8 }]}
                  />
                </View>
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
  partnersTitle: {
    width: 208,
    height: 24,
    borderRadius: 8,
    marginBottom: 16,
  },
  partnersRow: {
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 32,
  },
  partnerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 10,
    alignItems: 'center',
  },
  partnerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  partnerName: {
    width: 64,
    height: 10,
    borderRadius: 4,
    marginTop: 6,
  },
  partnerMeta: {
    width: 48,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  cardBody: {
    padding: 8,
    gap: 8,
  },
  line: {
    borderRadius: 4,
  },
  cardAction: {
    borderRadius: 12,
  },
});
