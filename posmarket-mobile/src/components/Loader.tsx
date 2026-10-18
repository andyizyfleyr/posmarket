/**
 * Loader — Phase 3.2 du plan.
 * Spinner animé aux couleurs brand.
 */

import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

interface LoaderProps {
  message?: string;
  size?: 'small' | 'large';
  fullScreen?: boolean;
}

export function Loader({
  message,
  size = 'large',
  fullScreen = false,
}: LoaderProps) {
  const content = (
    <View style={styles.container}>
      <ActivityIndicator size={size} color="#F56B2A" />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );

  if (fullScreen) {
    return <View style={styles.fullScreen}>{content}</View>;
  }
  return content;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
