import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

// Instance edge-safe (proxy/middleware) : aucune base de données, uniquement
// la vérification du JWT de session. Ne pas réutiliser pour des opérations DB.
export const { auth } = NextAuth(authConfig);