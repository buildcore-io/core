import {
  COL,
  DecodedToken,
  Space,
  SUB_COL,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import { tail } from 'lodash';
import admin from '../../src/admin.config';
import { approveProposal, voteOnProposal } from '../../src/controls/proposal.control';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import {
  acceptMemberSpace,
  addGuardian,
  blockMember,
  createSpace,
  declineMemberSpace,
  joinSpace,
  leaveSpace,
  removeGuardian,
  unblockMember,
  updateSpace,
} from './../../src/controls/space.control';
import {
  addGuardianToSpace,
  createMember,
  createSpace as createSpaceFunc,
  expectThrow,
  mockWalletReturnValue,
  wait,
} from './common';

let walletSpy: jest.SpyInstance<Promise<DecodedToken>, [req: WenRequest]>;

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

  it('unable to decode token.', () => {
    expectThrow(testEnv.wrap(createSpace)(null), WenError.invalid_params.key);
  });
});

describe('SpaceController: ' + WEN_FUNC.uSpace, () => {
  let dummyAddress: string;
  let space: Space;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    dummyAddress = wallet.getRandomEthAddress();
    mockWalletReturnValue(walletSpy, dummyAddress, {});
    space = await testEnv.wrap(createSpace)({});
    expect(space?.uid).toBeDefined();
  });

  it('successfully update space', async () => {
    const updateParams = {
      uid: space?.uid,
      name: 'abc',
      github: 'sadas',
      twitter: 'asdasd',
      discord: 'adamkun1233',
      avatarUrl: 'https://abc1',
      bannerUrl: 'https://abc1',
    };
    mockWalletReturnValue(walletSpy, dummyAddress, updateParams);
    const doc = await testEnv.wrap(updateSpace)({});
    expect(doc?.name).toEqual(updateParams.name);
    expect(doc?.github).toEqual(updateParams.github);
    expect(doc?.twitter).toEqual(updateParams.twitter);
    expect(doc?.discord).toEqual(updateParams.discord);
    expect(doc?.avatarUrl).toEqual(updateParams.avatarUrl);
    expect(doc?.bannerUrl).toEqual(updateParams.bannerUrl);
    walletSpy.mockRestore();
  });

  it('failed to update space - invalid URL', async () => {
    const updateParams = { uid: space?.uid, name: 'abc', twitter: 'WRONG URL' };
    mockWalletReturnValue(walletSpy, dummyAddress, updateParams);
    expectThrow(testEnv.wrap(updateSpace)({}), WenError.invalid_params.key);
    walletSpy.mockRestore();
  });

  it('failed to update space - missing UID', async () => {
    mockWalletReturnValue(walletSpy, dummyAddress, { name: 'abc' });
    expectThrow(testEnv.wrap(updateSpace)({}), WenError.invalid_params.key);
    walletSpy.mockRestore();
  });

  it('failed to update space - does not exists', async () => {
    mockWalletReturnValue(walletSpy, dummyAddress, { uid: dummyAddress, name: 'abc' });
    expectThrow(testEnv.wrap(updateSpace)({}), WenError.space_does_not_exists.key);
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
    expectThrow(testEnv.wrap(joinSpace)({}), WenError.you_are_already_part_of_space.key);
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
    expectThrow(
      testEnv.wrap(leaveSpace)({}),
      WenError.at_least_one_guardian_must_be_in_the_space.key,
    );
  });

  it('fail to leave space - as only member', async () => {
    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid });
    expectThrow(
      testEnv.wrap(leaveSpace)({}),
      WenError.at_least_one_member_must_be_in_the_space.key,
    );
  });

  it('fail to leave space where Im not in', async () => {
    mockWalletReturnValue(walletSpy, member, { uid: space.uid });
    expectThrow(testEnv.wrap(leaveSpace)({}), WenError.you_are_not_part_of_the_space.key);
  });

  it('make guardian', async () => {
    await joinSpaceFunc(member, space.uid);
    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member });
    const addGuardianResult = await testEnv.wrap(addGuardian)({});
    assertCreatedOnAndId(addGuardianResult, member);
  });

  it('fail to make guardian - must be member', async () => {
    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member });
    expectThrow(testEnv.wrap(addGuardian)({}), WenError.member_is_not_part_of_the_space.key);
  });

  it('fail to make guardian - already is', async () => {
    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member: guardian });
    expectThrow(testEnv.wrap(addGuardian)({}), WenError.member_is_already_guardian_of_space.key);
  });

  it('make guardian and remove', async () => {
    await joinSpaceFunc(member, space.uid);

    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member });
    const addGuardianResult = await testEnv.wrap(addGuardian)({});
    assertCreatedOnAndId(addGuardianResult, member);

    const removeGuardianResult = await testEnv.wrap(removeGuardian)({});
    expect(removeGuardianResult).toBeDefined();
    expect(removeGuardianResult.status).toEqual('success');
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
    expectThrow(
      testEnv.wrap(blockMember)({}),
      WenError.at_least_one_member_must_be_in_the_space.key,
    );
  });

  it('fail to block myself if Im only guardian', async () => {
    await joinSpaceFunc(member, space.uid);
    mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member: guardian });
    expectThrow(
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
    expectThrow(testEnv.wrap(joinSpace)({}), WenError.you_are_not_allowed_to_join_space.key);
  });

  describe('SpaceController: member management - NOT OPEN', () => {
    beforeEach(async () => {
      walletSpy = jest.spyOn(wallet, 'decodeAuth');
      guardian = wallet.getRandomEthAddress();
      member = wallet.getRandomEthAddress();
      mockWalletReturnValue(walletSpy, guardian, { name: 'This space rocks', open: false });
      space = await testEnv.wrap(createSpace)({});
      expect(space?.uid).toBeDefined();
    });

    it('successfully join space', async () => {
      await joinSpaceFunc(member, space.uid);
    });

    it('successfully join space and fail to accept - NOT GUARDIAN', async () => {
      await joinSpaceFunc(member, space.uid);

      mockWalletReturnValue(walletSpy, member, { uid: space.uid, member });
      expectThrow(testEnv.wrap(acceptMemberSpace)({}), WenError.you_are_not_guardian_of_space.key);
    });

    it('successfully join space and be accepted', async () => {
      await joinSpaceFunc(member, space.uid);

      mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member });
      const aSpace = await testEnv.wrap(acceptMemberSpace)({});
      assertCreatedOnAndId(aSpace, member);
    });

    it('join space, edit space and still able to accept', async () => {
      await joinSpaceFunc(member, space.uid);

      mockWalletReturnValue(walletSpy, guardian, {
        uid: space.uid,
        name: 'This space rocks',
        open: false,
      });
      space = await testEnv.wrap(updateSpace)({});
      expect(space?.uid).toBeDefined();

      // Accepted them
      mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member });
      const aSpace = await testEnv.wrap(acceptMemberSpace)({});
      assertCreatedOnAndId(aSpace, member);
    });

    it('join space, edit space to open and it should no longer be able to accept', async () => {
      await joinSpaceFunc(member, space.uid);

      mockWalletReturnValue(walletSpy, guardian, {
        uid: space.uid,
        name: 'This space rocks',
        open: true,
      });

      space = await testEnv.wrap(updateSpace)({});
      expect(space?.uid).toBeDefined();

      mockWalletReturnValue(walletSpy, guardian, { uid: space.uid, member });
      expectThrow(testEnv.wrap(acceptMemberSpace)({}), WenError.member_did_not_request_to_join.key);
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

  it('Should add guardian to space after vote, than remove it', async () => {
    mockWalletReturnValue(walletSpy, member, { uid: space?.uid });
    await testEnv.wrap(joinSpace)({});

    mockWalletReturnValue(walletSpy, guardians[0], { uid: space.uid, member });
    const proposal = await testEnv.wrap(addGuardian)({});

    mockWalletReturnValue(walletSpy, guardians[0], { uid: proposal.uid });
    await testEnv.wrap(approveProposal)({});

    mockWalletReturnValue(walletSpy, guardians[0], { uid: proposal.uid, values: [0] });
    await testEnv.wrap(voteOnProposal)({});
    mockWalletReturnValue(walletSpy, guardians[1], { uid: proposal.uid, values: [1] });
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

    mockWalletReturnValue(walletSpy, guardians[0], { uid: space.uid, member });
    const removeProposal = await testEnv.wrap(removeGuardian)({});
    mockWalletReturnValue(walletSpy, guardians[0], { uid: removeProposal.uid });
    await testEnv.wrap(approveProposal)({});

    mockWalletReturnValue(walletSpy, guardians[0], { uid: removeProposal.uid, values: [1] });
    await testEnv.wrap(voteOnProposal)({});
    mockWalletReturnValue(walletSpy, guardians[1], { uid: removeProposal.uid, values: [0] });
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
});
