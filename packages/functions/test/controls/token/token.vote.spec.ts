import { COL, Space, SUB_COL, TokenAllocation, TokenStats, WenError } from '@build5/interfaces';
import { soonDb } from '../../../src/firebase/firestore/soondb';
import { createToken } from '../../../src/runtime/firebase/token/base';
import { voteController } from '../../../src/runtime/firebase/vote';
import * as config from '../../../src/utils/config.utils';
import * as wallet from '../../../src/utils/wallet.utils';
import { MEDIA, testEnv } from '../../set-up';
import {
  createMember,
  createSpace,
  expectThrow,
  getRandomSymbol,
  mockWalletReturnValue,
  saveSoon,
  wait,
} from '../common';

let walletSpy: any;
let isProdSpy: jest.SpyInstance<boolean, []>;

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
  } as any);

describe('Token vote test', () => {
  let memberAddress: string;
  let space: Space;
  let token: any;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    isProdSpy = jest.spyOn(config, 'isProdEnv');
    memberAddress = await createMember(walletSpy);
    space = await createSpace(walletSpy, memberAddress);
    mockWalletReturnValue(walletSpy, memberAddress, dummyToken(space.uid));
    token = await testEnv.wrap(createToken)({});
    await saveSoon();
  });

  it('Should throw, no token', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      collection: COL.TOKEN,
      uid: wallet.getRandomEthAddress(),
      direction: 1,
    });
    await expectThrow(testEnv.wrap(voteController)({}), WenError.token_does_not_exist.key);
  });

  it('Should throw, invalid direction', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      collection: COL.TOKEN,
      uid: token.uid,
      direction: 2,
    });
    await expectThrow(testEnv.wrap(voteController)({}), WenError.invalid_params.key);
  });

  it('Should throw, no soons staked', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      collection: COL.TOKEN,
      uid: token.uid,
      direction: 1,
    });
    isProdSpy.mockReturnValue(true);
    await expectThrow(testEnv.wrap(voteController)({}), WenError.no_staked_soon.key);
    isProdSpy.mockRestore();
  });

  const validateStats = async (upvotes: number, downvotes: number, diff: number) => {
    await wait(async () => {
      const statsDocRef = soonDb().doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.STATS}/${token.uid}`);
      const stats = <TokenStats | undefined>await statsDocRef.get();
      return (
        stats?.votes?.upvotes === upvotes &&
        stats?.votes?.downvotes === downvotes &&
        stats?.votes?.voteDiff === diff
      );
    });
  };

  const sendVote = async (direction: number) => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      collection: COL.TOKEN,
      uid: token.uid,
      direction,
    });
    const vote = await testEnv.wrap(voteController)({});
    expect(vote.uid).toBe(memberAddress);
    expect(vote.parentId).toBe(token.uid);
    expect(vote.parentCol).toBe(COL.TOKEN);
    expect(vote.direction).toBe(direction);
  };

  it('Should vote', async () => {
    await sendVote(1);
    await validateStats(1, 0, 1);

    await sendVote(-1);
    await validateStats(0, 1, -1);

    mockWalletReturnValue(walletSpy, memberAddress, {
      collection: COL.TOKEN,
      uid: token.uid,
      direction: 0,
    });
    const vote = await testEnv.wrap(voteController)({});
    expect(vote).toBe(undefined);
  });
});
