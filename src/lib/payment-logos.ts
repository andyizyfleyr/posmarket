/**
 * Logos officiels des fournisseurs de paiement en ligne.
 * Assets locaux (public/brands) — FedaPay et Kkiapay : SVG issus des dépôts
 * officiels (fedapay/woocommerce-gateway-fedapay, kkiapay/wordpress-plugin) ;
 * FeexPay : PNG publié dans le paquet npm officiel `feexpay_lite`.
 */
export const PAYMENT_PROVIDER_LOGOS: Record<string, { src: string; alt: string }> = {
  fedapay: { src: '/brands/fedapay.svg', alt: 'FedaPay' },
  feexpay: { src: '/brands/feexpay.png', alt: 'FeexPay' },
  kkiapay: { src: '/brands/kkiapay.svg', alt: 'Kkiapay' },
};
