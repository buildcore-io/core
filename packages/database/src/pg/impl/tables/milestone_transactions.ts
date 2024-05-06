import { Timestamp } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgMilestoneTransactions } from '../../models';
import { pgDateToTimestamp } from '../postgres';

export interface MilestoneTransactions {
  uid: string;
  parentId: string;

  createdOn: Timestamp;
  updatedOn: Timestamp;

  PayloadSize: number;

  blockId: string;
  milestone: number;
  payload: any;
  processed: boolean;
  processedOn: Timestamp;
}

export class MilestoneTransactionConverter
  implements Converter<MilestoneTransactions, PgMilestoneTransactions>
{
  toPg = (mt: MilestoneTransactions): PgMilestoneTransactions => ({
    uid: mt.uid,
    parentId: mt.milestone.toString(),
    createdOn: mt.createdOn?.toDate(),
    updatedOn: mt.updatedOn?.toDate(),
    PayloadSize: mt.PayloadSize,
    blockId: mt.blockId,
    milestone: mt.milestone,
    payload: JSON.stringify(mt.payload) as any,
    processed: mt.processed,
    processedOn: mt.processedOn?.toDate(),
  });

  fromPg = (pg: PgMilestoneTransactions): MilestoneTransactions => ({
    uid: pg.uid,
    parentId: pg.parentId,

    createdOn: pgDateToTimestamp(pg.createdOn)!,
    updatedOn: pgDateToTimestamp(pg.updatedOn)!,

    PayloadSize: pg.PayloadSize!,

    blockId: pg.blockId!,
    milestone: pg.milestone!,
    payload: pg.payload,
    processed: pg.processed!,
    processedOn: pgDateToTimestamp(pg.processedOn)!,
  });
}
