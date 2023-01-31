import {
  COL,
  Network,
  Nft,
  StakeType,
  Transaction,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
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

  it('Should credit nft, not enough base tokens', async () => {
    let nft = await helper.createAndOrderNft();
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
    await helper.mintCollection();
    await helper.withdrawNftAndAwait(nft.uid);

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      network: Network.RMS,
      weeks: 25,
      type: StakeType.DYNAMIC,
    });
    const stakeNftOrder = await testEnv.wrap(stakeNft)({});
    nft = <Nft>(await nftDocRef.get()).data();
    await helper.sendNftToAddress(
      helper.guardianAddress!,
      stakeNftOrder.payload.targetAddress,
      undefined,
      nft.mintingData?.nftId,
    );

    const creditQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_NFT)
      .where('member', '==', helper.guardian);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.size === 1;
    });

    const snap = await creditQuery.get();
    const credit = snap.docs[0].data() as Transaction;
    expect(credit.payload.response.code).toBe(WenError.not_enough_base_token.code);
    expect(credit.payload.response.message).toBe(WenError.not_enough_base_token.key);
  });
});
