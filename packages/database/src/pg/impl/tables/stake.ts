import { Stake, StakeReward, StakeType } from '@build-5/interfaces';
import { ICollection } from '../../interfaces/collection';
import { Converter } from '../../interfaces/common';
import { PgStake } from '../../models';
import { PgStakeUpdate } from '../../models/stake_update';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class PgStakeCollection extends ICollection<Stake, PgStake, PgStakeUpdate> {
  getStakeSumPerMember = async (stakeReward: StakeReward): Promise<{ [key: string]: number }> => {
    const result = await this.con(this.col)
      .select('member')
      .select(this.con.raw('SUM(value) as value'))
      .where({ token: stakeReward.token })
      .where({ type: StakeType.DYNAMIC })
      .where('expiresAt', '>=', stakeReward.startDate.toDate())
      .where('createdOn', '<=', stakeReward.endDate.toDate())
      .groupBy('member');
    return (result as { member: string; value: number }[]).reduce(
      (acc, act) => ({ ...acc, [act.member]: act.value }),
      {} as { [key: string]: number },
    );
  };
}

export class StakeConverter implements Converter<Stake, PgStake> {
  toPg = (stake: Stake): PgStake => ({
    uid: stake.uid,
    project: stake.project,
    createdOn: stake.createdOn?.toDate(),
    updatedOn: stake.updatedOn?.toDate(),
    createdBy: stake.createdBy,

    member: stake.member,
    space: stake.space,
    token: stake.token,
    amount: stake.amount,
    value: stake.value,
    weeks: stake.weeks,
    expiresAt: stake.expiresAt?.toDate(),
    expirationProcessed: stake.expirationProcessed,
    orderId: stake.orderId,
    billPaymentId: stake.billPaymentId,
    type: stake.type,
    customMetadata: JSON.stringify(stake.customMetadata) as any,
  });

  fromPg = (pg: PgStake): Stake =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      createdOn: pgDateToTimestamp(pg.createdOn),
      updatedOn: pgDateToTimestamp(pg.updatedOn),
      createdBy: pg.createdBy || '',
      member: pg.member!,
      space: pg.space!,
      token: pg.token!,
      amount: pg.amount!,
      value: pg.value!,
      weeks: pg.weeks!,
      expiresAt: pgDateToTimestamp(pg.expiresAt)!,
      expirationProcessed: pg.expirationProcessed!,
      orderId: pg.orderId!,
      billPaymentId: pg.billPaymentId!,
      type: pg.type as StakeType,
      customMetadata: pg.customMetadata as { [key: string]: string } | undefined,
    });
}
