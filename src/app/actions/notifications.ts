'use server';

import { and, eq, inArray, desc } from 'drizzle-orm';
import { db } from '@/db';
import { notificationOutbox } from '@/db/schema';
import { getCurrentSession } from '@/app/actions/session';

// Événements pertinents pour l'affichage dans l'espace vendeur.
const VENDOR_EVENT_TYPES: string[] = [
  'NOUVELLE_COMMANDE',
  'COMMANDE_A_PREPARER',
  'NOUVEAU_CLIENT',
  'NOUVEL_AVIS',
  'RUPTURE_STOCK',
  'ALERTE_STOCK_BAS',
  'RECU_PAIEMENT',
  'PAIEMENT_INCIDENT',
  'VENTE_POS',
  'FACTURE_PAYEE',
  'ABONNEMENT_ACTIVE',
  'ABONNEMENT_EXPIRANT',
  'ABONNEMENT_EXPIRE',
  'BOUTIQUE_APPROUVEE',
  'BOUTIQUE_REJETEE',
  'BOUTIQUE_EN_ATTENTE',
  'RECAP_VENTES_JOUR',
  'RAPPORT_VENDEUR_HEBDO',
];

export interface SellerNotificationItem {
  id: string;
  eventType: string;
  title: string | null;
  body: string;
  createdAt: string;
}

export async function fetchSellerNotificationsAction(
  limit: number = 50,
): Promise<{ user: string | null; items: SellerNotificationItem[] }> {
  const { user } = await getCurrentSession();
  if (!user) return { user: null, items: [] };

  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));

  const rows = await db
    .select({
      id: notificationOutbox.id,
      eventType: notificationOutbox.eventType,
      title: notificationOutbox.title,
      body: notificationOutbox.body,
      createdAt: notificationOutbox.createdAt,
    })
    .from(notificationOutbox)
    .where(
      and(
        eq(notificationOutbox.recipientUserId, String(user.id)),
        eq(notificationOutbox.provider, 'inapp'),
        inArray(notificationOutbox.eventType, VENDOR_EVENT_TYPES),
      ),
    )
    .orderBy(desc(notificationOutbox.createdAt))
    .limit(safeLimit)
    .catch(() => []);

  return {
    user: String(user.id),
    items: rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      title: r.title,
      body: r.body,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
    })),
  };
}