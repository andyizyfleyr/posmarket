import type { NotificationEvent } from '@/types';
import type { ProductEmailItem } from '@/lib/email';
import type { PushChannelId } from '@/lib/push';

/**
 * Textes des notifications push, par événement.
 *
 * Règles de rédaction :
 *  - pas d'emoji ni de dièse (`#`) : uniquement du texte simple ;
 *  - une phrase courte, le détail utile (montant, boutique, produit) ;
 *  - une route de l'application pour ouvrir le bon écran au clic.
 *
 * Les données structurées (`emailData`) sont déjà fournies par les appelants de
 * `notify()` : les mêmes champs alimentent l'e-mail et le push.
 */

type PushData = Record<string, string | number | null | undefined | ProductEmailItem[]>;

interface BuildInput {
  title?: string;
  body: string;
  emailData?: PushData;
}

export interface PushContent {
  title: string;
  body: string;
  url: string;
  channelId: PushChannelId;
}

interface TemplateResult {
  title: string;
  body: string;
  url: string;
  channelId: PushChannelId;
}

const text = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const count = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const money = (value: unknown): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return text(value);
  return new Intl.NumberFormat('fr-FR').format(n);
};

const plural = (n: number, singular: string, pluralForm?: string): string =>
  `${n} ${n > 1 ? pluralForm || `${singular}s` : singular}`;

const orderUrl = (d: PushData): string => {
  const id = text(d.orderId);
  return id
    ? `/account?tab=orders&order=${encodeURIComponent(id)}`
    : '/account?tab=orders';
};

const sellerOrderUrl = (d: PushData): string => {
  const id = text(d.orderId);
  return id ? `/seller/orders?order=${encodeURIComponent(id)}` : '/seller/orders';
};

/**
 * Retire emojis, dièses et espaces superflus des textes hérités (corps de
 * secours fournis par les appelants). Les templates ci-dessous sont déjà
 * propres ; ce nettoyage garantit qu'aucun texte historique ne passe au travers.
 */
export function cleanPushText(value: string): string {
  return value
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
    .replace(/#/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

const TEMPLATES: Partial<Record<NotificationEvent, (d: PushData) => TemplateResult | null>> = {
  // ---------------------------------------------------------------- Acheteur
  CONFIRMATION_COMMANDE: (d) =>
    d.order || d.store
      ? {
          title: `Commande ${text(d.order) || 'confirmée'}`,
          body: `${text(d.store) || 'La boutique'} a bien reçu votre commande${
            d.total ? ` de ${money(d.total)} FCFA` : ''
          }.`,
          url: orderUrl(d),
          channelId: 'orders',
        }
      : null,

  COMMANDE_PRET: (d) =>
    d.order || d.store
      ? {
          title: `Commande ${text(d.order) || 'prête'}`,
          body: `Votre commande est prête${d.store ? ` chez ${text(d.store)}` : ''}. Vous pouvez venir la récupérer.`,
          url: orderUrl(d),
          channelId: 'orders',
        }
      : null,

  COMMANDE_EXPEDIEE: (d) =>
    d.order || d.store
      ? {
          title: `Commande ${text(d.order) || 'expédiée'}`,
          body: `Votre commande a été expédiée${d.store ? ` par ${text(d.store)}` : ''}.`,
          url: orderUrl(d),
          channelId: 'orders',
        }
      : null,

  COMMANDE_LIVREE: (d) =>
    d.order || d.store
      ? {
          title: `Commande ${text(d.order) || 'livrée'}`,
          body: `Votre commande a bien été livrée${d.store ? ` par ${text(d.store)}` : ''}. Merci pour votre achat.`,
          url: orderUrl(d),
          channelId: 'orders',
        }
      : null,

  COMMANDE_ANNULEE: (d) =>
    d.order || d.store
      ? {
          title: `Commande ${text(d.order) || 'annulée'}`,
          body: `${text(d.store) || 'La boutique'} a annulé votre commande. Contactez la boutique pour toute question.`,
          url: orderUrl(d),
          channelId: 'orders',
        }
      : null,

  RECU_PAIEMENT: (d) =>
    d.total || d.order
      ? {
          title: 'Reçu de paiement',
          body: `Paiement de ${money(d.total)} FCFA confirmé${d.order ? ` pour la commande ${text(d.order)}` : ''}.`,
          url: orderUrl(d),
          channelId: 'orders',
        }
      : null,

  RELANCE_PANIER_ABANDONNE: (d) => ({
    title: 'Votre panier vous attend',
    body: `${
      d.name ? `${text(d.name)}, ` : ''
    }finalisez votre commande en quelques instants${d.total ? ` pour ${money(d.total)} FCFA` : ''}.`,
    url: '/cart',
    channelId: 'promos',
  }),

  DEMANDE_AVIS: (d) =>
    d.store || d.order
      ? {
          title: 'Votre avis compte',
          body: `Partagez votre expérience${d.store ? ` chez ${text(d.store)}` : ''} en laissant un avis sur vos produits.`,
          url: orderUrl(d),
          channelId: 'account',
        }
      : null,

  // ----------------------------------------------------------------- Vendeur
  NOUVELLE_COMMANDE: (d) =>
    d.order || d.total
      ? {
          title: `Nouvelle commande ${text(d.order)}`,
          body: `${text(d.buyer) || 'Un client'} a commandé ${plural(
            count(d.items) || (Array.isArray(d.products) ? d.products.length : 0),
            'article',
          )}${d.total ? ` pour ${money(d.total)} FCFA` : ''}.`,
          url: sellerOrderUrl(d),
          channelId: 'orders',
        }
      : null,

  NOUVEAU_CLIENT: (d) => ({
    title: 'Nouveau client',
    body: `${text(d.buyer) || text(d.name) || 'Un client'} vient de passer sa première commande.`,
    url: '/seller/customers',
    channelId: 'account',
  }),

  ALERTE_STOCK_BAS: (d) =>
    d.product || d.stock
      ? {
          title: 'Stock bas',
          body: `${text(d.product) || 'Un produit'} : ${
            count(d.stock) === 1 ? '1 unité restante' : `${count(d.stock)} unités restantes`
          }. Pensez à réapprovisionner.`,
          url: '/seller/inventory',
          channelId: 'stock',
        }
      : null,

  RUPTURE_STOCK: (d) =>
    d.product
      ? {
          title: 'Rupture de stock',
          body: `${text(d.product)} est épuisé. Réapprovisionnez pour continuer à vendre.`,
          url: '/seller/inventory',
          channelId: 'stock',
        }
      : null,

  VENTE_POS: (d) =>
    d.total || d.items
      ? {
          title: 'Vente en boutique',
          body: `${plural(count(d.items), 'article')} vendu(s) pour ${money(d.total)} FCFA.`,
          url: '/seller/orders',
          channelId: 'orders',
        }
      : null,

  FACTURE_PAYEE: (d) => ({
    title: 'Facture payée',
    body: `Votre paiement de ${money(d.amount || d.total)} FCFA a été confirmé.`,
    url: '/seller/subscription',
    channelId: 'account',
  }),

  JALON_MILESTONE: (d) => ({
    title: 'Jalon atteint',
    body: `${text(d.label) || 'Nouveau palier'}${d.value ? ` : ${text(d.value)}` : ''}. Continuez sur votre lancée.`,
    url: '/seller/dashboard',
    channelId: 'account',
  }),

  ABONNEMENT_ACTIVE: (d) => ({
    title: 'Abonnement activé',
    body: `Votre formule ${text(d.tier) || 'PosMarket'}${d.duration ? ` (${text(d.duration)})` : ''} est active.`,
    url: '/seller/subscription',
    channelId: 'account',
  }),

  ABONNEMENT_EXPIRANT: (d) => ({
    title: 'Abonnement expirant',
    body: `Votre formule ${text(d.tier) || 'PosMarket'} expire${
      d.days ? ` dans ${plural(count(d.days), 'jour')}` : ' bientôt'
    }. Renouvelez-la pour garder votre boutique en ligne.`,
    url: '/seller/subscription',
    channelId: 'account',
  }),

  ABONNEMENT_EXPIRE: (d) => ({
    title: 'Abonnement expiré',
    body: `Votre formule ${text(d.tier) || 'PosMarket'} a expiré. Choisissez une nouvelle formule pour réactiver votre boutique.`,
    url: '/seller/subscription',
    channelId: 'account',
  }),

  BOUTIQUE_APPROUVEE: (d) => ({
    title: 'Boutique approuvée',
    body: `${text(d.store) || 'Votre boutique'} est en ligne. Vous pouvez recevoir des commandes.`,
    url: '/seller',
    channelId: 'account',
  }),

  BOUTIQUE_REJETEE: (d) => ({
    title: 'Boutique refusée',
    body: `Votre boutique n'a pas été validée${d.reason ? ` : ${text(d.reason)}` : ''}. Consultez votre espace pour corriger les informations.`,
    url: '/seller',
    channelId: 'account',
  }),

  BOUTIQUE_EN_ATTENTE: (d) => ({
    title: 'Boutique en attente',
    body: `${text(d.store) || 'Une boutique'} attend une validation.`,
    url: '/seller',
    channelId: 'account',
  }),

  VERIFICATION_COMPTE_OK: () => ({
    title: 'Compte vérifié',
    body: 'Votre compte est vérifié. Toutes les fonctionnalités sont disponibles.',
    url: '/seller',
    channelId: 'account',
  }),

  NOUVELLE_INSCRIPTION: (d) => ({
    title: 'Nouvelle inscription',
    body: `${text(d.name) || 'Un commerçant'}${d.email ? ` (${text(d.email)})` : ''} vient de s'inscrire.`,
    url: '/seller',
    channelId: 'account',
  }),

  COMMANDE_A_PREPARER: (d) =>
    d.order
      ? {
          title: 'Commande à préparer',
          body: `La commande ${text(d.order)} attend d'être préparée.`,
          url: sellerOrderUrl(d),
          channelId: 'orders',
        }
      : null,

  NOUVEL_AVIS: (d) =>
    d.product || d.rating
      ? {
          title: 'Nouvel avis',
          body: `${text(d.product) || 'Un produit'} a reçu une note de ${text(d.rating)} sur 5.`,
          url: '/seller/dashboard',
          channelId: 'account',
        }
      : null,

  RECAP_VENTES_JOUR: (d) =>
    d.count || d.total
      ? {
          title: `Récap des ventes${d.store ? ` — ${text(d.store)}` : ''}`,
          body: `${plural(count(d.count), 'commande')} aujourd'hui pour ${money(d.total)} FCFA.`,
          url: '/seller/dashboard',
          channelId: 'account',
        }
      : null,

  RAPPORT_VENDEUR_HEBDO: (d) =>
    d.count || d.total
      ? {
          title: `Rapport hebdomadaire${d.store ? ` — ${text(d.store)}` : ''}`,
          body: `${plural(count(d.count), 'commande')} cette semaine pour ${money(d.total)} FCFA.`,
          url: '/seller/dashboard',
          channelId: 'account',
        }
      : null,

  RAPPORT_ADMIN: (d) => ({
    title: 'Rapport hebdomadaire PosMarket',
    body: `${plural(count(d.count), 'commande')} pour ${money(d.total)} FCFA. ${plural(
      count(d.stores),
      'boutique',
    )} et ${plural(count(d.users), 'utilisateur')}.`,
    url: '/seller/dashboard',
    channelId: 'account',
  }),

  ALERTE_TECHNIQUE: () => ({
    title: 'Alerte technique',
    body: 'Une anomalie a été détectée sur la plateforme. Consultez le tableau de bord.',
    url: '/seller/dashboard',
    channelId: 'account',
  }),

  PAIEMENT_INCIDENT: (d) => ({
    title: 'Paiement en erreur',
    body: `Un paiement a été refusé${d.provider ? ` (${text(d.provider)})` : ''}. Consultez votre espace pour réessayer.`,
    url: '/seller/subscription',
    channelId: 'account',
  }),

  PAIEMENT_ECHOUE: (d) => ({
    title: 'Paiement non abouti',
    body: `Votre paiement${d.amount ? ` de ${money(d.amount)} FCFA` : ''} n'a pas abouti. Réessayez depuis votre espace abonnement.`,
    url: '/seller/subscription',
    channelId: 'account',
  }),
};

export function buildPushContent(event: NotificationEvent, input: BuildInput): PushContent {
  const data = input.emailData || {};
  const built = TEMPLATES[event]?.(data) || null;

  const title = cleanPushText(built?.title || input.title || 'PosMarket');
  const body = cleanPushText(built?.body || input.body);

  return {
    title: title || 'PosMarket',
    body: body || 'Consultez votre espace PosMarket.',
    url: built?.url || '/',
    channelId: built?.channelId || 'account',
  };
}
