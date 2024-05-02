/* eslint-disable @typescript-eslint/no-explicit-any */

import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Member,
  Network,
  SUB_COL,
  StakeType,
  TangleRequestType,
  TokenDistribution,
  TokenDropStatus,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken, getTangleOrder } from '../common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';
import { Helper, VAULT_MNEMONIC } from './Helper';

describe('Minted token airdrop tangle claim', () => {
  const helper = new Helper();
  let tangleOrder: Transaction;

  beforeAll(async () => {
    await helper.berforeAll();
    tangleOrder = await getTangleOrder(Network.RMS);
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it.each([false, true])('Should drop and claim minted token', async (hasExpiration: boolean) => {
    const expiresAt = hasExpiration ? dateToTimestamp(dayjs().add(2, 'h').toDate()) : undefined;
    const stakeType = hasExpiration ? StakeType.STATIC : StakeType.DYNAMIC;
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
    const airdropOrder = await testEnv.wrap<Transaction>(WEN_FUNC.airdropMintedToken);
    expect(airdropOrder.payload.unclaimedAirdrops).toBe(2);

    const guardian = <Member>await build5Db().doc(COL.MEMBER, helper.guardian).get();
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

    await helper.walletService!.send(guardianAddress, airdropOrder.payload.targetAddress!, 0, {
      expiration: expiresAt
        ? { expiresAt, returnAddressBech32: guardianAddress.bech32 }
        : undefined,
      nativeTokens: [{ id: helper.token?.mintingData?.tokenId!, amount: BigInt(total) }],
    });

    await wait(async () => {
      const airdrops = await helper.getAirdropsForMember(helper.member!);
      return airdrops.length === 2;
    });

    const distributionDocRef = build5Db().doc(
      COL.TOKEN,
      helper.token!.uid,
      SUB_COL.DISTRIBUTION,
      helper.member,
    );
    let distribution = <TokenDistribution>await distributionDocRef.get();
    expect(distribution.totalUnclaimedAirdrop).toBe(2);

    const member = <Member>await build5Db().doc(COL.MEMBER, helper.member).get();
    const memberAddress = await helper.walletService!.getAddressDetails(
      getAddress(member, helper.network),
    );
    await requestFundsFromFaucet(Network.RMS, memberAddress.bech32, 10 * MIN_IOTA_AMOUNT);

    await helper.walletService!.send(
      memberAddress,
      tangleOrder.payload.targetAddress!,
      1 * MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.CLAIM_MINTED_AIRDROPS,
            symbol: helper.token!.symbol,
          },
        },
      },
    );
    await MnemonicService.store(memberAddress.bech32, memberAddress.mnemonic);

    const orderQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.member)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);

    await wait(async () => {
      const snap = await orderQuery.get();
      return snap.length === 1;
    });

    const claimOrder = <Transaction>(await orderQuery.get())[0];
    await helper.walletService!.send(
      memberAddress,
      claimOrder.payload.response!.address as string,
      claimOrder.payload.response!.amount as number,
      {},
    );

    await wait(async () => {
      const orderDocRef = build5Db().doc(COL.TRANSACTION, airdropOrder.uid);
      const order = <Transaction>await orderDocRef.get();
      return order.payload.unclaimedAirdrops === 0;
    });

    const airdrops = await helper.getAirdropsForMember(helper.member!, TokenDropStatus.CLAIMED);
    expect(airdrops.length).toBe(2);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
