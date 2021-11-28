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

  const giveBadge = async (address: string, space: any, xp: number) => {
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
    mock(address, {
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

  it('create proposal - invalid combination NATIVE - REPUTATION_WITHIN_SPACE ', async () => {
    const memberId = await cMember();
    const space = await cSpace(memberId);
    (<any>expect(
      cProposal(memberId, space, ProposalType.NATIVE, ProposalSubType.REPUTATION_WITHIN_SPACE)
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
    await giveBadge(memberId, space, 10);
    const proposal = await cProposal(memberId, space, ProposalType.MEMBERS, ProposalSubType.ONE_MEMBER_ONE_VOTE);

    // Approve proposal.
    await apprProposal(memberId, proposal)

    // Let's vote.
    const v: any = await vote(memberId, proposal, [1]);
    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(1);
  });

  it('create proposal, approve & vote - REPUTATION_WITHIN_SPACE ', async () => {
    const memberId = await cMember();
    const space = await cSpace(memberId);
    await giveBadge(memberId, space, 10);
    const proposal = await cProposal(memberId, space, ProposalType.MEMBERS, ProposalSubType.REPUTATION_WITHIN_SPACE);

    // Approve proposal.
    await apprProposal(memberId, proposal)

    // Let's vote.
    const v: any = await vote(memberId, proposal, [1]);
    expect(v?.payload).toBeDefined();
    expect(v?.payload?.weight).toEqual(10);
  });

  it('create proposal, approve & vote - REPUTATION_WITHIN_SPACE 2 awards', async () => {
    const memberId = await cMember();
    const space = await cSpace(memberId);
    await giveBadge(memberId, space, 10);
    await giveBadge(memberId, space, 30);
    const proposal = await cProposal(memberId, space, ProposalType.MEMBERS, ProposalSubType.REPUTATION_WITHIN_SPACE);

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
    const award = await giveBadge(memberId, space, 10);
    await giveBadge(memberId, space, 30);
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
    const award = await giveBadge(memberId, space, 10);
    const award2 = await giveBadge(memberId, space, 20);
    const award3 = await giveBadge(memberId, space, 10);
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
    // expect(v._relatedRecs.proposal.totalWeight).toEqual(40);
  });
});
