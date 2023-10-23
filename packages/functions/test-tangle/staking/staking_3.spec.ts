import { build5Db } from '@build-5/database';
import { COL, Member, MIN_IOTA_AMOUNT, Stake, StakeType } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { removeExpiredStakesFromSpace } from '../../src/cron/stake.cron';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { setProdTiers, setTestTiers, wait } from '../../test/controls/common';
import { requestMintedTokenFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Staking test', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await setProdTiers();
    await helper.beforeEach();
  });

  const validateMemberTradingFee = async (expected: number) => {
    await wait(async () => {
      helper.member = <Member>await build5Db().doc(`${COL.MEMBER}/${helper.member?.uid}`).get();
      return helper.member.tokenTradingFeePercentage === expected;
    });
  };

  const expireStakeAndValidateFee = async (stake: Stake, expectedFee: number) => {
    await build5Db()
      .doc(`${COL.STAKE}/${stake.uid}`)
      .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });
    await removeExpiredStakesFromSpace();
    await validateMemberTradingFee(expectedFee);
  };

  it('Should set member token trading discount', async () => {
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      helper.memberAddress!,
      helper.MINTED_TOKEN_ID,
      helper.VAULT_MNEMONIC,
      7500 * MIN_IOTA_AMOUNT,
    );
    const stake1 = await helper.stakeAmount(
      500 * MIN_IOTA_AMOUNT,
      52,
      undefined,
      StakeType.DYNAMIC,
      undefined,
    );
    await validateMemberTradingFee(2.5 * (1 - 0.25));

    const stake2 = await helper.stakeAmount(
      1500 * MIN_IOTA_AMOUNT,
      52,
      undefined,
      StakeType.DYNAMIC,
      undefined,
    );
    await validateMemberTradingFee(2.5 * (1 - 0.5));

    const stake3 = await helper.stakeAmount(
      1000 * MIN_IOTA_AMOUNT,
      52,
      undefined,
      StakeType.DYNAMIC,
      undefined,
    );
    await validateMemberTradingFee(2.5 * (1 - 0.75));

    const stake4 = await helper.stakeAmount(
      4500 * MIN_IOTA_AMOUNT,
      52,
      undefined,
      StakeType.DYNAMIC,
      undefined,
    );
    await validateMemberTradingFee(0);

    await expireStakeAndValidateFee(stake4, 2.5 * (1 - 0.75));
    await expireStakeAndValidateFee(stake3, 2.5 * (1 - 0.5));
    await expireStakeAndValidateFee(stake2, 2.5 * (1 - 0.25));
    await expireStakeAndValidateFee(stake1, 2.5);
  });

  afterEach(async () => {
    await setTestTiers();
  });
});
