import { database } from '@buildcore/database';
import {
  COL,
  NetworkAddress,
  Space,
  SUB_COL,
  Token,
  TokenAllocation,
  TokenStats,
  Vote,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';
import { MEDIA, mockWalletReturnValue, testEnv } from '../../set-up';
import { expectThrow, getRandomSymbol, setProdTiers, setTestTiers, wait } from '../common';

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

describe('Token vote test', () => {
  let memberAddress: NetworkAddress;
  let space: Space;
  let token: any;

  beforeEach(async () => {
    memberAddress = await testEnv.createMember();
    space = await testEnv.createSpace(memberAddress);
    mockWalletReturnValue(memberAddress, dummyToken(space.uid));
    token = await testEnv.wrap<Token>(WEN_FUNC.createToken);
  });

  it('Should throw, no token', async () => {
    mockWalletReturnValue(memberAddress, {
      collection: COL.TOKEN,
      uid: getRandomEthAddress(),
      direction: 1,
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.voteController), WenError.token_does_not_exist.key);
  });

  it('Should throw, invalid direction', async () => {
    mockWalletReturnValue(memberAddress, {
      collection: COL.TOKEN,
      uid: token.uid,
      direction: 2,
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.voteController), WenError.invalid_params.key);
  });

  it('Should throw, no soons staked', async () => {
    await setProdTiers();
    mockWalletReturnValue(memberAddress, {
      collection: COL.TOKEN,
      uid: token.uid,
      direction: 1,
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.voteController), WenError.no_staked_soon.key);
    await setTestTiers();
  });

  const validateStats = async (upvotes: number, downvotes: number, diff: number) => {
    await wait(async () => {
      const statsDocRef = database().doc(COL.TOKEN, token.uid, SUB_COL.STATS, token.uid);
      const stats = <TokenStats | undefined>await statsDocRef.get();
      return (
        stats?.votes?.upvotes === upvotes &&
        stats?.votes?.downvotes === downvotes &&
        stats?.votes?.voteDiff === diff
      );
    });
  };

  const sendVote = async (direction: number) => {
    mockWalletReturnValue(memberAddress, {
      collection: COL.TOKEN,
      uid: token.uid,
      direction,
    });
    const vote = await testEnv.wrap<Vote>(WEN_FUNC.voteController);

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
    mockWalletReturnValue(memberAddress, {
      collection: COL.TOKEN,
      uid: token.uid,
      direction: 0,
    });
    const vote = await testEnv.wrap(WEN_FUNC.voteController);

    expect(vote).toEqual({});
  });
});
