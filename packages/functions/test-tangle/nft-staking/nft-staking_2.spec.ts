import {
  COL,
  Network,
  Nft,
  StakeType,
  Transaction,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { stakeNft } from '../../src/runtime/firebase/nft';
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

  it.each([false, true])(
    'Should credit nft, not enough base tokens',
    async (migration: boolean) => {
      let nft = await helper.createAndOrderNft();
      let nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
      await helper.mintCollection();
      nft = <Nft>await nftDocRef.get();
      await helper.withdrawNftAndAwait(nft.uid);

      if (migration) {
        await nftDocRef.delete();
        await build5Db().doc(`${COL.COLLECTION}/${nft.collection}`).delete();
      }

      mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
        network: Network.RMS,
        weeks: 25,
        type: StakeType.DYNAMIC,
      });
      const stakeNftOrder = await testEnv.wrap(stakeNft)({});
      await helper.sendNftToAddress(
        helper.guardianAddress!,
        stakeNftOrder.payload.targetAddress,
        undefined,
        nft.mintingData?.nftId,
      );

      const creditQuery = build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT_NFT)
        .where('member', '==', helper.guardian);
      await wait(async () => {
        const snap = await creditQuery.get<Transaction>();
        return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
      });

      const snap = await creditQuery.get();
      const credit = snap[0] as Transaction;
      expect(credit.payload.response.code).toBe(WenError.not_enough_base_token.code);
      expect(credit.payload.response.message).toBe(WenError.not_enough_base_token.key);
      expect(credit.payload.response.requiredAmount).toBeDefined();

      if (migration) {
        nftDocRef = build5Db().doc(`${COL.NFT}/${nft.mintingData?.nftId}`);
        nft = <Nft>await nftDocRef.get();
        expect(nft).toBeUndefined();
      } else {
        nft = <Nft>await nftDocRef.get();
        expect(nft.isOwned).toBe(false);
        expect(nft.owner).toBeNull();
        expect(nft.hidden).toBe(true);
      }
    },
  );
});
