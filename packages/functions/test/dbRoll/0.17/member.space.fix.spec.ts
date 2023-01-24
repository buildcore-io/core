import { COL, Member, Space } from '@soonaverse/interfaces';
import { memberSpacesRollFix } from '../../../scripts/dbUpgrades/0_17/member.spaces.fix';
import admin from '../../../src/admin.config';
import { joinSpace } from '../../../src/controls/space/member.join.control';
import { createSpace } from '../../../src/controls/space/space.create.control';
import * as wallet from '../../../src/utils/wallet.utils';
import { createMember, mockWalletReturnValue } from '../../controls/common';
import { testEnv } from '../../set-up';

let walletSpy: any;

describe('Test member spaces fix', () => {
  let guardian: string;
  let member: string;
  let space1: Space;
  let space2: Space;

  const createAndJoinSpace = async () => {
    mockWalletReturnValue(walletSpy, guardian, { name: 'This space rocks' });
    const space = await testEnv.wrap(createSpace)({});
    mockWalletReturnValue(walletSpy, member, { uid: space.uid });
    await testEnv.wrap(joinSpace)({});
    return space;
  };

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    guardian = await createMember(walletSpy);
    member = await createMember(walletSpy);
    space1 = await createAndJoinSpace();
    space2 = await createAndJoinSpace();
  });

  it('Should update spaces on member', async () => {
    const guardianDocRef = admin.firestore().doc(`${COL.MEMBER}/${guardian}`);
    const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${member}`);
    const { name: guardianName } = <Member>(await guardianDocRef.get()).data();
    const { name: memberName } = <Member>(await memberDocRef.get()).data();

    await guardianDocRef.set(
      {
        spaces: {
          [space1.uid]: {
            uid: space1.uid,
            isMember: admin.firestore.FieldValue.delete(),
            badges: ['badge'],
            awardsCompleted: 12,
            totalReputation: 10,
          },
          [space2.uid]: {
            uid: space1.uid,
            isMember: admin.firestore.FieldValue.delete(),
            badges: ['badge'],
            awardsCompleted: 12,
            totalReputation: 10,
          },
        },
      },
      { merge: true },
    );
    await memberDocRef.update({ space: admin.firestore.FieldValue.delete() });

    await memberSpacesRollFix(admin.app());

    const guardianData = <Member>(await guardianDocRef.get()).data();
    for (const space of [space1.uid, space2.uid]) {
      expect(guardianData.spaces![space].uid).toBe(space);
      expect(guardianData.spaces![space].isMember).toBe(true);
      expect(guardianData.spaces![space].badges).toEqual(['badge']);
      expect(guardianData.spaces![space].awardsCompleted).toBe(12);
      expect(guardianData.spaces![space].totalReputation).toBe(10);
      expect(guardianData.name).toBe(guardianName);
    }

    const memberData = <Member>(await memberDocRef.get()).data();
    for (const space of [space1.uid, space2.uid]) {
      expect(memberData.spaces![space].uid).toBe(space);
      expect(memberData.spaces![space].isMember).toBe(true);
      expect(memberData.name).toBe(memberName);
    }
  });
});
