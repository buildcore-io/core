import { build5Db } from '@build-5/database';
import {
  COL,
  RANKING_TEST,
  Space,
  SUB_COL,
  Token,
  TokenAllocation,
  TokenStats,
  WenError,
} from '@build-5/interfaces';
import { rankController } from '../../../src/runtime/firebase/rank';
import { createToken } from '../../../src/runtime/firebase/token/base';
import * as wallet from '../../../src/utils/wallet.utils';
import { MEDIA, testEnv } from '../../set-up';
import {
  createMember,
  createRoyaltySpaces,
  createSpace,
  expectThrow,
  getRandomSymbol,
  mockWalletReturnValue,
  setProdTiers,
  setTestTiers,
  wait,
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

describe('Token rank test', () => {
  let member: string;
  let space: Space;
  let token: any;

  beforeAll(async () => {
    await createRoyaltySpaces();
  });

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    member = await createMember(walletSpy);
    space = await createSpace(walletSpy, member);
    mockWalletReturnValue(walletSpy, member, dummyToken(space.uid));
    token = await testEnv.wrap(createToken)({});

    await build5Db()
      .doc(`${COL.SPACE}/${RANKING_TEST.tokenSpace}/${SUB_COL.GUARDIANS}/${member}`)
      .set({
        uid: member,
        parentId: RANKING_TEST.tokenSpace,
        parentCol: COL.SPACE,
      });
  });

  it('Should throw, no token', async () => {
    mockWalletReturnValue(walletSpy, member, {
      collection: COL.TOKEN,
      uid: wallet.getRandomEthAddress(),
      rank: 1,
    });
    await expectThrow(testEnv.wrap(rankController)({}), WenError.token_does_not_exist.key);
  });

  it('Should throw, invalid rank', async () => {
    mockWalletReturnValue(walletSpy, member, {
      collection: COL.TOKEN,
      uid: token.uid,
      rank: 200,
    });
    await expectThrow(testEnv.wrap(rankController)({}), WenError.invalid_params.key);
  });

  it('Should throw, no soons staked', async () => {
    await setProdTiers();

    mockWalletReturnValue(walletSpy, member, {
      collection: COL.TOKEN,
      uid: token.uid,
      rank: 1,
    });
    await expectThrow(testEnv.wrap(rankController)({}), WenError.no_staked_soon.key);

    await setTestTiers();
  });

  it('Should throw, not space member', async () => {
    await build5Db()
      .doc(`${COL.SPACE}/${RANKING_TEST.tokenSpace}/${SUB_COL.GUARDIANS}/${member}`)
      .delete();

    mockWalletReturnValue(walletSpy, member, {
      collection: COL.TOKEN,
      uid: token.uid,
      rank: 1,
    });
    await expectThrow(testEnv.wrap(rankController)({}), WenError.you_are_not_guardian_of_space.key);
  });

  const validateStats = async (count: number, sum: number) => {
    await wait(async () => {
      const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${token.uid}`);
      const statsDocRef = tokenDocRef.collection(SUB_COL.STATS).doc(token.uid);
      const stats = <TokenStats | undefined>await statsDocRef.get();
      const statsAreCorrect =
        stats?.ranks?.count === count &&
        stats?.ranks?.sum === sum &&
        stats?.ranks?.avg === Number((stats?.ranks?.sum! / stats?.ranks?.count!).toFixed(3));

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
    mockWalletReturnValue(walletSpy, member, {
      collection: COL.TOKEN,
      uid: token.uid,
      rank: rankValue,
    });
    const rank = await testEnv.wrap(rankController)({});
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
