import { COL } from '@buildcore/interfaces';
import { Knex } from 'knex';
import { get, some, uniq } from 'lodash';
import { BaseRecord } from '../../models/common';
import { Converter, WhereFilterOp, getTableName } from '../common';
import { OnSnapshot } from './snapshot';

export abstract class BaseIQuery<C, Q extends BaseRecord> {
  public table: string;
  public startAfterData: Q | undefined = undefined;
  public limits: number = 0;
  public whereIns: { key: string; value: any }[] = [];
  public wheres: { key: string; opr: WhereFilterOp; value: any }[] = [];
  public whereOrs: Record<string, any>[] = [];
  public orderBys: { key: string; dir: 'asc' | 'desc' }[] = [];

  constructor(
    public con: Knex,
    public col: COL,
    public converter: Converter<C, Q>,
  ) {
    this.table = getTableName(col);
  }

  createQuery = () => {
    const query = this.con(this.table).select('*');

    for (const ins of this.whereIns) {
      query.whereIn(ins.key, ins.value);
    }

    for (const wheres of this.wheres) {
      if (wheres.opr === 'array-contains') {
        query.where(wheres.key, '@>', `{${wheres.value}}`);
      } else {
        const opr = wheres.opr === '==' ? '=' : wheres.opr;
        query.where(wheres.key, opr, wheres.value);
      }
    }

    for (const whereOr of this.whereOrs) {
      query.where((builder) => {
        Object.entries(whereOr).forEach(([key, value]) => {
          builder.orWhere(key, value as any);
        });
      });
    }

    const orderBys = [...this.orderBys];
    if (!this.orderBys.map((o) => o.key).includes('uid')) {
      orderBys.push({ key: 'uid', dir: 'asc' });
    }

    if (this.startAfterData) {
      query.where((builder) => {
        for (let i = 0; i < orderBys.length; ++i) {
          builder.orWhere((b) => {
            for (let j = 0; j <= i; ++j) {
              b.where(
                orderBys[j].key as any,
                i === j ? (orderBys[j].dir === 'asc' ? '>' : '<') : '=',
                get(this.startAfterData, orderBys[j].key),
              );
            }
          });
        }
      });
    }

    if (this.limits) {
      query.limit(this.limits);
    }

    for (const orderBy of orderBys) {
      query.orderBy(orderBy.key, orderBy.dir);
    }

    return query;
  };

  checkIndex = async (query: Knex.QueryBuilder) => {
    if (process.env.ENVIRONMENT !== 'emulator') {
      return;
    }

    const hasOnlyEqual = this.wheres.reduce((acc, act) => acc && act.opr === '==', true);
    if (hasOnlyEqual && !this.orderBys.length && !this.whereOrs.length) {
      return;
    }

    const { name, columns } = this.createIndex();

    const result = await this.con
      .from('pg_catalog.pg_indexes')
      .where({
        tablename: this.table,
      })
      .whereLike('indexdef', `%(${columns})`);
    if (!result.length) {
      console.log('Index is missing');
      console.log(query.toSQL());
      console.log(`CREATE INDEX IF NOT EXISTS ${name} ON ${this.table} (${columns})`);
      process.exit(1);
    }
  };

  createIndex = () => {
    const columns = [];

    for (const { key } of this.whereIns) {
      columns.push(key);
    }
    for (const { key } of this.wheres) {
      columns.push(key);
    }
    for (const ors of this.whereOrs) {
      for (const key of Object.keys(ors)) {
        columns.push(key);
      }
    }

    const inKeys = this.whereIns.map((i) => i.key);
    const whereKeys = this.wheres.map((w) => w.key);
    const orKeys = this.whereOrs.map(Object.keys).reduce((acc, act) => [...acc, ...act], []);
    const allKeys = uniq([...inKeys, ...whereKeys, ...orKeys]);

    const orderBys = [...this.orderBys];
    if (!this.orderBys.map((o) => o.key).includes('uid')) {
      orderBys.push({ key: 'uid', dir: 'asc' });
    }
    for (const { key } of orderBys) {
      if (!allKeys.includes(key)) {
        columns.push(key);
      }
    }

    const name = `${this.table}_${Math.random().toString().replace('0.', '')}`;
    return {
      name,
      columns: columns
        .map((c) => (some(c, (char) => /[A-Z]/.test(char)) || c === 'position' ? `"${c}"` : c))
        .join(', '),
    };
  };
}

export class IQuery<C, Q extends BaseRecord> extends BaseIQuery<C, Q> {
  get = async (): Promise<C[]> => {
    const query = this.createQuery();
    await this.checkIndex(query);

    const snap = await query;
    return snap.map(this.converter.fromPg);
  };

  onSnapshot = (callback: (data: C[]) => Promise<void> | void, onError?: (err: any) => void) => {
    const snap = new OnSnapshot(this, callback, onError);
    return snap.unsubscrib;
  };

  whereOr = <F extends keyof Q>(filters: Record<F, any>) => {
    this.whereOrs.push(filters);
    return this;
  };

  where = <F extends keyof Q>(
    fieldPath: F,
    operator: WhereFilterOp,
    value: Q[F] | undefined | null,
  ): IQuery<C, Q> => {
    this.wheres.push({ key: fieldPath as string, opr: operator, value });
    return this;
  };

  whereIn = <F extends keyof Q>(fieldPath: F, value: Q[F][]): IQuery<C, Q> => {
    this.whereIns.push({ key: fieldPath as any, value });
    return this;
  };

  startAfter = (data: C | undefined): IQuery<C, Q> => {
    this.startAfterData = data ? this.converter.toPg(data) : undefined;
    return this;
  };

  limit = (value: number): IQuery<C, Q> => {
    this.limits = value;
    return this;
  };

  orderBy = <F extends keyof Q>(fieldPath: F, dir: 'asc' | 'desc' = 'asc') => {
    this.orderBys.push({ key: fieldPath as string, dir });
    return this;
  };
}
