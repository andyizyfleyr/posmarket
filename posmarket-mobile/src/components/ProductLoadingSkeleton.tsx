import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Skeleton, SkeletonProvider } from '@/components/Skeleton';

/**
 * Squelette de chargement de la fiche produit.
 *
 * Reproduction fidele de `src/app/product/[slug]/loading.tsx` du web :
 * barre retour, visuel produit, blocs d'informations, puis grille
 * « Produits similaires » avec un effet shimmer de 1,5 s.
 */
export function ProductLoadingSkeleton() {
  const { width: screenWidth } = useWindowDimensions();

  const horizontalPadding = 16;
  const contentWidth = Math.max(0, screenWidth - horizontalPadding * 2);
  const gridGap = 12;
  const cardWidth = (contentWidth - gridGap) / 2;

  return (
    <SkeletonProvider>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Barre retour */}
          <View style={styles.backRow}>
            <Skeleton style={styles.backCircle} />
            <Skeleton style={styles.backPill} />
          </View>

          <View style={styles.body}>
            {/* Fiche produit : image + informations */}
            <View style={styles.productBlock}>
              <Skeleton
                style={[styles.heroImage, { width: contentWidth, height: contentWidth }]}
              />
              <View style={styles.infoBlock}>
                <Skeleton style={[styles.line, { width: contentWidth * 0.5, height: 20 }]} />
                <Skeleton style={[styles.line, { width: contentWidth * 0.66, height: 16 }]} />
                <Skeleton style={[styles.priceBar, { width: 128, height: 32 }]} />
                <Skeleton
                  style={[styles.actionBar, { width: contentWidth, height: 56, marginTop: 16 }]}
                />
                <Skeleton style={[styles.actionBar, { width: contentWidth, height: 56 }]} />
              </View>
            </View>

            {/* Produits similaires */}
            <Skeleton style={[styles.sectionTitle, { width: 160, height: 20 }]} />

            <View style={[styles.grid, { gap: gridGap }]}>
              {[0, 1, 2, 3, 4].map((index) => (
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
          </View>
        </ScrollView>
      </SafeAreaView>
    </SkeletonProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  backPill: {
    width: 160,
    height: 36,
    borderRadius: 18,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  productBlock: {
    gap: 20,
    marginBottom: 32,
  },
  heroImage: {
    borderRadius: 16,
  },
  infoBlock: {
    gap: 12,
    paddingTop: 8,
  },
  line: {
    borderRadius: 4,
  },
  priceBar: {
    borderRadius: 12,
  },
  actionBar: {
    borderRadius: 12,
  },
  sectionTitle: {
    borderRadius: 4,
    marginBottom: 16,
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
  cardAction: {
    borderRadius: 12,
  },
});
