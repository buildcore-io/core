/* eslint-disable @typescript-eslint/no-explicit-any */

import { build5Db } from '@build-5/database';
import {
  COL,
  SOON_PROJECT_ID,
  SUB_COL,
  Token,
  TokenDrop,
  TokenDropStatus,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { dateToTimestamp, serverTime } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach(VAULT_MNEMONIC, MINTED_TOKEN_ID);
  });

  it('Claim owned and airdroped-vesting', async () => {
    const distributionDocRef = build5Db().doc(
      COL.TOKEN,
      helper.token.uid,
      SUB_COL.DISTRIBUTION,
      helper.guardian.uid,
    );
    await distributionDocRef.upsert({ tokenOwned: 1 });

    const airdrop: TokenDrop = {
      project: SOON_PROJECT_ID,
      createdOn: serverTime(),
      createdBy: helper.guardian.uid!,
      uid: getRandomEthAddress(),
      member: helper.guardian.uid,
      token: helper.token.uid,
      vestingAt: dateToTimestamp(dayjs().add(1, 'd')),
      count: 1,
      status: TokenDropStatus.UNCLAIMED,
    };
    await build5Db().doc(COL.AIRDROP, airdrop.uid).create(airdrop);

    mockWalletReturnValue(helper.guardian.uid, { symbol: helper.token.symbol });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.claimMintedTokenOrder);
    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', helper.guardian.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 2;
    });
    const billPayments = (await query.get()).map((d) => d as Transaction);
    const vesting = billPayments.filter((bp) => !isEmpty(bp.payload.vestingAt))[0];
    expect(vesting.payload.amount).toBe(50100);
    expect(vesting.payload.nativeTokens![0].amount).toBe(1);

    const unlocked = billPayments.filter((bp) => isEmpty(bp.payload.vestingAt))[0];
    expect(unlocked.payload.amount).toBe(order.payload.amount! - 50100);
    expect(unlocked.payload.nativeTokens![0].amount).toBe(1);

    const tokenData = <Token>await build5Db().doc(COL.TOKEN, helper.token.uid).get();
    expect(tokenData.mintingData?.tokensInVault).toBe(8);
    await awaitTransactionConfirmationsForToken(helper.token.uid);
  });
});

export const VAULT_MNEMONIC =
  'ball rack trash outside mix decade detail unfair select dad concert praise erupt urge cabbage cruise program knock daughter dinosaur exhaust rhythm innocent portion';
export const MINTED_TOKEN_ID =
  '0x08554b7257adc1a7a0d4eea5b3d7d146ce473720f349d17a7bfc31f41c43c22a930100000000';
