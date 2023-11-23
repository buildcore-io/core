import { build5Db } from '@build-5/database';
import {
  COL,
  Space,
  Token,
  TokenAllocation,
  TokenDrop,
  TokenDropStatus,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { airdropToken, createToken } from '../../../src/runtime/firebase/token/base';
import { dateToTimestamp } from '../../../src/utils/dateTime.utils';
import * as wallet from '../../../src/utils/wallet.utils';
import { MEDIA, testEnv } from '../../set-up';
import {
  createMember,
  createSpace,
  expectThrow,
  getRandomSymbol,
  mockWalletReturnValue,
} from '../common';

let walletSpy: any;

const dummyToken = (space: string) =>
  ({
    name: 'MyToken',
    symbol: getRandomSymbol(),
    space,
    totalSupply: 1000,
    allocations: <TokenAllocation[]>[{ title: 'Allocation1', percentage: 100 }],
    icon: MEDIA,
    overviewGraphics: MEDIA,
    termsAndConditions: 'https://wen.soonaverse.com/token/terms-and-conditions',
    access: 0,
    decimals: 6,
  }) as any;

describe('Token airdrop test', () => {
  let guardian: string;
  let member: string;
  let space: Space;
  let token: Token;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardian = await createMember(walletSpy);
    space = await createSpace(walletSpy, guardian);
    const dummyTokenData = dummyToken(space.uid);
    dummyTokenData.saleStartDate = dayjs().add(8, 'day').toDate();
    dummyTokenData.saleLength = 86400000;
    dummyTokenData.coolDownLength = 86400000;
    dummyTokenData.allocations = [
      { title: 'Private', percentage: 90 },
      { title: 'Public', percentage: 10, isPublicSale: true },
    ];
    mockWalletReturnValue(walletSpy, guardian, dummyTokenData);
    token = await testEnv.wrap(createToken)({});
    member = await createMember(walletSpy);
    await build5Db().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: true });
  });

  it('Should fail, token not approved', async () => {
    await build5Db().doc(`${COL.TOKEN}/${token.uid}`).update({ approved: false });
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 900, recipient: guardian, vestingAt: dayjs().toDate() }],
    };
    mockWalletReturnValue(walletSpy, guardian, airdropRequest);
    await expectThrow(testEnv.wrap(airdropToken)({}), WenError.token_not_approved.key);
  });

  it('Should airdrop token', async () => {
    const vestingAt = dayjs().toDate();
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 900, recipient: guardian, vestingAt }],
    };
    mockWalletReturnValue(walletSpy, guardian, airdropRequest);
    await testEnv.wrap(airdropToken)({});

    const airdrops = await getAirdropsForMember(guardian);
    expect(airdrops.length).toBe(1);
    expect(airdrops[0].count).toBe(900);
    expect(airdrops[0].vestingAt).toEqual(dateToTimestamp(vestingAt));
    expect(airdrops[0].member).toBe(guardian);
    expect(airdrops[0].token).toBe(token.uid);
    expect(airdrops[0].createdBy).toBe(guardian);
    expect(airdrops[0].status).toBe(TokenDropStatus.UNCLAIMED);
  });

  it('Should airdrop token with no space', async () => {
    await build5Db().doc(`${COL.TOKEN}/${token.uid}`).update({ space: '' });
    const vestingAt = dayjs().toDate();
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 900, recipient: guardian, vestingAt }],
    };

    mockWalletReturnValue(walletSpy, member, airdropRequest);
    await expectThrow(
      testEnv.wrap(airdropToken)({}),
      WenError.you_must_be_the_creator_of_this_token.key,
    );

    mockWalletReturnValue(walletSpy, guardian, airdropRequest);
    await testEnv.wrap(airdropToken)({});

    const airdrops = await getAirdropsForMember(guardian);
    expect(airdrops.length).toBe(1);
    expect(airdrops[0].count).toBe(900);
    expect(airdrops[0].vestingAt).toEqual(dateToTimestamp(vestingAt));
    expect(airdrops[0].member).toBe(guardian);
    expect(airdrops[0].token).toBe(token.uid);
    expect(airdrops[0].createdBy).toBe(guardian);
    expect(airdrops[0].status).toBe(TokenDropStatus.UNCLAIMED);
  });

  it('Should create 900 airdrops', async () => {
    const vestingAt = dayjs().toDate();
    const airdropRequest = {
      token: token.uid,
      drops: Array.from(Array(900)).map(() => ({ count: 1, recipient: guardian, vestingAt })),
    };
    mockWalletReturnValue(walletSpy, guardian, airdropRequest);
    await testEnv.wrap(airdropToken)({});

    const airdrops = await getAirdropsForMember(guardian);
    expect(airdrops.length).toBe(900);
  });

  it('Should airdrop batch token', async () => {
    const vestingAt = dayjs().toDate();
    const airdropRequest = {
      token: token.uid,
      drops: [
        { count: 800, recipient: guardian, vestingAt },
        { count: 100, recipient: member, vestingAt },
      ],
    };
    mockWalletReturnValue(walletSpy, guardian, airdropRequest);
    await testEnv.wrap(airdropToken)({});

    const airdrops = (await getAirdropsForToken(token.uid)).sort((a, b) => b.count - a.count);
    expect(airdrops.length).toBe(2);
    expect(airdrops[0].count).toBe(800);
    expect(airdrops[0].vestingAt).toEqual(dateToTimestamp(vestingAt));
    expect(airdrops[0].member).toBe(guardian);
    expect(airdrops[1].count).toBe(100);
    expect(airdrops[1].vestingAt).toEqual(dateToTimestamp(vestingAt));
    expect(airdrops[1].member).toBe(member);
  });

  it('Should throw, not enough tokens', async () => {
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 1000, recipient: guardian, vestingAt: dayjs().toDate() }],
    };
    mockWalletReturnValue(walletSpy, guardian, airdropRequest);
    await expectThrow(testEnv.wrap(airdropToken)({}), WenError.no_tokens_available_for_airdrop.key);
  });

  it('Should throw, no vesting', async () => {
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 1000, recipient: guardian }],
    };
    mockWalletReturnValue(walletSpy, guardian, airdropRequest);
    await expectThrow(testEnv.wrap(airdropToken)({}), WenError.invalid_params.key);
  });

  it('Should throw, not guardian', async () => {
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 50, recipient: guardian, vestingAt: dayjs().toDate() }],
    };
    mockWalletReturnValue(walletSpy, member, airdropRequest);
    await expectThrow(testEnv.wrap(airdropToken)({}), WenError.you_are_not_guardian_of_space.key);
  });

  it('Should throw at second drop', async () => {
    const vestingAt = dayjs();
    const airdropRequest = {
      token: token.uid,
      drops: [{ count: 900, recipient: guardian, vestingAt: vestingAt.toDate() }],
    };
    mockWalletReturnValue(walletSpy, guardian, airdropRequest);
    await testEnv.wrap(airdropToken)({});
    const airdrops = await getAirdropsForMember(guardian);
    expect(airdrops.length).toBe(1);
    expect(airdrops[0].count).toBe(900);
    expect(airdrops[0].vestingAt).toEqual(dateToTimestamp(vestingAt));
    expect(airdrops[0].member).toBe(guardian);

    const airdropRequest2 = {
      token: token.uid,
      drops: [{ count: 100, recipient: guardian, vestingAt: dayjs().toDate() }],
    };
    mockWalletReturnValue(walletSpy, guardian, airdropRequest2);
    await expectThrow(testEnv.wrap(airdropToken)({}), WenError.no_tokens_available_for_airdrop.key);
  });

  it('Should drop multiple for same user', async () => {
    const vestingAt = dayjs().toDate();
    const airdropRequest = {
      token: token.uid,
      drops: [
        { count: 400, recipient: guardian, vestingAt },
        { count: 50, recipient: member, vestingAt },
      ],
    };
    mockWalletReturnValue(walletSpy, guardian, airdropRequest);
    await testEnv.wrap(airdropToken)({});
    await testEnv.wrap(airdropToken)({});

    const guardianDrops = await getAirdropsForMember(guardian);
    expect(guardianDrops.length).toBe(2);
    const memberDrops = await getAirdropsForMember(member);
    expect(memberDrops.length).toBe(2);
  });
});

const getAirdropsForMember = async (member: string) => {
  const snap = await build5Db().collection(COL.AIRDROP).where('member', '==', member).get();
  return snap.map((d) => d as TokenDrop);
};

const getAirdropsForToken = async (token: string) => {
  const snap = await build5Db().collection(COL.AIRDROP).where('token', '==', token).get();
  return snap.map((d) => d as TokenDrop);
};
