import { WEN_FUNC } from "../../interfaces/functions";
import { createMember } from '../../src/controls/member.control';
import { createSpace } from '../../src/controls/space.control';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { WenError } from './../../interfaces/errors';
import { ProposalType } from './../../interfaces/models/proposal';
import { approveProposal, createProposal } from './../../src/controls/proposal.control';
import { addGuardian, joinSpace } from './../../src/controls/space.control';

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
          index: 1,
          text: "Give all the funds to the HORNET developers?",
          answers: [
            {
              index: 1,
              text: "YES",
              additionalInfo: "Go team!"
            },
            {
              index: 2,
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

  it('approve proposal', async () => {
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
    walletSpy.mockRestore();
  });

  it('fail to approve proposal (not guardian)', async () => {
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
    const wrapped2: any = testEnv.wrap(approveProposal);
    (<any>expect(wrapped2())).rejects.toThrowError(WenError.you_are_not_owner_of_proposal.key);
    walletSpy.mockRestore();
  });

  it('approve proposal by other guardian (not creator)', async () => {
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
    const wrapped2: any = testEnv.wrap(approveProposal);
    const returns2 = await wrapped2();
    expect(returns2?.uid).toBeDefined();
    expect(returns2?.approved).toEqual(true);
    walletSpy.mockRestore();
  });
});
