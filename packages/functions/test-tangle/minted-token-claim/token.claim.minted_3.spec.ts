/* eslint-disable @typescript-eslint/no-explicit-any */

import { COL, Token, TokenDrop, TokenDropStatus, TransactionType } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { claimMintedTokenOrder } from '../../src/runtime/firebase/token/minting';
import { dateToTimestamp, serverTime } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
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
      createdOn: serverTime(),
      createdBy: helper.guardian.uid!,
      uid: getRandomEthAddress(),
      member: helper.guardian.uid,
      token: helper.token.uid,
      vestingAt: dateToTimestamp(dayjs().add(1, 'd')),
      count: 1,
      status: TokenDropStatus.UNCLAIMED,
    };
    await build5Db().doc(`${COL.AIRDROP}/${airdrop.uid}`).create(airdrop);

    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, { symbol: helper.token.symbol });
    const order = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', helper.guardian.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });

    const tokenData = <Token>await build5Db().doc(`${COL.TOKEN}/${helper.token.uid}`).get();
    expect(tokenData.mintingData?.tokensInVault).toBe(9);

    await awaitTransactionConfirmationsForToken(helper.token.uid);
  });
});

export const VAULT_MNEMONIC =
  'put crisp lecture fine axis route tomato impact analyst insane arm exercise surprise pistol angry sing foil plug medal error extra spatial tongue indoor';
export const MINTED_TOKEN_ID =
  '0x0810f989d9e3f66d147eb8ae6ec102ccbbb419a1b4202df7363f339d279883866c0100000000';
