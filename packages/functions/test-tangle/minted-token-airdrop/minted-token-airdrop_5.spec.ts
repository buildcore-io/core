/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  MIN_IOTA_AMOUNT,
  Member,
  SUB_COL,
  TokenDistribution,
  Transaction,
  WEN_FUNC,
  WenError,
} from '@build-5/interfaces';

import { build5Db } from '@build-5/database';
import dayjs from 'dayjs';
import { getAddress } from '../../src/utils/address.utils';
import { expectThrow, wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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

  it('Should airdrop and claim 600', async () => {
    mockWalletReturnValue(helper.guardian!, {
      token: helper.token!.uid,
      drops: Array.from(Array(600)).map(() => ({
        count: 1,
        recipient: helper.member!,
        vestingAt: dayjs().add(1, 'y').toDate(),
      })),
    });
    let order = await testEnv.wrap<Transaction>(WEN_FUNC.airdropMintedToken);
    expect(order.payload.unclaimedAirdrops).toBe(600);

    mockWalletReturnValue(helper.member!, { symbol: helper.token!.symbol });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.claimMintedTokenOrder),
      WenError.no_tokens_to_claim.key,
    );

    const guardian = <Member>await build5Db().doc(COL.MEMBER, helper.guardian).get();
    const guardianAddress = await helper.walletService!.getAddressDetails(
      getAddress(guardian, helper.network),
    );
    await requestFundsFromFaucet(helper.network, guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      guardianAddress,
      helper.token!.mintingData?.tokenId!,
      VAULT_MNEMONIC,
      600,
    );
    await helper.walletService!.send(guardianAddress, order.payload.targetAddress!, 0, {
      nativeTokens: [{ id: helper.token?.mintingData?.tokenId!, amount: BigInt(600) }],
    });

    await wait(async () => {
      const airdrops = await helper.getAirdropsForMember(helper.member!);
      return airdrops.length === 600;
    });

    mockWalletReturnValue(helper.member!, {
      symbol: helper.token!.symbol,
    });
    const claimOrder = await testEnv.wrap<Transaction>(WEN_FUNC.claimMintedTokenOrder);
    await requestFundsFromFaucet(
      helper.network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );

    await wait(async () => {
      const orderDocRef = build5Db().doc(COL.TRANSACTION, order.uid);
      order = <Transaction>await orderDocRef.get();
      return order.payload.unclaimedAirdrops === 0;
    });

    const distributionDocRef = build5Db().doc(
      COL.TOKEN,
      helper.token?.uid,
      SUB_COL.DISTRIBUTION,
      helper.member!,
    );
    const distribution = <TokenDistribution>await distributionDocRef.get();
    expect(distribution.tokenOwned).toBe(600);
    expect(distribution.tokenClaimed).toBe(600);

    const stakesSnap = await build5Db()
      .collection(COL.STAKE)
      .where('member', '==', helper.member)
      .get();
    expect(stakesSnap.length).toBe(600);
  });
});
