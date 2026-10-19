/**
 * Redirection vers le tableau de bord vendeur.
 * L'app mobile est une app vendeur (comme la version web vendeur).
 */

import { Redirect } from 'expo-router';

export default function HomeScreen() {
  return <Redirect href="/seller/dashboard" />;
}