/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  StakeType,
  SUB_COL,
  TokenDrop,
  TokenDropStatus,
  Transaction,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { migrateAirdropOrders } from '../../scripts/dbUpgrades/0_17/airdrop.order.roll';
import { migrateAirdrops } from '../../scripts/dbUpgrades/0_17/airdrop.roll';
import admin from '../../src/admin.config';
import { airdropMintedToken } from '../../src/controls/token-minting/airdrop-minted-token';
import { claimMintedTokenOrder } from '../../src/controls/token-minting/claim-minted-token.control';
import { getAddress } from '../../src/utils/address.utils';
import { cOn, dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
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

  it('Should migrate and claim', async () => {
    const guardian = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${helper.guardian}`).get()).data()
    );
    const guardianAddress = await helper.walletService!.getAddressDetails(
      getAddress(guardian, helper.network),
    );
    await requestFundsFromFaucet(helper.network, guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);

    const drops = [
      { count: 1, recipient: helper.member!, vestingAt: dayjs().add(2, 'h').toDate() },
      { count: 1, recipient: helper.member!, vestingAt: dayjs().add(2, 'h').toDate() },
    ];
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      token: helper.token!.uid,
      drops,
    });
    let order = await testEnv.wrap(airdropMintedToken)({});
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      guardianAddress,
      helper.token!.mintingData?.tokenId!,
      VAULT_MNEMONIC,
      3,
    );

    const stakeAirdrop: TokenDrop = {
      uid: getRandomEthAddress(),
      createdBy: 'system',
      member: helper.member!,
      token: helper.token?.uid!,
      vestingAt: dateToTimestamp(dayjs().add(1, 'y')),
      count: 1,
      status: TokenDropStatus.UNCLAIMED,
      sourceAddress: helper.space?.vaultAddress,
      stakeRewardId: getRandomEthAddress(),
      stakeType: StakeType.DYNAMIC,
    };
    await admin.firestore().doc(`${COL.AIRDROP}/${stakeAirdrop.uid}`).create(cOn(stakeAirdrop));

    await helper.walletService!.send(guardianAddress, order.payload.targetAddress, 0, {
      nativeTokens: [{ id: helper.token?.mintingData?.tokenId!, amount: (2).toString(16) }],
    });
    await admin
      .firestore()
      .doc(`${COL.MNEMONIC}/${guardianAddress.bech32}`)
      .update({ consumedOutputIds: [] });
    await wait(async () => {
      const airdrops = await helper.getAirdropsForMember(helper.member!);
      return airdrops.length === 3;
    });

    await helper.walletService!.send(guardianAddress, helper.space?.vaultAddress!, 0, {
      nativeTokens: [{ id: helper.token?.mintingData?.tokenId!, amount: (1).toString(16) }],
    });
    await admin
      .firestore()
      .doc(`${COL.MNEMONIC}/${guardianAddress.bech32}`)
      .update({ consumedOutputIds: [] });

    let airdrops = await helper.getAirdropsForMember(helper.member!);
    const tokenDrops = airdrops.map((airdrop) => ({
      createdOn: airdrop.createdOn,
      orderId: airdrop.orderId || null,
      sourceAddress: airdrop.sourceAddress || null,
      vestingAt: airdrop.vestingAt,
      count: airdrop.count,
      uid: airdrop.uid,
      stakeRewardId: airdrop.stakeRewardId || null,
      stakeType: airdrop.stakeType || null,
    }));
    for (const airdrop of airdrops) {
      await admin.firestore().doc(`${COL.AIRDROP}/${airdrop.uid}`).delete();
    }
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token?.uid}/${SUB_COL.DISTRIBUTION}/${helper.member}`)
      .set(
        { parentCol: COL.TOKEN, parentId: helper.token?.uid, uid: helper.member!, tokenDrops },
        { merge: true },
      );

    await admin
      .firestore()
      .doc(`${COL.TRANSACTION}/${order.uid}`)
      .update({
        'payload.totalAirdropCount': admin.firestore.FieldValue.delete(),
        'payload.unclaimedAirdrops': admin.firestore.FieldValue.delete(),
        'payload.drops': airdrops
          .filter((a) => isEmpty(a.stakeRewardId))
          .map((airdrop) => ({
            vestingAt: airdrop.vestingAt.toDate(),
            count: airdrop.count,
            recipient: airdrop.member,
          })),
      });

    await migrateAirdrops(admin.app());
    await migrateAirdropOrders(admin.app());

    mockWalletReturnValue(helper.walletSpy, helper.member!, {
      token: helper.token!.uid,
    });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(
      helper.network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );

    await wait(async () => {
      const orderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`);
      order = <Transaction>(await orderDocRef.get()).data();
      return order.payload.unclaimedAirdrops === 0;
    });

    airdrops = await helper.getAirdropsForMember(helper.member!, TokenDropStatus.CLAIMED);
    expect(airdrops.length).toBe(3);

    const billPayments = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('member', '==', helper.member)
        .get()
    ).docs.map((d) => d.data() as Transaction);
    expect(billPayments.length).toBe(3);

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
