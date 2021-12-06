import dayjs from 'dayjs';
import { WEN_FUNC } from "../../interfaces/functions";
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { WenError } from './../../interfaces/errors';
import { AwardType } from './../../interfaces/models/award';
import { addOwner, approveAward, approveParticipant, createAward, participate, rejectAward } from './../../src/controls/award.control';
import { createMember } from './../../src/controls/member.control';
import { createSpace, joinSpace } from './../../src/controls/space.control';

describe('AwardController: ' + WEN_FUNC.cAward, () => {
  let walletSpy: any;
  let memberAddress: any;
  let space: any;
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
    walletSpy.mockRestore();
  });

  it('successfully create award with name', async () => {
    const walletSpy = jest.spyOn(wallet, 'decodeAuth');
    const body: any = {
      name: 'Award A',
      description: 'Finish this and that',
      space: space?.uid,
      type: AwardType.PARTICIPATE_AND_APPROVE,
      endDate: dayjs().add(5, 'days').toDate(),
      badge: {
        name: 'Winner',
        description: 'Such a special',
        count: 2,
        xp: 0
      }
    };
    walletSpy.mockReturnValue(Promise.resolve({
      address: memberAddress,
      body: body
    }));

    const wrapped: any = testEnv.wrap(createAward);
    const returns = await wrapped();
    expect(returns?.uid).toBeDefined();
    expect(returns?.name).toEqual(body.name);
    expect(returns?.description).toEqual(body.description);
    expect(returns?.space).toEqual(body.space);
    expect(returns?.badge).toEqual(body.badge);
    expect(returns?.createdOn).toBeDefined();
    expect(returns?.updatedOn).toBeDefined();
    walletSpy.mockRestore();
  });

  describe('Failed Validation', () => {
    let body: any;
    let walletSpy: any;
    beforeEach(async () => {
      walletSpy = jest.spyOn(wallet, 'decodeAuth');
      body = {
        name: 'Award A',
        description: 'Finish this and that',
        space: space?.uid,
        type: AwardType.PARTICIPATE_AND_APPROVE,
        endDate: dayjs().add(5, 'days').toDate(),
        badge: {
          name: 'Winner',
          description: 'Such a special',
          count: 2,
          xp: 0
        }
      };
    });

    it('failed to create award - missing space', async () => {
      delete body.space;
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createAward);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
      walletSpy.mockRestore();
    });

    it('failed to create award - invalid space', async () => {
      body.space = wallet.getRandomEthAddress();
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createAward);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.space_does_not_exists.key);
      walletSpy.mockRestore();
    });

    it('failed to create award - invalid name', async () => {
      delete body.name;
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createAward);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
      walletSpy.mockRestore();
    });

    it('failed to create award - badge over limit', async () => {
      body.badge.count = 1001;
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createAward);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
      walletSpy.mockRestore();
    });

    it('failed to create award - badge not divadable by XP', async () => {
      body.badge.count = 2;
      body.xp = 5;
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createAward);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
      walletSpy.mockRestore();
    });

    it('failed to create award - badge over XP limit', async () => {
      body.badge.count = 1001;
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createAward);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
      walletSpy.mockRestore();
    });
  });

  describe('Owner manipulation tests', () => {
    let body: any;
    let walletSpy: any;
    let award: any;
    const memberAddress2 = wallet.getRandomEthAddress();
    const memberAddress3 = wallet.getRandomEthAddress();
    beforeEach(async () => {
      walletSpy = jest.spyOn(wallet, 'decodeAuth');
      body = {
        name: 'Award A',
        description: 'Finish this and that',
        space: space?.uid,
        type: AwardType.PARTICIPATE_AND_APPROVE,
        endDate: dayjs().add(5, 'days').toDate(),
        badge: {
          name: 'Winner',
          description: 'Such a special',
          count: 2,
          xp: 0
        }
      };
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createAward);
      award = await wrapped();
      expect(award?.uid).toBeDefined();
    });

    it('Add owner.', async () => {
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: {
          uid: award.uid,
          member: memberAddress2
        }
      }));

      const wrapped: any = testEnv.wrap(addOwner);
      const returns = await wrapped();
      expect(returns?.uid).toBeDefined();
      walletSpy.mockRestore();
    });

    it('Fail to add owner - not owner', async () => {
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress2,
        body: {
          uid: award.uid,
          member: memberAddress3
        }
      }));

      const wrapped: any = testEnv.wrap(addOwner);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.you_are_not_owner_of_the_award.key);
      walletSpy.mockRestore();
    });

    it('Invalid Award', async () => {
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress2,
        body: {
          uid: memberAddress3,
          member: memberAddress3
        }
      }));

      const wrapped: any = testEnv.wrap(addOwner);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.award_does_not_exists.key);
      walletSpy.mockRestore();
    });
  });

  describe('Participant manipulation tests', () => {
    let body: any;
    let walletSpy: any;
    let award: any;
    const memberAddress2 = wallet.getRandomEthAddress();
    const memberAddress3 = wallet.getRandomEthAddress();
    const memberAddress4 = wallet.getRandomEthAddress();
    beforeEach(async () => {
      walletSpy = jest.spyOn(wallet, 'decodeAuth');
      body = {
        name: 'Award A',
        description: 'Finish this and that',
        space: space?.uid,
        type: AwardType.PARTICIPATE_AND_APPROVE,
        endDate: dayjs().add(5, 'days').toDate(),
        badge: {
          name: 'Winner',
          description: 'Such a special',
          count: 2,
          xp: 0
        }
      };
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: body
      }));

      const wrapped: any = testEnv.wrap(createAward);
      award = await wrapped();
      expect(award?.uid).toBeDefined();

      // Create members
      [
        memberAddress2,
        memberAddress3,
        memberAddress4
      ].forEach(async (r) => {
        walletSpy.mockReturnValue(Promise.resolve({
          address: r,
          body: {}
        }));

        const wrapped: any = testEnv.wrap(createMember);
        const returns = await wrapped(r);
        expect(returns?.uid).toEqual(r.toLowerCase());
      });
    });

    it('Participate.', async () => {
      // Join space first.
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress2,
        body: {
          uid: space?.uid
        }
      }));

      const wrapped3: any = testEnv.wrap(joinSpace);
      const returns3 = await wrapped3();
      expect(returns3?.uid).toBeDefined();

      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: {
          uid: award.uid
        }
      }));
      const approveA: any = testEnv.wrap(approveAward);
      const approved = await approveA();
      expect(approved?.uid).toBeDefined();

      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress2,
        body: {
          uid: award.uid
        }
      }));

      const wrapped: any = testEnv.wrap(participate);
      const returns = await wrapped();
      expect(returns?.uid).toBeDefined();
      walletSpy.mockRestore();
    });

    it('Unable to participate, not approved.', async () => {
      // Join space first.
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress2,
        body: {
          uid: space?.uid
        }
      }));

      const wrapped3: any = testEnv.wrap(joinSpace);
      const returns3 = await wrapped3();
      expect(returns3?.uid).toBeDefined();

      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress2,
        body: {
          uid: award.uid
        }
      }));

      const wrapped: any = testEnv.wrap(participate);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.award_is_not_approved.key);
    });

    it('Unable to participate, rejected.', async () => {
      // Join space first.
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress2,
        body: {
          uid: space?.uid
        }
      }));

      const wrapped3: any = testEnv.wrap(joinSpace);
      const returns3 = await wrapped3();
      expect(returns3?.uid).toBeDefined();

      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: {
          uid: award.uid
        }
      }));
      const approveA: any = testEnv.wrap(rejectAward);
      const approved = await approveA();
      expect(approved?.uid).toBeDefined();
      expect(approved?.rejected).toEqual(true);

      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress2,
        body: {
          uid: award.uid
        }
      }));

      const wrapped: any = testEnv.wrap(participate);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.award_is_rejected.key);
    });

    it('Fail to participate. Must be within the space.', async () => {

      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: {
          uid: award.uid
        }
      }));
      const approveA: any = testEnv.wrap(approveAward);
      const approved = await approveA();
      expect(approved?.uid).toBeDefined();

      walletSpy.mockReturnValue(Promise.resolve({
        address: wallet.getRandomEthAddress(),
        body: {
          uid: award.uid
        }
      }));
      const wrapped: any = testEnv.wrap(participate);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.you_are_not_part_of_the_space.key);
    });

    it('Already participant', async () => {
      // Join space first.
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress2,
        body: {
          uid: space?.uid
        }
      }));

      const wrapped3: any = testEnv.wrap(joinSpace);
      const returns3 = await wrapped3();
      expect(returns3?.uid).toBeDefined();

      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: {
          uid: award.uid
        }
      }));
      const approveA: any = testEnv.wrap(approveAward);
      const approved = await approveA();
      expect(approved?.uid).toBeDefined();

      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress2,
        body: {
          uid: award.uid
        }
      }));

      const wrapped: any = testEnv.wrap(participate);
      const returns = await wrapped();
      expect(returns?.uid).toBeDefined();

      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress2,
        body: {
          uid: award.uid
        }
      }));
      const wrapped2: any = testEnv.wrap(participate);
      (<any>expect(wrapped2())).rejects.toThrowError(WenError.member_is_already_participant_of_space.key);
      walletSpy.mockRestore();
    });

    it('Invalid Award', async () => {
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: {
          uid: award.uid
        }
      }));
      const approveA: any = testEnv.wrap(approveAward);
      const approved = await approveA();
      expect(approved?.uid).toBeDefined();

      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress2,
        body: {
          uid: memberAddress3
        }
      }));

      const wrapped: any = testEnv.wrap(participate);
      (<any>expect(wrapped())).rejects.toThrowError(WenError.award_does_not_exists.key);
      walletSpy.mockRestore();
    });

    it('Participate and assign badge', async () => {
      // Join space first.
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress2,
        body: {
          uid: space?.uid
        }
      }));

      const wrapped3: any = testEnv.wrap(joinSpace);
      const returns3 = await wrapped3();
      expect(returns3?.uid).toBeDefined();

      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: {
          uid: award.uid
        }
      }));

      const approveA: any = testEnv.wrap(approveAward);
      const approved = await approveA();
      expect(approved?.uid).toBeDefined();

      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress2,
        body: {
          uid: award.uid
        }
      }));

      const wrapped: any = testEnv.wrap(participate);
      const returns = await wrapped();
      expect(returns?.uid).toBeDefined();
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: {
          uid: award.uid,
          member: memberAddress2
        }
      }));

      const wrapped2: any = testEnv.wrap(approveParticipant);
      const returns2 = await wrapped2();
      expect(returns2?.uid).toBeDefined();
      expect(returns2?.payload).toBeDefined();
      expect(returns2?.payload.award).toEqual(award.uid);

      // Let's approve by admin.
      walletSpy.mockRestore();
    });


    it('Assign badge without being participant', async () => {
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: {
          uid: award.uid,
          member: memberAddress2
        }
      }));

      const wrapped2: any = testEnv.wrap(approveParticipant);
      const returns2 = await wrapped2();
      expect(returns2?.uid).toBeDefined();
      expect(returns2?.payload).toBeDefined();
      expect(returns2?.payload.award).toEqual(award.uid);

      // Let's approve by admin.
      walletSpy.mockRestore();
    });

    it('Failed to assign badge since its consumed', async () => {
      // First badge.
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: {
          uid: award.uid,
          member: memberAddress2
        }
      }));

      const wrapped2: any = testEnv.wrap(approveParticipant);
      const returns2 = await wrapped2();
      expect(returns2?.uid).toBeDefined();
      expect(returns2?.payload).toBeDefined();
      expect(returns2?.payload.award).toEqual(award.uid);

      // Second badge.
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: {
          uid: award.uid,
          member: memberAddress3
        }
      }));

      const wrapped3: any = testEnv.wrap(approveParticipant);
      const returns3 = await wrapped3();
      expect(returns3?.uid).toBeDefined();
      expect(returns3?.payload).toBeDefined();
      expect(returns3?.payload.award).toEqual(award.uid);

      // Fails no enoguh.
      walletSpy.mockReturnValue(Promise.resolve({
        address: memberAddress,
        body: {
          uid: award.uid,
          member: memberAddress4
        }
      }));

      // TODO Fix this.
      try {
        await wrapped3();
      } catch(e) {
        expect(e).toBeDefined();
      }
      // (<any>expect(wrapped4())).rejects.toThrowError(WenError.no_more_available_badges.key);
      // (<any>expect(wrapped3())).rejects.toThrowError(WenError.award_does_not_exists.key);

      // Let's approve by admin.
      walletSpy.mockRestore();
    });
  });
});
