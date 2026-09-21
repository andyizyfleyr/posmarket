'use server'

import { buildCountryGate } from '@/lib/geo'

export type DetectCountryResult = {
  allowed: boolean
  checked: boolean
  countryCode: string | null
  countryName: string | null
}

/**
 * Renvoie au client si son pays (détecté par IP) est desservi.
 * Utilisé par la vitrine pour informer/bloquer l'achat côté UX.
 */
export async function detectCountryAction(): Promise<DetectCountryResult> {
  return buildCountryGate()
}