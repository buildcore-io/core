import { database } from '@buildcore/database';
import {
  Award,
  AwardApproveParticipantResponse,
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  Token,
  Transaction,
  TransactionPayloadType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { wait } from '../../test/controls/common';
import { MEDIA, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { saveBaseToken } from './common';

const network = Network.RMS;

describe('Create award, base', () => {
  let guardian: string;
  let member: string;
  let spaces: Space[] = [];
  let awards: Award[] = [];
  let tokens: Token[] = [];

  beforeAll(async () => {});

  beforeEach(async () => {
    guardian = await testEnv.createMember();
    member = await testEnv.createMember();
    spaces = [await testEnv.createSpace(guardian), await testEnv.createSpace(guardian)];

    tokens = [
      await saveBaseToken(spaces[1].uid, guardian),
      await saveBaseToken(spaces[1].uid, guardian),
    ];

    mockWalletReturnValue(guardian, awardRequest(spaces[0].uid, tokens[0].symbol));
    awards[0] = await testEnv.wrap(WEN_FUNC.createAward);
    mockWalletReturnValue(guardian, awardRequest(spaces[0].uid, tokens[1].symbol));
    awards[1] = await testEnv.wrap(WEN_FUNC.createAward);
    mockWalletReturnValue(guardian, awardRequest(spaces[1].uid, tokens[0].symbol));
    awards[2] = await testEnv.wrap(WEN_FUNC.createAward);
  });

  const fundAwardWrapper = async (awardId: string) => {
    mockWalletReturnValue(guardian, { uid: awardId });
    const order = await testEnv.wrap<Transaction>(WEN_FUNC.fundAward);
    await requestFundsFromFaucet(network, order.payload.targetAddress, order.payload.amount);

    const awardDocRef = database().doc(COL.AWARD, awardId);
    await wait(async () => {
      const award = <Award>await awardDocRef.get();
      return award.approved && award.funded;
    });
  };

  it('Should update member space properly', async () => {
    const promises = awards.map((award) => fundAwardWrapper(award.uid));
    await Promise.all(promises);

    const approvePromises = awards.map((award) => {
      mockWalletReturnValue(guardian, { award: award.uid, members: [member, member] });
      return testEnv.wrap<AwardApproveParticipantResponse>(WEN_FUNC.approveParticipantAward);
    });
    await Promise.all(approvePromises);

    const nttQuery = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('payload_type', '==', TransactionPayloadType.BADGE);
    await wait(async () => {
      const snap = await nttQuery.get();
      return snap.length === 6;
    });

    const memberDocRef = database().doc(COL.MEMBER, member);
    const memberData = <Member>await memberDocRef.get();

    assertMemberSpaceAwardStats(memberData, spaces[0].uid, tokens[0], 4, 2);
    assertMemberSpaceAwardStats(memberData, spaces[0].uid, tokens[1], 4, 2);
    assertMemberSpaceAwardStats(memberData, spaces[1].uid, tokens[0], 2, 2);
  });
});

const assertMemberSpaceAwardStats = (
  member: Member,
  spaceId: string,
  token: Token,
  totalCompleted: number,
  completed: number,
) => {
  const space = member.spaces![spaceId];
  expect(space.awardsCompleted).toBe(totalCompleted);
  const stat = space.awardStat![token.uid];
  expect(stat.completed).toBe(completed);
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
