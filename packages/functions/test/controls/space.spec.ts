import { build5Db } from '@build-5/database';
import {
  ADD_REMOVE_GUARDIAN_THRESHOLD_PERCENTAGE,
  COL,
  Member,
  Proposal,
  ProposalMember,
  ProposalType,
  SOON_PROJECT_ID,
  SUB_COL,
  Space,
  SpaceMember,
  TokenStatus,
  TransactionType,
  UPDATE_SPACE_THRESHOLD_PERCENTAGE,
  WEN_FUNC,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { tail } from 'lodash';
import * as wallet from '../../src/utils/wallet.utils';
import { mockWalletReturnValue, testEnv } from '../set-up';
import { addGuardianToSpace, expectThrow, removeGuardianFromSpace, wait } from './common';

const assertCreatedOnAndId = (data: any, uid: string) => {
  expect(data).toBeDefined();
  expect(data.createdOn).toBeDefined();
  expect(data.uid).toEqual(uid);
};

const joinSpaceFunc = async (member: string, uid: string) => {
  mockWalletReturnValue(member, { uid });
  const jSpace = await testEnv.wrap<SpaceMember>(WEN_FUNC.joinSpace);
  assertCreatedOnAndId(jSpace, member);
};

/** * TODO * at_least_one_guardian_must_be_in_the_space */ describe(
  'SpaceController: ' + WEN_FUNC.createSpace,
  () => {
    let member: string;
    beforeEach(async () => {
      member = await testEnv.createMember();
    });

    it('successfully create space', async () => {
      mockWalletReturnValue(member, {});
      const space = await testEnv.wrap<Space>(WEN_FUNC.createSpace);
      expect(space.uid).toBeDefined();
      expect(space.createdOn).toBeDefined();
      expect(space.updatedOn).toBeDefined();
      expect(space.totalGuardians).toEqual(1);
      expect(space.totalMembers).toEqual(1);
      expect(space.totalPendingMembers).toEqual(0);
    });

    it('successfully create space with name', async () => {
      mockWalletReturnValue(member, {
        name: 'Space ABC',
        about: 'very cool',
      });
      const space = await testEnv.wrap<Space>(WEN_FUNC.createSpace);
      expect(space.uid).toBeDefined();
      expect(space.name).toEqual('Space ABC');
      expect(space.about).toEqual('very cool');
      expect(space.totalGuardians).toEqual(1);
      expect(space.totalMembers).toEqual(1);
    });
  },
);

describe('SpaceController: ' + WEN_FUNC.updateSpace, () => {
  let guardian: string;
  let member: string;
  let space: Space;
  beforeEach(async () => {
    guardian = await testEnv.createMember();
    member = await testEnv.createMember();
    space = await testEnv.createSpace(guardian);
    await addGuardianToSpace(space.uid, member);
  });

  it('successfully update space', async () => {
    const updateParams = {
      uid: space?.uid,
      name: 'abc',
      github: 'sadas',
      twitter: 'asdasd',
      discord: 'adamkun1233',
    };
    const owner = <Member>await build5Db().doc(COL.MEMBER, guardian).get();
    mockWalletReturnValue(guardian, updateParams);
    const proposal = await testEnv.wrap<Proposal>(WEN_FUNC.updateSpace);
    expect(proposal.type).toBe(ProposalType.EDIT_SPACE);
    expect(proposal.approved).toBe(true);
    expect(proposal.results?.total).toBe(2);
    expect(proposal.results?.voted).toBe(1);
    expect(proposal.results?.answers).toEqual({ [1]: 1 });
    expect(proposal.additionalInfo).toBe(
      `${owner.uid} wants to edit the space. ` +
        `Request created on ${dayjs().format('MM/DD/YYYY')}. ` +
        `${UPDATE_SPACE_THRESHOLD_PERCENTAGE} % must agree for this action to proceed`,
    );
    expect(proposal.name).toBe('Edit space');
    // TODO - I'm running out of time and need to release this.    // expect(proposal.questions[0].additionalInfo).toBe(    //   'Changes requested.<br />' +    //     'Name: abc (previously: Space A)<br />' +    //     'Discord: adamkun1233 (previously: None)<br />' +    //     'Github: sadas (previously: None)<br />' +    //     'Twitter: asdasd (previously: None)<br />',    // );
    space = <Space>await build5Db().doc(COL.SPACE, space.uid).get();
    const updatedOn = space.updatedOn;
    mockWalletReturnValue(member, { uid: proposal.uid, value: 1 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);
    await wait(async () => {
      space = <Space>await build5Db().doc(COL.SPACE, space.uid).get();
      return dayjs(updatedOn?.toDate()).isBefore(dayjs(space.updatedOn?.toDate()));
    });
    expect(space.name).toBe(updateParams.name);
    expect(space.github).toBe(updateParams.github);
    expect(space.twitter).toBe(updateParams.twitter);
    expect(space.discord).toBe(updateParams.discord);
  });

  it('failed to update space - invalid URL', async () => {
    const updateParams = { uid: space?.uid, name: 'abc', twitter: 'WRONG URL' };
    mockWalletReturnValue(guardian, updateParams);
    await expectThrow(testEnv.wrap(WEN_FUNC.updateSpace), WenError.invalid_params.key);
  });

  it('failed to update space - missing UID', async () => {
    mockWalletReturnValue(guardian, { name: 'abc' });
    await expectThrow(testEnv.wrap(WEN_FUNC.updateSpace), WenError.invalid_params.key);
  });

  it('failed to update space - does not exists', async () => {
    mockWalletReturnValue(guardian, { uid: guardian, name: 'abc' });
    await expectThrow(testEnv.wrap(WEN_FUNC.updateSpace), WenError.space_does_not_exists.key);
  });

  it('Should only allow one ongoing edit proposal', async () => {
    const updateParams = { uid: space?.uid, name: 'new name' };
    mockWalletReturnValue(guardian, updateParams);
    const proposal = await testEnv.wrap<Proposal>(WEN_FUNC.updateSpace);

    mockWalletReturnValue(guardian, updateParams);
    await expectThrow(testEnv.wrap(WEN_FUNC.updateSpace), WenError.ongoing_proposal.key);

    mockWalletReturnValue(member, { uid: proposal.uid, value: 1 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);
    await wait(async () => {
      space = <Space>await build5Db().doc(COL.SPACE, space.uid).get();
      return space.name === 'new name';
    });
  });
});

describe('SpaceController: member management', () => {
  let guardian: string;
  let member: string;
  let space: Space;

  beforeEach(async () => {
    guardian = await testEnv.createMember();
    member = await testEnv.createMember();
    mockWalletReturnValue(guardian, { name: 'This space rocks' });
    space = await testEnv.wrap<Space>(WEN_FUNC.createSpace);
  });

  it('successfully join space', async () => {
    await joinSpaceFunc(member, space.uid);
    const memberDocRef = build5Db().doc(COL.MEMBER, member);
    const memberData = <Member>await memberDocRef.get();
    expect((memberData.spaces || {})[space.uid].isMember).toBe(true);
  });

  it('fail to join space - already in', async () => {
    mockWalletReturnValue(guardian, { uid: space.uid });
    await expectThrow(
      testEnv.wrap<SpaceMember>(WEN_FUNC.joinSpace),
      WenError.you_are_already_part_of_space.key,
    );
  });

  it('successfully leave space', async () => {
    await joinSpaceFunc(member, space.uid);
    mockWalletReturnValue(member, { uid: space.uid });
    const lSpace = await testEnv.wrap<{ status: string }>(WEN_FUNC.leaveSpace);
    expect(lSpace).toBeDefined();
    expect(lSpace.status).toEqual('success');
    const memberDocRef = build5Db().doc(COL.MEMBER, member);
    const memberData = <Member>await memberDocRef.get();
    expect((memberData.spaces || {})[space.uid].isMember).toBe(false);
  });

  it('fail to leave space - as only guardian', async () => {
    await joinSpaceFunc(member, space.uid);
    mockWalletReturnValue(guardian, { uid: space.uid });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.leaveSpace),
      WenError.at_least_one_guardian_must_be_in_the_space.key,
    );
  });

  it('fail to leave space - as only member', async () => {
    mockWalletReturnValue(guardian, { uid: space.uid });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.leaveSpace),
      WenError.at_least_one_member_must_be_in_the_space.key,
    );
  });

  it('fail to leave space where Im not in', async () => {
    mockWalletReturnValue(member, { uid: space.uid });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.leaveSpace),
      WenError.you_are_not_part_of_the_space.key,
    );
  });

  it('fail to make guardian - must be member', async () => {
    mockWalletReturnValue(guardian, { uid: space.uid, member });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.addGuardianSpace),
      WenError.member_is_not_part_of_the_space.key,
    );
  });

  it('fail to make guardian - already is', async () => {
    mockWalletReturnValue(guardian, { uid: space.uid, member: guardian });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.addGuardianSpace),
      WenError.member_is_already_guardian_of_space.key,
    );
  });

  it('successfully block member', async () => {
    await joinSpaceFunc(member, space.uid);
    mockWalletReturnValue(guardian, { uid: space.uid, member });
    const blockMemberResult = await testEnv.wrap(WEN_FUNC.blockMemberSpace);
    assertCreatedOnAndId(blockMemberResult, member);

    const spaceDocRef = build5Db().doc(COL.SPACE, space.uid);
    space = <Space>await spaceDocRef.get();
    expect(space.totalGuardians).toBe(1);
    expect(space.totalMembers).toBe(1);

    const guardianCount = await build5Db()
      .collection(COL.SPACE, space.uid, SUB_COL.GUARDIANS)
      .count();
    expect(guardianCount).toBe(1);

    const memberCount = await build5Db().collection(COL.SPACE, space.uid, SUB_COL.MEMBERS).count();
    expect(memberCount).toBe(1);
  });

  it('block member and unblock', async () => {
    await joinSpaceFunc(member, space.uid);

    mockWalletReturnValue(guardian, { uid: space.uid, member });
    const bMember = await testEnv.wrap(WEN_FUNC.blockMemberSpace);
    assertCreatedOnAndId(bMember, member);

    const spaceDocRef = build5Db().doc(COL.SPACE, space.uid);
    const blockedDocRef = build5Db().doc(COL.SPACE, space.uid, SUB_COL.BLOCKED_MEMBERS, member);
    let blocked = await blockedDocRef.get();
    expect(blocked).toBeDefined();

    mockWalletReturnValue(guardian, { uid: space.uid, member });
    const ubMember = await testEnv.wrap<{ status: string }>(WEN_FUNC.unblockMemberSpace);
    expect(ubMember).toBeDefined();
    expect(ubMember.status).toEqual('success');

    space = <Space>await spaceDocRef.get();
    expect(space.totalGuardians).toBe(1);
    expect(space.totalMembers).toBe(1);

    const guardianCount = await build5Db()
      .collection(COL.SPACE, space.uid, SUB_COL.GUARDIANS)
      .count();
    expect(guardianCount).toBe(1);

    const memberCount = await build5Db().collection(COL.SPACE, space.uid, SUB_COL.MEMBERS).count();
    expect(memberCount).toBe(1);

    blocked = await blockedDocRef.get();
    expect(blocked).toBeUndefined();
  });

  it('fail to block member - if its the only one', async () => {
    mockWalletReturnValue(guardian, { uid: space.uid, member: guardian });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.blockMemberSpace),
      WenError.at_least_one_member_must_be_in_the_space.key,
    );
  });

  it('fail to block myself if Im only guardian', async () => {
    await joinSpaceFunc(member, space.uid);
    mockWalletReturnValue(guardian, { uid: space.uid, member: guardian });
    await expectThrow(testEnv.wrap(WEN_FUNC.blockMemberSpace), WenError.can_not_block_guardian.key);
  });

  it('successfully block member and unable to join space', async () => {
    await joinSpaceFunc(member, space.uid);
    mockWalletReturnValue(guardian, { uid: space.uid, member });
    const bMember = await testEnv.wrap(WEN_FUNC.blockMemberSpace);
    assertCreatedOnAndId(bMember, member);
    mockWalletReturnValue(member, { uid: space.uid });
    await expectThrow(
      testEnv.wrap<SpaceMember>(WEN_FUNC.joinSpace),
      WenError.you_are_not_allowed_to_join_space.key,
    );
  });

  describe('SpaceController: member management - NOT OPEN', () => {
    beforeEach(async () => {
      guardian = await testEnv.createMember();
      member = await testEnv.createMember();
      space = await testEnv.createSpace(guardian);
      await build5Db().doc(COL.SPACE, space.uid).update({ open: false });
    });

    it('successfully join space', async () => {
      await joinSpaceFunc(member, space.uid);
    });

    it('successfully join space and fail to accept - NOT GUARDIAN', async () => {
      await joinSpaceFunc(member, space.uid);
      mockWalletReturnValue(member, { uid: space.uid, member });
      await expectThrow(
        testEnv.wrap(WEN_FUNC.acceptMemberSpace),
        WenError.you_are_not_guardian_of_space.key,
      );
    });

    it('successfully join space and be accepted', async () => {
      await joinSpaceFunc(member, space.uid);
      mockWalletReturnValue(guardian, { uid: space.uid, member });
      const aSpace = await testEnv.wrap(WEN_FUNC.acceptMemberSpace);
      assertCreatedOnAndId(aSpace, member);
    });

    it('join space, edit space and still able to accept', async () => {
      await joinSpaceFunc(member, space.uid);
      const guardian2 = await testEnv.createMember();
      await addGuardianToSpace(space.uid, guardian2);
      const name = 'This space rocks rocks';
      mockWalletReturnValue(guardian, { uid: space.uid, name, open: false });
      const proposal = await testEnv.wrap<Proposal>(WEN_FUNC.updateSpace);
      mockWalletReturnValue(guardian2, { uid: proposal.uid, value: 1 });
      await testEnv.wrap(WEN_FUNC.voteOnProposal);
      await wait(async () => {
        space = <Space>await build5Db().doc(COL.SPACE, space.uid).get();
        return space.name === name;
      });
      mockWalletReturnValue(guardian, { uid: space.uid, member });
      const aSpace = await testEnv.wrap(WEN_FUNC.acceptMemberSpace);
      assertCreatedOnAndId(aSpace, member);
    });

    it('join space, edit space to open and it should no longer be able to accept', async () => {
      await joinSpaceFunc(member, space.uid);
      const guardian2 = await testEnv.createMember();
      await addGuardianToSpace(space.uid, guardian2);
      const name = 'This space rocks rocks';
      mockWalletReturnValue(guardian, { uid: space.uid, name, open: true });
      const proposal = await testEnv.wrap<Proposal>(WEN_FUNC.updateSpace);
      mockWalletReturnValue(guardian2, { uid: proposal.uid, value: 1 });
      await testEnv.wrap(WEN_FUNC.voteOnProposal);
      await wait(async () => {
        space = <Space>await build5Db().doc(COL.SPACE, space.uid).get();
        return space.name === name;
      });

      mockWalletReturnValue(guardian, { uid: space.uid, member });
      await expectThrow(
        testEnv.wrap(WEN_FUNC.acceptMemberSpace),
        WenError.member_did_not_request_to_join.key,
      );
    });

    it('successfully join space and be rejected', async () => {
      await joinSpaceFunc(member, space.uid);
      mockWalletReturnValue(guardian, { uid: space.uid, member });
      const declineMemberResult = await testEnv.wrap<{ status: string }>(
        WEN_FUNC.declineMemberSpace,
      );
      expect(declineMemberResult).toBeDefined();
      expect(declineMemberResult.status).toEqual('success');
    });

    it('Should throw on second time when member ask to join', async () => {
      await joinSpaceFunc(member, space.uid);
      mockWalletReturnValue(member, { uid: space.uid });
      await expectThrow(
        testEnv.wrap<SpaceMember>(WEN_FUNC.joinSpace),
        WenError.member_already_knocking.key,
      );
    });
  });
});

describe('Add guardian', () => {
  const guardianCount = 3;
  let guardians: string[] = [];
  let member: string;
  let space: Space;

  beforeEach(async () => {
    let promises: any[] = Array.from(Array(guardianCount)).map(() => testEnv.createMember());
    guardians = await Promise.all(promises);
    member = await testEnv.createMember();
    space = await testEnv.createSpace(guardians[0]);
    promises = tail(guardians).map(async (guardian) => addGuardianToSpace(space.uid, guardian));
    await Promise.all(promises);
  });

  it('Should throw, not guardian of the space', async () => {
    mockWalletReturnValue(member, { uid: space.uid, member });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.addGuardianSpace),
      WenError.you_are_not_guardian_of_space.key,
    );
    mockWalletReturnValue(guardians[0], { uid: wallet.getRandomEthAddress(), member });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.addGuardianSpace),
      WenError.you_are_not_guardian_of_space.key,
    );
  });

  it('Should throw, member not part of space', async () => {
    mockWalletReturnValue(guardians[0], { uid: space.uid, member });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.addGuardianSpace),
      WenError.member_is_not_part_of_the_space.key,
    );
  });

  it('Should throw, member already guardian', async () => {
    mockWalletReturnValue(guardians[0], {
      uid: space.uid,
      member: guardians[0],
    });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.addGuardianSpace),
      WenError.member_is_already_guardian_of_space.key,
    );
  });

  const createProposal = async (type: ProposalType, resultTotal: number) => {
    const wenFunc =
      type === ProposalType.ADD_GUARDIAN ? WEN_FUNC.addGuardianSpace : WEN_FUNC.removeGuardianSpace;
    mockWalletReturnValue(guardians[0], { uid: space.uid, member });
    const proposal = await testEnv.wrap<Proposal>(wenFunc);
    const guardianData = <Member>await build5Db().doc(COL.MEMBER, guardians[0]).get();
    const memberData = <Member>await build5Db().doc(COL.MEMBER, member).get();
    expect(proposal.type).toBe(type);
    expect(proposal.approved).toBe(true);
    expect(proposal.results?.total).toBe(resultTotal);
    expect(proposal.results?.voted).toBe(1);
    expect(proposal.results?.answers).toEqual({ [1]: 1 });
    expect(proposal.additionalInfo).toBe(
      `${guardianData.uid} wants to ${type === ProposalType.ADD_GUARDIAN ? 'add' : 'remove'} ${memberData.name} as guardian. ` +
        `Request created on ${dayjs().format('MM/DD/YYYY')}. ` +
        `${ADD_REMOVE_GUARDIAN_THRESHOLD_PERCENTAGE} % must agree for this action to proceed`,
    );
    expect(proposal.name).toBe(`${type === ProposalType.ADD_GUARDIAN ? 'Add' : 'Remove'} guardian`);
    const voteTransaction = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', guardians[0])
      .where('type', '==', TransactionType.VOTE)
      .where('payload_proposalId', '==', proposal.uid)
      .get();
    expect(voteTransaction.length).toBe(1);
    const proposalMember = <ProposalMember>(
      await build5Db().doc(COL.PROPOSAL, proposal.uid, SUB_COL.MEMBERS, guardians[0]).get()
    );
    expect(proposalMember.voted).toBe(true);
    expect((proposalMember as any).tranId).toBe(voteTransaction[0]?.uid);
    return proposal;
  };

  it('Should add guardian to space after vote, then remove it', async () => {
    mockWalletReturnValue(member, { uid: space?.uid });
    await testEnv.wrap<SpaceMember>(WEN_FUNC.joinSpace);
    const proposal = await createProposal(ProposalType.ADD_GUARDIAN, 3);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    mockWalletReturnValue(guardians[1], { uid: proposal.uid, value: 0 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);
    mockWalletReturnValue(guardians[2], { uid: proposal.uid, value: 1 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);

    await wait(async () => {
      const spaceDocRef = build5Db().doc(COL.SPACE, space.uid);
      space = <Space>await spaceDocRef.get();
      const guardian = await build5Db().doc(COL.SPACE, space.uid, SUB_COL.GUARDIANS, member).get();
      return space.totalGuardians === guardianCount + 1 && guardian !== undefined;
    });
    mockWalletReturnValue(guardians[0], { uid: proposal.uid, value: 0 });
    await expectThrow(testEnv.wrap(WEN_FUNC.voteOnProposal), WenError.vote_is_no_longer_active.key);
    const removeProposal = await createProposal(ProposalType.REMOVE_GUARDIAN, 4);
    mockWalletReturnValue(guardians[1], { uid: removeProposal.uid, value: 1 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);
    mockWalletReturnValue(guardians[2], { uid: removeProposal.uid, value: 1 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);
    await wait(async () => {
      const spaceDocRef = build5Db().doc(COL.SPACE, space.uid);
      space = <Space>await spaceDocRef.get();
      const guardian = await build5Db().doc(COL.SPACE, space.uid, SUB_COL.GUARDIANS, member).get();
      return space.totalGuardians === guardianCount && guardian === undefined;
    });
    mockWalletReturnValue(guardians[0], { uid: removeProposal.uid, value: 0 });
    await expectThrow(testEnv.wrap(WEN_FUNC.voteOnProposal), WenError.vote_is_no_longer_active.key);
  });

  it('Should add guardian to space only after threshold reached', async () => {
    mockWalletReturnValue(member, { uid: space?.uid });
    await testEnv.wrap<SpaceMember>(WEN_FUNC.joinSpace);
    const proposal = await createProposal(ProposalType.ADD_GUARDIAN, 3);

    mockWalletReturnValue(guardians[1], { uid: proposal.uid, value: 0 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);

    mockWalletReturnValue(guardians[2], { uid: proposal.uid, value: 0 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    mockWalletReturnValue(guardians[1], { uid: proposal.uid, value: 1 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);

    await wait(async () => {
      const spaceDocRef = build5Db().doc(COL.SPACE, space.uid);
      space = <Space>await spaceDocRef.get();
      const guardian = await build5Db().doc(COL.SPACE, space.uid, SUB_COL.GUARDIANS, member).get();
      return space.totalGuardians === guardianCount + 1 && guardian !== undefined;
    });

    mockWalletReturnValue(guardians[0], { uid: proposal.uid, value: 0 });
    await expectThrow(testEnv.wrap(WEN_FUNC.voteOnProposal), WenError.vote_is_no_longer_active.key);
  });

  it('Should add guardian to space when only one guardiand exists', async () => {
    const promises = tail(guardians).map((guardian) =>
      removeGuardianFromSpace(space.uid, guardian),
    );
    await Promise.all(promises);
    mockWalletReturnValue(member, { uid: space?.uid });
    await testEnv.wrap<SpaceMember>(WEN_FUNC.joinSpace);
    await createProposal(ProposalType.ADD_GUARDIAN, 1);
    await wait(async () => {
      const spaceDocRef = build5Db().doc(COL.SPACE, space.uid);
      space = <Space>await spaceDocRef.get();
      const guardian = await build5Db().doc(COL.SPACE, space.uid, SUB_COL.GUARDIANS, member).get();
      return space.totalGuardians === 2 && guardian !== undefined;
    });
  });

  it('Should only allow one ongoing add/remove proposal', async () => {
    mockWalletReturnValue(member, { uid: space?.uid });
    await testEnv.wrap<SpaceMember>(WEN_FUNC.joinSpace);
    let proposal = await createProposal(ProposalType.ADD_GUARDIAN, 3);
    await expectThrow(createProposal(ProposalType.ADD_GUARDIAN, 3), WenError.ongoing_proposal.key);
    mockWalletReturnValue(guardians[1], { uid: proposal.uid, value: 1 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);
    await wait(async () => {
      const spaceDocRef = build5Db().doc(COL.SPACE, space.uid);
      space = <Space>await spaceDocRef.get();
      const guardian = await build5Db().doc(COL.SPACE, space.uid, SUB_COL.GUARDIANS, member).get();
      return space.totalGuardians === guardianCount + 1 && guardian !== undefined;
    });
    await expectThrow(
      createProposal(ProposalType.ADD_GUARDIAN, 3),
      WenError.member_is_already_guardian_of_space.key,
    );
    const removeProposal = await createProposal(ProposalType.REMOVE_GUARDIAN, 4);
    await expectThrow(
      createProposal(ProposalType.REMOVE_GUARDIAN, 4),
      WenError.ongoing_proposal.key,
    );

    mockWalletReturnValue(guardians[1], { uid: removeProposal.uid, value: 1 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);

    mockWalletReturnValue(guardians[2], { uid: removeProposal.uid, value: 1 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);

    await wait(async () => {
      const spaceDocRef = build5Db().doc(COL.SPACE, space.uid);
      space = <Space>await spaceDocRef.get();
      const guardian = await build5Db().doc(COL.SPACE, space.uid, SUB_COL.GUARDIANS, member).get();
      return space.totalGuardians === guardianCount && guardian === undefined;
    });

    proposal = await createProposal(ProposalType.ADD_GUARDIAN, 3);
    await expectThrow(createProposal(ProposalType.ADD_GUARDIAN, 3), WenError.ongoing_proposal.key);

    mockWalletReturnValue(guardians[1], { uid: proposal.uid, value: 1 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);
    await wait(async () => {
      const spaceDocRef = build5Db().doc(COL.SPACE, space.uid);
      space = <Space>await spaceDocRef.get();
      const guardian = await build5Db().doc(COL.SPACE, space.uid, SUB_COL.GUARDIANS, member).get();
      return space.totalGuardians === guardianCount + 1 && guardian !== undefined;
    });
  });
});

describe('Token based space', () => {
  let guardian: string;
  let guardian2: string;
  let member: string;
  let space: Space;
  let token: string;

  beforeEach(async () => {
    guardian = await testEnv.createMember();
    guardian2 = await testEnv.createMember();
    member = await testEnv.createMember();
    space = await testEnv.createSpace(guardian);
    await addGuardianToSpace(space.uid, guardian2);
    token = wallet.getRandomEthAddress();
    await build5Db().doc(COL.TOKEN, token).upsert({
      project: SOON_PROJECT_ID,
      status: TokenStatus.MINTED,
      space: space.uid,
      approved: true,
    });
    mockWalletReturnValue(member, { uid: space?.uid });
    await testEnv.wrap<SpaceMember>(WEN_FUNC.joinSpace);
  });

  it('Should make space token based, can not update access further but can update others', async () => {
    await wait(async () => {
      space = <Space>await build5Db().doc(COL.SPACE, space.uid).get();
      return space.totalGuardians === 2 && space.totalMembers === 3;
    });
    const updateParams = { uid: space?.uid, tokenBased: true, minStakedValue: 100 };
    mockWalletReturnValue(guardian, updateParams);
    const proposal = await testEnv.wrap<Proposal>(WEN_FUNC.updateSpace);
    mockWalletReturnValue(guardian2, { uid: proposal.uid, value: 1 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);
    await wait(async () => {
      space = <Space>await build5Db().doc(COL.SPACE, space.uid).get();
      return space.tokenBased === true && space.minStakedValue === updateParams.minStakedValue;
    });
    expect(space.totalGuardians).toBe(1);
    expect(space.totalMembers).toBe(1);
    await addGuardianToSpace(space.uid, guardian);
    await addGuardianToSpace(space.uid, guardian2);

    mockWalletReturnValue(guardian, updateParams);
    await expectThrow(
      testEnv.wrap(WEN_FUNC.updateSpace),
      WenError.token_based_space_access_can_not_be_edited.key,
    );

    mockWalletReturnValue(guardian, { uid: space.uid, open: false });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.updateSpace),
      WenError.token_based_space_access_can_not_be_edited.key,
    );

    const name = 'second update';
    mockWalletReturnValue(guardian, { uid: space.uid, name });
    const proposal2 = await testEnv.wrap<Proposal>(WEN_FUNC.updateSpace);
    mockWalletReturnValue(guardian2, { uid: proposal2.uid, value: 1 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);
    await wait(async () => {
      space = <Space>await build5Db().doc(COL.SPACE, space.uid).get();
      return space.name === name;
    });
  });

  it('Should join token based space', async () => {
    const updateParams = { uid: space?.uid, tokenBased: true, minStakedValue: 100 };
    mockWalletReturnValue(guardian, updateParams);
    const proposal = await testEnv.wrap<Proposal>(WEN_FUNC.updateSpace);

    mockWalletReturnValue(guardian2, { uid: proposal.uid, value: 1 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);

    await wait(async () => {
      space = <Space>await build5Db().doc(COL.SPACE, space.uid).get();
      return space.tokenBased === true && space.minStakedValue === updateParams.minStakedValue;
    });

    const newMember = await testEnv.createMember();
    await build5Db()
      .doc(COL.TOKEN, token, SUB_COL.DISTRIBUTION, newMember)
      .upsert({ stakes_dynamic_value: 200 });
    mockWalletReturnValue(newMember, { uid: space?.uid });
    await testEnv.wrap<SpaceMember>(WEN_FUNC.joinSpace);

    await wait(async () => {
      space = <Space>await build5Db().doc(COL.SPACE, space.uid).get();
      return space.totalMembers === 2 && space.totalGuardians === 1;
    });
  });

  it('Should not remove member as it has enough stakes', async () => {
    await build5Db()
      .doc(COL.TOKEN, token, SUB_COL.DISTRIBUTION, member)
      .upsert({ stakes_dynamic_value: 200 });
    const updateParams = { uid: space?.uid, tokenBased: true, minStakedValue: 100 };

    mockWalletReturnValue(guardian, updateParams);
    const proposal = await testEnv.wrap<Proposal>(WEN_FUNC.updateSpace);

    mockWalletReturnValue(guardian2, { uid: proposal.uid, value: 1 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);

    await wait(async () => {
      space = <Space>await build5Db().doc(COL.SPACE, space.uid).get();
      return space.tokenBased === true && space.minStakedValue === updateParams.minStakedValue;
    });

    expect(space.totalMembers).toBe(2);
    expect(space.totalGuardians).toBe(1);
  });

  it('Should not remove guardians as they have enough stakes', async () => {
    await build5Db()
      .doc(COL.TOKEN, token, SUB_COL.DISTRIBUTION, guardian)
      .upsert({ stakes_dynamic_value: 200 });
    await build5Db()
      .doc(COL.TOKEN, token, SUB_COL.DISTRIBUTION, guardian2)
      .upsert({ stakes_dynamic_value: 200 });
    const updateParams = { uid: space?.uid, tokenBased: true, minStakedValue: 100 };

    mockWalletReturnValue(guardian, updateParams);
    const proposal = await testEnv.wrap<Proposal>(WEN_FUNC.updateSpace);

    mockWalletReturnValue(guardian2, { uid: proposal.uid, value: 1 });
    await testEnv.wrap(WEN_FUNC.voteOnProposal);
    await wait(async () => {
      space = <Space>await build5Db().doc(COL.SPACE, space.uid).get();
      return space.tokenBased === true && space.minStakedValue === updateParams.minStakedValue;
    });

    expect(space.totalMembers).toBe(2);
    expect(space.totalGuardians).toBe(2);
  });
});
