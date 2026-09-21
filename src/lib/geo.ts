import { headers } from 'next/headers';
import { COUNTRIES } from '@/constants/countries';

/**
 * Géolocalisation serveur par IP (garde-fou anti-bypass).
 *
 * Sur Vercel, le pays est fourni nativement via l'en-tête `x-vercel-ip-country`
 * (dérivé de l'IP côté proxy, impossible à falsifier depuis le navigateur).
 * En dehors de Vercel, on retombe sur un lookup externe (ipapi.co) avec cache.
 */

const ALLOWED_COUNTRY_CODES = new Set(COUNTRIES.map((c) => c.code.toUpperCase()));

export function isCountryAllowed(countryCode?: string | null): boolean {
  return Boolean(countryCode && ALLOWED_COUNTRY_CODES.has(countryCode.toUpperCase()));
}

export function getCountryName(countryCode?: string | null): string | undefined {
  const code = countryCode?.toUpperCase();
  return COUNTRIES.find((c) => c.code === code)?.name;
}

export function getSupportedCountriesLabel(): string {
  return COUNTRIES.map((c) => c.name).join(', ');
}

function extractClientIp(input: Headers): string | null {
  const forwarded = input.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return input.get('x-real-ip') || input.get('cf-connecting-ip') || null;
}

function extractCountryHeader(input: Headers): string | null {
  const value = input.get('x-vercel-ip-country') || input.get('cf-ipcountry');
  if (value && /^[A-Za-z]{2}$/.test(value)) return value.toUpperCase();
  return null;
}

type IpLookupResult = { ok: boolean; code?: string };

// Cache en mémoire des lookups externes (ipapi.co est limité ~45 req/min).
const ipLookupCache = new Map<string, { ts: number; result: IpLookupResult }>();
const IP_LOOKUP_TTL_MS = 30 * 60 * 1000;

async function lookupCountryByIp(ip: string): Promise<IpLookupResult> {
  const cached = ipLookupCache.get(ip);
  if (cached && Date.now() - cached.ts < IP_LOOKUP_TTL_MS) return cached.result;

  let result: IpLookupResult = { ok: false };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    clearTimeout(timer);
    const json = (await res.json().catch(() => null)) as { country_code?: unknown } | null;
    const code = typeof json?.country_code === 'string' ? json.country_code.toUpperCase() : '';
    result = { ok: res.ok && /^[A-Z]{2}$/.test(code), code: /^[A-Z]{2}$/.test(code) ? code : undefined };
  } catch {
    result = { ok: false };
  }
  ipLookupCache.set(ip, { ts: Date.now(), result });
  return result;
}

export type ClientCountryResult = {
  /** Code ISO 3166-1 alpha-2 du pays détecté, ou null */
  code: string | null;
  /** true si le pays a pu être déterminé */
  detected: boolean;
};

/**
 * Détecte le pays du client actuel. À appeler uniquement dans un contexte
 * serveur (server action / route handler), jamais côté client.
 */
export async function detectClientCountry(): Promise<ClientCountryResult> {
  const requestHeaders = await headers();

  const headerCountry = extractCountryHeader(requestHeaders);
  if (headerCountry) return { code: headerCountry, detected: true };

  const ip = extractClientIp(requestHeaders);
  if (!ip) return { code: null, detected: false };

  const lookup = await lookupCountryByIp(ip);
  if (!lookup.ok || !lookup.code) return { code: null, detected: false };

  return { code: lookup.code, detected: true };
}

export type CountryGate = {
  allowed: boolean;
  checked: boolean;
  countryCode: string | null;
  countryName: string | null;
};

/**
 * État du portail pays : `allowed=false` si le pays détecté n'est pas servi.
 * En cas d'échec de détection (pays inconnu) on laisse passer (`checked=false`),
 * le portage du blocage strict s'appuie sur les en-têtes Vercel en production.
 */
export async function buildCountryGate(): Promise<CountryGate> {
  try {
    const { code, detected } = await detectClientCountry();
    if (!detected || !code) {
      return { allowed: true, checked: false, countryCode: null, countryName: null };
    }
    return {
      allowed: isCountryAllowed(code),
      checked: true,
      countryCode: code,
      countryName: getCountryName(code) || null,
    };
  } catch {
    return { allowed: true, checked: false, countryCode: null, countryName: null };
  }
}