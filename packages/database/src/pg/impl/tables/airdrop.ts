import { StakeType, TokenDrop, TokenDropStatus } from '@build-5/interfaces';
import { head } from 'lodash';
import { ICollection } from '../../interfaces/collection';
import { Converter } from '../../interfaces/common';
import { PgAirdrop } from '../../models';
import { PgAirdropUpdate } from '../../models/airdrop_update';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class PgAirdropCollection extends ICollection<TokenDrop, PgAirdrop, PgAirdropUpdate> {
  getUnclaimedAirdropTotalValue = async (token: string) => {
    const snap = await this.con(this.table)
      .select(this.con.raw('SUM(count) as count'))
      .where({ token, status: TokenDropStatus.UNCLAIMED });
    return head(snap).count || 0;
  };
}

export class AirdropConverter implements Converter<TokenDrop, PgAirdrop> {
  toPg = (airdrop: TokenDrop): PgAirdrop => ({
    uid: airdrop.uid,
    project: airdrop.project,
    createdOn: airdrop.createdOn?.toDate(),
    updatedOn: airdrop.updatedOn?.toDate(),
    createdBy: airdrop.createdBy,

    member: airdrop.member,
    token: airdrop.token,
    award: airdrop.award,
    vestingAt: airdrop.vestingAt?.toDate(),
    count: airdrop.count,
    status: airdrop.status,
    orderId: airdrop.orderId,
    billPaymentId: airdrop.billPaymentId,
    sourceAddress: airdrop.sourceAddress,
    stakeRewardId: airdrop.stakeRewardId,
    stakeType: airdrop.stakeType,
    isBaseToken: airdrop.isBaseToken,
  });

  fromPg = (pg: PgAirdrop): TokenDrop =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      createdOn: pgDateToTimestamp(pg.createdOn),
      updatedOn: pgDateToTimestamp(pg.updatedOn),
      createdBy: pg.createdBy || '',

      member: pg.member!,
      token: pg.token!,
      award: pg.award,
      vestingAt: pgDateToTimestamp(pg.vestingAt)!,
      count: pg.count!,
      status: pg.status as TokenDropStatus,
      orderId: pg.orderId,
      billPaymentId: pg.billPaymentId,
      sourceAddress: pg.sourceAddress,
      stakeRewardId: pg.stakeRewardId,
      stakeType: pg.stakeType as StakeType,
      isBaseToken: pg.isBaseToken,
    });
}
