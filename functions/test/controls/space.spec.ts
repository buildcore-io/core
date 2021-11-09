import { WenError } from '../../interfaces/errors';
import { WEN_FUNC } from "../../interfaces/functions";
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { addGuardian, blockMember, createSpace, joinSpace, leaveSpace, removeGuardian, unblockMember, updateSpace } from './../../src/controls/space.control';

describe('SpaceController: ' + WEN_FUNC.cSpace, () => {
  it('successfully create space', async () => {
    const dummyAddress = wallet.getRandomEthAddress();
    const walletSpy = jest.spyOn(wallet, 'decodeToken');
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: {}
    }));

    const wrapped: any = testEnv.wrap(createSpace);
    const returns = await wrapped();
    expect(returns?.uid).toBeDefined();
    expect(returns?.createdOn).toBeDefined();
    expect(returns?.updatedOn).toBeDefined();

    // am I member and guardian.
    expect(returns.members).toBeDefined();
    expect(returns.members[dummyAddress]).toBeDefined();
    expect(returns.guardians).toBeDefined();
    expect(returns.guardians[dummyAddress]).toBeDefined();
    walletSpy.mockRestore();
  });

  it('successfully create space with name', async () => {
    const dummyAddress = wallet.getRandomEthAddress();
    const walletSpy = jest.spyOn(wallet, 'decodeToken');
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: {
        name: 'Space ABC'
      }
    }));

    const wrapped: any = testEnv.wrap(createSpace);
    const returns = await wrapped();
    expect(returns?.uid).toBeDefined();
    expect(returns?.name).toEqual('Space ABC');
    walletSpy.mockRestore();
  });

  it('unable to decode token.', async () => {
    const wrapped: any = testEnv.wrap(createSpace);
    (<any>expect(wrapped())).rejects.toThrowError(WenError.token_must_be_provided.key);
  });
});


describe('SpaceController: ' + WEN_FUNC.uSpace, () => {
  let walletSpy: any;
  let dummyAddress: any;
  let doc: any;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeToken');
    dummyAddress = wallet.getRandomEthAddress();;
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: {}
    }));

    const wCreate: any = testEnv.wrap(createSpace);
    doc = await wCreate();
    expect(doc?.uid).toBeDefined();
  });

  it('successfully update space', async () => {
    // Let's go ahead and update the space.
    const wUpdate: any = testEnv.wrap(updateSpace);
    const updateParams = {
      uid: doc?.uid,
      name: 'abc',
      github: 'https://abc1',
      twitter: 'https://abc1',
      discord: 'https://abc1'
    };
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: updateParams
    }));
    const doc2: any = await wUpdate();
    expect(doc2?.name).toEqual(updateParams.name);
    expect(doc2?.github).toEqual(updateParams.github);
    expect(doc2?.twitter).toEqual(updateParams.twitter);
    expect(doc2?.discord).toEqual(updateParams.discord);
    walletSpy.mockRestore();
  });

  it('failed to update space - invalid URL', async () => {
    // Let's go ahead and update the space.
    const wUpdate: any = testEnv.wrap(updateSpace);
    const updateParams = {
      uid: doc?.uid,
      name: 'abc',
      twitter: 'WRONG URL'
    };
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: updateParams
    }));

    (<any>expect(wUpdate())).rejects.toThrowError(WenError.invalid_params.key);
    walletSpy.mockRestore();
  });

  it('failed to update space - missing UID', async () => {
    // Let's go ahead and update the space.
    const wUpdate: any = testEnv.wrap(updateSpace);
    const updateParams = {
      name: 'abc'
    };
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: updateParams
    }));

    (<any>expect(wUpdate())).rejects.toThrowError(WenError.invalid_params.key);
    walletSpy.mockRestore();
  });

  it('failed to update space - does not exists', async () => {
    // Let's go ahead and update the space.
    const wUpdate: any = testEnv.wrap(updateSpace);
    const updateParams = {
      uid: dummyAddress,
      name: 'abc'
    };
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: updateParams
    }));

    (<any>expect(wUpdate())).rejects.toThrowError(WenError.space_does_not_exists.key);
    walletSpy.mockRestore();
  });
});

describe('SpaceController: member management', () => {
  let walletSpy: any;
  let guardian: any;
  let member: any;
  let doc: any;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeToken');
    guardian = wallet.getRandomEthAddress();
    member = wallet.getRandomEthAddress();
    walletSpy.mockReturnValue(Promise.resolve({
      address: guardian,
      body: {
        name: 'This space rocks'
      }
    }));

    const wCreate: any = testEnv.wrap(createSpace);
    doc = await wCreate();
    expect(doc?.uid).toBeDefined();
  });

  it('successfully join space', async () => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: member,
      body: {
        uid: doc.uid
      }
    }));
    const jSpace: any = testEnv.wrap(joinSpace);
    const doc2 = await jSpace();
    expect(doc2).toBeDefined();
    expect(doc2.createdOn).toBeDefined();
    expect(doc2.uid).toEqual(member);
  });

  it('fail to join space - already in', async () => {
    // Guardian tries to join again.
    walletSpy.mockReturnValue(Promise.resolve({
      address: guardian,
      body: {
        uid: doc.uid
      }
    }));
    const jSpace: any = testEnv.wrap(joinSpace);
    // Unable to join because guardian is already part of it.
    (<any>expect(jSpace())).rejects.toThrowError(WenError.you_are_already_part_of_space.key);
  });

  it('successfully leave space', async () => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: member,
      body: {
        uid: doc.uid
      }
    }));
    const jSpace: any = testEnv.wrap(joinSpace);
    const doc2 = await jSpace();
    expect(doc2).toBeDefined();
    expect(doc2.createdOn).toBeDefined();
    expect(doc2.uid).toEqual(member);

    // Let's leave space now.
    const lSpace: any = testEnv.wrap(leaveSpace);
    const doc3 = await lSpace();
    expect(doc3).toBeDefined();
    expect(doc3.status).toEqual('success');
  });

  it('fail to leave space - as only guardian', async () => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: member,
      body: {
        uid: doc.uid
      }
    }));
    const jSpace: any = testEnv.wrap(joinSpace);
    const doc2 = await jSpace();
    expect(doc2).toBeDefined();
    expect(doc2.createdOn).toBeDefined();
    expect(doc2.uid).toEqual(member);

    walletSpy.mockReturnValue(Promise.resolve({
      address: guardian,
      body: {
        uid: doc.uid
      }
    }));
    // Let's leave space now.
    const lSpace: any = testEnv.wrap(leaveSpace);
    (<any>expect(lSpace())).rejects.toThrowError(WenError.at_least_one_guardian_must_be_in_the_space.key);
  });

  it('fail to leave space - as only member', async () => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: guardian,
      body: {
        uid: doc.uid
      }
    }));
    // Let's leave space now.
    const lSpace: any = testEnv.wrap(leaveSpace);
    (<any>expect(lSpace())).rejects.toThrowError(WenError.at_least_one_member_must_be_in_the_space.key);
  });

  it('fail to leave space where Im not in', async () => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: member,
      body: {
        uid: doc.uid
      }
    }));
    // Let's leave space now.
    const lSpace: any = testEnv.wrap(leaveSpace);
    (<any>expect(lSpace())).rejects.toThrowError(WenError.you_are_not_part_of_the_space.key);
  });

  it('make guardian', async () => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: member,
      body: {
        uid: doc.uid
      }
    }));
    const jSpace: any = testEnv.wrap(joinSpace);
    const doc2 = await jSpace();
    expect(doc2).toBeDefined();
    expect(doc2.createdOn).toBeDefined();
    expect(doc2.uid).toEqual(member);

    walletSpy.mockReturnValue(Promise.resolve({
      address: guardian,
      body: {
        uid: doc.uid,
        member: member
      }
    }));

    // Let's add guardian now.
    const aGuardian: any = testEnv.wrap(addGuardian);
    const doc3 = await aGuardian();
    expect(doc3).toBeDefined();
    expect(doc3.createdOn).toBeDefined();
    expect(doc3.uid).toEqual(member);
  });

  it('fail to make guardian - must be member', async () => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: guardian,
      body: {
        uid: doc.uid,
        member: member
      }
    }));

    // Let's leave space now.
    const aGuardian: any = testEnv.wrap(addGuardian);
    (<any>expect(aGuardian())).rejects.toThrowError(WenError.member_is_not_part_of_the_space.key);
  });

  it('fail to make guardian - already is', async () => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: guardian,
      body: {
        uid: doc.uid,
        member: guardian
      }
    }));
    // Let's leave space now.
    const aGuardian: any = testEnv.wrap(addGuardian);
    (<any>expect(aGuardian())).rejects.toThrowError(WenError.member_is_already_guardian_of_space.key);
  });

  it('make guardian and remove', async () => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: member,
      body: {
        uid: doc.uid
      }
    }));
    const jSpace: any = testEnv.wrap(joinSpace);
    const doc2 = await jSpace();
    expect(doc2).toBeDefined();
    expect(doc2.createdOn).toBeDefined();
    expect(doc2.uid).toEqual(member);

    walletSpy.mockReturnValue(Promise.resolve({
      address: guardian,
      body: {
        uid: doc.uid,
        member: member
      }
    }));

    // Let's add guardian now.
    const aGuardian: any = testEnv.wrap(addGuardian);
    const doc3 = await aGuardian();
    expect(doc3).toBeDefined();
    expect(doc3.createdOn).toBeDefined();
    expect(doc3.uid).toEqual(member);

    // Lets try to remove the guardian.
    const rGuardian: any = testEnv.wrap(removeGuardian);
    const doc4 = await rGuardian();
    expect(doc4).toBeDefined();
    expect(doc4.status).toEqual('success');
  });

  it('successfully block member', async () => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: member,
      body: {
        uid: doc.uid
      }
    }));
    const jSpace: any = testEnv.wrap(joinSpace);
    const doc2 = await jSpace();
    expect(doc2).toBeDefined();
    expect(doc2.createdOn).toBeDefined();
    expect(doc2.uid).toEqual(member);

    walletSpy.mockReturnValue(Promise.resolve({
      address: guardian,
      body: {
        uid: doc.uid,
        member: member
      }
    }));
    // Let's block member now
    const bMember: any = testEnv.wrap(blockMember);
    const doc3 = await bMember();
    expect(doc3).toBeDefined();
    expect(doc3.createdOn).toBeDefined();
    expect(doc3.uid).toEqual(member);
  });

  it('block member and unblock', async () => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: member,
      body: {
        uid: doc.uid
      }
    }));
    const jSpace: any = testEnv.wrap(joinSpace);
    const doc2 = await jSpace();
    expect(doc2).toBeDefined();
    expect(doc2.createdOn).toBeDefined();
    expect(doc2.uid).toEqual(member);

    walletSpy.mockReturnValue(Promise.resolve({
      address: guardian,
      body: {
        uid: doc.uid,
        member: member
      }
    }));
    // Let's block member now
    const bMember: any = testEnv.wrap(blockMember);
    const doc3 = await bMember();
    expect(doc3).toBeDefined();
    expect(doc3.createdOn).toBeDefined();
    expect(doc3.uid).toEqual(member);

    // Let's go and and ublock member.
    const unblMember: any = testEnv.wrap(unblockMember);
    const doc4 = await unblMember();
    expect(doc4).toBeDefined();
    expect(doc4.status).toEqual('success');
  });

  it('successfully block member and unable to join space', async () => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: member,
      body: {
        uid: doc.uid
      }
    }));
    const jSpace: any = testEnv.wrap(joinSpace);
    const doc2 = await jSpace();
    expect(doc2).toBeDefined();
    expect(doc2.createdOn).toBeDefined();
    expect(doc2.uid).toEqual(member);

    walletSpy.mockReturnValue(Promise.resolve({
      address: guardian,
      body: {
        uid: doc.uid,
        member: member
      }
    }));
    // Let's block member now
    const bMember: any = testEnv.wrap(blockMember);
    const doc3 = await bMember();
    expect(doc3).toBeDefined();
    expect(doc3.createdOn).toBeDefined();
    expect(doc3.uid).toEqual(member);

    // Let's try to join the space.
    walletSpy.mockReturnValue(Promise.resolve({
      address: member,
      body: {
        uid: doc.uid
      }
    }));
    const jSpace2: any = testEnv.wrap(joinSpace);
    (<any>expect(jSpace2())).rejects.toThrowError(WenError.you_are_not_allowed_to_join_space.key);
  });
});
