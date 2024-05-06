import { COL, SUB_COL } from '@buildcore/interfaces';
import { Knex } from 'knex';
import { head } from 'lodash';
import { undefinedToNull } from '../impl/common';
import { BaseRecord } from '../models/common';
import { Update } from '../models/common_update';
import { Converter, WhereFilterOp, getTableName } from './common';
import { IDocument } from './document/document';
import { ISubDocument } from './document/sub.document';
import { IQuery } from './query/query';
import { ISubColQuery } from './query/sub.query';

export class ICollection<T, Q extends BaseRecord, U extends Update> {
  protected table: string = '';

  constructor(
    protected con: Knex,
    protected col: COL,
    protected converter: Converter<T, Q>,
  ) {
    this.table = getTableName(col);
  }

  protected createQuery = () => new IQuery(this.con, this.col, this.converter);

  doc = (colId: string) => new IDocument(this.con, this.col, colId, this.converter);

  get = () => this.createQuery().get();

  where = <F extends keyof Q>(
    fieldPath: F,
    operator: WhereFilterOp,
    value: Q[F] | undefined | null,
  ) => this.createQuery().where(fieldPath, operator, value);

  update = async <F extends keyof Q>(data: U, where: Record<F, Q[F]>) => {
    await this.con(this.table).update(undefinedToNull(data)).where(where);
  };

  delete = async <F extends keyof Q>(where: Record<F, Q[F]>) =>
    await this.con(this.table).delete().where(where);

  count = async () => {
    const result = await this.con(this.table).count();
    return Number(head(result)?.count || 0);
  };

  limit = (limit: number) => this.createQuery().limit(limit);

  orderBy = <F extends keyof Q>(fieldPath: F, dir?: 'asc' | 'desc') =>
    this.createQuery().orderBy(fieldPath, dir);
}

export class ISubCollection<T, Q extends BaseRecord, U extends Update> extends ICollection<
  T,
  Q,
  U
> {
  constructor(
    con: Knex,
    col: COL,
    protected colId: string | undefined,
    protected subCol: SUB_COL,
    protected converter: Converter<T, Q>,
  ) {
    super(con, col, converter);
    this.table = getTableName(col, subCol);
  }

  protected createQuery = () =>
    new ISubColQuery(this.con, this.col, this.colId, this.subCol, this.converter);

  doc = (subColId: string) =>
    new ISubDocument(this.con, this.col, this.colId!, this.subCol, subColId, this.converter);

  count = async () => {
    const result = await this.con(this.table).where({ parentId: this.colId }).count();
    return Number(head(result)?.count || 0);
  };
}
