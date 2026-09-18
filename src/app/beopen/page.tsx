import type { Metadata } from 'next';
import BeOpenClient from './BeOpenClient';

export const metadata: Metadata = {
  title: 'BeOpen | Boostez vos ventes & Libérez votre esprit avec PosMarket',
  description:
    'L\'application tout-en-un indispensable pour les commerçants modernes : Caisse tactile express, Gestion de stock en temps réel, Paiements Mobile Money sécurisés et Vitrine e-commerce ouverte 24h/24.',
  keywords: [
    'logiciel de caisse afrique',
    'application caisse enregistreuse',
    'gestion de stock commerce',
    'caisse mobile money',
    'posmarket',
    'boutique en ligne afrique',
    'logiciel commerçant cotonou abidjan dakar',
  ],
  openGraph: {
    title: 'BeOpen | La Solution Ultime pour Commerçants Ambitieux - PosMarket',
    description:
      'Ne laissez plus le désordre ou les erreurs de caisse voler vos bénéfices. Transformez votre téléphone en caisse enregistreuse et vitrine 24h/24.',
    type: 'website',
  },
};

export default function BeOpenPage() {
  return <BeOpenClient />;
}
