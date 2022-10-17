import { TIMELOCK_UNLOCK_CONDITION_TYPE } from '@iota/iota.js-next';
import { HexHelper } from '@iota/util.js-next';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import { MAX_WEEKS_TO_STAKE, MIN_IOTA_AMOUNT } from '../../interfaces/config';
import { Member, Network, Space, Stake } from '../../interfaces/models';
import { COL, Timestamp } from '../../interfaces/models/base';
import admin from '../../src/admin.config';
import { depositStake } from '../../src/controls/stake.control';
import { removeExpiredStakesFromSpace } from '../../src/cron/stake.cron';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { SmrWallet } from '../../src/services/wallet/SmrWalletService';
import { AddressDetails, WalletService } from '../../src/services/wallet/wallet';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { MilestoneListener } from '../db-sync.utils';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';

let walletSpy: any;
const network = Network.RMS;

describe('Staking test', () => {
  let listenerRMS: MilestoneListener;
  let member: Member;
  let memberAddress: AddressDetails;
  let space: Space;
  let walletService: SmrWallet;

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    listenerRMS = new MilestoneListener(network);
    walletService = (await WalletService.newWallet(network)) as SmrWallet;
  });

  beforeEach(async () => {
    const memberId = await createMember(walletSpy);
    member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${memberId}`).get()).data();
    memberAddress = await walletService.getAddressDetails(getAddress(member, network));
    space = await createSpace(walletSpy, memberId);
    await requestFundsFromFaucet(network, memberAddress.bech32, 10 * MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(walletService, memberAddress, TOKEN_ID, VAULT_MNEMONIC, 100);
  });

  const stakeAmount = async (amount: number, weeks = 26, expiresAt?: Timestamp) => {
    mockWalletReturnValue(walletSpy, member.uid, { space: space.uid, weeks, network });
    const order = await testEnv.wrap(depositStake)({});
    await walletService.send(memberAddress, order.payload.targetAddress, order.payload.amount, {
      expiration: expiresAt ? { expiresAt, returnAddressBech32: memberAddress.bech32 } : undefined,
      nativeTokens: [{ id: TOKEN_ID, amount: HexHelper.fromBigInt256(bigInt(amount)) }],
    });
    await MnemonicService.store(memberAddress.bech32, memberAddress.mnemonic, Network.RMS);
    const query = admin.firestore().collection(COL.STAKE).where('orderId', '==', order.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.size == 1;
    });
    const stake = <Stake>(await query.get()).docs[0].data();
    expect(stake.amount).toBe(amount);
    expect(stake.member).toBe(member.uid);
    expect(stake.value).toBe(Math.floor(amount * (1 + weeks / MAX_WEEKS_TO_STAKE)));
    expect(stake.weeks).toBe(weeks);
    expect(stake.orderId).toBe(order.uid);

    await wait(async () => {
      const currSpace = <Space>(
        (await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).get()).data()
      );
      return currSpace.staked?.total !== space.staked?.total;
    });
    space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).get()).data();
    return stake;
  };

  const validateSpaceStakeAmount = async (
    totalStakedAmount: number,
    stakedAmount: number,
    stakedAmountValue: number,
  ) => {
    space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).get()).data();
    expect(space.staked?.total).toBe(totalStakedAmount);
    expect(space.staked?.amount).toBe(stakedAmount);
    expect(space.staked?.value).toBe(stakedAmountValue);
  };

  it.each([false, true])(
    'Should set take amount and remove it once expired',
    async (hasExpiration: boolean) => {
      const expiresAt = hasExpiration ? dateToTimestamp(dayjs().add(1, 'h').toDate()) : undefined;

      const stake1 = await stakeAmount(10, 26, expiresAt);
      await validateSpaceStakeAmount(10, 10, 15);

      const stake2 = await stakeAmount(20, 26, expiresAt);
      await validateSpaceStakeAmount(30, 30, 45);

      await removeExpiredStakesFromSpace();
      await validateSpaceStakeAmount(30, 30, 45);

      await admin
        .firestore()
        .doc(`${COL.STAKE}/${stake2.uid}`)
        .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });
      await removeExpiredStakesFromSpace();
      await validateSpaceStakeAmount(30, 10, 15);

      await admin
        .firestore()
        .doc(`${COL.STAKE}/${stake1.uid}`)
        .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });
      await removeExpiredStakesFromSpace();
      await validateSpaceStakeAmount(30, 0, 0);

      const outputs = await walletService.getOutputs(memberAddress.bech32, [], true);
      expect(Object.keys(outputs).length).toBe(2);
      const hasTimelock = Object.values(outputs).filter(
        (o) =>
          o.unlockConditions.find((u) => u.type === TIMELOCK_UNLOCK_CONDITION_TYPE) !== undefined,
      );
      expect(hasTimelock.length).toBe(2);
    },
  );

  it('Should set take amount and remove it once expired, 52 weeks', async () => {
    const stake1 = await stakeAmount(10, 52);
    await validateSpaceStakeAmount(10, 10, 20);

    const stake2 = await stakeAmount(20, 52);
    await validateSpaceStakeAmount(30, 30, 60);

    await removeExpiredStakesFromSpace();
    await validateSpaceStakeAmount(30, 30, 60);

    await admin
      .firestore()
      .doc(`${COL.STAKE}/${stake2.uid}`)
      .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });
    await removeExpiredStakesFromSpace();
    await validateSpaceStakeAmount(30, 10, 20);

    await admin
      .firestore()
      .doc(`${COL.STAKE}/${stake1.uid}`)
      .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });
    await removeExpiredStakesFromSpace();
    await validateSpaceStakeAmount(30, 0, 0);

    const outputs = await walletService.getOutputs(memberAddress.bech32, [], true);
    expect(Object.keys(outputs).length).toBe(2);
    const hasTimelock = Object.values(outputs).filter(
      (o) =>
        o.unlockConditions.find((u) => u.type === TIMELOCK_UNLOCK_CONDITION_TYPE) !== undefined,
    );
    expect(hasTimelock.length).toBe(2);
  });

  afterAll(async () => {
    await listenerRMS.cancel();
  });
});

const TOKEN_ID = '0x08319d70d87e0296576769a768a0dd16953676d01046cea911c3dde62fb00f0eb40100000000';
const VAULT_MNEMONIC =
  'multiply sound whale way attract dentist identify wear much oxygen matter movie harsh oil vintage real island history era galaxy image wonder usage giraffe';
