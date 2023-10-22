import { build5Db } from '@build-5/database';
import {
  COL,
  IgnoreWalletReason,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  StakeType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
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
    let nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
    await helper.mintCollection();
    nft = <Nft>await nftDocRef.get();
    await helper.withdrawNftAndAwait(nft.uid);

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
      MIN_IOTA_AMOUNT,
      undefined,
      true,
    );

    const creditQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_NFT)
      .where('member', '==', helper.guardian)
      .where(
        'ignoreWalletReason',
        '==',
        IgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION,
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
