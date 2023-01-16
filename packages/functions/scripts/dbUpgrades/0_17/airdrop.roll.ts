/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BaseSubCollection,
  COL,
  StakeType,
  SUB_COL,
  TokenDrop,
  TokenDropStatus,
} from '@soonaverse/interfaces';
import { randomUUID } from 'crypto';
import { App } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { isEmpty, last } from 'lodash';
import admin from '../../../src/admin.config';

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
      const distDocRef = snap.docs[i].ref;
      const tokenDropsPromises = (distribution.tokenDrops || []).map(async (drop) => {
        const airdrop = dropToAirdrop(distribution, drop, false);
        await saveAirdrop(distDocRef, drop, airdrop, false, db);
      });

      const tokenDropsHistoryPromises = (distribution.tokenDropsHistory || []).map(async (drop) => {
        const airdrop = dropToAirdrop(distribution, drop, true);
        await saveAirdrop(distDocRef, drop, airdrop, true, db);
      });

      await Promise.all([...tokenDropsPromises, ...tokenDropsHistoryPromises]);

      if (!isEmpty(distribution.tokenDrops) || !isEmpty(distribution.tokenDropsHistory)) {
        ++count;
      }
    }
  } while (lastDoc);
  console.log(`${count} distributions updated`);
  return count;
};

const saveAirdrop = async (
  distDocRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
  old: PrevTokenDrop,
  airdrop: TokenDrop,
  isHist: boolean,
  db: admin.firestore.Firestore,
) => {
  const batch = db.batch();
  batch.update(distDocRef, {
    [isHist ? 'tokenDropsHistory' : 'tokenDrops']: FieldValue.arrayRemove(old),
  });
  batch.set(db.doc(`${COL.AIRDROP}/${airdrop.uid}`), airdrop);
  await batch.commit();
};

const dropToAirdrop = (distribution: PrevTokenDistribution, drop: PrevTokenDrop, isHist: boolean) =>
  <TokenDrop>{
    createdOn: drop.createdOn || Timestamp.now(),
    uid: drop.uid || randomUUID(),
    member: distribution.uid,
    token: distribution.parentId,
    vestingAt: drop.vestingAt || Timestamp.now(),
    count: drop.count || 0,
    status: isHist ? TokenDropStatus.CLAIMED : TokenDropStatus.UNCLAIMED,

    orderId: drop.orderId || null,
    sourceAddress: drop.sourceAddress || null,
    stakeRewardId: drop.stakeRewardId || null,
    stakeType: drop.stakeType || null,
  };

export const roll = migrateAirdrops;
