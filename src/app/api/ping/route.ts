import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ping — sonde de disponibilité (GitHub Actions toutes les 3 minutes).
 *
 * Ne JAMAIS renvoyer le message d'erreur : une erreur du driver Neon contient
 * l'hôte, l'utilisateur, la base et parfois la chaîne de connexion complète.
 * L'endpoint est public et non authentifié ; le détail reste dans les journaux.
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ping] base de données injoignable:', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
