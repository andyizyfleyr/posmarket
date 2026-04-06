import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccountStr) {
      // Si la variable d'env est un JSON stringifié
      const serviceAccount = JSON.parse(serviceAccountStr);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized from environment variable.');
    } else {
      // Fallback local pour développement (ajoutez le fichier dans .gitignore !)
      // admin.initializeApp({
      //   credential: admin.credential.applicationDefault()
      // });
      console.warn('FIREBASE_SERVICE_ACCOUNT is missing. Notifications will not be sent.');
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

export interface NotificationData {
  type: 'NEW_ORDER' | 'LOW_STOCK' | 'NEW_REVIEW' | 'SUBSCRIPTION_EXPIRING' | 'MILESTONE' | 'CART_ALERT';
  store_id: string;
  [key: string]: string;
}

export async function sendPushNotification(
  topic: string, 
  title: string, 
  body: string, 
  data: NotificationData
) {
  if (!admin.apps.length) return;

  const message = {
    notification: { title, body },
    data: {
      ...data,
      click_action: 'FLUTTER_NOTIFICATION_CLICK'
    },
    topic: topic.startsWith('store_') ? topic : `store_${data.store_id}`
  };

  try {
    const response = await admin.messaging().send(message);
    console.log(`Successfully sent ${data.type} notification:`, response);
    return response;
  } catch (error) {
    console.error(`Error sending ${data.type} notification:`, error);
    throw error;
  }
}

export async function sendOrderNotification(storeName: string, total: number, storeId: string) {
  return sendPushNotification(
    `store_${storeId}`,
    'Nouvelle Commande ! 🛍️',
    `Une commande de ${total.toLocaleString()} CFA a été placée sur la boutique ${storeName}.`,
    { type: 'NEW_ORDER', store_id: storeId }
  );
}

export { admin };
