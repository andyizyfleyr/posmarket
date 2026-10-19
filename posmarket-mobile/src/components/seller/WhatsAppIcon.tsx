/**
 * Icône WhatsApp officielle — glyphe de la police FontAwesome5 Brands
 * (`@expo/vector-icons`, incluse dans Expo Go). On évite un SVG dessiné à la
 * main : le parseur natif de `react-native-svg` refuse certains paths de la
 * marque (« Invalid number format, character 'z' »).
 */

import FontAwesome5 from '@expo/vector-icons/FontAwesome5';

export function WhatsAppIcon({
  size = 16,
  color = '#25D366',
}: {
  size?: number;
  color?: string;
}) {
  return <FontAwesome5 name="whatsapp" size={size} color={color} />;
}
