/**
 * Notifications — canaux Android, permissions et jeton push Expo.
 *
 * Les notifications distantes sont envoyées par le serveur (Expo Push API) à
 * partir des événements de la boutique. L'application enregistre son jeton à
 * la connexion (voir `src/components/PushNotifications.tsx`).
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

export type NotificationChannelId = 'orders' | 'stock' | 'account' | 'promos';

/** Clé de stockage local du jeton push (utilisée à la déconnexion). */
export const PUSH_TOKEN_STORAGE_KEY = 'posmarket_push_token';

const CHANNELS: Record<NotificationChannelId, { name: string; description: string }> = {
  orders: {
    name: 'Commandes',
    description: 'Nouvelles commandes, préparation, livraison et retrait.',
  },
  stock: {
    name: 'Stock',
    description: 'Alertes de stock bas et de rupture.',
  },
  account: {
    name: 'Compte',
    description: 'Abonnement, boutique, avis et rapports.',
  },
  promos: {
    name: 'Promotions',
    description: 'Relances de panier et offres marketing.',
  },
};

// Affiche les notifications même lorsque l'application est au premier plan.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Crée les canaux Android (obligatoire pour le prompt Android 13+). */
export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Promise.all(
    (Object.keys(CHANNELS) as NotificationChannelId[]).map((id) =>
      Notifications.setNotificationChannelAsync(id, {
        name: CHANNELS[id].name,
        description: CHANNELS[id].description,
        importance:
          id === 'promos'
            ? Notifications.AndroidImportance.DEFAULT
            : Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F56B2A',
      }),
    ),
  );
}

/**
 * Demande l'autorisation d'afficher des notifications.
 * Crée au passage les canaux Android.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    await ensureNotificationChannels();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch {
    // Repli gracieux sur les appareils sans module natif (émulateurs, web...).
    return false;
  }
}

/**
 * Jeton push Expo de l'appareil, ou `null` si le projet EAS n'est pas
 * configuré / si le module natif est absent (Expo Go d'une autre version).
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      console.log('[Notifications] projectId EAS manquant : push distant désactivé.');
      return null;
    }

    await ensureNotificationChannels();
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data ? String(data) : null;
  } catch (error) {
    console.log('[Notifications] Jeton push indisponible:', error);
    return null;
  }
}
