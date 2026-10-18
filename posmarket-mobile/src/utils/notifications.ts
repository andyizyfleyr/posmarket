/**
 * Notifications — Phase 5.2 du plan.
 * Gestion des alertes et du suivi de commande sur Android.
 */

import { Platform } from 'react-native';

export async function requestNotificationPermissions(): Promise<boolean> {
  // Graceful fallback on devices/emulators
  try {
    const Notifications = await import('expo-notifications');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch {
    return false;
  }
}

export async function notifyOrderConfirmed(orderIds: string[]): Promise<void> {
  try {
    const Notifications = await import('expo-notifications');
    const ref = orderIds.join(', ');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Commande confirmée ! 🎉',
        body: `Votre commande (Réf: ${ref}) est en cours de préparation.`,
        sound: true,
      },
      trigger: null, // trigger immediately
    });
  } catch (e) {
    console.log('[Notifications] Fallback notification:', e);
  }
}
