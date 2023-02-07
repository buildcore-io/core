import {
  AwardBadgeType,
  COL,
  Network,
  ProposalStartDateMin,
  ProposalSubType,
  ProposalType,
  RelatedRecordsResponse,
  Space,
  TokenStatus,
  WenError,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { set } from 'lodash';
import admin from '../../src/admin.config';
import { createMember } from '../../src/controls/member.control';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import {
  approveProposal,
  rejectProposal,
} from './../../src/controls/proposal/approve.reject.proposal';
import { createProposal } from './../../src/controls/proposal/create.proposal';
import { voteOnProposal } from './../../src/controls/proposal/vote/vote.on.proposal';
import { joinSpace } from './../../src/controls/space/member.join.control';
import { createSpace } from './../../src/controls/space/space.create.control';
import {
  approveAwardParticipant,
  awardParticipate,
  createAward,
} from './../../src/runtime/firebase/award/index';
import { addGuardianToSpace, expectThrow, mockWalletReturnValue } from './common';

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
  subType: ProposalSubType.ONE_MEMBER_ONE_VOTE,
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

describe('ProposalController: ' + WEN_FUNC.cProposal + ' NATIVE', () => {
  let memberAddress: string;
  let space: Space;
  let body: any;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = wallet.getRandomEthAddress();
    mockWalletReturnValue(walletSpy, memberAddress, {});
    const returns = await testEnv.wrap(createMember)(memberAddress);
    expect(returns?.uid).toEqual(memberAddress.toLowerCase());
    mockWalletReturnValue(walletSpy, memberAddress, { name: 'Space A' });
    space = await testEnv.wrap(createSpace)({});
    expect(space?.uid).toBeDefined();
    body = dummyBody(space.uid);

    const tokenId = wallet.getRandomEthAddress();
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).create({
      uid: tokenId,
      space: space.uid,
      status: TokenStatus.MINTED,
    });
  });

  it('successfully create proposal with name', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, body);
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
      mockWalletReturnValue(walletSpy, memberAddress, {});
      await expectThrow(testEnv.wrap(createProposal)({}), WenError.invalid_params.key);
    });

    it('missing name', async () => {
      delete body.name;
      mockWalletReturnValue(walletSpy, memberAddress, body);
      await expectThrow(testEnv.wrap(createProposal)({}), WenError.invalid_params.key);
    });

    it('no questions', async () => {
      body.questions = [];
      mockWalletReturnValue(walletSpy, memberAddress, body);
      await expectThrow(testEnv.wrap(createProposal)({}), WenError.invalid_params.key);
    });

    it('only one answer', async () => {
      delete body.questions[0].answers[1];
      mockWalletReturnValue(walletSpy, memberAddress, body);
      await expectThrow(testEnv.wrap(createProposal)({}), WenError.invalid_params.key);
    });

    it('invalid type', async () => {
      body.type = 2;
      mockWalletReturnValue(walletSpy, memberAddress, body);
      await expectThrow(testEnv.wrap(createProposal)({}), WenError.invalid_params.key);
    });
  });

  ['approve', 'reject'].forEach((s) => {
    const command = s === 'approve' ? approveProposal : rejectProposal;
    const field = s === 'approve' ? 'approved' : 'rejected';
    it(s + ' proposal', async () => {
      mockWalletReturnValue(walletSpy, memberAddress, body);
      const cProposal = await testEnv.wrap(createProposal)({});
      expect(cProposal?.uid).toBeDefined();
      mockWalletReturnValue(walletSpy, memberAddress, { uid: cProposal.uid });
      const uProposal = await testEnv.wrap(command)({});
      expect(uProposal?.uid).toBeDefined();
      expect(uProposal?.[field]).toEqual(true);
      walletSpy.mockRestore();
    });

    it('fail to ' + s + ' proposal (not guardian)', async () => {
      mockWalletReturnValue(walletSpy, memberAddress, body);
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

      mockWalletReturnValue(walletSpy, memberAddress, body);
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

describe('ProposalController: ' + WEN_FUNC.cProposal + ' MEMBERS', () => {
  let memberId: string;
  let space: Space;

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

  const cProposal = (
    address: string,
    space: Space,
    type: ProposalType,
    subType: ProposalSubType,
    addAnswers: any[] = [],
    awards: string[] = [],
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
      subType,
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
    if (subType === ProposalSubType.REPUTATION_BASED_ON_AWARDS) {
      set(proposal, 'settings.awards', awards);
    }
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

  const cMember = async (address = wallet.getRandomEthAddress()) => {
    mockWalletReturnValue(walletSpy, address, {});
    const returns = await testEnv.wrap(createMember)(address);
    expect(returns?.uid).toEqual(address.toLowerCase());
    return returns!.uid;
  };

  const giveBadge = async (guardian: string, address: string, space: any, tokenReward = 0) => {
    mockWalletReturnValue(walletSpy, address, {
      name: 'Award A',
      description: 'Finish this and that',
      space: space?.uid,
      endDate: dayjs().add(5, 'days').toDate(),
      badge: {
        name: 'Winner',
        description: 'Such a special',
        total: 1,
        tokenReward,
        type: AwardBadgeType.BASE,
      },
      network: Network.RMS,
    });
    const award = await testEnv.wrap(createAward)({});
    expect(award?.uid).toBeDefined();

    await admin.firestore().doc(`${COL.AWARD}/${award.uid}`).update({ approved: true });

    // Participate
    mockWalletReturnValue(walletSpy, address, { uid: award?.uid });
    const returnsParti = await testEnv.wrap(awardParticipate)({});
    expect(returnsParti?.uid).toBeDefined();

    // Approve
    mockWalletReturnValue(walletSpy, guardian, { uid: award.uid, member: address });
    const returns2 = await testEnv.wrap(approveAwardParticipant)({});
    expect(returns2?.uid).toBeDefined();

    return award;
  };

  beforeEach(async () => {
    // Disable start date validation.
    ProposalStartDateMin.value = -60 * 60;
    RelatedRecordsResponse.status = true;
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberId = await cMember();
    space = await cSpace(memberId);
  });

  afterEach(async () => {
    // Disable start date validation.
    ProposalStartDateMin.value = 5 * 60 * 1000;
  });

  it('create proposal ', async () => {
    await cProposal(memberId, space, ProposalType.MEMBERS, ProposalSubType.ONE_MEMBER_ONE_VOTE);
  });

  it('create proposal - invalid combination NATIVE - REPUTATION_BASED_ON_AWARDS ', async () => {
    await expectThrow(
      cProposal(memberId, space, ProposalType.NATIVE, ProposalSubType.REPUTATION_BASED_ON_AWARDS),
      WenError.invalid_params.key,
    );
  });

  it('create proposal - invalid combination NATIVE - REPUTATION_BASED_ON_SPACE ', async () => {
    await expectThrow(
      cProposal(memberId, space, ProposalType.NATIVE, ProposalSubType.REPUTATION_BASED_ON_SPACE),
      WenError.invalid_params.key,
    );
  });

  it('create proposal, approve & vote ', async () => {
    await giveBadge(memberId, memberId, space, 10);
    const proposal = await cProposal(
      memberId,
      space,
      ProposalType.MEMBERS,
      ProposalSubType.ONE_MEMBER_ONE_VOTE,
    );

    await apprProposal(memberId, proposal);

    const vResult = await vote(memberId, proposal, [1]);
    expect(vResult?.payload).toBeDefined();
    expect(vResult?.payload?.weight).toEqual(1);
  });

  it('create proposal, approve & vote - REPUTATION_BASED_ON_SPACE ', async () => {
    await giveBadge(memberId, memberId, space, 10);
    const proposal = await cProposal(
      memberId,
      space,
      ProposalType.MEMBERS,
      ProposalSubType.REPUTATION_BASED_ON_SPACE,
    );

    await apprProposal(memberId, proposal);

    const v = await vote(memberId, proposal, [1]);
    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(10);
  });

  it('create proposal, approve & vote - REPUTATION_BASED_ON_SPACE 2 awards', async () => {
    await giveBadge(memberId, memberId, space, 10);
    await giveBadge(memberId, memberId, space, 30);
    const proposal = await cProposal(
      memberId,
      space,
      ProposalType.MEMBERS,
      ProposalSubType.REPUTATION_BASED_ON_SPACE,
    );

    await apprProposal(memberId, proposal);

    const v = await vote(memberId, proposal, [1]);
    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(40);
  });

  it('create proposal, approve & vote - REPUTATION_BASED_ON_AWARDS 2 awards (using only one)', async () => {
    const award = await giveBadge(memberId, memberId, space, 10);
    await giveBadge(memberId, memberId, space, 30);
    const proposal = await cProposal(
      memberId,
      space,
      ProposalType.MEMBERS,
      ProposalSubType.REPUTATION_BASED_ON_AWARDS,
      undefined,
      [award.uid],
    );

    await apprProposal(memberId, proposal);

    const v = await vote(memberId, proposal, [1]);
    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(10);
  });

  it('create proposal, approve & vote - REPUTATION_BASED_ON_AWARDS 3 awards (using all)', async () => {
    const award = await giveBadge(memberId, memberId, space, 10);
    const award2 = await giveBadge(memberId, memberId, space, 20);
    const award3 = await giveBadge(memberId, memberId, space, 10);
    const proposal = await cProposal(
      memberId,
      space,
      ProposalType.MEMBERS,
      ProposalSubType.REPUTATION_BASED_ON_AWARDS,
      undefined,
      [award.uid, award2.uid, award3.uid],
    );

    await apprProposal(memberId, proposal);

    const v = await vote(memberId, proposal, [1]);
    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(40);
    expect(v._relatedRecs.proposal.results.voted).toEqual(40);
    expect(v._relatedRecs.proposal.results.total).toEqual(40);
    // Not supported yet.
    expect(v._relatedRecs.proposal.totalWeight).toEqual(40);
  });

  it('create proposal, approve & vote - ONE_MEMBER_ONE_VOTE - 7 ppl all same', async () => {
    const memberId = await cMember();
    const memberId1 = await cMember();
    const memberId2 = await cMember();
    const memberId3 = await cMember();
    const memberId4 = await cMember();
    const memberId5 = await cMember();
    const memberId6 = await cMember();
    const memberId7 = await cMember();
    const space = await cSpace(memberId);
    await jSpace(memberId1, space);
    await jSpace(memberId2, space);
    await jSpace(memberId3, space);
    await jSpace(memberId4, space);
    await jSpace(memberId5, space);
    await jSpace(memberId6, space);
    await jSpace(memberId7, space);
    const proposal = await cProposal(
      memberId,
      space,
      ProposalType.MEMBERS,
      ProposalSubType.ONE_MEMBER_ONE_VOTE,
    );

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

  it('create proposal, approve & vote - ONE_MEMBER_ONE_VOTE - 7 ppl 4/3', async () => {
    const memberId = await cMember();
    const memberId1 = await cMember();
    const memberId2 = await cMember();
    const memberId3 = await cMember();
    const memberId4 = await cMember();
    const memberId5 = await cMember();
    const memberId6 = await cMember();
    const memberId7 = await cMember();
    const space = await cSpace(memberId);
    await jSpace(memberId1, space);
    await jSpace(memberId2, space);
    await jSpace(memberId3, space);
    await jSpace(memberId4, space);
    await jSpace(memberId5, space);
    await jSpace(memberId6, space);
    await jSpace(memberId7, space);
    const proposal = await cProposal(
      memberId,
      space,
      ProposalType.MEMBERS,
      ProposalSubType.ONE_MEMBER_ONE_VOTE,
    );

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

  it('create proposal, approve & vote - ONE_MEMBER_ONE_VOTE - 4 ppl badges', async () => {
    const memberId = await cMember();
    const memberId1 = await cMember();
    const memberId2 = await cMember();
    const memberId3 = await cMember();
    const memberId4 = await cMember();
    const memberId5 = await cMember();
    const space = await cSpace(memberId);
    await jSpace(memberId1, space);
    await jSpace(memberId2, space);
    await jSpace(memberId3, space);
    await jSpace(memberId4, space);
    await jSpace(memberId5, space);

    // Distribute badges.
    await giveBadge(memberId, memberId, space, 30);
    await giveBadge(memberId, memberId, space, 30);
    await giveBadge(memberId, memberId, space, 30); // 90 together.
    await giveBadge(memberId, memberId1, space, 30);
    await giveBadge(memberId, memberId1, space, 30); // 60 together
    await giveBadge(memberId, memberId2, space, 10); // 10
    await giveBadge(memberId, memberId3, space, 5); // 5
    await giveBadge(memberId, memberId4, space, 30);
    await giveBadge(memberId, memberId4, space, 30); // 60
    await giveBadge(memberId, memberId5, space, 200);

    const proposal = await cProposal(
      memberId,
      space,
      ProposalType.MEMBERS,
      ProposalSubType.REPUTATION_BASED_ON_SPACE,
    );

    // Approve proposal.
    await apprProposal(memberId, proposal);

    // Let's vote.
    await vote(memberId2, proposal, [2]);
    await vote(memberId3, proposal, [2]);
    await vote(memberId1, proposal, [1]);
    await vote(memberId, proposal, [1]); // 150
    const v = await vote(memberId4, proposal, [2]); // 75
    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(60);
    expect(v._relatedRecs.proposal.results.answers['1']).toEqual(150);
    expect(v._relatedRecs.proposal.results.answers['2']).toEqual(75);
    expect(v._relatedRecs.proposal.results.voted).toEqual(225);
    expect(v._relatedRecs.proposal.results.total).toEqual(425);
    expect(v._relatedRecs.proposal.totalWeight).toEqual(425);
  });

  // TODO
  // it('create proposal - REPUTATION_BASED_ON_AWARDS forgot badges', async () => {
  //   const memberId = await cMember();
  //   const memberId1 = await cMember();
  //   const space = await cSpace(memberId);
  //   await jSpace(memberId1, space);
  //   (<any>expect(
  //     cProposal(memberId, space, ProposalType.MEMBERS, ProposalSubType.REPUTATION_BASED_ON_AWARDS)
  //   )).rejects.toThrowError(WenError.invalid_params.key);
  // });

  it('create proposal, approve & vote - REPUTATION_BASED_ON_AWARDS - 2 ppl badges - unused badge', async () => {
    const memberId = await cMember();
    const memberId1 = await cMember();
    const space = await cSpace(memberId);
    await jSpace(memberId1, space);

    // Distribute badges.
    const badgeA = await giveBadge(memberId, memberId, space, 30);
    await giveBadge(memberId, memberId1, space, 30);

    const proposal = await cProposal(
      memberId,
      space,
      ProposalType.MEMBERS,
      ProposalSubType.REPUTATION_BASED_ON_AWARDS,
      undefined,
      [badgeA!.uid],
    );

    // Approve proposal.
    await apprProposal(memberId, proposal);

    // Let's vote.
    // await vote(memberId1, proposal, [2]);
    const v = await vote(memberId, proposal, [1]);

    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(30);
    expect(v._relatedRecs.proposal.results.answers['1']).toEqual(30);
    // expect(v._relatedRecs.proposal.results.answers['2']).toEqual(0);
    expect(v._relatedRecs.proposal.results.voted).toEqual(30);
    expect(v._relatedRecs.proposal.results.total).toEqual(30);
    expect(v._relatedRecs.proposal.totalWeight).toEqual(30);
  });

  it('create proposal, approve & vote - REPUTATION_BASED_ON_AWARDS - 3 ppl badges across two spaces', async () => {
    const memberId = await cMember();
    const memberId1 = await cMember();
    const memberId2 = await cMember();
    const space = await cSpace(memberId);
    const space2 = await cSpace(memberId1);
    await jSpace(memberId, space2);
    await jSpace(memberId1, space);
    await jSpace(memberId2, space2);

    // Distribute badges.
    const badgeA = await giveBadge(memberId, memberId, space, 30);
    const badgeB = await giveBadge(memberId1, memberId, space2, 30);
    const badgeC = await giveBadge(memberId1, memberId1, space2, 30);
    const badgeD = await giveBadge(memberId1, memberId2, space2, 30);
    /*
    memberId = 60
    memberId1 = 30
    memberId2 = 30
    */
    await giveBadge(memberId, memberId1, space, 30);

    const proposal = await cProposal(
      memberId,
      space,
      ProposalType.MEMBERS,
      ProposalSubType.REPUTATION_BASED_ON_AWARDS,
      undefined,
      [badgeA!.uid, badgeB!.uid, badgeC!.uid, badgeD!.uid],
    );

    // Approve proposal.
    await apprProposal(memberId, proposal);

    // Let's vote.
    await vote(memberId, proposal, [1]);
    await vote(memberId1, proposal, [1]);
    const v = await vote(memberId, proposal, [2]);

    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(60);
    expect(v._relatedRecs.proposal.results.answers['1']).toEqual(30);
    expect(v._relatedRecs.proposal.results.answers['2']).toEqual(60);
    expect(v._relatedRecs.proposal.results.voted).toEqual(90);
    expect(v._relatedRecs.proposal.results.total).toEqual(90);
    expect(v._relatedRecs.proposal.totalWeight).toEqual(90);
  });
});
