/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BaseSubCollection,
  COL,
  StakeType,
  SUB_COL,
  Timestamp,
  TokenDistribution,
  TokenDrop,
  TokenDropStatus,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { migrateAirdrops } from '../../../scripts/dbUpgrades/0_17/airdrop.roll';
import admin from '../../../src/admin.config';
import { dateToTimestamp } from '../../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

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

describe('Airdrop roll test', () => {
  it('Should roll old airdrop', async () => {
    const tokenId = getRandomEthAddress();
    const member = getRandomEthAddress();
    const now = dayjs();
    const tokenDrops = [
      {
        createdOn: dateToTimestamp(now),
        orderId: getRandomEthAddress(),
        sourceAddress: getRandomEthAddress(),
        vestingAt: dateToTimestamp(now.add(1, 'd')),
        count: 123,
        uid: getRandomEthAddress(),
        stakeRewardId: getRandomEthAddress(),
        stakeType: StakeType.DYNAMIC,
      },
      {
        createdOn: dateToTimestamp(now),
        orderId: getRandomEthAddress(),
        sourceAddress: getRandomEthAddress(),
        vestingAt: dateToTimestamp(now.add(2, 'd')),
        count: 123,
        uid: getRandomEthAddress(),
      },
      {
        createdOn: dateToTimestamp(now),
        orderId: getRandomEthAddress(),
        vestingAt: dateToTimestamp(now.add(3, 'd')),
        count: 123,
        uid: getRandomEthAddress(),
      },
    ];
    const tokenDropsHistory = tokenDrops.map((dr) => ({ ...dr, uid: getRandomEthAddress() }));

    const oldDistribution: PrevTokenDistribution = {
      parentId: tokenId,
      parentCol: COL.TOKEN,
      uid: member,
      tokenDrops,
      tokenDropsHistory,
    };
    const distDocRef = admin
      .firestore()
      .collection(COL.TOKEN)
      .doc(oldDistribution.parentId)
      .collection(SUB_COL.DISTRIBUTION)
      .doc(oldDistribution.uid);
    await distDocRef.create(oldDistribution);

    await migrateAirdrops(admin.app());

    for (const drop of tokenDrops) {
      const airdrop = <TokenDrop>(
        (await admin.firestore().doc(`${COL.AIRDROP}/${drop.uid}`).get()).data()
      );
      expect(airdrop.createdOn).toEqual(drop.createdOn);
      expect(airdrop.orderId || undefined).toEqual(drop.orderId || undefined);
      expect(airdrop.sourceAddress || undefined).toEqual(drop.sourceAddress || undefined);
      expect(airdrop.vestingAt).toEqual(drop.vestingAt);
      expect(airdrop.count).toEqual(drop.count);
      expect(airdrop.stakeRewardId || undefined).toEqual(drop.stakeRewardId || undefined);
      expect(airdrop.stakeType || undefined).toEqual(drop.stakeType || undefined);
      expect(airdrop.status).toBe(TokenDropStatus.UNCLAIMED);
      expect(airdrop.token).toBe(tokenId);
      expect(airdrop.member).toBe(member);
    }

    for (const drop of tokenDropsHistory) {
      const airdrop = <TokenDrop>(
        (await admin.firestore().doc(`${COL.AIRDROP}/${drop.uid}`).get()).data()
      );
      expect(airdrop.createdOn).toEqual(drop.createdOn);
      expect(airdrop.orderId || undefined).toEqual(drop.orderId || undefined);
      expect(airdrop.sourceAddress || undefined).toEqual(drop.sourceAddress || undefined);
      expect(airdrop.vestingAt).toEqual(drop.vestingAt);
      expect(airdrop.count).toEqual(drop.count);
      expect(airdrop.stakeRewardId || undefined).toEqual(drop.stakeRewardId || undefined);
      expect(airdrop.stakeType || undefined).toEqual(drop.stakeType || undefined);
      expect(airdrop.status).toBe(TokenDropStatus.CLAIMED);
      expect(airdrop.token).toBe(tokenId);
      expect(airdrop.member).toBe(member);

      const dist = <TokenDistribution>(await distDocRef.get()).data();
      expect(dist.totalUnclaimedAirdrop).toBe(123 * 3);
    }
  });

  it('Should fail then roll without creating two airdrops', async () => {
    const tokenId = getRandomEthAddress();
    const member = getRandomEthAddress();
    const now = dayjs();
    const tokenDrops = [
      {
        createdOn: dateToTimestamp(now),
        orderId: getRandomEthAddress(),
        vestingAt: dateToTimestamp(now.add(3, 'd')),
        count: 123,
        uid: '',
      },
    ];
    const tokenDropsHistory = tokenDrops.map((dr) => ({ ...dr }));

    const oldDistribution = {
      parentId: tokenId,
      parentCol: COL.TOKEN,
      uid: member,
      tokenDrops,
      tokenDropsHistory,
    };
    const distDocRef = admin
      .firestore()
      .collection(COL.TOKEN)
      .doc(oldDistribution.parentId)
      .collection(SUB_COL.DISTRIBUTION)
      .doc(oldDistribution.uid);

    await distDocRef.create(oldDistribution);
    await distDocRef.update({ parentId: admin.firestore.FieldValue.delete() });

    const airdropQuery = admin.firestore().collection(COL.AIRDROP).where('token', '==', tokenId);
    try {
      await migrateAirdrops(admin.app());
      fail();
    } catch {
      const snap = await airdropQuery.get();
      expect(snap.size).toBe(0);
    }

    await distDocRef.update({ parentId: oldDistribution.parentId });
    await migrateAirdrops(admin.app());

    const snap = await airdropQuery.get();
    expect(snap.size).toBe(2);

    const airdrops = snap.docs.map((doc) => doc.data() as TokenDrop);
    expect(airdrops.filter((a) => a.status === TokenDropStatus.CLAIMED).length).toBe(1);
    expect(airdrops.filter((a) => a.status === TokenDropStatus.UNCLAIMED).length).toBe(1);

    const dist = <TokenDistribution>(await distDocRef.get()).data();
    expect(dist.totalUnclaimedAirdrop).toBe(123);
  });
});
