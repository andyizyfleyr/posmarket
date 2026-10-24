import { NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { registerGuestPushToken } from '@/lib/push';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
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
    const phone = String(body?.phone || '').trim();

    if (!/^Expo(nent)?PushToken\[.+\]$/.test(token)) {
      return NextResponse.json({ success: false, error: 'Jeton push invalide.' }, { status: 400 });
    }
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Commande manquante.' }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json({ success: false, error: 'Email ou téléphone requis.' }, { status: 400 });
    }

    const orderRows = await db
      .select({
        id: orders.id,
        buyerEmail: (orders as any).buyerEmail,
        buyerPhone: (orders as any).buyerPhone,
        buyerUserId: (orders as any).buyerUserId,
      } as any)
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    const order: any = orderRows[0];

    if (!order) {
      return NextResponse.json({ success: false, error: 'Commande introuvable.' }, { status: 404 });
    }

    if (order.buyerUserId) {
      return NextResponse.json({ success: false, error: 'Commande liée à un compte.' }, { status: 400 });
    }

    const orderEmail = String(order.buyerEmail || '').trim().toLowerCase();
    const orderPhone = String(order.buyerPhone || '').trim();

    if (email && orderEmail && email !== orderEmail) {
      return NextResponse.json({ success: false, error: 'Email ne correspond pas à la commande.' }, { status: 400 });
    }
    if (phone && orderPhone && phone.replace(/\s+/g, '') !== orderPhone.replace(/\s+/g, '')) {
      return NextResponse.json({ success: false, error: 'Téléphone ne correspond pas à la commande.' }, { status: 400 });
    }

    const platform = body?.platform === 'ios' ? 'ios' : 'android';

    await registerGuestPushToken({
      orderId: order.id,
      token,
      email: email || orderEmail || null,
      phone: phone || orderPhone || null,
      platform,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] guest/push-token POST error:', error);
    return NextResponse.json({ success: false, error: "Impossible d'enregistrer les notifications." }, { status: 500 });
  }
}
