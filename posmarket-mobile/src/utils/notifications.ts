/**
 * Notifications — Phase 5.2 du plan.
 * Alertes locales de suivi de commande sur Android.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const ORDER_CHANNEL_ID = 'orders';

// Affiche les notifications même lorsque l'application est au premier plan.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Demande l'autorisation d'afficher des notifications.
 * Crée au passage le canal Android « Commandes » (requis pour le prompt Android 13+).
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ORDER_CHANNEL_ID, {
        name: 'Commandes',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F56B2A',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch {
    // Repli gracieux sur les appareils sans module natif (émulateurs, Expo Go web...).
    return false;
  }
}

/**
 * Notification locale de confirmation de commande.
 */
export async function notifyOrderConfirmed(orderIds: string[]): Promise<void> {
  try {
    const ref = orderIds.join(', ');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Commande confirmée ! 🎉',
        body: `Votre commande (Réf: ${ref}) est en cours de préparation.`,
        sound: true,
        color: '#F56B2A',
      },
      trigger: null, // déclenchement immédiat
    });
  } catch (e) {
    console.log('[Notifications] Notification locale indisponible:', e);
  }
}
