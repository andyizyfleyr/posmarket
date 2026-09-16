import { parsePhoneNumber, Country, DEFAULT_COUNTRY } from '@/constants/countries';

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v25.0';

export function isWhatsAppConfigured(): boolean {
  return !!(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Normalise un numéro en E.164 (+229..., +225...) requis par l'API WhatsApp.
 * Réutilise la logique de src/constants/countries.ts (détection indicatif par pays).
 */
export function toE164(phone: string | null | undefined, fallbackCountry: Country = DEFAULT_COUNTRY): string {
  if (!phone) return '';
  const parsed = parsePhoneNumber(String(phone).trim(), fallbackCountry);
  if (!parsed.e164) return '';
  const digits = parsed.e164.replace(/\D/g, '');
  if (digits.length < 10) return '';
  return `+${digits}`;
}

async function graphRequest(payload: Record<string, unknown>): Promise<{ messageId?: string; error?: string }> {
  if (!isWhatsAppConfigured()) {
    return { error: 'WhatsApp non configuré (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID manquants)' };
  }

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
      cache: 'no-store',
    });

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      const payload = json as {
        error?: { message?: string; user_msg?: string };
        message?: string;
        messages?: Array<{ id?: string }>;
      };
      const details = payload.error?.user_msg || payload.error?.message || payload.message || res.statusText;
      return { error: `WhatsApp API ${res.status} : ${details}` };
    }

    const messages = (json as { messages?: Array<{ id?: string }> })?.messages;
    return { messageId: messages?.[0]?.id || undefined };
  } catch (err) {
    return { error: `WhatsApp API fetch : ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Envoi d'un message par texte libre (conversation ouverte < 24 h avec le client).
 * Ne pas utiliser pour un message initié par la plateforme sans consentement.
 */
export async function sendWhatsAppText(
  to: string,
  body: string,
): Promise<{ messageId?: string; error?: string }> {
  const phone = toE164(to);
  if (!phone) return { error: `Numéro invalide : "${to}"` };
  return graphRequest({
    to: phone,
    type: 'text',
    text: { preview_url: false, body },
  });
}

/**
 * Envoi d'un template approuvé (obligatoire pour un message initié par l'entreprise).
 * `components` : tableau Meta Cloud API (ex. [{ type: 'body', parameters: [{ type: 'text', text: 'X' }] }]).
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  components?: Array<Record<string, unknown>>,
  languageCode: string = 'fr',
): Promise<{ messageId?: string; error?: string }> {
  const phone = toE164(to);
  if (!phone) return { error: `Numéro invalide : "${to}"` };
  return graphRequest({
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components && components.length > 0 ? { components } : {}),
    },
  });
}