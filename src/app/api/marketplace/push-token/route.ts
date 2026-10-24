import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/app/actions/session';
import { registerPushToken, unregisterPushToken } from '@/lib/push';
import { parseBody } from '@/lib/validation';
import { pushTokenSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * POST /api/marketplace/push-token
 * Enregistre le jeton Expo de l'appareil pour l'utilisateur connecté.
 * Accessible aux acheteurs comme aux vendeurs : c'est le même compte mobile.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await getCurrentSession();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const parsed = await parseBody(req, pushTokenSchema);
    if (!parsed.ok) return parsed.response;
    const { token, platform, deviceName } = parsed.data;

    await registerPushToken({
      userId: user.id,
      token,
      platform,
      deviceName: deviceName || null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] push-token POST error:', error);
    return NextResponse.json(
      { success: false, error: "Impossible d'enregistrer les notifications." },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/marketplace/push-token
 * Désactive un jeton à la déconnexion de l'appareil.
 */
export async function DELETE(req: NextRequest) {
  try {
    const { user } = await getCurrentSession();
    if (!user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { token?: string } | null;
    const token = String(body?.token || '').trim();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Jeton push manquant.' }, { status: 400 });
    }

    await unregisterPushToken(token);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] push-token DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Impossible de désactiver les notifications.' },
      { status: 500 },
    );
  }
}
