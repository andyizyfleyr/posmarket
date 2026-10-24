/**
 * Enregistrement du jeton push et ouverture des notifications.
 *
 * Monté une seule fois dans le layout racine, à l'intérieur d'`AuthProvider` :
 *  - à la connexion, demande la permission puis envoie le jeton Expo au serveur ;
 *  - au clic sur une notification, ouvre la route portée par `data.url` ;
 *  - l'ouverture depuis une application fermée est traitée via
 *    `getLastNotificationResponseAsync`.
 */

import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { registerPushToken } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import {
  getExpoPushToken,
  PUSH_TOKEN_STORAGE_KEY,
  requestNotificationPermissions,
} from '@/utils/notifications';

export function PushNotifications() {
  const { user } = useAuth();
  const userId = user?.id;
  const router = useRouter();
  const handled = useRef<string | null>(null);

  // Clic sur une notification (app ouverte ou en arrière-plan).
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      const identifier = response?.notification.request.identifier;
      if (!identifier || handled.current === identifier) return;
      handled.current = identifier;

      const url = response?.notification.request.content.data?.url;
      if (typeof url !== 'string' || !url.startsWith('/')) return;
      try {
        router.push(url as Href);
      } catch {
        // Route inconnue : on laisse l'application sur l'écran courant.
      }
    };

    const subscription =
      Notifications.addNotificationResponseReceivedListener(open);
    Notifications.getLastNotificationResponseAsync()
      .then(open)
      .catch(() => {});

    return () => subscription.remove();
  }, [router]);

  // Jeton push : un par appareil, renvoyé à chaque connexion (upsert serveur).
  useEffect(() => {
    if (!userId) return;
    let active = true;

    (async () => {
      const granted = await requestNotificationPermissions();
      if (!granted || !active) return;

      const token = await getExpoPushToken();
      if (!token || !active) return;

      try {
        await registerPushToken({
          token,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
        });
        await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
      } catch {
        // Réseau indisponible : une prochaine connexion réessaiera.
      }
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  return null;
}
