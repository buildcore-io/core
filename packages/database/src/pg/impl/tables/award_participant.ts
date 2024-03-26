import { AwardParticipant, COL } from '@build-5/interfaces';
import { Converter } from '../../interfaces/common';
import { PgAwardParticipants } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class AwardParticipantConverter implements Converter<AwardParticipant, PgAwardParticipants> {
  toPg = (awardParticipant: AwardParticipant): PgAwardParticipants => ({
    uid: awardParticipant.uid,
    project: awardParticipant.project,
    createdOn: awardParticipant.createdOn?.toDate(),
    parentId: awardParticipant.parentId,
    comment: awardParticipant.comment || undefined,
    completed: awardParticipant.completed,
    count: awardParticipant.count,
    tokenReward: awardParticipant.tokenReward,
  });

  fromPg = (pg: PgAwardParticipants): AwardParticipant =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      parentId: pg.parentId,
      parentCol: COL.AWARD,
      comment: pg.comment,
      completed: pg.completed || false,
      createdOn: pgDateToTimestamp(pg.createdOn)!,
      count: pg.count || 0,
      tokenReward: pg.tokenReward || 0,
    });
}
