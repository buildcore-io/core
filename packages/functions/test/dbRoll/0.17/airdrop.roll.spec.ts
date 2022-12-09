/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BaseSubCollection,
  COL,
  StakeType,
  SUB_COL,
  Timestamp,
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
    await admin
      .firestore()
      .doc(
        `${COL.TOKEN}/${oldDistribution.parentId}/${SUB_COL.DISTRIBUTION}/${oldDistribution.uid}`,
      )
      .create(oldDistribution);

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
    }
  });
});
