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

export async function sendOrderNotification(storeName: string, total: number) {
  if (!admin.apps.length) return;

  const message = {
    notification: {
      title: 'Nouvelle Commande ! 🛍️',
      body: `Une commande de ${total.toLocaleString()} CFA a été placée sur la boutique ${storeName}.`
    },
    data: {
      type: 'NEW_ORDER',
      click_action: 'FLUTTER_NOTIFICATION_CLICK'
    },
    // On envoie au topic pour simplifier (tous les vendeurs qui ont l'app reçoivent)
    // On peut ensuite segmenter par topic "store_${storeId}" pour être plus précis.
    topic: 'marketplace_orders' 
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Successfully sent notification:', response);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

export { admin };
