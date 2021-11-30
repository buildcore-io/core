import dayjs from "dayjs";
import { WEN_FUNC } from "../../interfaces/functions";
import { createMember } from '../../src/controls/member.control';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { ProposalStartDateMin, RelatedRecordsResponse } from './../../interfaces/config';
import { WenError } from './../../interfaces/errors';
import { AwardType } from './../../interfaces/models/award';
import { ProposalSubType, ProposalType } from './../../interfaces/models/proposal';
import { approveParticipant, createAward, participate } from './../../src/controls/award.control';
import { approveProposal, createProposal, rejectProposal, voteOnProposal } from './../../src/controls/proposal.control';
import { addGuardian, createSpace, joinSpace } from './../../src/controls/space.control';

describe('ProposalController: ' + WEN_FUNC.cProposal + ' NATIVE', () => {
  let walletSpy: any;
  let memberAddress: any;
  let space: any;
  let body: any;
  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    memberAddress = wallet.getRandomEthAddress();
    walletSpy.mockReturnValue(Promise.resolve({
      address: memberAddress,
      body: {}
    }));

    const wrapped: any = testEnv.wrap(createMember);
    const returns = await wrapped(memberAddress);
    expect(returns?.uid).toEqual(memberAddress.toLowerCase());
    walletSpy.mockReturnValue(Promise.resolve({
      address: memberAddress,
      body: {
        name: 'Space A'
      }
    }));
    const wCreate: any = testEnv.wrap(createSpace);
    space = await wCreate();
    expect(space?.uid).toBeDefined();

    body = {
      name: "All 4 HORNET",
      space: space.uid,
      additionalInfo: "The biggest governance decision in the history of IOTA",
      settings: {
        milestoneIndexCommence: 5,
        milestoneIndexStart: 6,
        milestoneIndexEnd: 8
      },
      type: ProposalType.NATIVE,
      subType: ProposalSubType.ONE_ADDRESS_ONE_VOTE,
      questions: [
        {
          text: "Give all the funds to the HORNET developers?",
          answers: [
            {
              value: 1,
              text: "YES",
              additionalInfo: "Go team!"
            },
            {
              value: 2,
              text: "Doh! Of course!",
              additionalInfo: "There is no other option"
            }
          ],
          additionalInfo: "This would fund the development of HORNET indefinitely"
        }
      ]
    };
  });

  it('successfully create proposal with name', async () => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: memberAddress,
      body: body
    }));

    const wrapped: any = testEnv.wrap(createProposal);
    const returns = await wrapped();
    expect(returns?.uid).toBeDefined();
    expect(returns?.name).toEqual(body.name);
    expect(returns?.additionalInfo).toEqual(body.additionalInfo);
    expect(returns?.milestoneIndexCommence).toEqual(body.milestoneIndexCommence);
    expect(returns?.milestoneIndexStart).toEqual(body.milestoneIndexStart);
    expect(returns?.milestoneIndexEnd).toEqual(body.milestoneIndexEnd);
    expect(returns?.type).toEqual(body.type);
    expect(returns?.questions).toBeDefined();
    expect(returns?.createdOn).toBeDefined();
    expect(returns?.updatedOn).toBeDefined();
    walletSpy.mockRestore();
  });

  describe('Proposal validations', () => {
    it('empty body', async () => {
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: {}
      }));

      const wrapped: any = testEnv.wrap(createProposal);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
    });

    it('missing name', async () => {
      delete body.name;
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createProposal);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
    });

    [
      'milestoneIndexCommence',
      'milestoneIndexStart',
      'milestoneIndexEnd'
    ].forEach((f) => {
      it('invalid ' + f, async () => {
        body[f] = 'sadas';
        walletSpy.mockReturnValue(Promise.resolve({
          address: memberAddress,
          body: body
        }));

        const wrapped: any = testEnv.wrap(createProposal);
        (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
      });
    });

    it('milestoneIndexStart < milestoneIndexCommence', async () => {
      body.settings = {};
      body.settings.milestoneIndexStart = 100;
      body.settings.milestoneIndexCommence = 40;
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createProposal);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
    });

    it('milestoneIndexEnd < milestoneIndexStart', async () => {
      body.settings = {};
      body.settings.milestoneIndexStart = 100;
      body.settings.milestoneIndexEnd = 40;
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createProposal);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
    });

    it('no questions', async () => {
      body.questions = [];
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createProposal);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
    });

    it('only one answer', async () => {
      delete body.questions[0].answers[1];
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createProposal);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
    });

    it('invalid type', async () => {
      body.type = 2;
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createProposal);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
    });
  });

  [
    'approve',
    'reject'
  ].forEach((s) => {
    const command = (s === 'approve' ? approveProposal : rejectProposal);
    const field = (s === 'approve' ? 'approved' : 'rejected');
    it(s + ' proposal', async () => {
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createProposal);
      const returns = await wrapped();
      expect(returns?.uid).toBeDefined();
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: {
          uid: returns.uid
        }
      }));
      const wrapped2: any = testEnv.wrap(command);
      const returns2 = await wrapped2();
      expect(returns2?.uid).toBeDefined();
      expect(returns2?.[field]).toEqual(true);
      walletSpy.mockRestore();
    });

    it('fail to ' + s + ' proposal (not guardian)', async () => {
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createProposal);
      const returns = await wrapped();
      expect(returns?.uid).toBeDefined();
      walletSpy.mockReturnValue(Promise.resolve({
        address: wallet.getRandomEthAddress(),
        body: {
          uid: returns.uid
        }
      }));
      const wrapped2: any = testEnv.wrap(command);
      (<any>expect(wrapped2())).rejects.toThrowError(WenError.you_are_not_guardian_of_space.key);
      walletSpy.mockRestore();
    });

    it(s + ' proposal by other guardian (not creator)', async () => {
      const guardian2 = wallet.getRandomEthAddress();

      // Join guardian2 as member of the space
      walletSpy.mockReturnValue(Promise.resolve({
        address: guardian2,
        body: {
          uid: space.uid
        }
      }));
      const jSpace: any = testEnv.wrap(joinSpace);
      const doc2 = await jSpace();
      expect(doc2).toBeDefined();
      expect(doc2.createdOn).toBeDefined();
      expect(doc2.uid).toEqual(guardian2);

      // Make guardian2 guardian of the space.
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: {
          uid: space.uid,
          member: guardian2
        }
      }));

      // Let's add guardian tp space.
      const aGuardian: any = testEnv.wrap(addGuardian);
      const doc3 = await aGuardian();
      expect(doc3).toBeDefined();

      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      // ----

      const wrapped: any = testEnv.wrap(createProposal);
      const returns = await wrapped();
      expect(returns?.uid).toBeDefined();
      walletSpy.mockReturnValue(Promise.resolve({
        address: guardian2,
        body: {
          uid: returns.uid
        }
      }));
      const wrapped2: any = testEnv.wrap(command);
      const returns2 = await wrapped2();
      expect(returns2?.uid).toBeDefined();
      expect(returns2?.[field]).toEqual(true);
      walletSpy.mockRestore();
    });
  });
});

describe('ProposalController: ' + WEN_FUNC.cProposal + ' MEMBERS', () => {
  let walletSpy: any;
  // Create helper functions.
  const mock = (address: string, body = {}) => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: address,
      body: body
    }));
  };

  const cSpace = async (address: string) => {
    mock(address, {
      name: 'Space A'
    });
    const wCreate: any = testEnv.wrap(createSpace);
    const space = await wCreate();
    expect(space?.uid).toBeDefined();
    return space!;
  };

  const jSpace = async (address: string, space: any) => {
    mock(address, {
      uid: space.uid
    });
    const wJoin: any = testEnv.wrap(joinSpace);
    const s = await wJoin();
    expect(s?.uid).toBeDefined();
    return s!;
  };

  const cProposal = (address: string, space: any, type: ProposalType, subType: ProposalSubType, addAnswers: any[] = [], awards: string[] = []) => {
    mock(address, {
      name: "Space Test",
      space: space.uid,
      settings: type === ProposalType.MEMBERS ? {
        startDate: new Date(),
        endDate: dayjs().add(5, 'day').toDate(),
        onlyGuardians: false,
        awards: awards
      } : {
        milestoneIndexCommence: 5,
        milestoneIndexStart: 6,
        milestoneIndexEnd: 8
      },
      type: type,
      subType: subType,
      questions: [
        {
          text: "Questions?",
          answers: [...[
            {
              value: 1,
              text: "YES"
            },
            {
              value: 2,
              text: "Doh! Of course!"
            }
          ], ...addAnswers]
        }
      ]
    });

    const wrapped: any = testEnv.wrap(createProposal);
    return wrapped();
  };

  const apprProposal = async (address: string, proposal: any) => {
    mock(address, {
      uid: proposal.uid
    });
    const wrapped: any = testEnv.wrap(approveProposal);
    const pr = await wrapped();
    expect(proposal?.uid).toBeDefined();
    return pr;
  };

  const vote = async (address: string, proposal: any, values: any) => {
    mock(address, {
      uid: proposal.uid,
      values: values
    });
    const wrapped: any = testEnv.wrap(voteOnProposal);
    const pr = await wrapped();
    expect(proposal?.uid).toBeDefined();
    return pr;
  };


  const cMember = async (address = wallet.getRandomEthAddress()) => {
    mock(address);
    const wrapped: any = testEnv.wrap(createMember);
    const returns = await wrapped(address);
    expect(returns?.uid).toEqual(address.toLowerCase());
    return returns!.uid;
  };

  const giveBadge = async (guardian: string, address: string, space: any, xp: number) => {
    // Create Award.
    mock(address, {
      name: 'Award A',
      description: 'Finish this and that',
      space: space?.uid,
      type: AwardType.PARTICIPATE_AND_APPROVE,
      endDate: dayjs().add(5, 'days').toDate(),
      badge: {
        name: 'Winner',
        description: 'Such a special',
        count: 1,
        xp: xp || 0
      }
    });
    const wrappedAward: any = testEnv.wrap(createAward);
    const award = await wrappedAward();
    expect(award?.uid).toBeDefined();

    // Participate
    mock(address, { uid: award?.uid});
    const wrappedParticipate: any = testEnv.wrap(participate);
    const returnsParti = await wrappedParticipate();
    expect(returnsParti?.uid).toBeDefined();

    // Approve
    mock(guardian, {
      uid: award.uid,
      member: address
    });
    const wrapped2: any = testEnv.wrap(approveParticipant);
    const returns2 = await wrapped2();
    expect(returns2?.uid).toBeDefined();

    return award;
  };

  beforeEach(async () => {
    // Disable start date validation.
    ProposalStartDateMin.value = -60 * 60;
    RelatedRecordsResponse.status = true;
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    jest.setTimeout(50 * 1000)
  });

  afterEach(async () => {
    // Disable start date validation.
    ProposalStartDateMin.value = 5 * 60 * 1000;
  });

  it('create proposal ', async () => {
    const memberId = await cMember();
    const space = await cSpace(memberId);
    await cProposal(memberId, space, ProposalType.MEMBERS, ProposalSubType.ONE_MEMBER_ONE_VOTE);
  });

  it('create proposal - invalid combination Members - ONE_ADDRESS_ONE_VOTE ', async () => {
    const memberId = await cMember();
    const space = await cSpace(memberId);
    (<any>expect(
      cProposal(memberId, space, ProposalType.MEMBERS, ProposalSubType.ONE_ADDRESS_ONE_VOTE)
    )).rejects.toThrowError(WenError.invalid_params.key);
  });

  it('create proposal - invalid combination NATIVE - REPUTATION_BASED_ON_AWARDS ', async () => {
    const memberId = await cMember();
    const space = await cSpace(memberId);
    (<any>expect(
      cProposal(memberId, space, ProposalType.NATIVE, ProposalSubType.REPUTATION_BASED_ON_AWARDS)
    )).rejects.toThrowError(WenError.invalid_params.key);
  });

  it('create proposal - invalid combination NATIVE - REPUTATION_BASED_ON_SPACE ', async () => {
    const memberId = await cMember();
    const space = await cSpace(memberId);
    (<any>expect(
      cProposal(memberId, space, ProposalType.NATIVE, ProposalSubType.REPUTATION_BASED_ON_SPACE)
    )).rejects.toThrowError(WenError.invalid_params.key);
  });

  it('create proposal - invalid combination NATIVE - ONE_MEMBER_ONE_VOTE ', async () => {
    const memberId = await cMember();
    const space = await cSpace(memberId);
    (<any>expect(
      cProposal(memberId, space, ProposalType.NATIVE, ProposalSubType.ONE_MEMBER_ONE_VOTE)
    )).rejects.toThrowError(WenError.invalid_params.key);
  });

  it('create proposal, approve & vote ', async () => {
    const memberId = await cMember();
    const space = await cSpace(memberId);
    await giveBadge(memberId, memberId, space, 10);
    const proposal = await cProposal(memberId, space, ProposalType.MEMBERS, ProposalSubType.ONE_MEMBER_ONE_VOTE);

    // Approve proposal.
    await apprProposal(memberId, proposal)

    // Let's vote.
    const v: any = await vote(memberId, proposal, [1]);
    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(1);
  });

  it('create proposal, approve & vote - REPUTATION_BASED_ON_SPACE ', async () => {
    const memberId = await cMember();
    const space = await cSpace(memberId);
    await giveBadge(memberId, memberId, space, 10);
    const proposal = await cProposal(memberId, space, ProposalType.MEMBERS, ProposalSubType.REPUTATION_BASED_ON_SPACE);

    // Approve proposal.
    await apprProposal(memberId, proposal)

    // Let's vote.
    const v: any = await vote(memberId, proposal, [1]);
    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(10);
  });

  it('create proposal, approve & vote - REPUTATION_BASED_ON_SPACE 2 awards', async () => {
    const memberId = await cMember();
    const space = await cSpace(memberId);
    await giveBadge(memberId, memberId, space, 10);
    await giveBadge(memberId, memberId, space, 30);
    const proposal = await cProposal(memberId, space, ProposalType.MEMBERS, ProposalSubType.REPUTATION_BASED_ON_SPACE);

    // Approve proposal.
    await apprProposal(memberId, proposal)

    // Let's vote.
    const v: any = await vote(memberId, proposal, [1]);
    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(40);
  });

  it('create proposal, approve & vote - REPUTATION_BASED_ON_AWARDS 2 awards (using only one)', async () => {
    const memberId = await cMember();
    const space = await cSpace(memberId);
    const award = await giveBadge(memberId, memberId, space, 10);
    await giveBadge(memberId, memberId, space, 30);
    const proposal = await cProposal(memberId, space, ProposalType.MEMBERS, ProposalSubType.REPUTATION_BASED_ON_AWARDS, undefined, [award.uid]);

    // Approve proposal.
    await apprProposal(memberId, proposal)

    // Let's vote.
    const v: any = await vote(memberId, proposal, [1]);
    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(10);
  });

  it('create proposal, approve & vote - REPUTATION_BASED_ON_AWARDS 3 awards (using all)', async () => {
    const memberId = await cMember();
    const space = await cSpace(memberId);
    const award = await giveBadge(memberId, memberId, space, 10);
    const award2 = await giveBadge(memberId, memberId, space, 20);
    const award3 = await giveBadge(memberId, memberId, space, 10);
    const proposal = await cProposal(memberId, space, ProposalType.MEMBERS, ProposalSubType.REPUTATION_BASED_ON_AWARDS, undefined, [award.uid, award2.uid, award3.uid]);

    // Approve proposal.
    await apprProposal(memberId, proposal)

    // Let's vote.
    const v: any = await vote(memberId, proposal, [1]);
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
    const proposal = await cProposal(memberId, space, ProposalType.MEMBERS, ProposalSubType.ONE_MEMBER_ONE_VOTE);

    // Approve proposal.
    await apprProposal(memberId, proposal)

    // Let's vote.
    await vote(memberId1, proposal, [1]);
    await vote(memberId2, proposal, [1]);
    await vote(memberId3, proposal, [1]);
    await vote(memberId4, proposal, [1]);
    await vote(memberId5, proposal, [1]);
    // const v6: any = await vote(memberId6, proposal, [1]);
    await vote(memberId7, proposal, [1]);
    const v: any = await vote(memberId, proposal, [1]);
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
    const proposal = await cProposal(memberId, space, ProposalType.MEMBERS, ProposalSubType.ONE_MEMBER_ONE_VOTE);

    // Approve proposal.
    await apprProposal(memberId, proposal)

    // Let's vote.
    await vote(memberId1, proposal, [1]);
    await vote(memberId2, proposal, [1]);
    await vote(memberId3, proposal, [2]);
    await vote(memberId4, proposal, [2]);
    await vote(memberId5, proposal, [2]);
    // const v6: any = await vote(memberId6, proposal, [1]);
    await vote(memberId7, proposal, [1]);
    const v: any = await vote(memberId, proposal, [1]);
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

    const proposal = await cProposal(memberId, space, ProposalType.MEMBERS, ProposalSubType.REPUTATION_BASED_ON_SPACE);

    // Approve proposal.
    await apprProposal(memberId, proposal)

    // Let's vote.
    await vote(memberId2, proposal, [2]);
    await vote(memberId3, proposal, [2]);
    await vote(memberId1, proposal, [1]);
    await vote(memberId, proposal, [1]); // 150
    const v: any = await vote(memberId4, proposal, [2]); // 75
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

    const proposal = await cProposal(memberId, space, ProposalType.MEMBERS, ProposalSubType.REPUTATION_BASED_ON_AWARDS, undefined, [badgeA!.uid]);

    // Approve proposal.
    await apprProposal(memberId, proposal)

    // Let's vote.
    await vote(memberId1, proposal, [2]);
    const v: any = await vote(memberId, proposal, [1]);

    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(30);
    expect(v._relatedRecs.proposal.results.answers['1']).toEqual(30);
    expect(v._relatedRecs.proposal.results.answers['2']).toEqual(0);
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
      memberId, space, ProposalType.MEMBERS,
      ProposalSubType.REPUTATION_BASED_ON_AWARDS, undefined, [badgeA!.uid, badgeB!.uid, badgeC!.uid, badgeD!.uid]
    );

    // Approve proposal.
    await apprProposal(memberId, proposal)

    // Let's vote.
    await vote(memberId, proposal, [1]);
    await vote(memberId1, proposal, [1]);
    const v: any = await vote(memberId, proposal, [2]);

    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(60);
    expect(v._relatedRecs.proposal.results.answers['1']).toEqual(30);
    expect(v._relatedRecs.proposal.results.answers['2']).toEqual(60);
    expect(v._relatedRecs.proposal.results.voted).toEqual(90);
    expect(v._relatedRecs.proposal.results.total).toEqual(90);
    expect(v._relatedRecs.proposal.totalWeight).toEqual(90);
  });
});
