/* eslint-disable @typescript-eslint/no-explicit-any */

import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Member,
  SUB_COL,
  StakeType,
  TokenDistribution,
  TokenDrop,
  TokenDropStatus,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { getAddress } from '../../src/utils/address.utils';
import { wait } from '../../test/controls/common';
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

  it('Multiplier should be max 2', async () => {
    const stakeType = StakeType.DYNAMIC;
    const drops = [
      {
        count: 1,
        recipient: helper.member!,
        vestingAt: dayjs().add(80, 'y').toDate(),
        stakeType,
      },
    ];
    mockWalletReturnValue(helper.guardian!, {
      token: helper.token!.uid,
      drops,
    });
    let order = await testEnv.wrap<Transaction>(WEN_FUNC.airdropMintedToken);

    const airdropQuery = build5Db().collection(COL.AIRDROP).where('member', '==', helper.member);
    let airdropsSnap = await airdropQuery.get();
    expect(airdropsSnap.length).toBe(1);
    const airdrop = <TokenDrop>airdropsSnap[0];
    expect(airdrop.vestingAt.toDate()).toEqual(drops[0].vestingAt);
    expect(airdrop.count).toEqual(drops[0].count);
    expect(airdrop.member).toEqual(drops[0].recipient);
    expect(airdrop.stakeType).toEqual(drops[0].stakeType);
    expect(airdrop.token).toEqual(helper.token?.uid!);
    expect(airdrop.status).toEqual(TokenDropStatus.DEPOSIT_NEEDED);

    const guardianDocRef = build5Db().doc(COL.MEMBER, helper.guardian);
    const guardian = <Member>await guardianDocRef.get();
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

    await helper.walletService!.send(guardianAddress, order.payload.targetAddress!, 0, {
      nativeTokens: [{ id: helper.token?.mintingData?.tokenId!, amount: BigInt(1) }],
    });

    await wait(async () => {
      const airdropsSnap = await airdropQuery.get();
      return airdropsSnap.length === 1 && airdropsSnap[0]?.status === TokenDropStatus.UNCLAIMED;
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
      const docRef = build5Db().doc(COL.TRANSACTION, order.uid);
      order = <Transaction>await docRef.get();
      return order.payload.unclaimedAirdrops === 0;
    });

    await awaitTransactionConfirmationsForToken(helper.token!.uid);

    const distributionDocRef = build5Db().doc(
      COL.TOKEN,
      helper.token!.uid,
      SUB_COL.DISTRIBUTION,
      helper.member,
    );
    const distribution = <TokenDistribution | undefined>await distributionDocRef.get();
    expect(distribution?.stakes![stakeType].value).toBe(2);

    airdropsSnap = await airdropQuery.get();
    expect(airdropsSnap.length).toBe(1);
    expect((<TokenDrop>airdropsSnap[0]).status).toBe(TokenDropStatus.CLAIMED);
  });
});
