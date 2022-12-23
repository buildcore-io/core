import {
  COL,
  RANKING_TEST,
  Space,
  SUB_COL,
  Token,
  TokenAllocation,
  TokenStats,
  WenError,
} from '@soonaverse/interfaces';
import admin from '../../../src/admin.config';
import { rankController } from '../../../src/controls/rank.control';
import { createToken } from '../../../src/controls/token.control';
import * as config from '../../../src/utils/config.utils';
import { cOn } from '../../../src/utils/dateTime.utils';
import * as wallet from '../../../src/utils/wallet.utils';
import { MEDIA, testEnv } from '../../set-up';
import {
  createMember,
  createRoyaltySpaces,
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
  } as any);

describe('Token rank test', () => {
  let member: string;
  let space: Space;
  let token: any;

  beforeAll(async () => {
    await createRoyaltySpaces();
  });

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    isProdSpy = jest.spyOn(config, 'isProdEnv');
    member = await createMember(walletSpy);
    space = await createSpace(walletSpy, member);
    mockWalletReturnValue(walletSpy, member, dummyToken(space.uid));
    token = await testEnv.wrap(createToken)({});
    await saveSoon();

    await admin
      .firestore()
      .doc(`${COL.SPACE}/${RANKING_TEST.tokenSpace}/${SUB_COL.GUARDIANS}/${member}`)
      .set(
        cOn({
          uid: member,
          parentId: RANKING_TEST.tokenSpace,
          parentCol: COL.SPACE,
        }),
      );
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
    mockWalletReturnValue(walletSpy, member, {
      collection: COL.TOKEN,
      uid: token.uid,
      rank: 1,
    });
    isProdSpy.mockReturnValue(true);
    await expectThrow(testEnv.wrap(rankController)({}), WenError.no_staked_soon.key);
    isProdSpy.mockRestore();
  });

  it('Should throw, not space member', async () => {
    await admin
      .firestore()
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
      const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
      const statsDocRef = tokenDocRef.collection(SUB_COL.STATS).doc(token.uid);
      const stats = <TokenStats | undefined>(await statsDocRef.get()).data();
      const statsAreCorrect = stats?.ranks?.count === count && stats?.ranks?.sum === sum;

      token = <Token>(await tokenDocRef.get()).data();
      return statsAreCorrect && token.rankCount === count && token.rankSum === sum;
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
