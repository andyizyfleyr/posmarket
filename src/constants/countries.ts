export interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  placeholder?: string;
}

export const COUNTRIES: Country[] = [
  { code: 'BJ', name: 'Bénin', dialCode: '+229', flag: '🇧🇯', placeholder: '97 12 34 56' },
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
      const nat = digits.slice(dDigits.length);
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

/**
 * Formats a phone number for display (e.g. "+229 97 12 34 56", "+225 07 12 34 56 78")
 */
export function formatPhoneNumber(phone: string, defaultCountry: Country = DEFAULT_COUNTRY): string {
  if (!phone) return '';
  const parsed = parsePhoneNumber(phone, defaultCountry);
  if (!parsed.nationalNumber) {
    return parsed.country.dialCode;
  }

  const natDigits = parsed.nationalNumber;
  let grouped = '';
  if (natDigits.length <= 6) {
    grouped = natDigits.match(/.{1,2}/g)?.join(' ') || natDigits;
  } else if (natDigits.length <= 9) {
    if (natDigits.length === 9) {
      grouped = `${natDigits.slice(0, 2)} ${natDigits.slice(2, 5)} ${natDigits.slice(5, 7)} ${natDigits.slice(7)}`;
    } else if (natDigits.length === 8) {
      grouped = `${natDigits.slice(0, 2)} ${natDigits.slice(2, 4)} ${natDigits.slice(4, 6)} ${natDigits.slice(6)}`;
    } else {
      grouped = natDigits.match(/.{1,3}/g)?.join(' ') || natDigits;
    }
  } else {
    grouped = natDigits.match(/.{1,2}/g)?.join(' ') || natDigits;
  }

  return `${parsed.country.dialCode} ${grouped}`.trim();
}

/**
 * Validates whether a phone number is valid (between 7 and 15 digits total).
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}
