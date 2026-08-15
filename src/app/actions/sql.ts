'use server';

import { runQuery } from '@/db/query';
import { QuerySpec } from '@/db/builder';

export async function execQuery(spec: QuerySpec) {
  return runQuery(spec);
}

export async function execRpc(name: string, args?: any) {
  return runQuery({ table: '', method: 'select', rpc: name, rpcArgs: args });
}
