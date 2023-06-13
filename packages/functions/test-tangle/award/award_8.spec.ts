import {
  Award,
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  Token,
  TransactionAwardType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { approveAwardParticipant, createAward, fundAward } from '../../src/runtime/firebase/award';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, createSpace, mockWalletReturnValue, wait } from '../../test/controls/common';
import { MEDIA, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { saveBaseToken } from './common';

const network = Network.RMS;
let walletSpy: any;

describe('Create award, base', () => {
  let guardian: string;
  let member: string;
  let spaces: Space[] = [];
  let awards: Award[] = [];
  let tokens: Token[] = [];

  beforeAll(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
  });

  beforeEach(async () => {
    guardian = await createMember(walletSpy);
    member = await createMember(walletSpy);
    spaces = [await createSpace(walletSpy, guardian), await createSpace(walletSpy, guardian)];

    tokens = [
      await saveBaseToken(spaces[1].uid, guardian),
      await saveBaseToken(spaces[1].uid, guardian),
    ];

    mockWalletReturnValue(walletSpy, guardian, awardRequest(spaces[0].uid, tokens[0].symbol));
    awards[0] = await testEnv.wrap(createAward)({});
    mockWalletReturnValue(walletSpy, guardian, awardRequest(spaces[0].uid, tokens[1].symbol));
    awards[1] = await testEnv.wrap(createAward)({});
    mockWalletReturnValue(walletSpy, guardian, awardRequest(spaces[1].uid, tokens[0].symbol));
    awards[2] = await testEnv.wrap(createAward)({});
  });

  const fundAwardWrapper = async (awardId: string) => {
    mockWalletReturnValue(walletSpy, guardian, { uid: awardId });
    const order = await testEnv.wrap(fundAward)({});
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const awardDocRef = build5Db().doc(`${COL.AWARD}/${awardId}`);
    await wait(async () => {
      const award = <Award>await awardDocRef.get();
      return award.approved && award.funded;
    });
  };

  it('Should update member space properly', async () => {
    let promises = awards.map((award) => fundAwardWrapper(award.uid));
    await Promise.all(promises);

    promises = awards.map((award) => {
      mockWalletReturnValue(walletSpy, guardian, { award: award.uid, members: [member, member] });
      return testEnv.wrap(approveAwardParticipant)({});
    });
    await Promise.all(promises);

    const nttQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('payload.type', '==', TransactionAwardType.BADGE);
    await wait(async () => {
      const snap = await nttQuery.get();
      return snap.length === 6;
    });

    const memberDocRef = build5Db().doc(`${COL.MEMBER}/${member}`);
    const memberData = <Member>await memberDocRef.get();

    assertMemberSpaceAwardStats(
      memberData,
      spaces[0].uid,
      tokens[0],
      4,
      4 * MIN_IOTA_AMOUNT,
      2,
      2 * MIN_IOTA_AMOUNT,
    );
    assertMemberSpaceAwardStats(
      memberData,
      spaces[0].uid,
      tokens[1],
      4,
      4 * MIN_IOTA_AMOUNT,
      2,
      2 * MIN_IOTA_AMOUNT,
    );

    assertMemberSpaceAwardStats(
      memberData,
      spaces[1].uid,
      tokens[0],
      2,
      2 * MIN_IOTA_AMOUNT,
      2,
      2 * MIN_IOTA_AMOUNT,
    );
  });
});

const assertMemberSpaceAwardStats = (
  member: Member,
  spaceId: string,
  token: Token,
  totalCompleted: number,
  totalReward: number,
  completed: number,
  reward: number,
) => {
  const space = member.spaces![spaceId];
  expect(space.awardsCompleted).toBe(totalCompleted);
  expect(space.totalReward).toBe(totalReward);
  const stat = space.awardStat![token.uid];
  expect(stat.completed).toBe(completed);
  expect(stat.totalReward).toBe(reward);
  expect(stat.tokenSymbol).toBe(token.symbol);
};

const awardRequest = (space: string, tokenSymbol: string) => ({
  name: 'award',
  description: 'awarddesc',
  space,
  endDate: dayjs().add(2, 'd').toDate(),
  badge: {
    name: 'badge',
    description: 'badgedesc',
    total: 2,
    image: MEDIA,
    tokenReward: MIN_IOTA_AMOUNT,
    lockTime: 31557600000,
    tokenSymbol,
  },
  network,
});
