import { COL, SUB_COL } from '@buildcore/interfaces';
import { Knex } from 'knex';
import { BaseRecord } from '../../models/common';
import { Converter, getTableName } from '../common';
import { IQuery } from './query';

export class ISubColQuery<C, Q extends BaseRecord> extends IQuery<C, Q> {
  constructor(
    public con: Knex,
    public col: COL,
    public colId: string | undefined,
    public subCol: SUB_COL,
    converter: Converter<C, Q>,
  ) {
    super(con, col, converter);
    this.table = getTableName(col, subCol);

    if (colId) {
      this.where('parentId' as any, '==', colId);
    }
  }
}
