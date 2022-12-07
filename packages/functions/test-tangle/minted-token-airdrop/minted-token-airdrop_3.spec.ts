/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  TokenDrop,
  TokenDropStatus,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { airdropMintedToken } from '../../src/controls/token-minting/airdrop-minted-token';
import { claimMintedTokenOrder } from '../../src/controls/token-minting/claim-minted-token.control';
import { getAddress } from '../../src/utils/address.utils';
import { cOn, dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { expectThrow, mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';
import { Helper, VAULT_MNEMONIC } from './Helper';

describe('Minted token airdrop', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.berforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Shoult throw, nothing to claim', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.member!, {
      token: helper.token!.uid,
    });
    await expectThrow(testEnv.wrap(claimMintedTokenOrder)({}), WenError.no_tokens_to_claim.key);
  });

  it('Shoult throw, not enough storage dep sent', async () => {
    const airdrop: TokenDrop = {
      createdBy: helper.guardian!,
      uid: wallet.getRandomEthAddress(),
      member: helper.member!,
      token: helper.token!.uid,
      vestingAt: dateToTimestamp(dayjs().add(1, 'd')),
      count: 1,
      status: TokenDropStatus.UNCLAIMED,
    };
    await admin.firestore().doc(`${COL.AIRDROP}/${airdrop.uid}`).create(cOn(airdrop));

    mockWalletReturnValue(helper.walletSpy, helper.member!, {
      token: helper.token!.uid,
    });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    const amountSent = claimOrder.payload.amount - 1;
    await requestFundsFromFaucet(helper.network, claimOrder.payload.targetAddress, amountSent);

    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', helper.member)
        .get();
      return snap.size === 1 && snap.docs[0].data().payload.amount === amountSent;
    });

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });

  it('Should credit, not enough tokens sent', async () => {
    const drops = [
      { count: 1, recipient: helper.member!, vestingAt: dayjs().subtract(1, 'm').toDate() },
      { count: 1, recipient: helper.member!, vestingAt: dayjs().add(2, 'h').toDate() },
    ];
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      token: helper.token!.uid,
      drops,
    });
    const order = await testEnv.wrap(airdropMintedToken)({});
    const guardian = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${helper.guardian}`).get()).data()
    );
    const guardianAddress = await helper.walletService!.getAddressDetails(
      getAddress(guardian, helper.network),
    );
    await requestFundsFromFaucet(helper.network, guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      guardianAddress,
      helper.token!.mintingData?.tokenId!,
      VAULT_MNEMONIC,
      1,
    );

    await helper.walletService!.send(guardianAddress, order.payload.targetAddress, 0, {
      nativeTokens: [{ id: helper.token?.mintingData?.tokenId!, amount: (1).toString(16) }],
    });
    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', helper.guardian)
        .get();
      return (
        snap.size === 1 &&
        snap.docs[0].data().payload.amount === order.payload.amount &&
        Number(snap.docs[0].data().payload.nativeTokens[0].amount) === 1
      );
    });

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
