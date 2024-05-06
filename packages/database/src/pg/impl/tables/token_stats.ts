import { COL, StakeType, TokenPurchaseAge, TokenStats } from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgTokenStats } from '../../models';
import { removeNulls } from '../common';

export class TokenStatsConverter implements Converter<TokenStats, PgTokenStats> {
  toPg = (ts: TokenStats): PgTokenStats => ({
    uid: ts.parentId,
    project: ts.project,
    parentId: ts.parentId,

    votes_upvotes: ts.votes?.upvotes,
    votes_downvotes: ts.votes?.downvotes,
    votes_voteDiff: ts.votes?.voteDiff,
    ranks_count: ts.ranks?.count,
    ranks_sum: ts.ranks?.sum,
    ranks_avg: ts.ranks?.avg,
    volumeTotal: ts.volumeTotal,
    volume_in24h: ts.volume?.[TokenPurchaseAge.IN_24_H],
    volume_in48h: ts.volume?.[TokenPurchaseAge.IN_48_H],
    volume_in7d: ts.volume?.[TokenPurchaseAge.IN_7_D],
    stakes_static_amount: ts.stakes?.[StakeType.STATIC]?.amount,
    stakes_static_totalAmount: ts.stakes?.[StakeType.STATIC]?.totalAmount,
    stakes_static_value: ts.stakes?.[StakeType.STATIC]?.value,
    stakes_static_totalValue: ts.stakes?.[StakeType.STATIC]?.totalValue,
    stakes_static_stakingMembersCount: ts.stakes?.[StakeType.STATIC]?.stakingMembersCount,
    stakes_dynamic_amount: ts.stakes?.[StakeType.DYNAMIC]?.amount,
    stakes_dynamic_totalAmount: ts.stakes?.[StakeType.DYNAMIC]?.totalAmount,
    stakes_dynamic_value: ts.stakes?.[StakeType.DYNAMIC]?.value,
    stakes_dynamic_totalValue: ts.stakes?.[StakeType.DYNAMIC]?.totalValue,
    stakes_dynamic_stakingMembersCount: ts.stakes?.[StakeType.DYNAMIC]?.stakingMembersCount,
    stakeExpiry: ts.stakeExpiry,
  });

  fromPg = (pg: PgTokenStats): TokenStats =>
    removeNulls({
      project: pg.project,
      parentId: pg.parentId,
      parentCol: COL.TOKEN,
      volumeTotal: pg.volumeTotal || 0,
      volume: {
        [TokenPurchaseAge.IN_24_H]: pg.volume_in24h || 0,
        [TokenPurchaseAge.IN_48_H]: pg.volume_in48h || 0,
        [TokenPurchaseAge.IN_7_D]: pg.volume_in7d || 0,
      },
      stakes: {
        [StakeType.STATIC]: {
          amount: pg.stakes_static_amount || 0,
          totalAmount: pg.stakes_static_totalAmount || 0,
          value: pg.stakes_static_value || 0,
          totalValue: pg.stakes_static_totalValue || 0,
          stakingMembersCount: pg.stakes_static_stakingMembersCount || 0,
        },
        [StakeType.DYNAMIC]: {
          amount: pg.stakes_dynamic_amount || 0,
          totalAmount: pg.stakes_dynamic_totalAmount || 0,
          value: pg.stakes_dynamic_value || 0,
          totalValue: pg.stakes_dynamic_totalValue || 0,
          stakingMembersCount: pg.stakes_dynamic_stakingMembersCount || 0,
        },
      },
      votes: {
        upvotes: pg.votes_upvotes || 0,
        downvotes: pg.votes_downvotes || 0,
        voteDiff: pg.votes_voteDiff || 0,
      },
      ranks: {
        sum: pg.ranks_sum || 0,
        avg: pg.ranks_avg || 0,
        count: pg.ranks_count || 0,
      },
      stakeExpiry: pg.stakeExpiry as { [key: string]: { [key: number]: number } },
    });
}
