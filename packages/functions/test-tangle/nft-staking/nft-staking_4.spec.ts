import {
  COL,
  Network,
  Nft,
  StakeType,
  Transaction,
  TransactionType,
  WenError,
} from '@build5/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
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

  it.each([true, false])('Should credit first then stake', async (migration: boolean) => {
    let nft = await helper.createAndOrderNft();
    let nftDocRef = soonDb().doc(`${COL.NFT}/${nft.uid}`);
    await helper.mintCollection();
    nft = <Nft>await nftDocRef.get();
    await helper.withdrawNftAndAwait(nft.uid);

    if (migration) {
      await nftDocRef.delete();
      await soonDb().doc(`${COL.COLLECTION}/${nft.collection}`).delete();
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

    const creditQuery = soonDb()
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

    const extraRequired = credit.payload.response.requiredAmount - nft.mintingData?.storageDeposit!;
    await helper.sendNftToAddress(
      helper.guardianAddress!,
      stakeNftOrder.payload.targetAddress,
      undefined,
      nft.mintingData?.nftId,
      extraRequired,
    );

    const stakeQuery = soonDb()
      .collection(COL.NFT_STAKE)
      .where('nft', '==', migration ? nft.mintingData?.nftId : nft.uid);
    await wait(async () => {
      const snap = await stakeQuery.get();
      return snap.length === 1;
    });
  });
});
