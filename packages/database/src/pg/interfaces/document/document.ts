import { COL } from '@buildcore/interfaces';
import { Knex } from 'knex';
import { head, unset } from 'lodash';
import { BaseRecord } from '../../models/common';
import { Update } from '../../models/common_update';
import { Converter, PKey, getTableName } from '../common';
import { toRaw } from './common';
import { onSnapshot } from './snapshot';

export class IDocument<C, B extends BaseRecord, U extends Update> {
  public pKey: PKey = { uid: '' };
  public table: string;

  constructor(
    protected con: Knex | Knex.Transaction,
    protected col: COL,
    protected colId: string,
    public converter: Converter<C, B>,
  ) {
    this.table = getTableName(col);
    this.pKey.uid = colId;
  }

  create = async (data: C): Promise<void> => {
    const pgData = this.converter.toPg({ ...data, ...this.pKey });
    await this.con(this.table).insert(pgData);
  };

  createQuery = () => {
    let query = this.con(this.table).where(this.pKey);
    if (this.con.isTransaction) {
      query.forUpdate().timeout(200);
    }
    return query;
  };

  get = async (): Promise<C | undefined> => {
    const snap = head(await this.createQuery());
    return snap ? this.converter.fromPg(snap) : undefined;
  };

  onSnapshot = (
    callback: (data: C | undefined) => Promise<void> | void,
    onError?: (err: any) => void,
  ) => onSnapshot(this, callback, onError);

  update = async (data: U) => {
    unset(data, 'parentCol');
    const update = toRaw(this.con, data);
    await this.con(this.table).update(update).where(this.pKey);
  };

  upsert = async (data: U) => {
    unset(data, 'parentCol');
    const update = toRaw(this.con, data);
    const trx = await this.con.transaction();
    await trx(this.table).insert(this.pKey).onConflict(Object.keys(this.pKey)).ignore();
    await trx(this.table).update(update).where(this.pKey);
    try {
      await trx.commit();
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  };

  delete = async () => {
    await this.con(this.table).delete().where(this.pKey);
  };

  useTransaction = async <R>(
    trx: Knex.Transaction,
    func: (doc: IDocument<C, B, U>) => Promise<R>,
  ): Promise<R> => {
    const con = this.con;
    try {
      this.con = trx;
      return await func(this);
    } finally {
      this.con = con;
    }
  };
}
