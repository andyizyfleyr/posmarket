export type Filter = {
  op: 'eq' | 'in';
  column: string;
  value: any;
};

export type QuerySpec = {
  table: string;
  method: 'select' | 'insert' | 'upsert' | 'update' | 'delete';
  selectColumns?: string[] | null;
  values?: any;
  filters?: Filter[];
  order?: { column: string; ascending: boolean } | null;
  limit?: number | null;
  offset?: number | null;
  single?: boolean;
  head?: boolean;
  textSearch?: { column: string; query: string } | null;
  rpc?: string;
  rpcArgs?: any;
};

export type QueryResult<T = any> = { data: T; error: any; count?: number };
export type Executor = (spec: QuerySpec) => Promise<QueryResult>;

export class QueryBuilder<T = any[]> {
  private spec: QuerySpec;

  constructor(
    private tableName: string,
    private executor: Executor,
    method: QuerySpec['method'] = 'select'
  ) {
    this.spec = { table: tableName, method, filters: [] };
  }

  select(columns?: any): this {
    this.spec.method = 'select';
    if (typeof columns === 'string' && columns.trim()) {
      this.spec.selectColumns = columns
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c && c !== '*');
    } else if (Array.isArray(columns)) {
      this.spec.selectColumns = columns.map((c) => String(c).trim()).filter((c) => c);
    } else if (columns && typeof columns === 'object') {
      this.spec.head = true;
    }
    return this;
  }

  insert(values: any): this {
    this.spec.method = 'insert';
    this.spec.values = values;
    return this;
  }

  upsert(values: any): this {
    this.spec.method = 'upsert';
    this.spec.values = values;
    return this;
  }

  update(values: any): this {
    this.spec.method = 'update';
    this.spec.values = values;
    return this;
  }

  delete(): this {
    this.spec.method = 'delete';
    return this;
  }

  rpc(name: string, args?: any): this {
    this.spec.rpc = name;
    this.spec.rpcArgs = args;
    return this;
  }

  eq(column: string, value: any): this {
    this.spec.filters!.push({ op: 'eq', column, value });
    return this;
  }

  in(column: string, values: any[]): this {
    this.spec.filters!.push({ op: 'in', column, value: values });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this.spec.order = { column, ascending: opts?.ascending !== false };
    return this;
  }

  limit(n: number): this {
    this.spec.limit = n;
    return this;
  }

  range(start: number, end: number): this {
    this.spec.offset = start;
    this.spec.limit = end - start + 1;
    return this;
  }

  textSearch(column: string, query: string, _opts?: any): this {
    this.spec.textSearch = { column, query };
    return this;
  }

  single(): QueryBuilder<any> {
    this.spec.single = true;
    return this as any;
  }

  execute(): Promise<QueryResult<T>> {
    return this.executor(this.spec);
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
