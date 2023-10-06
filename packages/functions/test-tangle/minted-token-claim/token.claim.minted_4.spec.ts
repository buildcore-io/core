/* eslint-disable @typescript-eslint/no-explicit-any */

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

const VAULT_MNEMONIC =
  'senior orphan field peasant pioneer fox enjoy excite denial lyrics crowd wash peasant chat taxi jungle copper awesome item demand roast spread couple cube';
const MINTED_TOKEN_ID =
  '0x08f5bee0f3a87cbf93cd9b5395fb185edb85a09a9548b67b13f578098b77970a330100000000';
