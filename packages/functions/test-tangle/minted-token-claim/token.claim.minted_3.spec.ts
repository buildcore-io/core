/* eslint-disable @typescript-eslint/no-explicit-any */

import { database } from '@buildcore/database';
import {
  COL,
  SOON_PROJECT_ID,
  Token,
  TokenDrop,
  TokenDropStatus,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
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

  it('Claim when only airdropped', async () => {
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
    await database().doc(COL.AIRDROP, airdrop.uid).create(airdrop);

    mockWalletReturnValue(helper.guardian.uid, { symbol: helper.token.symbol });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.claimMintedTokenOrder);
    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    const query = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', helper.guardian.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });

    const tokenData = <Token>await database().doc(COL.TOKEN, helper.token.uid).get();
    expect(tokenData.mintingData?.tokensInVault).toBe(9);

    await awaitTransactionConfirmationsForToken(helper.token.uid);
  });
});

export const VAULT_MNEMONIC =
  'put crisp lecture fine axis route tomato impact analyst insane arm exercise surprise pistol angry sing foil plug medal error extra spatial tongue indoor';
export const MINTED_TOKEN_ID =
  '0x0810f989d9e3f66d147eb8ae6ec102ccbbb419a1b4202df7363f339d279883866c0100000000';
