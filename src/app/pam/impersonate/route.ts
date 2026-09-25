import { NextRequest, NextResponse } from 'next/server';
import { createImpersonationSession } from '@/lib/impersonation';
import { getAdminSession } from '@/app/actions/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      const loginUrl = new URL('/pam/login', request.url);
      loginUrl.searchParams.set('error', 'session_expired');
      return NextResponse.redirect(loginUrl, 303);
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const storeId = searchParams.get('storeId');
    const email = searchParams.get('email');
    const redirectTo = searchParams.get('redirectTo');

    const isSecure = request.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production';

    const result = await createImpersonationSession({
      userId,
      storeId,
      email,
      redirectTo,
      isSecure,
    });

    if (!result.success || !result.redirectUrl) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html lang="fr">
          <head>
            <meta charset="utf-8">
            <title>Erreur de connexion impersonée</title>
            <style>
              body { font-family: system-ui, sans-serif; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: #1e293b; padding: 2rem; border-radius: 1rem; max-width: 420px; text-align: center; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.5); }
              h1 { color: #f87171; font-size: 1.25rem; margin-bottom: 0.75rem; }
              p { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.5rem; }
              a { display: inline-block; background: #f56b2a; color: white; padding: 0.75rem 1.5rem; border-radius: 0.75rem; text-decoration: none; font-weight: bold; font-size: 0.875rem; }
              a:hover { background: #ea580c; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Connexion impossible</h1>
              <p>${result.error || 'Une erreur est survenue lors de la tentative de connexion.'}</p>
              <a href="/pam/users">Retour à l'espace Admin</a>
            </div>
          </body>
        </html>`,
        {
          status: 400,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        },
      );
    }

    const redirectUrl = new URL(result.redirectUrl, request.url);
    const response = NextResponse.redirect(redirectUrl, 303);

    // Positionner tous les cookies de session et d'impersonation
    for (const cookie of result.cookies) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }

    // Supprimer d'anciens cookies résiduels
    if (result.cookiesToDelete) {
      for (const cookieName of result.cookiesToDelete) {
        response.cookies.delete(cookieName);
      }
    }

    return response;
  } catch (error) {
    console.error('PAM Impersonate GET Error:', error);
    return new NextResponse('Erreur serveur lors de la connexion', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { userId, storeId, email, redirectTo } = body;

    const isSecure = request.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production';

    const result = await createImpersonationSession({
      userId,
      storeId,
      email,
      redirectTo,
      isSecure,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const response = NextResponse.json({
      success: true,
      redirectUrl: result.redirectUrl,
      targetUser: result.targetUser,
    });

    for (const cookie of result.cookies) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }

    if (result.cookiesToDelete) {
      for (const cookieName of result.cookiesToDelete) {
        response.cookies.delete(cookieName);
      }
    }

    return response;
  } catch (error) {
    console.error('PAM Impersonate POST Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
