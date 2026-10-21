import type { Metadata } from 'next';
import OfflineView from '@/views/OfflineView';

export const metadata: Metadata = {
  title: 'Pas de connexion Internet',
  description:
    'Vous êtes hors ligne. Vérifiez votre connexion puis réessayez : votre panier PosMarket est conservé.',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return <OfflineView />;
}
