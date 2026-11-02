import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { registerGuestPushToken } from '@/lib/push';
import { enforceSharedRateLimit } from '@/lib/api-rate-limit';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Normalisation des numéros : chiffres uniquement, indicatif conservé. */
function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * POST /api/marketplace/guest/push-token
 *
 * Enregistre le jeton push d'un acheteur **invité** (sans compte) sur une
 * commande qu'il vient de passer.
 *
 * Cette route est publique par nature (un invité n'a pas de session) : elle
 * s'appuyait donc uniquement sur l'e-mail/téléphone de la commande comme
 * preuve de possession. Trois défauts corrigés ici :
 *
 * 1. **Aucune limite de débit** → ajout d'un quota « sensitive » partagé entre
 *    instances (protège l'énumération d'identifiants de commandes).
 * 2. **Messages d'erreur distincts** (404 « commande introuvable », 400
 *    « liée à un compte », « e-mail ne correspond pas ») → ils révélaient
 *    l'existence d'une commande et permettaient de tester des adresses. Une
 *    seule réponse générique est renvoyée pour tous les refus.
 * 3. **Vérification partielle** : si la commande ne contenait pas d'e-mail,
 *    la comparaison était simplement sautée. Elle est désormais obligatoire
 *    dès qu'une coordonnée est fournie, et le jeton ne peut pas être volé à une
 *    autre commande (voir `registerGuestPushToken`).
 */
export async function POST(req: Request) {
  try {
    const limited = await enforceSharedRateLimit(req, 'sensitive');
    if (limited) return limited;

    const body = (await req.json().catch(() => null)) as {
      token?: string;
      orderId?: string;
      email?: string;
      phone?: string;
      platform?: string;
    } | null;

    const token = String(body?.token || '').trim();
    const orderId = String(body?.orderId || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const phone = normalizePhone(String(body?.phone || ''));

    const reject = () =>
      NextResponse.json(
        { success: false, error: 'Impossible de lier les notifications à cette commande.' },
        { status: 400 },
      );

    if (!/^Expo(nent)?PushToken\[.+\]$/.test(token)) {
      return NextResponse.json({ success: false, error: 'Jeton push invalide.' }, { status: 400 });
    }
    if (!UUID_RE.test(orderId)) return reject();
    if (!email && !phone) {
      return NextResponse.json(
        { success: false, error: 'Email ou téléphone requis.' },
        { status: 400 },
      );
    }

    const [order] = await db
      .select({
        id: orders.id,
        buyerEmail: orders.buyerEmail,
        buyerPhone: orders.buyerPhone,
        buyerUserId: orders.buyerUserId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) return reject();
    // Une commande liée à un compte utilise `/api/marketplace/push-token`
    // (authentifié) : ne pas accepter un jeton invité pour celle-ci.
    if (order.buyerUserId) return reject();

    const orderEmail = String(order.buyerEmail || '').trim().toLowerCase();
    const orderPhone = normalizePhone(String(order.buyerPhone || ''));

    // La coordonnée fournie doit correspondre à celle enregistrée sur la
    // commande. Un champ absent côté commande ne vaut PAS validation.
    if (email && email !== orderEmail) return reject();
    if (phone && phone !== orderPhone) return reject();
    if (!email && !phone) return reject();

    const platform = body?.platform === 'ios' ? 'ios' : 'android';

    await registerGuestPushToken({
      orderId: order.id,
      token,
      email: orderEmail || email || null,
      phone: orderPhone || phone || null,
      platform,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] guest/push-token POST error:', error);
    return NextResponse.json(
      { success: false, error: "Impossible d'enregistrer les notifications." },
      { status: 500 },
    );
  }
}
