import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const redirectTo = searchParams.get('redirectTo') || '/pam';

  const targetUrl = new URL(redirectTo, request.url);
  const response = NextResponse.redirect(targetUrl, 303);

  // Supprimer la session utilisateur NextAuth et les cookies d'impersonation
  const cookiesToClear = [
    'authjs.session-token',
    '__Secure-authjs.session-token',
    'pam_impersonation',
    'currentStoreId',
    'pos_current_store_id',
    'userId',
    'buyerUserId',
    'auth_intent',
    'auth_role_error',
  ];

  for (const name of cookiesToClear) {
    response.cookies.delete(name);
  }

  return response;
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });

  const cookiesToClear = [
    'authjs.session-token',
    '__Secure-authjs.session-token',
    'pam_impersonation',
    'currentStoreId',
    'pos_current_store_id',
    'userId',
    'buyerUserId',
    'auth_intent',
    'auth_role_error',
  ];

  for (const name of cookiesToClear) {
    response.cookies.delete(name);
  }

  return response;
}
