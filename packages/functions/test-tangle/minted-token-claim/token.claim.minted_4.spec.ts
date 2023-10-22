/* eslint-disable @typescript-eslint/no-explicit-any */

import { build5Db } from '@build-5/database';
import {
  COL,
  Token,
  TokenDrop,
  TokenDropStatus,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { retryWallet } from '../../src/cron/wallet.cron';
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

  it('Claim multiple airdropped', async () => {
    for (let i = 0; i < 3; ++i) {
      const airdrop: TokenDrop = {
        createdOn: serverTime(),
        createdBy: helper.guardian.uid!,
        uid: getRandomEthAddress(),
        member: helper.guardian.uid,
        token: helper.token.uid,
        vestingAt: dateToTimestamp(dayjs().add(i + 1, 'd')),
        count: i + 1,
        status: TokenDropStatus.UNCLAIMED,
      };
      await build5Db().doc(`${COL.AIRDROP}/${airdrop.uid}`).create(airdrop);
    }
    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, { symbol: helper.token.symbol });
    const order = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('member', '==', helper.guardian.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 3;
    });

    const tokenData = <Token>await build5Db().doc(`${COL.TOKEN}/${helper.token.uid}`).get();
    expect(tokenData.mintingData?.tokensInVault).toBe(4);

    await wait(async () => {
      const snap = await query.get<Transaction>();
      const processed = snap.filter((d) => !isEmpty(d?.payload?.walletReference?.processedOn));
      return processed.length == 3;
    });

    await wait(async () => {
      const snap = await query.get<Transaction>();
      const confirmed = snap.filter((d) => d!.payload.walletReference?.confirmed).length;
      if (confirmed !== 3) {
        await retryWallet();
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      return confirmed === 3;
    });

    await awaitTransactionConfirmationsForToken(helper.token.uid);
  });
});

export const VAULT_MNEMONIC =
  'question lunch output credit rabbit issue leopard property region egg master engage brief boost resist panda long snow inform whisper second faculty honey super';
export const MINTED_TOKEN_ID =
  '0x08516cf8ebcf220dbbc3dd5dd9cfc6b8ad9a69d598b3ab951268415a55a03ba7520100000000';
