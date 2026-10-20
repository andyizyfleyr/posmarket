import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import splashIcon from '../../assets/splash-icon.png';

/**
 * Splash custom — sigle PosMarket sur fond blanc, spinner et « Chargement ».
 * Le sigle provient du meme asset que le splash natif, pour une transition
 * sans rupture visuelle.
 */
export function SplashScreen() {
  return (
    <View style={styles.container}>
      <Image source={splashIcon} style={styles.logo} contentFit="contain" />
      <ActivityIndicator size="large" color="#F56B2A" style={styles.spinner} />
      <Text style={styles.loadingText}>Chargement</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: 200,
    height: 200,
  },
  spinner: {
    marginTop: 4,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
    fontFamily: 'System',
    fontWeight: '500',
  },
});
