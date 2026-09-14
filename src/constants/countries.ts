export interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  placeholder?: string;
}

export const COUNTRIES: Country[] = [
  // Afrique de l'Ouest & Centrale
  { code: 'SN', name: 'Sénégal', dialCode: '+221', flag: '🇸🇳', placeholder: '77 123 45 67' },
  { code: 'CI', name: "Côte d'Ivoire", dialCode: '+225', flag: '🇨🇮', placeholder: '07 12 34 56 78' },
  { code: 'BJ', name: 'Bénin', dialCode: '+229', flag: '🇧🇯', placeholder: '97 12 34 56' },
  { code: 'TG', name: 'Togo', dialCode: '+228', flag: '🇹🇬', placeholder: '90 12 34 56' },
  { code: 'ML', name: 'Mali', dialCode: '+223', flag: '🇲🇱', placeholder: '70 12 34 56' },
  { code: 'GN', name: 'Guinée', dialCode: '+224', flag: '🇬🇳', placeholder: '620 12 34 56' },
  { code: 'BF', name: 'Burkina Faso', dialCode: '+226', flag: '🇧🇫', placeholder: '70 12 34 56' },
  { code: 'NE', name: 'Niger', dialCode: '+227', flag: '🇳🇪', placeholder: '90 12 34 56' },
  { code: 'CM', name: 'Cameroun', dialCode: '+237', flag: '🇨🇲', placeholder: '6 70 12 34 56' },
  { code: 'GA', name: 'Gabon', dialCode: '+241', flag: '🇬🇦', placeholder: '07 12 34 56' },
  { code: 'CG', name: 'Congo-Brazzaville', dialCode: '+242', flag: '🇨🇬', placeholder: '06 123 45 67' },
  { code: 'CD', name: 'RDC (Congo-Kinshasa)', dialCode: '+243', flag: '🇨🇩', placeholder: '81 234 56 78' },
  { code: 'TD', name: 'Tchad', dialCode: '+235', flag: '🇹🇩', placeholder: '66 12 34 56' },
  { code: 'CF', name: 'Centrafrique', dialCode: '+236', flag: '🇨🇫', placeholder: '70 12 34 56' },
  { code: 'MR', name: 'Mauritanie', dialCode: '+222', flag: '🇲🇷', placeholder: '22 12 34 56' },
  { code: 'GM', name: 'Gambie', dialCode: '+220', flag: '🇬🇲', placeholder: '700 1234' },
  { code: 'GW', name: 'Guinée-Bissau', dialCode: '+245', flag: '🇬🇼', placeholder: '955 12 34' },
  { code: 'SL', name: 'Sierra Leone', dialCode: '+232', flag: '🇸🇱', placeholder: '76 123456' },
  { code: 'LR', name: 'Liberia', dialCode: '+231', flag: '🇱🇷', placeholder: '77 012 3456' },
  { code: 'GH', name: 'Ghana', dialCode: '+233', flag: '🇬🇭', placeholder: '24 123 4567' },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', flag: '🇳🇬', placeholder: '802 123 4567' },
  { code: 'GQ', name: 'Guinée Équatoriale', dialCode: '+240', flag: '🇬🇶', placeholder: '222 123 456' },

  // Afrique du Nord
  { code: 'MA', name: 'Maroc', dialCode: '+212', flag: '🇲🇦', placeholder: '6 12 34 56 78' },
  { code: 'DZ', name: 'Algérie', dialCode: '+213', flag: '🇩🇿', placeholder: '5 12 34 56 78' },
  { code: 'TN', name: 'Tunisie', dialCode: '+216', flag: '🇹🇳', placeholder: '20 123 456' },
  { code: 'EG', name: 'Égypte', dialCode: '+20', flag: '🇪🇬', placeholder: '100 123 4567' },

  // Afrique de l'Est & Australe
  { code: 'MG', name: 'Madagascar', dialCode: '+261', flag: '🇲🇬', placeholder: '32 12 345 67' },
  { code: 'RW', name: 'Rwanda', dialCode: '+250', flag: '🇷🇼', placeholder: '788 123 456' },
  { code: 'BI', name: 'Burundi', dialCode: '+257', flag: '🇧🇮', placeholder: '79 12 34 56' },
  { code: 'DJ', name: 'Djibouti', dialCode: '+253', flag: '🇩🇯', placeholder: '77 12 34 56' },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪', placeholder: '712 345678' },
  { code: 'TZ', name: 'Tanzanie', dialCode: '+255', flag: '🇹🇿', placeholder: '712 345 678' },
  { code: 'UG', name: 'Ouganda', dialCode: '+256', flag: '🇺🇬', placeholder: '712 345678' },
  { code: 'ZA', name: 'Afrique du Sud', dialCode: '+27', flag: '🇿🇦', placeholder: '71 123 4567' },
  { code: 'AO', name: 'Angola', dialCode: '+244', flag: '🇦🇴', placeholder: '923 123 456' },
  { code: 'MZ', name: 'Mozambique', dialCode: '+258', flag: '🇲🇿', placeholder: '82 123 4567' },
  { code: 'MU', name: 'Maurice', dialCode: '+230', flag: '🇲🇺', placeholder: '5251 2345' },
  { code: 'KM', name: 'Comores', dialCode: '+269', flag: '🇰🇲', placeholder: '321 23 45' },

  // Europe
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', placeholder: '6 12 34 56 78' },
  { code: 'BE', name: 'Belgique', dialCode: '+32', flag: '🇧🇪', placeholder: '470 12 34 56' },
  { code: 'CH', name: 'Suisse', dialCode: '+41', flag: '🇨🇭', placeholder: '78 123 45 67' },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', placeholder: '514 123-4567' },
  { code: 'US', name: 'États-Unis', dialCode: '+1', flag: '🇺🇸', placeholder: '202 555-0123' },
  { code: 'GB', name: 'Royaume-Uni', dialCode: '+44', flag: '🇬🇧', placeholder: '7911 123456' },
  { code: 'ES', name: 'Espagne', dialCode: '+34', flag: '🇪🇸', placeholder: '612 34 56 78' },
  { code: 'IT', name: 'Italie', dialCode: '+39', flag: '🇮🇹', placeholder: '312 345 6789' },
  { code: 'DE', name: 'Allemagne', dialCode: '+49', flag: '🇩🇪', placeholder: '151 12345678' },
  { code: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹', placeholder: '912 345 678' },
  { code: 'NL', name: 'Pays-Bas', dialCode: '+31', flag: '🇳🇱', placeholder: '6 12345678' },
  { code: 'LU', name: 'Luxembourg', dialCode: '+352', flag: '🇱🇺', placeholder: '621 123 456' },
  { code: 'TR', name: 'Turquie', dialCode: '+90', flag: '🇹🇷', placeholder: '501 234 56 78' },
  { code: 'AE', name: 'Émirats Arabes Unis', dialCode: '+971', flag: '🇦🇪', placeholder: '50 123 4567' },
  { code: 'SA', name: 'Arabie Saoudite', dialCode: '+966', flag: '🇸🇦', placeholder: '50 123 4567' },
  { code: 'QA', name: 'Qatar', dialCode: '+974', flag: '🇶🇦', placeholder: '3312 3456' },
  { code: 'CN', name: 'Chine', dialCode: '+86', flag: '🇨🇳', placeholder: '138 0013 8000' },
  { code: 'IN', name: 'Inde', dialCode: '+91', flag: '🇮🇳', placeholder: '98123 45678' },
  { code: 'BR', name: 'Brésil', dialCode: '+55', flag: '🇧🇷', placeholder: '11 91234-5678' },
  { code: 'HT', name: 'Haïti', dialCode: '+509', flag: '🇭🇹', placeholder: '34 12 3456' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // Sénégal by default

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

  // Sort countries by dialCode length descending so longer dial codes match first (+221 before +22, etc.)
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

  // If starts with +, but didn't match any known country, still preserve it
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
 * Formats a phone number for display (e.g. "+221 77 123 45 67" or "+33 6 12 34 56 78")
 */
export function formatPhoneNumber(phone: string, defaultCountry: Country = DEFAULT_COUNTRY): string {
  if (!phone) return '';
  const parsed = parsePhoneNumber(phone, defaultCountry);
  if (!parsed.nationalNumber) {
    return parsed.country.dialCode;
  }

  // Group national digits nicely (groups of 2 or 3 digits)
  const natDigits = parsed.nationalNumber;
  let grouped = '';
  if (natDigits.length <= 6) {
    grouped = natDigits.match(/.{1,2}/g)?.join(' ') || natDigits;
  } else if (natDigits.length <= 9) {
    // 2-3-2-2 or 3-2-2
    if (natDigits.length === 9) {
      // e.g. 77 123 45 67
      grouped = `${natDigits.slice(0, 2)} ${natDigits.slice(2, 5)} ${natDigits.slice(5, 7)} ${natDigits.slice(7)}`;
    } else if (natDigits.length === 8) {
      // e.g. 07 12 34 56
      grouped = `${natDigits.slice(0, 2)} ${natDigits.slice(2, 4)} ${natDigits.slice(4, 6)} ${natDigits.slice(6)}`;
    } else {
      grouped = natDigits.match(/.{1,3}/g)?.join(' ') || natDigits;
    }
  } else {
    // 10+ digits: e.g. France (06 12 34 56 78) -> 6 12 34 56 78
    grouped = natDigits.match(/.{1,2}/g)?.join(' ') || natDigits;
  }

  return `${parsed.country.dialCode} ${grouped}`.trim();
}

/**
 * Validates whether an international phone number is valid (at least 6 digits national, max 15 digits).
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  // E.164 specification: 7 to 15 digits total
  return digits.length >= 7 && digits.length <= 15;
}
