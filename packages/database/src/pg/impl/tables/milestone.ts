import { Milestone } from '@buildcore/interfaces';
import { get } from 'lodash';
import { Converter } from '../../interfaces/common';
import { PgMilestone } from '../../models';
import { pgDateToTimestamp } from '../postgres';

export class MilestoneConverter implements Converter<Milestone, PgMilestone> {
  toPg = (milestone: Milestone): PgMilestone => ({
    uid: get(milestone, 'uid', ''),
    createdOn: milestone.createdOn?.toDate(),
    completed: milestone.completed,
    completedOn: milestone.completedOn?.toDate(),
    listenerNodeId: milestone.listenerNodeId,
    milestone: milestone.milestone,
    milestoneTimestamp: milestone.milestoneTimestamp?.toDate(),
    trxConflictCount: milestone.trxConflictCount,
    trxFailedCount: milestone.trxFailedCount,
    trxValidCount: milestone.trxValidCount,
  });

  fromPg = (pg: PgMilestone): Milestone => ({
    createdOn: pgDateToTimestamp(pg.createdOn)!,
    completedOn: pgDateToTimestamp(pg.completedOn)!,
    milestone: pg.milestone!,
    completed: pg.completed!,
    listenerNodeId: pg.listenerNodeId!,
    milestoneTimestamp: pgDateToTimestamp(pg.milestoneTimestamp)!,
    trxConflictCount: pg.trxConflictCount!,
    trxFailedCount: pg.trxFailedCount!,
    trxValidCount: pg.trxValidCount!,

    transactions: {},
    cmi: 0,
    processed: true,
  });
}
