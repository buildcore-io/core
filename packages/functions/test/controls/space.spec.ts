import {
  ADD_REMOVE_GUARDIAN_THRESHOLD_PERCENTAGE,
  COL,
  Member,
  Proposal,
  ProposalMember,
  ProposalType,
  Space,
  StakeType,
  SUB_COL,
  TokenStatus,
  TransactionType,
  UPDATE_SPACE_THRESHOLD_PERCENTAGE,
  WenError,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { tail } from 'lodash';
import admin from '../../src/admin.config';
import { voteOnProposal } from '../../src/controls/proposal.control';
import { addGuardian, removeGuardian } from '../../src/controls/space/guardian.add.remove.control';
import { acceptMemberSpace } from '../../src/controls/space/member.accept.control';
import { blockMember } from '../../src/controls/space/member.block.control';
import { declineMemberSpace } from '../../src/controls/space/member.decline.control';
import { joinSpace } from '../../src/controls/space/member.join.control';
import { leaveSpace } from '../../src/controls/space/member.leave.control';
import { unblockMember } from '../../src/controls/space/member.unblock.control';
import { createSpace } from '../../src/controls/space/space.create.control';
import { updateSpace } from '../../src/controls/space/space.update.control';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import {
  addGuardianToSpace,
  createMember,
  createSpace as createSpaceFunc,
  expectThrow,
  mockWalletReturnValue,
  removeGuardianFromSpace,
  wait,
} from './common';

let walletSpy: any;

const assertCreatedOnAndId = (data: any, uid: string) => {
  expect(data).toBeDefined();
  expect(data.createdOn).toBeDefined();
  expect(data.uid).toEqual(uid);
};

const joinSpaceFunc = async (member: string, uid: string) => {
  mockWalletReturnValue(walletSpy, member, { uid });
  const jSpace = await testEnv.wrap(joinSpace)({});
  assertCreatedOnAndId(jSpace, member);
};

/**
 * TODO
 * at_least_one_guardian_must_be_in_the_space
 */
describe('SpaceController: ' + WEN_FUNC.cSpace, () => {
  it('successfully create space', async () => {
    const dummyAddress = wallet.getRandomEthAddress();
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    mockWalletReturnValue(walletSpy, dummyAddress, {});

    const returns = await testEnv.wrap(createSpace)({});
    expect(returns?.uid).toBeDefined();
    expect(returns?.createdOn).toBeDefined();
    expect(returns?.updatedOn).toBeDefined();

    // am I member and guardian.
    expect(returns.members).toBeDefined();
    expect(returns.members[dummyAddress]).toBeDefined();
    expect(returns.guardians).toBeDefined();
    expect(returns.guardians[dummyAddress]).toBeDefined();
    expect(returns?.totalGuardians).toEqual(1);
    expect(returns?.totalMembers).toEqual(1);
    expect(returns?.totalPendingMembers).toEqual(0);
    walletSpy.mockRestore();
  });

  it('successfully create space with name', async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    mockWalletReturnValue(walletSpy, wallet.getRandomEthAddress(), {
      name: 'Space ABC',
      about: 'very cool',
    });

    const returns = await testEnv.wrap(createSpace)({});
    expect(returns?.uid).toBeDefined();
    expect(returns?.name).toEqual('Space ABC');
    expect(returns?.about).toEqual('very cool');
    expect(returns?.totalGuardians).toEqual(1);
    expect(returns?.totalMembers).toEqual(1);
    walletSpy.mockRestore();
  });

  it('unable to decode token.', async () => {
    await expectThrow(testEnv.wrap(createSpace)(null), WenError.invalid_params.key);
  });
});

describe('SpaceController: ' + WEN_FUNC.uSpace, () => {
  let guardian: string;
  let member: string;
  let space: Space;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardian = await createMember(walletSpy);
    member = await createMember(walletSpy);
    space = await createSpaceFunc(walletSpy, guardian);

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
    const owner = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${guardian}`).get()).data();
    mockWalletReturnValue(walletSpy, guardian, updateParams);
    const proposal = <Proposal>await testEnv.wrap(updateSpace)({});

    expect(proposal.type).toBe(ProposalType.EDIT_SPACE);
    expect(proposal.approved).toBe(true);
    expect(proposal.results?.total).toBe(2);
    expect(proposal.results?.voted).toBe(1);
    expect(proposal.results?.answers).toEqual({ [1]: 1 });
    expect(proposal.additionalInfo).toBe(
      `${owner.name} wants to edit the space. ` +
        `Request created on ${dayjs().format('MM/DD/YYYY')}. ` +
        `${UPDATE_SPACE_THRESHOLD_PERCENTAGE} % must agree for this action to proceed`,
    );
    expect(proposal.name).toBe('Edit space');

    expect(proposal.questions[0].additionalInfo).toBe(
      'Changes requested.\n' +
        'Name: abc (previously: Space A)\n' +
        'Discord: adamkun1233 (previously: None)\n' +
        'Github: sadas (previously: None)\n' +
        'Twitter: asdasd (previously: None)\n',
    );

    space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).get()).data();
    const updatedOn = space.updatedOn;
    mockWalletReturnValue(walletSpy, member, { uid: proposal.uid, values: [1] });
    await testEnv.wrap(voteOnProposal)({});

    await wait(async () => {
      space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).get()).data();
      return dayjs(updatedOn?.toDate()).isBefore(dayjs(space.updatedOn?.toDate()));
    });

    expect(space.name).toBe(updateParams.name);
    expect(space.github).toBe(updateParams.github);
    expect(space.twitter).toBe(updateParams.twitter);
    expect(space.discord).toBe(updateParams.discord);
  });

  it('failed to update space - invalid URL', async () => {
    const updateParams = { uid: space?.uid, name: 'abc', twitter: 'WRONG URL' };
    mockWalletReturnValue(walletSpy, guardian, updateParams);
    await expectThrow(testEnv.wrap(updateSpace)({}), WenError.invalid_params.key);
    walletSpy.mockRestore();
  });

  it('failed to update space - missing UID', async () => {
    mockWalletReturnValue(walletSpy, guardian, { name: 'abc' });
    await expectThrow(testEnv.wrap(updateSpace)({}), WenError.invalid_params.key);
    walletSpy.mockRestore();
  });

  it('failed to update space - does not exists', async () => {
    mockWalletReturnValue(walletSpy, guardian, { uid: guardian, name: 'abc' });
    await expectThrow(testEnv.wrap(updateSpace)({}), WenError.space_does_not_exists.key);
    walletSpy.mockRestore();
  });
});

describe('SpaceController: member management', () => {
  let guardian: string;
  let member: string;
  let space: Space;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardian = wallet.getRandomEthAddress();
    member = wallet.getRandomEthAddress();
    mockWalletReturnValue(walletSpy, guardian, { name: 'This space rocks' });
    space = await testEnv.wrap(createSpace)({});
    expect(space?.uid).toBeDefined();
  });

  it('successfully join space', async () => {
    joinSpaceFunc(member, space.uid);
  });

  it('fail to join space - already in', async () => {
    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid });
    await expectThrow(testEnv.wrap(joinSpace)({}), WenError.you_are_already_part_of_space.key);
  });

  it('successfully leave space', async () => {
    await joinSpaceFunc(member, space.uid);
    const lSpace = await testEnv.wrap(leaveSpace)({});
    expect(lSpace).toBeDefined();
    expect(lSpace.status).toEqual('success');
  });

  it('fail to leave space - as only guardian', async () => {
    await joinSpaceFunc(member, space.uid);
    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid });
    await expectThrow(
      testEnv.wrap(leaveSpace)({}),
      WenError.at_least_one_guardian_must_be_in_the_space.key,
    );
  });

  it('fail to leave space - as only member', async () => {
    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid });
    await expectThrow(
      testEnv.wrap(leaveSpace)({}),
      WenError.at_least_one_member_must_be_in_the_space.key,
    );
  });

  it('fail to leave space where Im not in', async () => {
    mockWalletReturnValue(walletSpy, member, { uid: space.uid });
    await expectThrow(testEnv.wrap(leaveSpace)({}), WenError.you_are_not_part_of_the_space.key);
  });

  it('fail to make guardian - must be member', async () => {
    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member });
    await expectThrow(testEnv.wrap(addGuardian)({}), WenError.member_is_not_part_of_the_space.key);
  });

  it('fail to make guardian - already is', async () => {
    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member: guardian });
    await expectThrow(
      testEnv.wrap(addGuardian)({}),
      WenError.member_is_already_guardian_of_space.key,
    );
  });

  it('successfully block member', async () => {
    await joinSpaceFunc(member, space.uid);
    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member });
    const blockMemberResult = await testEnv.wrap(blockMember)({});
    assertCreatedOnAndId(blockMemberResult, member);
  });

  it('block member and unblock', async () => {
    await joinSpaceFunc(member, space.uid);

    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member });
    const bMember = await testEnv.wrap(blockMember)({});
    assertCreatedOnAndId(bMember, member);

    const ubMember = await testEnv.wrap(unblockMember)({});
    expect(ubMember).toBeDefined();
    expect(ubMember.status).toEqual('success');
  });

  it('fail to block member - if its the only one', async () => {
    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member: guardian });
    await expectThrow(
      testEnv.wrap(blockMember)({}),
      WenError.at_least_one_member_must_be_in_the_space.key,
    );
  });

  it('fail to block myself if Im only guardian', async () => {
    await joinSpaceFunc(member, space.uid);
    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member: guardian });
    await expectThrow(
      testEnv.wrap(blockMember)({}),
      WenError.at_least_one_guardian_must_be_in_the_space.key,
    );
  });

  it('successfully block member and unable to join space', async () => {
    await joinSpaceFunc(member, space.uid);

    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member });
    const bMember = await testEnv.wrap(blockMember)({});
    assertCreatedOnAndId(bMember, member);
    mockWalletReturnValue(walletSpy, member, { uid: space.uid });
    await expectThrow(testEnv.wrap(joinSpace)({}), WenError.you_are_not_allowed_to_join_space.key);
  });

  describe('SpaceController: member management - NOT OPEN', () => {
    beforeEach(async () => {
      walletSpy = jest.spyOn(wallet, 'decodeAuth');
      guardian = await createMember(walletSpy);
      member = await createMember(walletSpy);
      space = await createSpaceFunc(walletSpy, guardian);
      await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).update({ open: false });
    });

    it('successfully join space', async () => {
      await joinSpaceFunc(member, space.uid);
    });

    it('successfully join space and fail to accept - NOT GUARDIAN', async () => {
      await joinSpaceFunc(member, space.uid);

      mockWalletReturnValue(walletSpy, member, { uid: space.uid, member });
      await expectThrow(
        testEnv.wrap(acceptMemberSpace)({}),
        WenError.you_are_not_guardian_of_space.key,
      );
    });

    it('successfully join space and be accepted', async () => {
      await joinSpaceFunc(member, space.uid);

      mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member });
      const aSpace = await testEnv.wrap(acceptMemberSpace)({});
      assertCreatedOnAndId(aSpace, member);
    });

    it('join space, edit space and still able to accept', async () => {
      await joinSpaceFunc(member, space.uid);

      const guardian2 = await createMember(walletSpy);
      await addGuardianToSpace(space.uid, guardian2);
      const name = 'This space rocks rocks';
      mockWalletReturnValue(walletSpy, guardian, {
        uid: space.uid,
        name,
        open: false,
      });
      const proposal = await testEnv.wrap(updateSpace)({});

      mockWalletReturnValue(walletSpy, guardian2, { uid: proposal.uid, values: [1] });
      await testEnv.wrap(voteOnProposal)({});

      await wait(async () => {
        space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).get()).data();
        return space.name === name;
      });

      mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member });
      const aSpace = await testEnv.wrap(acceptMemberSpace)({});
      assertCreatedOnAndId(aSpace, member);
    });

    it('join space, edit space to open and it should no longer be able to accept', async () => {
      await joinSpaceFunc(member, space.uid);

      const guardian2 = await createMember(walletSpy);
      await addGuardianToSpace(space.uid, guardian2);

      const name = 'This space rocks rocks';
      mockWalletReturnValue(walletSpy, guardian, {
        uid: space.uid,
        name,
        open: true,
      });
      const proposal = await testEnv.wrap(updateSpace)({});

      mockWalletReturnValue(walletSpy, guardian2, { uid: proposal.uid, values: [1] });
      await testEnv.wrap(voteOnProposal)({});

      await wait(async () => {
        space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).get()).data();
        return space.name === name;
      });

      mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member });
      await expectThrow(
        testEnv.wrap(acceptMemberSpace)({}),
        WenError.member_did_not_request_to_join.key,
      );
    });

    it('successfully join space and be rejected', async () => {
      await joinSpaceFunc(member, space.uid);

      mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member });
      const declineMemberResult = await testEnv.wrap(declineMemberSpace)({});
      expect(declineMemberResult).toBeDefined();
      expect(declineMemberResult.status).toEqual('success');
    });

    it('Should throw on second time when member ask to join', async () => {
      await joinSpaceFunc(member, space.uid);

      mockWalletReturnValue(walletSpy, member, { uid: space.uid });
      await expectThrow(testEnv.wrap(joinSpace)({}), WenError.member_already_knocking.key);
    });
  });
});

describe('Add guardian', () => {
  const guardianCount = 3;
  let guardians: string[] = [];
  let member: string;
  let space: Space;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    let promises: any[] = Array.from(Array(guardianCount)).map(() => createMember(walletSpy));
    guardians = await Promise.all(promises);
    member = await createMember(walletSpy);
    space = await createSpaceFunc(walletSpy, guardians[0]);

    promises = tail(guardians).map(async (guardian) => addGuardianToSpace(space.uid, guardian));
    await Promise.all(promises);
  });

  it('Should throw, not guardian of the space', async () => {
    mockWalletReturnValue(walletSpy, member, { uid: space.uid, member });
    await expectThrow(testEnv.wrap(addGuardian)({}), WenError.you_are_not_guardian_of_space.key);
    mockWalletReturnValue(walletSpy, guardians[0], { uid: wallet.getRandomEthAddress(), member });
    await expectThrow(testEnv.wrap(addGuardian)({}), WenError.you_are_not_guardian_of_space.key);
  });

  it('Should throw, member not part of space', async () => {
    mockWalletReturnValue(walletSpy, guardians[0], { uid: space.uid, member });
    await expectThrow(testEnv.wrap(addGuardian)({}), WenError.member_is_not_part_of_the_space.key);
  });

  it('Should throw, member already guardian', async () => {
    mockWalletReturnValue(walletSpy, guardians[0], { uid: space.uid, member: guardians[0] });
    await expectThrow(
      testEnv.wrap(addGuardian)({}),
      WenError.member_is_already_guardian_of_space.key,
    );
  });

  const createProposal = async (type: ProposalType, resultTotal: number) => {
    mockWalletReturnValue(walletSpy, guardians[0], { uid: space.uid, member });
    const proposal: Proposal = await testEnv.wrap(
      type === ProposalType.ADD_GUARDIAN ? addGuardian : removeGuardian,
    )({});

    const guardianData = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${guardians[0]}`).get()).data()
    );
    const memberData = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${member}`).get()).data()
    );

    expect(proposal.type).toBe(type);
    expect(proposal.approved).toBe(true);
    expect(proposal.results?.total).toBe(resultTotal);
    expect(proposal.results?.voted).toBe(1);
    expect(proposal.results?.answers).toEqual({ [1]: 1 });
    expect(proposal.additionalInfo).toBe(
      `${guardianData.name} wants to ${type === ProposalType.ADD_GUARDIAN ? 'add' : 'remove'} ${
        memberData.name
      } as guardian. ` +
        `Request created on ${dayjs().format('MM/DD/YYYY')}. ` +
        `${ADD_REMOVE_GUARDIAN_THRESHOLD_PERCENTAGE} % must agree for this action to proceed`,
    );
    expect(proposal.name).toBe(`${type === ProposalType.ADD_GUARDIAN ? 'Add' : 'Remove'} guardian`);

    const voteTransaction = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', guardians[0])
      .where('type', '==', TransactionType.VOTE)
      .where('payload.proposalId', '==', proposal.uid)
      .get();
    expect(voteTransaction.size).toBe(1);

    const proposalMember = <ProposalMember>(
      (
        await admin
          .firestore()
          .doc(`${COL.PROPOSAL}/${proposal.uid}/${SUB_COL.MEMBERS}/${guardians[0]}`)
          .get()
      ).data()
    );
    expect(proposalMember.voted).toBe(true);
    expect((proposalMember as any).tranId).toBe(voteTransaction.docs[0].id);

    return proposal;
  };

  it('Should add guardian to space after vote, than remove it', async () => {
    mockWalletReturnValue(walletSpy, member, { uid: space?.uid });
    await testEnv.wrap(joinSpace)({});

    const proposal = await createProposal(ProposalType.ADD_GUARDIAN, 3);

    mockWalletReturnValue(walletSpy, guardians[1], { uid: proposal.uid, values: [0] });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await testEnv.wrap(voteOnProposal)({});
    mockWalletReturnValue(walletSpy, guardians[2], { uid: proposal.uid, values: [1] });
    await testEnv.wrap(voteOnProposal)({});

    await wait(async () => {
      const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space.uid}`);
      space = <Space>(await spaceDocRef.get()).data();
      const guardian = await spaceDocRef.collection(SUB_COL.GUARDIANS).doc(member).get();
      return space.totalGuardians === guardianCount + 1 && guardian.exists;
    });
    mockWalletReturnValue(walletSpy, guardians[0], { uid: proposal.uid, values: [0] });
    await expectThrow(testEnv.wrap(voteOnProposal)({}), WenError.vote_is_no_longer_active.key);

    const removeProposal = await createProposal(ProposalType.REMOVE_GUARDIAN, 4);

    mockWalletReturnValue(walletSpy, guardians[1], { uid: removeProposal.uid, values: [1] });
    await testEnv.wrap(voteOnProposal)({});
    mockWalletReturnValue(walletSpy, guardians[2], { uid: removeProposal.uid, values: [1] });
    await testEnv.wrap(voteOnProposal)({});

    await wait(async () => {
      const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space.uid}`);
      space = <Space>(await spaceDocRef.get()).data();
      const guardian = await spaceDocRef.collection(SUB_COL.GUARDIANS).doc(member).get();
      return space.totalGuardians === guardianCount && !guardian.exists;
    });
    mockWalletReturnValue(walletSpy, guardians[0], { uid: removeProposal.uid, values: [0] });
    await expectThrow(testEnv.wrap(voteOnProposal)({}), WenError.vote_is_no_longer_active.key);
  });

  it('Should add guardian to space only after threshold reached', async () => {
    mockWalletReturnValue(walletSpy, member, { uid: space?.uid });
    await testEnv.wrap(joinSpace)({});

    const proposal = await createProposal(ProposalType.ADD_GUARDIAN, 3);

    mockWalletReturnValue(walletSpy, guardians[1], { uid: proposal.uid, values: [0] });
    await testEnv.wrap(voteOnProposal)({});
    mockWalletReturnValue(walletSpy, guardians[2], { uid: proposal.uid, values: [0] });
    await testEnv.wrap(voteOnProposal)({});

    await new Promise((resolve) => setTimeout(resolve, 2000));
    mockWalletReturnValue(walletSpy, guardians[1], { uid: proposal.uid, values: [1] });
    await testEnv.wrap(voteOnProposal)({});

    await wait(async () => {
      const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space.uid}`);
      space = <Space>(await spaceDocRef.get()).data();
      const guardian = await spaceDocRef.collection(SUB_COL.GUARDIANS).doc(member).get();
      return space.totalGuardians === guardianCount + 1 && guardian.exists;
    });
    mockWalletReturnValue(walletSpy, guardians[0], { uid: proposal.uid, values: [0] });
    await expectThrow(testEnv.wrap(voteOnProposal)({}), WenError.vote_is_no_longer_active.key);
  });

  it('Should add guardian to space when only one guardiand exists', async () => {
    const promises = tail(guardians).map((guardian) =>
      removeGuardianFromSpace(space.uid, guardian),
    );
    await Promise.all(promises);

    mockWalletReturnValue(walletSpy, member, { uid: space?.uid });
    await testEnv.wrap(joinSpace)({});

    await createProposal(ProposalType.ADD_GUARDIAN, 1);

    await wait(async () => {
      const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space.uid}`);
      space = <Space>(await spaceDocRef.get()).data();
      const guardian = await spaceDocRef.collection(SUB_COL.GUARDIANS).doc(member).get();
      return space.totalGuardians === 2 && guardian.exists;
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
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardian = await createMember(walletSpy);
    guardian2 = await createMember(walletSpy);
    member = await createMember(walletSpy);
    space = await createSpaceFunc(walletSpy, guardian);
    await addGuardianToSpace(space.uid, guardian2);

    token = wallet.getRandomEthAddress();
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token}`)
      .set({ status: TokenStatus.MINTED, space: space.uid, uid: token });

    mockWalletReturnValue(walletSpy, member, { uid: space?.uid });
    await testEnv.wrap(joinSpace)({});
  });

  it('Should make space token based, can not update access further but can update others', async () => {
    await wait(async () => {
      space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).get()).data();
      return space.totalGuardians === 2 && space.totalMembers === 3;
    });

    const updateParams = {
      uid: space?.uid,
      tokenBased: true,
      minStakedValue: 100,
    };
    mockWalletReturnValue(walletSpy, guardian, updateParams);
    const proposal = await testEnv.wrap(updateSpace)({});

    mockWalletReturnValue(walletSpy, guardian2, { uid: proposal.uid, values: [1] });
    await testEnv.wrap(voteOnProposal)({});

    await wait(async () => {
      space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).get()).data();
      return space.tokenBased === true && space.minStakedValue === updateParams.minStakedValue;
    });
    expect(space.totalGuardians).toBe(1);
    expect(space.totalMembers).toBe(1);

    await addGuardianToSpace(space.uid, guardian);
    await addGuardianToSpace(space.uid, guardian2);

    mockWalletReturnValue(walletSpy, guardian, updateParams);
    await expectThrow(
      testEnv.wrap(updateSpace)({}),
      WenError.token_based_space_access_can_not_be_edited.key,
    );
    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, open: false });
    await expectThrow(
      testEnv.wrap(updateSpace)({}),
      WenError.token_based_space_access_can_not_be_edited.key,
    );

    const name = 'second update';
    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, name });
    const proposal2 = await testEnv.wrap(updateSpace)({});
    mockWalletReturnValue(walletSpy, guardian2, { uid: proposal2.uid, values: [1] });
    await testEnv.wrap(voteOnProposal)({});

    await wait(async () => {
      space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).get()).data();
      return space.name === name;
    });
  });

  it('Should join token based space', async () => {
    const updateParams = {
      uid: space?.uid,
      tokenBased: true,
      minStakedValue: 100,
    };
    mockWalletReturnValue(walletSpy, guardian, updateParams);
    const proposal = await testEnv.wrap(updateSpace)({});

    mockWalletReturnValue(walletSpy, guardian2, { uid: proposal.uid, values: [1] });
    await testEnv.wrap(voteOnProposal)({});

    await wait(async () => {
      space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).get()).data();
      return space.tokenBased === true && space.minStakedValue === updateParams.minStakedValue;
    });

    const newMember = await createMember(walletSpy);
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}/${newMember}`)
      .set({ stakes: { [StakeType.DYNAMIC]: { value: 200 } } });
    mockWalletReturnValue(walletSpy, newMember, { uid: space?.uid });
    await testEnv.wrap(joinSpace)({});

    await wait(async () => {
      space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).get()).data();
      return space.totalMembers === 2 && space.totalGuardians === 1;
    });
  });

  it('Should not remove member as it has enough stakes', async () => {
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}/${member}`)
      .set({ stakes: { [StakeType.DYNAMIC]: { value: 200 } } });

    const updateParams = {
      uid: space?.uid,
      tokenBased: true,
      minStakedValue: 100,
    };
    mockWalletReturnValue(walletSpy, guardian, updateParams);
    const proposal = await testEnv.wrap(updateSpace)({});

    mockWalletReturnValue(walletSpy, guardian2, { uid: proposal.uid, values: [1] });
    await testEnv.wrap(voteOnProposal)({});

    await wait(async () => {
      space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).get()).data();
      return space.tokenBased === true && space.minStakedValue === updateParams.minStakedValue;
    });
    expect(space.totalMembers).toBe(2);
    expect(space.totalGuardians).toBe(1);
  });

  it('Should not remove guardians as they have enough stakes', async () => {
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}/${guardian}`)
      .set({ stakes: { [StakeType.DYNAMIC]: { value: 200 } } });
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}/${guardian2}`)
      .set({ stakes: { [StakeType.DYNAMIC]: { value: 200 } } });

    const updateParams = {
      uid: space?.uid,
      tokenBased: true,
      minStakedValue: 100,
    };
    mockWalletReturnValue(walletSpy, guardian, updateParams);
    const proposal = await testEnv.wrap(updateSpace)({});

    mockWalletReturnValue(walletSpy, guardian2, { uid: proposal.uid, values: [1] });
    await testEnv.wrap(voteOnProposal)({});

    await wait(async () => {
      space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${space.uid}`).get()).data();
      return space.tokenBased === true && space.minStakedValue === updateParams.minStakedValue;
    });
    expect(space.totalMembers).toBe(2);
    expect(space.totalGuardians).toBe(2);
  });
});
