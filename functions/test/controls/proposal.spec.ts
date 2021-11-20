import { WEN_FUNC } from "../../interfaces/functions";
import { createMember } from '../../src/controls/member.control';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { WenError } from './../../interfaces/errors';
import { ProposalType } from './../../interfaces/models/proposal';
import { TransactionType } from './../../interfaces/models/transaction';
import { approveProposal, createProposal, rejectProposal, voteOnProposal } from './../../src/controls/proposal.control';
import { addGuardian, createSpace, joinSpace } from './../../src/controls/space.control';

describe('ProposalController: ' + WEN_FUNC.cProposal, () => {
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

  it('Approve proposal & vote', async () => {
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
    const wrapped2: any = testEnv.wrap(approveProposal);
    const returns2 = await wrapped2();
    expect(returns2?.uid).toBeDefined();
    expect(returns2?.approved).toEqual(true);

    walletSpy.mockReturnValue(Promise.resolve({
      address: memberAddress,
      body: {
        uid: returns.uid,
        values: [2]
      }
    }));
    // Let's do vote by guardian.
    const wrapped3: any = testEnv.wrap(voteOnProposal);
    const returns3 = await wrapped3();
    expect(returns3?.uid).toBeDefined();
    expect(returns3?.type).toEqual(TransactionType.VOTE);
    expect(returns3?.payload.values).toEqual([2]);

    // Let's go
    walletSpy.mockRestore();
  });

  it('Approve proposal & vote - fails - value does not exists', async () => {
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
    const wrapped2: any = testEnv.wrap(approveProposal);
    const returns2 = await wrapped2();
    expect(returns2?.uid).toBeDefined();
    expect(returns2?.approved).toEqual(true);

    walletSpy.mockReturnValue(Promise.resolve({
      address: memberAddress,
      body: {
        uid: returns.uid,
        values: [3]
      }
    }));
    // Let's do vote by guardian.
    const wrapped3: any = testEnv.wrap(voteOnProposal);
    (<any>expect(wrapped3())).rejects.toThrowError(WenError.value_does_not_exists_in_proposal.key);

    // Let's go
    walletSpy.mockRestore();
  });
});

