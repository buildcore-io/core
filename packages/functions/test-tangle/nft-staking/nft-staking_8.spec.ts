import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  StakeType,
  Transaction,
  TransactionIgnoreWalletReason,
  TransactionType,
} from '@soonaverse/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { creditUnrefundable } from '../../src/runtime/firebase/credit';
import { stakeNft } from '../../src/runtime/firebase/nft';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Stake nft', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should stake with storage dep', async () => {
    let nft = await helper.createAndOrderNft();
    let nftDocRef = soonDb().doc(`${COL.NFT}/${nft.uid}`);
    await helper.mintCollection();
    nft = <Nft>await nftDocRef.get();
    await helper.withdrawNftAndAwait(nft.uid);

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      network: Network.RMS,
      weeks: 25,
      type: StakeType.DYNAMIC,
    });
    const stakeNftOrder = await testEnv.wrap(stakeNft)({});
    const blockId = await helper.sendNftToAddress(
      helper.guardianAddress!,
      stakeNftOrder.payload.targetAddress,
      undefined,
      nft.mintingData?.nftId,
      MIN_IOTA_AMOUNT,
      undefined,
      true,
    );
    console.log(blockId);

    const creditQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_NFT)
      .where('member', '==', helper.guardian)
      .where(
        'ignoreWalletReason',
        '==',
        TransactionIgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION,
      );
    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return snap.length === 1;
    });

    const snap = await creditQuery.get<Transaction>();
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, { transaction: snap[0].uid });
    const order = await testEnv.wrap(creditUnrefundable)({});
    await requestFundsFromFaucet(Network.RMS, order.payload.targetAddress, order.payload.amount);
  });
});
