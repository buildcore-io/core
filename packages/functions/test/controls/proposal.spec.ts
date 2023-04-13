import {
  COL,
  Network,
  Proposal,
  ProposalStartDateMin,
  ProposalType,
  RelatedRecordsResponse,
  Space,
  Token,
  TokenStatus,
  WEN_FUNC,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { MEDIA, testEnv } from '../set-up';
import {
  approveAwardParticipant,
  awardParticipate,
  createAward,
} from './../../src/runtime/firebase/award/index';
import {
  approveProposal,
  createProposal,
  rejectProposal,
  voteOnProposal,
} from './../../src/runtime/firebase/proposal/index';
import { createSpace, joinSpace } from './../../src/runtime/firebase/space/index';
import {
  addGuardianToSpace,
  createMember,
  expectThrow,
  getRandomSymbol,
  mockWalletReturnValue,
} from './common';

let walletSpy: any;

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
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    member = await createMember(walletSpy);
    mockWalletReturnValue(walletSpy, member, { name: 'Space A' });
    space = await testEnv.wrap(createSpace)({});
    expect(space?.uid).toBeDefined();
    body = dummyBody(space.uid);

    const tokenId = wallet.getRandomEthAddress();
    await soonDb().doc(`${COL.TOKEN}/${tokenId}`).create({
      uid: tokenId,
      space: space.uid,
      status: TokenStatus.MINTED,
      approved: true,
    });
  });

  it('successfully create proposal with name', async () => {
    mockWalletReturnValue(walletSpy, member, body);
    const cProposal = await testEnv.wrap(createProposal)({});
    expect(cProposal?.uid).toBeDefined();
    expect(cProposal?.name).toEqual(body.name);
    expect(cProposal?.additionalInfo).toEqual(body.additionalInfo);
    expect(cProposal?.type).toEqual(body.type);
    expect(cProposal?.questions).toBeDefined();
    expect(cProposal?.createdOn).toBeDefined();
    expect(cProposal?.updatedOn).toBeDefined();
    walletSpy.mockRestore();
  });

  describe('Proposal validations', () => {
    it('empty body', async () => {
      mockWalletReturnValue(walletSpy, member, {});
      await expectThrow(testEnv.wrap(createProposal)({}), WenError.invalid_params.key);
    });

    it('missing name', async () => {
      delete body.name;
      mockWalletReturnValue(walletSpy, member, body);
      await expectThrow(testEnv.wrap(createProposal)({}), WenError.invalid_params.key);
    });

    it('no questions', async () => {
      body.questions = [];
      mockWalletReturnValue(walletSpy, member, body);
      await expectThrow(testEnv.wrap(createProposal)({}), WenError.invalid_params.key);
    });

    it('only one answer', async () => {
      delete body.questions[0].answers[1];
      mockWalletReturnValue(walletSpy, member, body);
      await expectThrow(testEnv.wrap(createProposal)({}), WenError.invalid_params.key);
    });

    it('invalid type', async () => {
      body.type = 2;
      mockWalletReturnValue(walletSpy, member, body);
      await expectThrow(testEnv.wrap(createProposal)({}), WenError.invalid_params.key);
    });
  });

  ['approve', 'reject'].forEach((s) => {
    const command = s === 'approve' ? approveProposal : rejectProposal;
    const field = s === 'approve' ? 'approved' : 'rejected';
    it(s + ' proposal', async () => {
      mockWalletReturnValue(walletSpy, member, body);
      const cProposal = await testEnv.wrap(createProposal)({});
      expect(cProposal?.uid).toBeDefined();
      mockWalletReturnValue(walletSpy, member, { uid: cProposal.uid });
      const uProposal = await testEnv.wrap(command)({});
      expect(uProposal?.uid).toBeDefined();
      expect(uProposal?.[field]).toEqual(true);
      walletSpy.mockRestore();
    });

    it('fail to ' + s + ' proposal (not guardian)', async () => {
      mockWalletReturnValue(walletSpy, member, body);
      const cProposal = await testEnv.wrap(createProposal)({});
      expect(cProposal?.uid).toBeDefined();
      mockWalletReturnValue(walletSpy, wallet.getRandomEthAddress(), { uid: cProposal.uid });
      await expectThrow(testEnv.wrap(command)({}), WenError.you_are_not_guardian_of_space.key);
      walletSpy.mockRestore();
    });

    it(s + ' proposal by other guardian (not creator)', async () => {
      const guardian2 = wallet.getRandomEthAddress();
      mockWalletReturnValue(walletSpy, guardian2, { uid: space.uid });
      const jSpace = await testEnv.wrap(joinSpace)({});
      expect(jSpace).toBeDefined();
      expect(jSpace.createdOn).toBeDefined();
      expect(jSpace.uid).toEqual(guardian2);

      await addGuardianToSpace(space.uid, guardian2);

      mockWalletReturnValue(walletSpy, member, body);
      const cProposal = await testEnv.wrap(createProposal)({});
      expect(cProposal?.uid).toBeDefined();

      mockWalletReturnValue(walletSpy, guardian2, { uid: cProposal.uid });
      const result = await testEnv.wrap(command)({});
      expect(result?.uid).toBeDefined();
      expect(result?.[field]).toEqual(true);
      walletSpy.mockRestore();
    });
  });
});

describe('ProposalController: ' + WEN_FUNC.createProposal + ' MEMBERS', () => {
  let memberId: string;
  let space: Space;
  let token: Token;

  const cSpace = async (address: string) => {
    mockWalletReturnValue(walletSpy, address, { name: 'Space A' });
    const space = await testEnv.wrap(createSpace)({});
    expect(space?.uid).toBeDefined();
    return space as Space;
  };

  const jSpace = async (address: string, space: Space) => {
    mockWalletReturnValue(walletSpy, address, { uid: space.uid });
    const jSpace = await testEnv.wrap(joinSpace)({});
    expect(jSpace?.uid).toBeDefined();
    return jSpace as Space;
  };

  const cProposal = (address: string, space: Space, type: ProposalType, addAnswers: any[] = []) => {
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
    mockWalletReturnValue(walletSpy, address, proposal);
    return testEnv.wrap(createProposal)({});
  };

  const apprProposal = async (address: string, proposal: any) => {
    mockWalletReturnValue(walletSpy, address, { uid: proposal.uid });
    const pr = await testEnv.wrap(approveProposal)({});
    expect(proposal?.uid).toBeDefined();
    return pr;
  };

  const vote = async (address: string, proposal: any, values: any) => {
    mockWalletReturnValue(walletSpy, address, { uid: proposal.uid, values: values });
    const pr = await testEnv.wrap(voteOnProposal)({});
    expect(proposal?.uid).toBeDefined();
    return pr;
  };

  const giveBadge = async (
    guardian: string,
    address: string,
    space: any,
    tokenSymbol: string,
    tokenReward = 0,
  ) => {
    mockWalletReturnValue(walletSpy, address, {
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
    const award = await testEnv.wrap(createAward)({});
    expect(award?.uid).toBeDefined();

    await soonDb().doc(`${COL.AWARD}/${award.uid}`).update({ approved: true, address: '' });

    // Participate
    mockWalletReturnValue(walletSpy, address, { uid: award?.uid });
    const returnsParti = await testEnv.wrap(awardParticipate)({});
    expect(returnsParti?.uid).toBeDefined();

    // Approve
    mockWalletReturnValue(walletSpy, guardian, { award: award.uid, members: [address] });
    const returns2 = await testEnv.wrap(approveAwardParticipant)({});
    expect(Object.keys(returns2?.badges).length).toBe(1);

    return award;
  };

  beforeEach(async () => {
    // Disable start date validation.
    ProposalStartDateMin.value = -60 * 60;
    RelatedRecordsResponse.status = true;
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberId = await createMember(walletSpy);
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

    const vResult = await vote(memberId, proposal, [2]);
    expect(vResult?.payload).toBeDefined();
    expect(vResult?.payload?.weight).toEqual(1);
    await vote(memberId, proposal, [2]);

    const proposalDocRef = soonDb().doc(`${COL.PROPOSAL}/${proposal.uid}`);
    proposal = <Proposal>await proposalDocRef.get();

    expect(proposal.results.answers[2]).toBe(1);
  });

  it('create proposal, approve & vote twice on different ', async () => {
    await giveBadge(memberId, memberId, space, token.symbol, 10);
    let proposal: Proposal = await cProposal(memberId, space, ProposalType.MEMBERS);

    await apprProposal(memberId, proposal);

    const vResult = await vote(memberId, proposal, [2]);
    expect(vResult?.payload).toBeDefined();
    expect(vResult?.payload?.weight).toEqual(1);
    await vote(memberId, proposal, [1]);

    const proposalDocRef = soonDb().doc(`${COL.PROPOSAL}/${proposal.uid}`);
    proposal = <Proposal>await proposalDocRef.get();

    expect(proposal.results.answers[2]).toBe(0);
    expect(proposal.results.answers[1]).toBe(1);
  });

  it('create proposal, approve & vote - 7 ppl all same', async () => {
    const memberId = await createMember(walletSpy);
    const memberId1 = await createMember(walletSpy);
    const memberId2 = await createMember(walletSpy);
    const memberId3 = await createMember(walletSpy);
    const memberId4 = await createMember(walletSpy);
    const memberId5 = await createMember(walletSpy);
    const memberId6 = await createMember(walletSpy);
    const memberId7 = await createMember(walletSpy);
    const space = await cSpace(memberId);
    await jSpace(memberId1, space);
    await jSpace(memberId2, space);
    await jSpace(memberId3, space);
    await jSpace(memberId4, space);
    await jSpace(memberId5, space);
    await jSpace(memberId6, space);
    await jSpace(memberId7, space);
    const proposal = await cProposal(memberId, space, ProposalType.MEMBERS);

    // Approve proposal.
    await apprProposal(memberId, proposal);

    // Let's vote.
    await vote(memberId1, proposal, [1]);
    await vote(memberId2, proposal, [1]);
    await vote(memberId3, proposal, [1]);
    await vote(memberId4, proposal, [1]);
    await vote(memberId5, proposal, [1]);
    // const v6: any = await vote(memberId6, proposal, [1]);
    await vote(memberId7, proposal, [1]);
    const v = await vote(memberId, proposal, [1]);
    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(1);
    expect(v._relatedRecs.proposal.results.answers['1']).toEqual(7);
    expect(v._relatedRecs.proposal.results.voted).toEqual(7);
    expect(v._relatedRecs.proposal.results.total).toEqual(8);
    expect(v._relatedRecs.proposal.totalWeight).toEqual(8);
  });

  it('create proposal, approve & vote - 7 ppl 4/3', async () => {
    const memberId = await createMember(walletSpy);
    const memberId1 = await createMember(walletSpy);
    const memberId2 = await createMember(walletSpy);
    const memberId3 = await createMember(walletSpy);
    const memberId4 = await createMember(walletSpy);
    const memberId5 = await createMember(walletSpy);
    const memberId6 = await createMember(walletSpy);
    const memberId7 = await createMember(walletSpy);
    const space = await cSpace(memberId);
    await jSpace(memberId1, space);
    await jSpace(memberId2, space);
    await jSpace(memberId3, space);
    await jSpace(memberId4, space);
    await jSpace(memberId5, space);
    await jSpace(memberId6, space);
    await jSpace(memberId7, space);
    const proposal = await cProposal(memberId, space, ProposalType.MEMBERS);

    // Approve proposal.
    await apprProposal(memberId, proposal);

    // Let's vote.
    await vote(memberId1, proposal, [1]);
    await vote(memberId2, proposal, [1]);
    await vote(memberId3, proposal, [2]);
    await vote(memberId4, proposal, [2]);
    await vote(memberId5, proposal, [2]);
    // const v6: any = await vote(memberId6, proposal, [1]);
    await vote(memberId7, proposal, [1]);
    const v = await vote(memberId, proposal, [1]);
    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(1);
    expect(v._relatedRecs.proposal.results.answers['1']).toEqual(4);
    expect(v._relatedRecs.proposal.results.answers['2']).toEqual(3);
    expect(v._relatedRecs.proposal.results.voted).toEqual(7);
    expect(v._relatedRecs.proposal.results.total).toEqual(8);
    expect(v._relatedRecs.proposal.totalWeight).toEqual(8);
  });

  it('create proposal, approve & vote - 4 ppl badges', async () => {
    const memberId = await createMember(walletSpy);
    const memberId1 = await createMember(walletSpy);
    const memberId2 = await createMember(walletSpy);
    const memberId3 = await createMember(walletSpy);
    const memberId4 = await createMember(walletSpy);
    const memberId5 = await createMember(walletSpy);
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

    const proposal = await cProposal(memberId, space, ProposalType.MEMBERS);

    // Approve proposal.
    await apprProposal(memberId, proposal);

    // Let's vote.
    await vote(memberId2, proposal, [2]);
    await vote(memberId3, proposal, [2]);
    await vote(memberId1, proposal, [1]);
    await vote(memberId, proposal, [1]); // 150
    const v = await vote(memberId4, proposal, [2]); // 75
    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(1);
    expect(v._relatedRecs.proposal.results.answers['1']).toEqual(2);
    expect(v._relatedRecs.proposal.results.answers['2']).toEqual(3);
    expect(v._relatedRecs.proposal.results.voted).toEqual(5);
    expect(v._relatedRecs.proposal.results.total).toEqual(6);
    expect(v._relatedRecs.proposal.totalWeight).toEqual(6);
  });
});

export const saveBaseToken = async (space: string, guardian: string) => {
  const token = {
    symbol: getRandomSymbol(),
    approved: true,
    updatedOn: serverTime(),
    createdOn: serverTime(),
    space,
    uid: getRandomEthAddress(),
    createdBy: guardian,
    name: 'MyToken',
    status: TokenStatus.BASE,
    access: 0,
    icon: MEDIA,
    mintingData: {
      network: Network.RMS,
    },
  };
  await soonDb().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return token as Token;
};
