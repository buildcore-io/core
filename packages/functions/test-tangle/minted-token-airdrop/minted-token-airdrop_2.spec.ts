/* eslint-disable @typescript-eslint/no-explicit-any */

import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Member,
  SOON_PROJECT_ID,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp, serverTime } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Minted token airdrop', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.berforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Mint token, airdrop then claim all', async () => {
    await database().doc(COL.TOKEN, helper.token!.uid).update({
      mintingData_mintedBy: undefined,
      mintingData_mintedOn: undefined,
      mintingData_aliasBlockId: undefined,
      mintingData_aliasId: undefined,
      mintingData_aliasStorageDeposit: undefined,
      mintingData_tokenId: undefined,
      mintingData_blockId: undefined,
      mintingData_foundryStorageDeposit: undefined,
      mintingData_network: undefined,
      mintingData_networkFormat: undefined,
      mintingData_vaultAddress: undefined,
      mintingData_tokensInVault: undefined,
      mintingData_vaultStorageDeposit: undefined,
      mintingData_guardianStorageDeposit: undefined,
      mintingData_meltedTokens: undefined,
      mintingData_circulatingSupply: undefined,
      status: TokenStatus.AVAILABLE,
      totalSupply: Number.MAX_SAFE_INTEGER,
    });
    await database()
      .doc(COL.TOKEN, helper.token!.uid, SUB_COL.DISTRIBUTION, helper.member)
      .upsert({ tokenOwned: 1 });

    const airdrop: TokenDrop = {
      project: SOON_PROJECT_ID,
      createdOn: serverTime(),
      createdBy: helper.guardian!,
      uid: getRandomEthAddress(),
      member: helper.member!,
      token: helper.token!.uid,
      vestingAt: dateToTimestamp(dayjs().add(1, 'd')),
      count: 1,
      status: TokenDropStatus.UNCLAIMED,
    };
    await database().doc(COL.AIRDROP, airdrop.uid).create(airdrop);

    mockWalletReturnValue(helper.guardian!, {
      token: helper.token!.uid,
      network: helper.network,
    });
    const mintingOrder = await testEnv.wrap<Transaction>(WEN_FUNC.mintTokenOrder);
    await requestFundsFromFaucet(
      helper.network,
      mintingOrder.payload.targetAddress,
      mintingOrder.payload.amount,
    );

    const guardian = <Member>await database().doc(COL.MEMBER, helper.guardian).get();
    await requestFundsFromFaucet(
      helper.network,
      getAddress(guardian, helper.network),
      MIN_IOTA_AMOUNT,
    );
    await wait(async () => {
      const tokenDocRef = await database().doc(COL.TOKEN, helper.token!.uid).get();
      return tokenDocRef?.status === TokenStatus.MINTED;
    });

    const drops = [
      { count: 1, recipient: helper.member!, vestingAt: dayjs().subtract(1, 'm').toDate() },
      { count: 1, recipient: helper.member!, vestingAt: dayjs().add(2, 'h').toDate() },
    ];
    mockWalletReturnValue(helper.guardian!, {
      token: helper.token!.uid,
      drops,
    });
    let order = await testEnv.wrap<Transaction>(WEN_FUNC.airdropMintedToken);
    const guardianAddress = await helper.walletService!.getAddressDetails(
      getAddress(guardian, helper.network),
    );
    const token = <Token>await database().doc(COL.TOKEN, helper.token!.uid).get();
    await helper.walletService!.send(guardianAddress, order.payload.targetAddress!, 0, {
      nativeTokens: [{ id: token.mintingData?.tokenId!, amount: BigInt(2) }],
    });

    await wait(async () => {
      const airdrops = await helper.getAirdropsForMember(helper.member!);
      return airdrops.length === 3;
    });

    mockWalletReturnValue(helper.member!, { symbol: helper.token!.symbol });
    const claimOrder = await testEnv.wrap<Transaction>(WEN_FUNC.claimMintedTokenOrder);
    await requestFundsFromFaucet(
      helper.network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );

    const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
    await wait(async () => {
      order = <Transaction>await orderDocRef.get();
      return order.payload.unclaimedAirdrops === 0;
    });

    const distributionDocRef = database().doc(
      COL.TOKEN,
      helper.token!.uid,
      SUB_COL.DISTRIBUTION,
      helper.member,
    );
    const distribution = <TokenDistribution | undefined>await distributionDocRef.get();
    expect(distribution?.tokenOwned).toBe(4);
    expect(distribution?.tokenClaimed).toBe(3);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);

    const billPayments = (
      await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('member', '==', helper.member)
        .get()
    ).map((d) => d as Transaction);
    expect(billPayments.length).toBe(4);

    const credit = (
      await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', order.member)
        .get()
    ).map((d) => <Transaction>d);
    expect(credit.length).toBe(2);

    const member = <Member>await database().doc(COL.MEMBER, helper.member).get();
    const memberAddress = await helper.walletService!.getAddressDetails(
      getAddress(member, helper.network),
    );

    for (const hasTimelock of [false, true]) {
      const outputs = await helper.walletService!.getOutputs(
        memberAddress.bech32,
        [],
        false,
        hasTimelock,
      );
      expect(
        Object.values(outputs).reduce((acc, act) => acc + Number(act.nativeTokens![0].amount), 0),
      ).toBe(2);
    }
  });
});
