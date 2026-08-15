import { QueryBuilder, QuerySpec, QueryResult } from './db/builder';
import {
  getCurrentSession,
  signInWithPasswordSession,
  signUpSession,
  signOutSession,
  setSessionUser,
} from './app/actions/session';
import { execQuery, execRpc } from './app/actions/sql';

const clientExecutor = async (spec: QuerySpec): Promise<QueryResult> => {
  return execQuery(spec);
};

export const supabase = {
  auth: {
    async getSession() {
      const { user } = await getCurrentSession();
      return { data: { session: user ? { user } : null }, error: null };
    },
    async getUser() {
      const { user } = await getCurrentSession();
      return { data: { user }, error: null };
    },
    async signUp({ email, password, options }: any) {
      const result = await signUpSession(options?.data?.full_name || 'Utilisateur', email);
      return {
        data: { user: result.user, session: result.user ? { user: result.user } : null },
        error: result.error,
      };
    },
    async signInWithPassword({ email }: any) {
      const result = await signInWithPasswordSession(email);
      return {
        data: { user: result.user, session: result.user ? { user: result.user } : null },
        error: result.error,
      };
    },
    async signOut() {
      return signOutSession();
    },
    async setSession(session: any) {
      return setSessionUser(session?.user?.id || null);
    },
  },
  from(table: string) {
    return new QueryBuilder(table, clientExecutor);
  },
  rpc(name: string, args?: any) {
    const builder: QueryBuilder<any> = new QueryBuilder('', clientExecutor);
    builder.rpc(name, args);
    return builder;
  },
  functions: {
    async invoke(fn: string, opts: any) {
      if (fn === 'create-staff') {
        return execRpc('create-staff', opts?.body);
      }
      return { data: null, error: { message: 'Function not implemented' } };
    },
  },
};

export default supabase;
