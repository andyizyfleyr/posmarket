'use client';

import { AuthView } from '@/views/AuthView';
import type { NotificationType } from '@/types';

interface SellerLoginFormProps {
  /** Destination demandée, déjà validée par le serveur. */
  next: string | null;
}

/**
 * Formulaire de connexion vendeur.
 *
 * Le composant reste client : `AuthView` attend un callback `onLogin`, qui ne
 * peut pas être sérialisé depuis un composant serveur.
 */
export default function SellerLoginForm({ next }: SellerLoginFormProps) {
  const target = next || '/dashboard';

  return (
    <AuthView
      onLogin={() => {
        // `assign` et non `push` : le retour navigateur ne doit pas propose
        // de revenir à la page de connexion une fois le dashboard atteint.
        window.location.assign(target);
      }}
      notify={(message: string, type?: NotificationType) => console.log('Login notify:', message, type)}
    />
  );
}
