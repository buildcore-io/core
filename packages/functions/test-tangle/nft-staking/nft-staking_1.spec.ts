import {
  COL,
  Collection,
  Network,
  Nft,
  NftStake,
  StakeType,
  Transaction,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { stakeNft } from '../../src/runtime/firebase/nft';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Stake nft', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it.each([StakeType.DYNAMIC, StakeType.STATIC])(
    'Should stake nft',
    async (stakeType: StakeType) => {
      let nft = await helper.createAndOrderNft();
      const nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
      await helper.mintCollection();
      await helper.withdrawNftAndAwait(nft.uid);

      mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
        network: Network.RMS,
        weeks: 25,
        type: stakeType,
      });
      let stakeNftOrder = await testEnv.wrap(stakeNft)({});
      nft = <Nft>await nftDocRef.get();
      await helper.sendNftToAddress(
        helper.guardianAddress!,
        stakeNftOrder.payload.targetAddress,
        dateToTimestamp(dayjs().add(2, 'd')),
        nft.mintingData?.nftId,
      );

      const stakeQuery = build5Db().collection(COL.NFT_STAKE).where('nft', '==', nft.uid);
      await wait(async () => {
        const snap = await stakeQuery.get();
        return snap.length === 1;
      });

      const snap = await stakeQuery.get();
      const nftStake = snap[0] as NftStake;
      expect(nftStake.member).toBe(helper.guardian!);
      expect(nftStake.space).toBe(nft.space);
      expect(nftStake.collection).toBe(nft.collection);
      expect(nftStake.nft).toBe(nft.uid);
      expect(nftStake.weeks).toBe(25);
      expect(nftStake.expiresAt).toBeDefined();
      expect(nftStake.expirationProcessed).toBe(false);
      expect(nftStake.type).toBe(stakeType);

      const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${nftStake.collection}`);
      const collection = <Collection>await collectionDocRef.get();
      expect(collection.stakedNft).toBe(1);

      const stakeNftOrderDocRef = build5Db().doc(`${COL.TRANSACTION}/${stakeNftOrder.uid}`);
      stakeNftOrder = <Transaction>await stakeNftOrderDocRef.get();
      expect(stakeNftOrder.payload.nft).toBe(nft.uid);
      expect(stakeNftOrder.payload.collection).toBe(nft.collection);
    },
  );
});
