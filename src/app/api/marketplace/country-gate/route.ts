import { NextResponse } from 'next/server';
import { buildCountryGate } from '@/lib/geo';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/country-gate
 *
 * Portail pays du checkout (même garde que le web, `buildCountryGate`).
 * Le mobile s'en sert pour l'écran « Commande indisponible » ; le blocage
 * autoritaire est refait côté action au moment de l'envoi de la commande.
 */
export async function GET() {
  const gate = await buildCountryGate();
  return NextResponse.json({ success: true, ...gate });
}
