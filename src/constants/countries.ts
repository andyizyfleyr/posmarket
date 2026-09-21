export interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  placeholder?: string;
}

export const COUNTRIES: Country[] = [
  { code: 'BJ', name: 'Bénin', dialCode: '+229', flag: '🇧🇯', placeholder: '01 97 12 34 56' },
  { code: 'TG', name: 'Togo', dialCode: '+228', flag: '🇹🇬', placeholder: '90 12 34 56' },
  { code: 'CI', name: "Côte d'Ivoire", dialCode: '+225', flag: '🇨🇮', placeholder: '07 12 34 56 78' },
  { code: 'SN', name: 'Sénégal', dialCode: '+221', flag: '🇸🇳', placeholder: '77 123 45 67' },
  { code: 'CM', name: 'Cameroun', dialCode: '+237', flag: '🇨🇲', placeholder: '6 70 12 34 56' },
  { code: 'ML', name: 'Mali', dialCode: '+223', flag: '🇲🇱', placeholder: '70 12 34 56' },
  { code: 'NE', name: 'Niger', dialCode: '+227', flag: '🇳🇪', placeholder: '90 12 34 56' },
  { code: 'GH', name: 'Ghana', dialCode: '+233', flag: '🇬🇭', placeholder: '24 123 4567' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬', placeholder: '802 123 4567' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // Bénin (or first in list)

export function getCountryByCode(code?: string | null): Country | undefined {
  if (!code) return undefined;
  const upper = code.toUpperCase().trim();
  return COUNTRIES.find((c) => c.code === upper);
}

export function getCountryByDialCode(dialCode?: string | null): Country | undefined {
  if (!dialCode) return undefined;
  const clean = dialCode.startsWith('+') ? dialCode : `+${dialCode}`;
  return COUNTRIES.find((c) => c.dialCode === clean);
}

export function getCountryByName(name?: string | null): Country | undefined {
  if (!name) return undefined;
  const norm = name.toLowerCase().trim();
  return COUNTRIES.find((c) => c.name.toLowerCase() === norm);
}

/**
 * Parse a raw phone number string and detect its country & national number.
 */
export function parsePhoneNumber(rawPhone: string, fallbackCountry: Country = DEFAULT_COUNTRY): {
  country: Country;
  nationalNumber: string;
  e164: string;
} {
  if (!rawPhone) {
    return { country: fallbackCountry, nationalNumber: '', e164: '' };
  }

  const clean = rawPhone.trim();
  let digits = clean.replace(/\D/g, '');

  // Handle leading 00 as international prefix
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Sort countries by dialCode length descending
  const sortedByDialLength = [...COUNTRIES].sort(
    (a, b) => b.dialCode.replace(/\D/g, '').length - a.dialCode.replace(/\D/g, '').length
  );

  for (const c of sortedByDialLength) {
    const dDigits = c.dialCode.replace(/\D/g, '');
    if (digits.startsWith(dDigits)) {
      let nat = digits.slice(dDigits.length);
      // Normalisation E.164 : retirer le "0" national (trunk prefix) du Ghana et du Nigeria.
      if ((c.code === 'GH' || c.code === 'NG') && nat.startsWith('0')) {
        nat = nat.slice(1);
      }
      return {
        country: c,
        nationalNumber: nat,
        e164: `${c.dialCode}${nat}`,
      };
    }
  }

  // If starts with +, but didn't match
  if (clean.startsWith('+')) {
    return {
      country: fallbackCountry,
      nationalNumber: digits,
      e164: `+${digits}`,
    };
  }

  // Default to fallbackCountry
  return {
    country: fallbackCountry,
    nationalNumber: digits,
    e164: digits ? `${fallbackCountry.dialCode}${digits}` : '',
  };
}

interface PhoneRule {
  /** Nombre de chiffres du numéro national significatif (hors indicatif pays) */
  length: number;
  /** Regex appliquée sur les chiffres du numéro national significatif */
  pattern: RegExp;
  /** Regroupement des chiffres pour l'affichage */
  groups: number[];
}

/**
 * Plans de numérotation nationaux à jour (septembre 2026).
 * Sources : UIT-T (plans E.164 publiés), régulateurs (ARTP/ARCEP-Bénin/NCA/NCC), ITU national numbering plans.
 */
const PHONE_RULES: Record<string, PhoneRule> = {
  // Bénin : 10 chiffres depuis le 30/11/2024 — préfixe "01" ajouté devant l'ancien numéro 8 chiffres.
  BJ: { length: 10, pattern: /^01\d{8}$/, groups: [2, 2, 2, 2, 2] },
  // Togo : 8 chiffres — fixe 22-27, mobile 90-93 / 96-99 / 700-705 / 793-799.
  TG: { length: 8, pattern: /^(2[2-9]|9[0-9]|70[0-5]|79[3-9])\d{6}$/, groups: [2, 2, 2, 2] },
  // Côte d'Ivoire : 10 chiffres (plan 2021) — mobile 01/05/07, fixe 21/25/27.
  CI: { length: 10, pattern: /^(0[157]|2[157])\d{8}$/, groups: [2, 2, 2, 2, 2] },
  // Sénégal : 9 chiffres — fixe 30/32/33/36/39, mobile 70/72/75-79, VoIP 93.
  SN: { length: 9, pattern: /^(3[02369]|7[025-9]|93)\d{7}$/, groups: [2, 3, 2, 2] },
  // Cameroun : 9 chiffres — fixe 2, mobile 6.
  CM: { length: 9, pattern: /^[26]\d{8}$/, groups: [1, 2, 2, 2, 2] },
  // Mali : 8 chiffres — fixe 20-27 / 44, mobile 6X / 7X / 82-84 / 90-94, mobile 89/95-99 (Moov).
  ML: { length: 8, pattern: /^(2\d|44|6\d|7\d|8[2-4]|9\d)\d{6}$/, groups: [2, 2, 2, 2] },
  // Niger : 8 chiffres — fixe 20/21/23, mobile 70/74/8X/9X.
  NE: { length: 8, pattern: /^(2[013]|7[04]|8[0-9]|9[0-9])\d{6}$/, groups: [2, 2, 2, 2] },
  // Ghana : 9 chiffres — fixe 30-39, mobile 20-29 / 50-59 (sans le "0" national).
  GH: { length: 9, pattern: /^[235]\d{8}$/, groups: [2, 3, 4] },
  // Nigeria : 10 chiffres — mobile / NFC 7XX / 8XX / 9XX (sans le "0" national).
  NG: { length: 10, pattern: /^[789]\d{9}$/, groups: [3, 3, 4] },
};

function groupDigits(digits: string, groups: number[]): string {
  const total = groups.reduce((a, b) => a + b, 0);
  if (total !== digits.length) {
    return digits.match(/.{1,2}/g)?.join(' ') || digits;
  }
  const parts: string[] = [];
  let i = 0;
  for (const g of groups) {
    parts.push(digits.slice(i, i + g));
    i += g;
  }
  return parts.join(' ');
}

/**
 * Formats a phone number for display (e.g. "+229 01 97 12 34 56", "+225 07 12 34 56 78").
 */
export function formatPhoneNumber(phone: string, defaultCountry: Country = DEFAULT_COUNTRY): string {
  if (!phone) return '';
  const parsed = parsePhoneNumber(phone, defaultCountry);
  if (!parsed.nationalNumber) {
    return parsed.country.dialCode;
  }

  const rule = PHONE_RULES[parsed.country.code];
  const grouped = rule
    ? groupDigits(parsed.nationalNumber, rule.groups)
    : parsed.nationalNumber.match(/.{1,2}/g)?.join(' ') || parsed.nationalNumber;

  return `${parsed.country.dialCode} ${grouped}`.trim();
}

/**
 * Validates a phone number against the national numbering plan of the detected country
 * (dial code present) or the provided fallback country. Returns false for empty/partial numbers.
 */
export function isValidPhoneNumber(phone: string, defaultCountry: Country = DEFAULT_COUNTRY): boolean {
  if (!phone) return false;
  const parsed = parsePhoneNumber(phone, defaultCountry);
  const rule = PHONE_RULES[parsed.country.code];
  if (!rule) return false;

  const national = parsed.nationalNumber;
  if (national.length !== rule.length) return false;
  return rule.pattern.test(national);
}
