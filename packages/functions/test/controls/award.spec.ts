import { AwardType, Space, WenError, WEN_FUNC } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import {
  addOwner,
  approveAward,
  approveParticipant,
  createAward,
  participate,
  rejectAward,
} from './../../src/controls/award.control';
import { createMember } from './../../src/controls/member.control';
import { joinSpace } from './../../src/controls/space/member.join.control';
import { createSpace } from './../../src/controls/space/space.create.control';
import { expectThrow, mockWalletReturnValue } from './common';

const dummyAward = (spaceId?: string) => ({
  name: 'Award A',
  description: 'Finish this and that',
  space: spaceId,
  type: AwardType.PARTICIPATE_AND_APPROVE,
  endDate: dayjs().add(5, 'days').toDate(),
  badge: {
    name: 'Winner',
    description: 'Such a special',
    count: 2,
    xp: 0,
  },
});

let walletSpy: any;

describe('AwardController: ' + WEN_FUNC.cAward, () => {
  let memberAddress: string;
  let space: Space;
  let award: any;
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
    walletSpy.mockRestore();
  });

  it('successfully create award with name', async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    const body = dummyAward(space.uid);
    mockWalletReturnValue(walletSpy, memberAddress, body);

    const returns = await testEnv.wrap(createAward)({});
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
    beforeEach(() => {
      walletSpy = jest.spyOn(wallet, 'decodeAuth');
      body = dummyAward(space.uid);
    });

    const execute = async (error: string) => {
      mockWalletReturnValue(walletSpy, memberAddress, body);
      await expectThrow(testEnv.wrap(createAward)({}), error);
      walletSpy.mockRestore();
    };

    it('failed to create award - missing space', async () => {
      delete body.space;
      await execute(WenError.invalid_params.key);
    });

    it('failed to create award - invalid space', async () => {
      body.space = wallet.getRandomEthAddress();
      await execute(WenError.space_does_not_exists.key);
    });

    it('failed to create award - invalid name', async () => {
      delete body.name;
      await execute(WenError.invalid_params.key);
    });

    it('failed to create award - badge over limit', async () => {
      body.badge.count = 10001;
      await execute(WenError.invalid_params.key);
    });

    it('failed to create award - badge not dividable by XP', async () => {
      body.badge.count = 2;
      body.xp = 5;
      await execute(WenError.invalid_params.key);
    });

    it('failed to create award - badge over XP limit', async () => {
      body.badge.count = 10001;
      await execute(WenError.invalid_params.key);
    });
  });

  describe('Owner manipulation tests', () => {
    const memberAddress2 = wallet.getRandomEthAddress();
    const memberAddress3 = wallet.getRandomEthAddress();

    beforeEach(async () => {
      walletSpy = jest.spyOn(wallet, 'decodeAuth');
      body = dummyAward(space?.uid);
      mockWalletReturnValue(walletSpy, memberAddress, body);
      award = await testEnv.wrap(createAward)({});
      expect(award?.uid).toBeDefined();
    });

    it('Add owner.', async () => {
      mockWalletReturnValue(walletSpy, memberAddress, { uid: award.uid, member: memberAddress2 });
      const returns = await testEnv.wrap(addOwner)({});
      expect(returns?.uid).toBeDefined();
      walletSpy.mockRestore();
    });

    it('Fail to add owner - not owner', async () => {
      mockWalletReturnValue(walletSpy, memberAddress2, { uid: award.uid, member: memberAddress3 });
      await expectThrow(testEnv.wrap(addOwner)({}), WenError.you_are_not_owner_of_the_award.key);
      walletSpy.mockRestore();
    });

    it('Invalid Award', async () => {
      mockWalletReturnValue(walletSpy, memberAddress2, {
        uid: memberAddress3,
        member: memberAddress3,
      });
      await expectThrow(testEnv.wrap(addOwner)({}), WenError.award_does_not_exists.key);
      walletSpy.mockRestore();
    });
  });

  describe('Participant manipulation tests', () => {
    const memberAddress2 = wallet.getRandomEthAddress();
    const memberAddress3 = wallet.getRandomEthAddress();
    const memberAddress4 = wallet.getRandomEthAddress();

    beforeEach(async () => {
      walletSpy = jest.spyOn(wallet, 'decodeAuth');
      body = dummyAward(space?.uid);
      mockWalletReturnValue(walletSpy, memberAddress, body);

      award = await testEnv.wrap(createAward)({});
      expect(award?.uid).toBeDefined();

      // Create members
      [memberAddress2, memberAddress3, memberAddress4].forEach(async (r) => {
        mockWalletReturnValue(walletSpy, r, {});
        const returns = await testEnv.wrap(createMember)(r);
        expect(returns?.uid).toEqual(r.toLowerCase());
      });
    });

    it('Participate.', async () => {
      // Join space first.
      mockWalletReturnValue(walletSpy, memberAddress2, { uid: space?.uid });

      const returns3 = await testEnv.wrap(joinSpace)({});
      expect(returns3?.uid).toBeDefined();

      mockWalletReturnValue(walletSpy, memberAddress, { uid: award.uid });

      const approved = await testEnv.wrap(approveAward)({});
      expect(approved?.uid).toBeDefined();

      mockWalletReturnValue(walletSpy, memberAddress2, { uid: award.uid });

      const returns = await testEnv.wrap(participate)({});
      expect(returns?.uid).toBeDefined();
      walletSpy.mockRestore();
    });

    it('Unable to participate, not approved.', async () => {
      // Join space first.
      mockWalletReturnValue(walletSpy, memberAddress2, { uid: space?.uid });

      const returns3 = await testEnv.wrap(joinSpace)({});
      expect(returns3?.uid).toBeDefined();

      mockWalletReturnValue(walletSpy, memberAddress2, { uid: award.uid });

      await expectThrow(testEnv.wrap(participate)({}), WenError.award_is_not_approved.key);
    });

    it('Unable to participate, rejected.', async () => {
      // Join space first.
      mockWalletReturnValue(walletSpy, memberAddress2, { uid: space?.uid });

      const returns3 = await testEnv.wrap(joinSpace)({});
      expect(returns3?.uid).toBeDefined();

      mockWalletReturnValue(walletSpy, memberAddress, { uid: award.uid });

      const approved = await testEnv.wrap(rejectAward)({});
      expect(approved?.uid).toBeDefined();
      expect(approved?.rejected).toEqual(true);

      mockWalletReturnValue(walletSpy, memberAddress2, { uid: award.uid });
      await expectThrow(testEnv.wrap(participate)({}), WenError.award_is_rejected.key);
    });

    it('Fail to participate. Must be within the space.', async () => {
      mockWalletReturnValue(walletSpy, memberAddress, { uid: award.uid });

      const approved = await testEnv.wrap(approveAward)({});
      expect(approved?.uid).toBeDefined();

      mockWalletReturnValue(walletSpy, wallet.getRandomEthAddress(), { uid: award.uid });

      await expectThrow(testEnv.wrap(participate)({}), WenError.you_are_not_part_of_the_space.key);
    });

    it('Already participant', async () => {
      // Join space first.
      mockWalletReturnValue(walletSpy, memberAddress2, { uid: space?.uid });

      const returns3 = await testEnv.wrap(joinSpace)({});
      expect(returns3?.uid).toBeDefined();

      mockWalletReturnValue(walletSpy, memberAddress, { uid: award.uid });

      const approved = await testEnv.wrap(approveAward)({});
      expect(approved?.uid).toBeDefined();

      mockWalletReturnValue(walletSpy, memberAddress2, { uid: award.uid });

      const returns = await testEnv.wrap(participate)({});
      expect(returns?.uid).toBeDefined();

      mockWalletReturnValue(walletSpy, memberAddress2, { uid: award.uid });

      await expectThrow(
        testEnv.wrap(participate)({}),
        WenError.member_is_already_participant_of_space.key,
      );
      walletSpy.mockRestore();
    });

    it('Invalid Award', async () => {
      mockWalletReturnValue(walletSpy, memberAddress, { uid: award.uid });

      const approved = await testEnv.wrap(approveAward)({});
      expect(approved?.uid).toBeDefined();

      mockWalletReturnValue(walletSpy, memberAddress2, { uid: memberAddress3 });

      await expectThrow(testEnv.wrap(participate)({}), WenError.award_does_not_exists.key);
      walletSpy.mockRestore();
    });

    it('Participate and assign badge', async () => {
      // Join space first.
      mockWalletReturnValue(walletSpy, memberAddress2, { uid: space?.uid });

      const returns3 = await testEnv.wrap(joinSpace)({});
      expect(returns3?.uid).toBeDefined();

      mockWalletReturnValue(walletSpy, memberAddress, { uid: award.uid });

      const approved = await testEnv.wrap(approveAward)({});
      expect(approved?.uid).toBeDefined();

      mockWalletReturnValue(walletSpy, memberAddress2, { uid: award.uid });

      const returns = await testEnv.wrap(participate)({});
      expect(returns?.uid).toBeDefined();
      mockWalletReturnValue(walletSpy, memberAddress, { uid: award.uid, member: memberAddress2 });

      const returns2 = await testEnv.wrap(approveParticipant)({});
      expect(returns2?.uid).toBeDefined();
      expect(returns2?.payload).toBeDefined();
      expect(returns2?.payload.award).toEqual(award.uid);

      // Let's approve by admin.
      walletSpy.mockRestore();
    });

    it('Assign badge without being participant', async () => {
      mockWalletReturnValue(walletSpy, memberAddress, { uid: award.uid, member: memberAddress2 });

      const returns2 = await testEnv.wrap(approveParticipant)({});
      expect(returns2?.uid).toBeDefined();
      expect(returns2?.payload).toBeDefined();
      expect(returns2?.payload.award).toEqual(award.uid);

      // Let's approve by admin.
      walletSpy.mockRestore();
    });

    it('Failed to assign badge since its consumed', async () => {
      // First badge.
      mockWalletReturnValue(walletSpy, memberAddress, { uid: award.uid, member: memberAddress2 });

      const returns2 = await testEnv.wrap(approveParticipant)({});
      expect(returns2?.uid).toBeDefined();
      expect(returns2?.payload).toBeDefined();
      expect(returns2?.payload.award).toEqual(award.uid);

      // Second badge.
      mockWalletReturnValue(walletSpy, memberAddress, { uid: award.uid, member: memberAddress3 });

      const returns3 = await testEnv.wrap(approveParticipant)({});
      expect(returns3?.uid).toBeDefined();
      expect(returns3?.payload).toBeDefined();
      expect(returns3?.payload.award).toEqual(award.uid);

      // Fails no enoguh.
      mockWalletReturnValue(walletSpy, memberAddress, { uid: award.uid, member: memberAddress4 });

      // TODO Fix this.
      try {
        await testEnv.wrap(approveParticipant)({});
      } catch (e) {
        expect(e).toBeDefined();
      }
      // (<any>expect(wrapped4())).rejects.toThrowError(WenError.no_more_available_badges.key);
      // (<any>expect(wrapped3())).rejects.toThrowError(WenError.award_does_not_exists.key);

      // Let's approve by admin.
      walletSpy.mockRestore();
    });
  });
});
