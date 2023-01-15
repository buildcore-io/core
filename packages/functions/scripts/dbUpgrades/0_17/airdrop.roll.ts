/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BaseSubCollection,
  COL,
  StakeType,
  SUB_COL,
  TokenDropStatus,
} from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { isEmpty, last } from 'lodash';

export interface PrevTokenDrop {
  readonly createdOn: Timestamp;
  readonly orderId?: string;
  readonly sourceAddress?: string;
  readonly vestingAt: Timestamp;
  readonly count: number;
  readonly uid: string;
  readonly stakeRewardId?: string;
  readonly stakeType?: StakeType;
}

export interface PrevTokenDistribution extends BaseSubCollection {
  readonly uid: string;
  readonly tokenDrops?: PrevTokenDrop[];
  readonly tokenDropsHistory?: PrevTokenDrop[];
}

export const migrateAirdrops = async (app: App) => {
  const db = getFirestore(app);
  let lastDoc: any | undefined = undefined;
  let count = 0;
  do {
    let query = db.collectionGroup(SUB_COL.DISTRIBUTION).limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const distributions = snap.docs.map((d) => d.data() as PrevTokenDistribution);
    for (let i = 0; i < distributions.length; ++i) {
      const distribution = distributions[i];

      const tokenDropsPromises = (distribution.tokenDrops || []).map((drop) => {
        const airdrop = dropToAirdrop(distribution, drop, false);
        return db.doc(`${COL.AIRDROP}/${airdrop.uid}`).set(airdrop);
      });

      const tokenDropsHistoryPromises = (distribution.tokenDropsHistory || []).map((drop) => {
        const airdrop = dropToAirdrop(distribution, drop, true);
        return db.doc(`${COL.AIRDROP}/${airdrop.uid}`).set(airdrop);
      });

      await Promise.all([...tokenDropsPromises, ...tokenDropsHistoryPromises]);

      await snap.docs[i].ref.update({
        tokenDropsHistory: FieldValue.delete(),
        tokenDrops: FieldValue.delete(),
      });

      if (!isEmpty(distribution.tokenDrops) || !isEmpty(distribution.tokenDropsHistory)) {
        ++count;
      }
    }
  } while (lastDoc);
  console.log(`${count} distributions updated`);
  return count;
};

const dropToAirdrop = (
  distribution: PrevTokenDistribution,
  drop: PrevTokenDrop,
  isHist: boolean,
) => ({
  createdOn: drop.createdOn || Timestamp.now(),
  uid: drop.uid,
  member: distribution.uid,
  token: distribution.parentId,
  vestingAt: drop.vestingAt,
  count: drop.count,
  status: isHist ? TokenDropStatus.CLAIMED : TokenDropStatus.UNCLAIMED,

  orderId: drop.orderId || null,
  sourceAddress: drop.sourceAddress || null,
  stakeRewardId: drop.stakeRewardId || null,
  stakeType: drop.stakeType || null,
});

export const roll = migrateAirdrops;
