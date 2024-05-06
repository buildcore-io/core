import { database } from '@buildcore/database';
import {
  COL,
  Rank,
  RANKING_TEST,
  Space,
  SUB_COL,
  Token,
  TokenAllocation,
  TokenStats,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import * as wallet from '../../../src/utils/wallet.utils';
import { MEDIA, mockWalletReturnValue, testEnv } from '../../set-up';
import {
  createRoyaltySpaces,
  expectThrow,
  getRandomSymbol,
  setProdTiers,
  setTestTiers,
  wait,
} from '../common';

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

describe('Token rank test', () => {
  let member: string;
  let space: Space;
  let token: any;

  beforeAll(async () => {
    await createRoyaltySpaces();
  });

  beforeEach(async () => {
    member = await testEnv.createMember();
    space = await testEnv.createSpace(member);

    mockWalletReturnValue(member, dummyToken(space.uid));
    token = await testEnv.wrap(WEN_FUNC.createToken);

    await database().doc(COL.SPACE, RANKING_TEST.tokenSpace, SUB_COL.GUARDIANS, member).upsert({
      parentId: RANKING_TEST.tokenSpace,
    });
  });

  it('Should throw, no token', async () => {
    mockWalletReturnValue(member, {
      collection: COL.TOKEN,
      uid: wallet.getRandomEthAddress(),
      rank: 1,
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.rankController), WenError.token_does_not_exist.key);
  });

  it('Should throw, invalid rank', async () => {
    mockWalletReturnValue(member, {
      collection: COL.TOKEN,
      uid: token.uid,
      rank: 200,
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.rankController), WenError.invalid_params.key);
  });

  it('Should throw, no soons staked', async () => {
    await setProdTiers();

    mockWalletReturnValue(member, {
      collection: COL.TOKEN,
      uid: token.uid,
      rank: 1,
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.rankController), WenError.no_staked_soon.key);

    await setTestTiers();
  });

  it('Should throw, not space member', async () => {
    await database().doc(COL.SPACE, RANKING_TEST.tokenSpace, SUB_COL.GUARDIANS, member).delete();

    mockWalletReturnValue(member, {
      collection: COL.TOKEN,
      uid: token.uid,
      rank: 1,
    });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.rankController),
      WenError.you_are_not_guardian_of_space.key,
    );
  });

  const validateStats = async (count: number, sum: number) => {
    await wait(async () => {
      const statsDocRef = database().doc(COL.TOKEN, token.uid, SUB_COL.STATS, token.uid);
      const stats = <TokenStats | undefined>await statsDocRef.get();
      const statsAreCorrect =
        stats?.ranks?.count === count &&
        stats?.ranks?.sum === sum &&
        stats?.ranks?.avg === Number((stats?.ranks?.sum! / stats?.ranks?.count!).toFixed(3));

      const tokenDocRef = database().doc(COL.TOKEN, token.uid);
      token = <Token>await tokenDocRef.get();
      return (
        statsAreCorrect &&
        token.rankCount === count &&
        token.rankSum === sum &&
        token.rankAvg === Number((token.rankSum / token.rankCount).toFixed(3))
      );
    });
  };

  const sendRank = async (rankValue: number) => {
    mockWalletReturnValue(member, {
      collection: COL.TOKEN,
      uid: token.uid,
      rank: rankValue,
    });
    const rank = await testEnv.wrap<Rank>(WEN_FUNC.rankController);
    expect(rank.uid).toBe(member);
    expect(rank.parentId).toBe(token.uid);
    expect(rank.parentCol).toBe(COL.TOKEN);
    expect(rank.rank).toBe(rankValue);
  };

  it('Should rank', async () => {
    await sendRank(100);
    await validateStats(1, 100);

    await sendRank(-50);
    await validateStats(1, -50);
  });
});
