import { COL, SUB_COL } from '@buildcore/interfaces';
import { Knex } from 'knex';
import { BaseRecord } from '../../models/common';
import { Update } from '../../models/common_update';
import { Converter, getTableName } from '../common';
import { IDocument } from './document';

export class ISubDocument<C, B extends BaseRecord, U extends Update> extends IDocument<C, B, U> {
  constructor(
    con: Knex | Knex.Transaction,
    col: COL,
    colId: string,
    protected subCol: SUB_COL,
    protected subColId: string,
    converter: Converter<C, B>,
  ) {
    super(con, col, colId, converter);
    this.pKey.uid = subColId;
    this.pKey.parentId = this.colId;
    this.table = getTableName(col, subCol);
  }
}
