import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { ShoppingCart } from 'lucide-react-native';

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <ShoppingCart size={64} color="#F56B2A" strokeWidth={2.5} />
        <ActivityIndicator size="large" color="#F56B2A" style={styles.spinner} />
      </View>
      <Text style={styles.loadingText}>Chargement…</Text>
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
  iconWrapper: {
    position: 'relative',
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    position: 'absolute',
  },
  loadingText: {
    marginTop: 24,
    fontSize: 16,
    color: '#666',
    fontFamily: 'System',
  },
});