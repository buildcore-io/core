/* eslint-disable @typescript-eslint/no-explicit-any */
import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  StakeType,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@build-5/interfaces';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Collection minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should return credits when nft deposit order does not receive nft', async () => {
    mockWalletReturnValue(helper.guardian!, {
      network: Network.RMS,
      weeks: 25,
      type: StakeType.DYNAMIC,
    });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.stakeNft);
    await requestFundsFromFaucet(Network.RMS, order.payload.targetAddress, MIN_IOTA_AMOUNT);

    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', helper.guardian!);
    await wait(async () => {
      const snap = await query.get();
      return (
        snap.length === 1 &&
        snap[0].payload.walletReference?.confirmed &&
        snap[0].payload.amount === MIN_IOTA_AMOUNT
      );
    });
  });
});
