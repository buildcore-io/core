import { database } from '@buildcore/database';
import {
  COL,
  IgnoreWalletReason,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  StakeType,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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

  it('Should not stake with storage dep', async () => {
    let nft = await helper.createAndOrderNft();
    let nftDocRef = database().doc(COL.NFT, nft.uid);
    await helper.mintCollection();
    nft = <Nft>await nftDocRef.get();
    await helper.withdrawNftAndAwait(nft.uid);

    mockWalletReturnValue(helper.guardian!, {
      network: Network.RMS,
      weeks: 25,
      type: StakeType.DYNAMIC,
    });
    const stakeNftOrder = await testEnv.wrap<Transaction>(WEN_FUNC.stakeNft);
    await helper.sendNftToAddress(
      helper.guardianAddress!,
      stakeNftOrder.payload.targetAddress!,
      undefined,
      nft.mintingData?.nftId,
      MIN_IOTA_AMOUNT,
      undefined,
      true,
    );

    let creditQuery = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_NFT)
      .where('member', '==', helper.guardian)
      .where(
        'ignoreWalletReason',
        '==',
        IgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION,
      );
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.length === 1;
    });

    const snap = await creditQuery.get();
    mockWalletReturnValue(helper.guardian!, { transaction: snap[0].uid });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.creditUnrefundable);
    await requestFundsFromFaucet(Network.RMS, order.payload.targetAddress, order.payload.amount);

    creditQuery = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT_STORAGE_DEPOSIT_LOCKED)
      .where('member', '==', helper.guardian);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.length === 1 && snap[0].payload.walletReference?.confirmed;
    });

    const nftStakes = await database()
      .collection(COL.NFT_STAKE)
      .where('member', '==', helper.guardian)
      .get();
    expect(nftStakes.length).toBe(0);
  });
});
