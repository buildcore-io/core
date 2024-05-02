import { COL, StakeType, TokenDistribution } from '@buildcore/interfaces';
import { head } from 'lodash';
import { ISubCollection } from '../../interfaces/collection';
import { Converter } from '../../interfaces/common';
import { PgTokenDistribution } from '../../models';
import { PgTokenDistributionUpdate } from '../../models/token_update';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class PgTokenDistributionCollection extends ISubCollection<
  TokenDistribution,
  PgTokenDistribution,
  PgTokenDistributionUpdate
> {
  getTotalOwned = async () => {
    const snap = await this.con(this.table)
      .select(this.con.raw('SUM("tokenOwned") as "tokenOwned"'))
      .where({ parentId: this.colId });
    return Number(head(snap).tokenOwned || 0);
  };
}

export class TokenDistributionConverter
  implements Converter<TokenDistribution, PgTokenDistribution>
{
  toPg = (td: TokenDistribution) => ({
    uid: td.uid!,
    project: td.project,
    createdOn: td.createdOn?.toDate(),
    parentId: td.parentId,

    totalDeposit: td.totalDeposit,
    totalPaid: td.totalPaid,
    refundedAmount: td.refundedAmount,
    totalBought: td.totalBought,
    reconciled: td.reconciled,
    billPaymentId: td.billPaymentId,
    creditPaymentId: td.creditPaymentId,
    royaltyBillPaymentId: td.royaltyBillPaymentId,
    tokenClaimed: td.tokenClaimed,
    lockedForSale: td.lockedForSale,
    sold: td.sold,
    totalPurchased: td.totalPurchased,
    tokenOwned: td.tokenOwned,
    mintedClaimedOn: td.mintedClaimedOn?.toDate(),
    mintingTransactions: td.mintingTransactions,
    stakeRewards: td.stakeRewards,
    extraStakeRewards: td.extraStakeRewards,
    totalUnclaimedAirdrop: td.totalUnclaimedAirdrop,
    stakeVoteTransactionId: td.stakeVoteTransactionId,

    stakes_static_amount: td.stakes?.[StakeType.STATIC]?.amount || 0,
    stakes_static_totalAmount: td.stakes?.[StakeType.STATIC]?.totalAmount || 0,
    stakes_static_value: td.stakes?.[StakeType.STATIC]?.value || 0,
    stakes_static_totalValue: td.stakes?.[StakeType.STATIC]?.totalValue || 0,
    stakes_static_stakingMembersCount: td.stakes?.[StakeType.STATIC]?.stakingMembersCount || 0,
    stakes_dynamic_amount: td.stakes?.[StakeType.DYNAMIC]?.amount || 0,
    stakes_dynamic_totalAmount: td.stakes?.[StakeType.DYNAMIC]?.totalAmount || 0,
    stakes_dynamic_value: td.stakes?.[StakeType.DYNAMIC]?.value || 0,
    stakes_dynamic_totalValue: td.stakes?.[StakeType.DYNAMIC]?.totalValue || 0,
    stakes_dynamic_stakingMembersCount: td.stakes?.[StakeType.DYNAMIC]?.stakingMembersCount || 0,
    stakeExpiry: td.stakeExpiry,
  });

  fromPg = (pg: PgTokenDistribution): TokenDistribution =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      parentId: pg.parentId,
      parentCol: COL.TOKEN,
      totalDeposit: pg.totalDeposit,
      totalPaid: pg.totalPaid,
      refundedAmount: pg.refundedAmount,
      totalBought: pg.totalBought,
      reconciled: pg.reconciled,
      billPaymentId: pg.billPaymentId,
      creditPaymentId: pg.creditPaymentId,
      royaltyBillPaymentId: pg.royaltyBillPaymentId,
      tokenClaimed: pg.tokenClaimed,
      lockedForSale: pg.lockedForSale,
      sold: pg.sold,
      totalPurchased: pg.totalPurchased,
      tokenOwned: pg.tokenOwned,
      createdOn: pgDateToTimestamp(pg.createdOn),
      mintedClaimedOn: pgDateToTimestamp(pg.mintedClaimedOn),
      mintingTransactions: pg.mintingTransactions,
      stakes: {
        [StakeType.STATIC]: {
          amount: pg.stakes_static_amount,
          totalAmount: pg.stakes_static_totalAmount,
          value: pg.stakes_static_value,
          totalValue: pg.stakes_static_totalValue,
          stakingMembersCount: pg.stakes_static_stakingMembersCount,
        },
        [StakeType.DYNAMIC]: {
          amount: pg.stakes_dynamic_amount,
          totalAmount: pg.stakes_dynamic_totalAmount,
          value: pg.stakes_dynamic_value,
          totalValue: pg.stakes_dynamic_totalValue,
          stakingMembersCount: pg.stakes_dynamic_stakingMembersCount,
        },
      },
      stakeExpiry: pg.stakeExpiry as { [key: string]: { [key: number]: number } },
      stakeRewards: pg.stakeRewards,
      extraStakeRewards: pg.extraStakeRewards,
      totalUnclaimedAirdrop: pg.totalUnclaimedAirdrop,
      stakeVoteTransactionId: pg.stakeVoteTransactionId,
    });
}
