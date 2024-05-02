import { build5Db } from '@build-5/database';
import {
  Access,
  Award,
  AwardApproveParticipantResponse,
  AwardParticipant,
  COL,
  Network,
  NetworkAddress,
  Proposal,
  ProposalStartDateMin,
  ProposalType,
  RelatedRecordsResponse,
  SOON_PROJECT_ID,
  Space,
  Token,
  TokenStatus,
  Transaction,
  WEN_FUNC,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { MEDIA, mockWalletReturnValue, testEnv } from '../set-up';
import { addGuardianToSpace, expectThrow, getRandomSymbol } from './common';

const dummyBody = (space: string) => ({
  name: 'All 4 HORNET',
  space,
  additionalInfo: 'The biggest governance decision in the history of IOTA',
  settings: {
    startDate: new Date(),
    endDate: dayjs().add(5, 'day').toDate(),
    onlyGuardians: false,
  },
  type: ProposalType.NATIVE,
  questions: [
    {
      text: 'Give all the funds to the HORNET developers?',
      answers: [
        { value: 1, text: 'YES', additionalInfo: 'Go team!' },
        { value: 2, text: 'Doh! Of course!', additionalInfo: 'There is no other option' },
      ],
      additionalInfo: 'This would fund the development of HORNET indefinitely',
    },
  ],
});

describe('ProposalController: ' + WEN_FUNC.rejectProposal + ' NATIVE', () => {
  let member: string;
  let space: Space;
  let body: any;

  beforeEach(async () => {
    member = await testEnv.createMember();
    space = await testEnv.createSpace(member);
    body = dummyBody(space.uid);

    const tokenId = wallet.getRandomEthAddress();
    await build5Db()
      .doc(COL.TOKEN, tokenId)
      .create({
        links: [] as URL[],
        project: SOON_PROJECT_ID,
        uid: tokenId,
        space: space.uid,
        status: TokenStatus.MINTED,
        approved: true,
      } as Token);
  });

  it('successfully create proposal with name', async () => {
    mockWalletReturnValue(member, body);
    const cProposal = await testEnv.wrap<Proposal>(WEN_FUNC.createProposal);
    expect(cProposal?.uid).toBeDefined();
    expect(cProposal?.name).toEqual(body.name);
    expect(cProposal?.additionalInfo).toEqual(body.additionalInfo);
    expect(cProposal?.type).toEqual(body.type);
    expect(cProposal?.questions).toBeDefined();
    expect(cProposal?.createdOn).toBeDefined();
    expect(cProposal?.updatedOn).toBeDefined();
  });

  describe('Proposal validations', () => {
    it('empty body', async () => {
      mockWalletReturnValue(member, {});
      await expectThrow(
        testEnv.wrap<Proposal>(WEN_FUNC.createProposal),
        WenError.invalid_params.key,
      );
    });

    it('missing name', async () => {
      delete body.name;
      mockWalletReturnValue(member, body);
      await expectThrow(
        testEnv.wrap<Proposal>(WEN_FUNC.createProposal),
        WenError.invalid_params.key,
      );
    });

    it('no questions', async () => {
      body.questions = [];
      mockWalletReturnValue(member, body);
      await expectThrow(
        testEnv.wrap<Proposal>(WEN_FUNC.createProposal),
        WenError.invalid_params.key,
      );
    });

    it('only one answer', async () => {
      delete body.questions[0].answers[1];
      mockWalletReturnValue(member, body);
      await expectThrow(
        testEnv.wrap<Proposal>(WEN_FUNC.createProposal),
        WenError.invalid_params.key,
      );
    });

    it('invalid type', async () => {
      body.type = 2;
      mockWalletReturnValue(member, body);
      await expectThrow(
        testEnv.wrap<Proposal>(WEN_FUNC.createProposal),
        WenError.invalid_params.key,
      );
    });
  });

  ['approve', 'reject'].forEach((s) => {
    const command = s === 'approve' ? WEN_FUNC.approveProposal : WEN_FUNC.rejectProposal;
    const field = s === 'approve' ? 'approved' : 'rejected';
    it(s + ' proposal', async () => {
      mockWalletReturnValue(member, body);
      const cProposal = await testEnv.wrap<Proposal>(WEN_FUNC.createProposal);
      expect(cProposal?.uid).toBeDefined();
      mockWalletReturnValue(member, { uid: cProposal.uid });
      const uProposal = await testEnv.wrap<Proposal>(command);
      expect(uProposal?.uid).toBeDefined();
      expect(uProposal?.[field]).toEqual(true);
    });

    it('fail to ' + s + ' proposal (not guardian)', async () => {
      mockWalletReturnValue(member, body);
      const cProposal = await testEnv.wrap<Proposal>(WEN_FUNC.createProposal);
      expect(cProposal?.uid).toBeDefined();
      const randomUser = await testEnv.createMember();
      mockWalletReturnValue(randomUser, { uid: cProposal.uid });
      await expectThrow(testEnv.wrap(command), WenError.you_are_not_guardian_of_space.key);
    });

    it(s + ' proposal by other guardian (not creator)', async () => {
      const guardian2 = await testEnv.createMember();
      mockWalletReturnValue(guardian2, { uid: space.uid });
      const jSpace = await testEnv.wrap<Space>(WEN_FUNC.joinSpace);
      expect(jSpace).toBeDefined();
      expect(jSpace.createdOn).toBeDefined();
      expect(jSpace.uid).toEqual(guardian2);

      await addGuardianToSpace(space.uid, guardian2);

      mockWalletReturnValue(member, body);
      const cProposal = await testEnv.wrap<Proposal>(WEN_FUNC.createProposal);
      expect(cProposal?.uid).toBeDefined();

      mockWalletReturnValue(guardian2, { uid: cProposal.uid });
      const result = await testEnv.wrap<Proposal>(command);
      expect(result?.uid).toBeDefined();
      expect(result?.[field]).toEqual(true);
    });
  });
});

describe('ProposalController: ' + WEN_FUNC.createProposal + ' MEMBERS', () => {
  let memberId: string;
  let space: Space;
  let token: Token;

  const cSpace = async (address: NetworkAddress) => {
    mockWalletReturnValue(address, { name: 'Space A' });
    space = await testEnv.wrap<Space>(WEN_FUNC.createSpace);
    expect(space?.uid).toBeDefined();
    return space as Space;
  };

  const jSpace = async (address: NetworkAddress, space: Space) => {
    mockWalletReturnValue(address, { uid: space.uid });
    const jSpace = await testEnv.wrap<Space>(WEN_FUNC.joinSpace);
    expect(jSpace?.uid).toBeDefined();
    return jSpace;
  };

  const cProposal = (
    address: NetworkAddress,
    space: Space,
    type: ProposalType,
    addAnswers: any[] = [],
  ) => {
    const proposal = {
      name: 'Space Test',
      space: space.uid,
      settings: {
        startDate: new Date(),
        endDate: dayjs().add(5, 'day').toDate(),
        onlyGuardians: false,
      },
      type,
      questions: [
        {
          text: 'Questions?',
          answers: [
            { value: 1, text: 'YES' },
            { value: 2, text: 'Doh! Of course!' },
            ...addAnswers,
          ],
        },
      ],
    };
    mockWalletReturnValue(address, proposal);
    return testEnv.wrap<Proposal>(WEN_FUNC.createProposal);
  };

  const apprProposal = async (address: NetworkAddress, proposal: any) => {
    mockWalletReturnValue(address, { uid: proposal.uid });
    const pr = await testEnv.wrap<Proposal>(WEN_FUNC.approveProposal);
    expect(proposal?.uid).toBeDefined();
    return pr;
  };

  const vote = async (address: NetworkAddress, proposal: any, value: number) => {
    mockWalletReturnValue(address, { uid: proposal.uid, value });
    const pr = await testEnv.wrap<Transaction>(WEN_FUNC.voteOnProposal);
    expect(proposal?.uid).toBeDefined();
    return pr;
  };

  const giveBadge = async (
    guardian: string,
    address: NetworkAddress,
    space: any,
    tokenSymbol: string,
    tokenReward = 0,
  ) => {
    mockWalletReturnValue(address, {
      name: 'Award A',
      description: 'Finish this and that',
      space: space?.uid,
      endDate: dayjs().add(5, 'days').toDate(),
      badge: {
        image: MEDIA,
        name: 'Winner',
        description: 'Such a special',
        total: 1,
        tokenReward,
        lockTime: 31557600000,
        tokenSymbol,
      },
      network: Network.RMS,
    });
    const award = await testEnv.wrap<Award>(WEN_FUNC.createAward);
    expect(award?.uid).toBeDefined();

    await build5Db().doc(COL.AWARD, award.uid).update({ approved: true, address: '' });

    // Participate
    mockWalletReturnValue(address, { uid: award?.uid });
    const returnsParti = await testEnv.wrap<AwardParticipant>(WEN_FUNC.participateAward);
    expect(returnsParti?.uid).toBeDefined();

    // Approve
    mockWalletReturnValue(guardian, { award: award.uid, members: [address] });
    const returns2 = await testEnv.wrap<AwardApproveParticipantResponse>(
      WEN_FUNC.approveParticipantAward,
    );
    expect(Object.keys(returns2?.badges).length).toBe(1);

    return award;
  };

  beforeEach(async () => {
    // Disable start date validation.
    ProposalStartDateMin.value = -60 * 60;
    RelatedRecordsResponse.status = true;
    memberId = await testEnv.createMember();
    space = await cSpace(memberId);

    token = await saveBaseToken(space.uid, memberId);
  });

  afterEach(async () => {
    // Disable start date validation.
    ProposalStartDateMin.value = 5 * 60 * 1000;
  });

  it('create proposal ', async () => {
    await cProposal(memberId, space, ProposalType.MEMBERS);
  });

  it('create proposal, approve & vote twice on same ', async () => {
    await giveBadge(memberId, memberId, space, token.symbol, 10);
    let proposal: Proposal = await cProposal(memberId, space, ProposalType.MEMBERS);

    await apprProposal(memberId, proposal);

    const vResult = await vote(memberId, proposal, 2);
    expect(vResult?.payload).toBeDefined();
    expect(vResult?.payload?.weight).toEqual(1);
    await vote(memberId, proposal, 2);

    const proposalDocRef = build5Db().doc(COL.PROPOSAL, proposal.uid);
    proposal = <Proposal>await proposalDocRef.get();
    expect(proposal.results.answers[2]).toBe(1);
  });

  it('create proposal, approve & vote twice on different', async () => {
    await giveBadge(memberId, memberId, space, token.symbol, 10);
    let proposal: Proposal = await cProposal(memberId, space, ProposalType.MEMBERS);

    await apprProposal(memberId, proposal);

    const vResult = await vote(memberId, proposal, 2);
    expect(vResult?.payload).toBeDefined();
    expect(vResult?.payload?.weight).toEqual(1);

    await vote(memberId, proposal, 1);

    const proposalDocRef = build5Db().doc(COL.PROPOSAL, proposal.uid);
    proposal = <Proposal>await proposalDocRef.get();

    expect(proposal.results.answers[2]).toBe(0);
    expect(proposal.results.answers[1]).toBe(1);
  });

  it('create proposal, approve & vote - 7 ppl all same', async () => {
    const memberId = await testEnv.createMember();
    const memberId1 = await testEnv.createMember();
    const memberId2 = await testEnv.createMember();
    const memberId3 = await testEnv.createMember();
    const memberId4 = await testEnv.createMember();
    const memberId5 = await testEnv.createMember();
    const memberId6 = await testEnv.createMember();
    const memberId7 = await testEnv.createMember();
    const space = await cSpace(memberId);
    await jSpace(memberId1, space);
    await jSpace(memberId2, space);
    await jSpace(memberId3, space);
    await jSpace(memberId4, space);
    await jSpace(memberId5, space);
    await jSpace(memberId6, space);
    await jSpace(memberId7, space);
    let proposal = await cProposal(memberId, space, ProposalType.MEMBERS);

    await apprProposal(memberId, proposal);

    await vote(memberId1, proposal, 1);
    await vote(memberId2, proposal, 1);
    await vote(memberId3, proposal, 1);
    await vote(memberId4, proposal, 1);
    await vote(memberId5, proposal, 1);
    await vote(memberId7, proposal, 1);

    const v = await vote(memberId, proposal, 1);
    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(1);

    const proposalDocRef = build5Db().doc(COL.PROPOSAL, proposal.uid);
    proposal = (await proposalDocRef.get())!;
    expect(proposal.results.answers['1']).toEqual(7);
    expect(proposal.results.voted).toEqual(7);
    expect(proposal.results.total).toEqual(8);
    expect(proposal.totalWeight).toEqual(8);
  });

  it('create proposal, approve & vote - 7 ppl 4/3', async () => {
    const memberId = await testEnv.createMember();
    const memberId1 = await testEnv.createMember();
    const memberId2 = await testEnv.createMember();
    const memberId3 = await testEnv.createMember();
    const memberId4 = await testEnv.createMember();
    const memberId5 = await testEnv.createMember();
    const memberId6 = await testEnv.createMember();
    const memberId7 = await testEnv.createMember();
    const space = await cSpace(memberId);
    await jSpace(memberId1, space);
    await jSpace(memberId2, space);
    await jSpace(memberId3, space);
    await jSpace(memberId4, space);
    await jSpace(memberId5, space);
    await jSpace(memberId6, space);
    await jSpace(memberId7, space);
    let proposal = await cProposal(memberId, space, ProposalType.MEMBERS);

    await apprProposal(memberId, proposal);

    await vote(memberId1, proposal, 1);
    await vote(memberId2, proposal, 1);
    await vote(memberId3, proposal, 2);
    await vote(memberId4, proposal, 2);
    await vote(memberId5, proposal, 2);
    await vote(memberId7, proposal, 1);
    const v = await vote(memberId, proposal, 1);
    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(1);

    const proposalDocRef = build5Db().doc(COL.PROPOSAL, proposal.uid);
    proposal = (await proposalDocRef.get())!;
    expect(proposal.results.answers['1']).toEqual(4);
    expect(proposal.results.answers['2']).toEqual(3);
    expect(proposal.results.voted).toEqual(7);
    expect(proposal.results.total).toEqual(8);
    expect(proposal.totalWeight).toEqual(8);
  });

  it('create proposal, approve & vote - 4 ppl badges', async () => {
    const memberId = await testEnv.createMember();
    const memberId1 = await testEnv.createMember();
    const memberId2 = await testEnv.createMember();
    const memberId3 = await testEnv.createMember();
    const memberId4 = await testEnv.createMember();
    const memberId5 = await testEnv.createMember();
    const space = await cSpace(memberId);
    await jSpace(memberId1, space);
    await jSpace(memberId2, space);
    await jSpace(memberId3, space);
    await jSpace(memberId4, space);
    await jSpace(memberId5, space);

    // Distribute badges.
    await giveBadge(memberId, memberId, space, token.symbol, 30);
    await giveBadge(memberId, memberId, space, token.symbol, 30);
    await giveBadge(memberId, memberId, space, token.symbol, 30); // 90 together.
    await giveBadge(memberId, memberId1, space, token.symbol, 30);
    await giveBadge(memberId, memberId1, space, token.symbol, 30); // 60 together
    await giveBadge(memberId, memberId2, space, token.symbol, 10); // 10
    await giveBadge(memberId, memberId3, space, token.symbol, 5); // 5
    await giveBadge(memberId, memberId4, space, token.symbol, 30);
    await giveBadge(memberId, memberId4, space, token.symbol, 30); // 60
    await giveBadge(memberId, memberId5, space, token.symbol, 200);

    let proposal = await cProposal(memberId, space, ProposalType.MEMBERS);

    // Approve proposal.
    await apprProposal(memberId, proposal);

    // Let's vote.
    await vote(memberId2, proposal, 2);
    await vote(memberId3, proposal, 2);
    await vote(memberId1, proposal, 1);
    await vote(memberId, proposal, 1); // 150
    const v = await vote(memberId4, proposal, 2); // 75
    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(1);

    const proposalDocRef = build5Db().doc(COL.PROPOSAL, proposal.uid);
    proposal = (await proposalDocRef.get())!;
    expect(proposal.results.answers['1']).toEqual(2);
    expect(proposal.results.answers['2']).toEqual(3);
    expect(proposal.results.voted).toEqual(5);
    expect(proposal.results.total).toEqual(6);
    expect(proposal.totalWeight).toEqual(6);
  });
});

export const saveBaseToken = async (space: string, guardian: string) => {
  const token = {
    project: SOON_PROJECT_ID,
    symbol: getRandomSymbol(),
    approved: true,
    updatedOn: serverTime().toDate(),
    createdOn: serverTime().toDate(),
    space,
    uid: getRandomEthAddress(),
    createdBy: guardian,
    name: 'MyToken',
    status: TokenStatus.BASE,
    access: Access.OPEN,
    icon: MEDIA,
    mintingData_network: Network.RMS,
  };
  const docRef = build5Db().doc(COL.TOKEN, token.uid);
  await docRef.upsert(token);
  return (await docRef.get())!;
};
