/* eslint-disable @typescript-eslint/no-explicit-any */

import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Member,
  SUB_COL,
  StakeType,
  Token,
  TokenDistribution,
  TokenDropStatus,
  TokenStats,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { head } from 'lodash';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { expectThrow, wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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

  it('Should drop and claim minted token', async () => {
    const expiresAt = dateToTimestamp(dayjs().add(2, 'h').toDate());
    const stakeType = StakeType.STATIC;
    const drops = [
      {
        count: 1,
        recipient: helper.member!,
        vestingAt: dayjs().subtract(1, 'm').toDate(),
      },
      { count: 1, recipient: helper.member!, vestingAt: dayjs().add(2, 'M').toDate(), stakeType },
    ];
    const total = drops.reduce((acc, act) => acc + act.count, 0);
    mockWalletReturnValue(helper.guardian!, {
      token: helper.token!.uid,
      drops,
    });
    let order = await testEnv.wrap<Transaction>(WEN_FUNC.airdropMintedToken);
    expect(order.payload.unclaimedAirdrops).toBe(2);

    mockWalletReturnValue(helper.member!, { symbol: helper.token!.symbol });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.claimMintedTokenOrder),
      WenError.no_tokens_to_claim.key,
    );

    const guardian = <Member>await database().doc(COL.MEMBER, helper.guardian).get();
    const guardianAddress = await helper.walletService!.getAddressDetails(
      getAddress(guardian, helper.network),
    );
    await requestFundsFromFaucet(
      helper.network,
      guardianAddress.bech32,
      5 * MIN_IOTA_AMOUNT,
      expiresAt,
    );
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      guardianAddress,
      helper.token!.mintingData?.tokenId!,
      VAULT_MNEMONIC,
      total,
      expiresAt,
    );

    await helper.walletService!.send(guardianAddress, order.payload.targetAddress!, 0, {
      expiration: expiresAt
        ? { expiresAt, returnAddressBech32: guardianAddress.bech32 }
        : undefined,
      nativeTokens: [{ id: helper.token?.mintingData?.tokenId!, amount: BigInt(total) }],
    });

    await wait(async () => {
      const airdrops = await helper.getAirdropsForMember(helper.member!);
      return airdrops.length === 2;
    });

    const distributionDocRef = database().doc(
      COL.TOKEN,
      helper.token!.uid,
      SUB_COL.DISTRIBUTION,
      helper.member,
    );
    let distribution = <TokenDistribution>await distributionDocRef.get();
    expect(distribution.totalUnclaimedAirdrop).toBe(2);

    mockWalletReturnValue(helper.member!, {
      symbol: helper.token!.symbol,
    });
    const claimOrder = await testEnv.wrap<Transaction>(WEN_FUNC.claimMintedTokenOrder);
    const claimOrder2 = await testEnv.wrap<Transaction>(WEN_FUNC.claimMintedTokenOrder);
    await requestFundsFromFaucet(
      helper.network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
      expiresAt,
    );
    await requestFundsFromFaucet(
      helper.network,
      claimOrder2.payload.targetAddress,
      claimOrder2.payload.amount,
      expiresAt,
    );

    await wait(async () => {
      const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
      order = <Transaction>await orderDocRef.get();
      return order.payload.unclaimedAirdrops === 0;
    });

    const airdrops = await helper.getAirdropsForMember(helper.member!, TokenDropStatus.CLAIMED);
    expect(airdrops.length).toBe(2);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);

    const billPayments = (
      await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('member', '==', helper.member)
        .get()
    ).map((d) => d as Transaction);
    expect(billPayments.length).toBe(2);
    billPayments.forEach((billPayment) => {
      expect(billPayment.payload.token).toBe(helper.token!.uid);
      expect(billPayment.payload.tokenSymbol).toBe(helper.token!.symbol);
      expect(billPayment.payload.type).toBe(TransactionPayloadType.MINTED_AIRDROP_CLAIM);
    });
    for (let i = 0; i < drops.length; ++i) {
      expect(
        billPayments.find((bp) => {
          if (dayjs(drops[i].vestingAt).isBefore(dayjs())) {
            return bp.payload.vestingAt === undefined;
          }
          return (
            bp.payload.vestingAt &&
            dayjs(bp.payload.vestingAt.toDate()).isSame(dayjs(drops[i].vestingAt))
          );
        }),
      ).toBeDefined();
    }

    await wait(async () => {
      const snap = await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .whereIn('member', [helper.guardian, helper.member])
        .get();
      return snap.length === 2;
    });

    const { amount } = await helper.walletService!.getBalance(guardianAddress.bech32);
    expect(amount).toBe(5 * MIN_IOTA_AMOUNT);

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
      const sum = Object.values(outputs).reduce(
        (acc, act) => acc + Number(head(act?.nativeTokens)?.amount || 0),
        0,
      );
      expect(sum).toBe(1);
    }

    await awaitTransactionConfirmationsForToken(helper.token?.uid!);

    const tokenUid = helper.token?.uid;

    helper.token = <Token>await database().doc(COL.TOKEN, tokenUid).get();
    expect(helper.token.mintingData?.tokensInVault).toBe(0);

    const statsDocRef = database().doc(COL.TOKEN, tokenUid, SUB_COL.STATS, tokenUid);
    const tokenStats = <TokenStats>await statsDocRef.get();
    expect(tokenStats.stakes![stakeType]?.amount).toBe(1);
    expect(tokenStats.stakes![stakeType]?.totalAmount).toBe(1);
    expect(tokenStats.stakes![stakeType]?.value).toBe(1);
    expect(tokenStats.stakes![stakeType]?.totalValue).toBe(1);

    distribution = <TokenDistribution>await distributionDocRef.get();
    expect(distribution.stakes![stakeType]?.amount).toBe(1);
    expect(distribution.stakes![stakeType]?.totalAmount).toBe(1);
    expect(distribution.stakes![stakeType]?.value).toBe(1);
    expect(distribution.stakes![stakeType]?.totalValue).toBe(1);
    expect(distribution.totalUnclaimedAirdrop).toBe(0);
  });
});
