import { StakeReward, StakeRewardStatus } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgStakeReward } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class StakeRewardConverter implements Converter<StakeReward, PgStakeReward> {
  toPg = (sr: StakeReward): PgStakeReward => ({
    uid: sr.uid,
    project: sr.project,
    createdOn: sr.createdOn?.toDate(),
    updatedOn: sr.updatedOn?.toDate(),
    createdBy: sr.createdBy,

    startDate: sr.startDate?.toDate(),
    endDate: sr.endDate?.toDate(),
    tokenVestingDate: sr.tokenVestingDate?.toDate(),
    tokensToDistribute: sr.tokensToDistribute,
    token: sr.token,
    totalStaked: sr.totalStaked,
    totalAirdropped: sr.totalAirdropped,
    status: sr.status,
  });

  fromPg = (pg: PgStakeReward): StakeReward =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      createdOn: pgDateToTimestamp(pg.createdOn),
      updatedOn: pgDateToTimestamp(pg.updatedOn),
      createdBy: pg.createdBy || '',
      startDate: pgDateToTimestamp(pg.startDate)!,
      endDate: pgDateToTimestamp(pg.endDate)!,
      tokenVestingDate: pgDateToTimestamp(pg.tokenVestingDate)!,
      tokensToDistribute: pg.tokensToDistribute!,
      token: pg.token!,
      status: pg.status as StakeRewardStatus,
      totalStaked: pg.totalStaked,
      totalAirdropped: pg.totalAirdropped,
    });
}
