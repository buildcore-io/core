import { COL, Member } from '@soonaverse/interfaces';
import { createAvatarCollection } from '../../../scripts/dbUpgrades/0.19/avatar.roll_1';
import { rollMemberAvatars } from '../../../scripts/dbUpgrades/0.19/avatar.roll_2';
import admin from '../../../src/admin.config';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

describe('Member avatar roll', () => {
  it('Should roll member avatar', async () => {
    await createAvatarCollection(admin.app());

    await admin
      .firestore()
      .doc(`${COL.AVATARS}/QmNPS2nsqu51vhyuLPkkrfngxWqNJHvJkPysSfLDNydH2u`)
      .set({ available: false });

    const members = [
      {
        uid: getRandomEthAddress(),
        currentProfileImage: {
          avatar: 'bafybeiep4fgd3wkuxhqbaozgpvj6slmgawwwrqzewizgjjpdjud3lwgjyi',
          fileName: 1044,
          metadata: 'QmNPS2nsqu51vhyuLPkkrfngxWqNJHvJkPysSfLDNydH2u',
          original: 'bafybeidlm6mmibwtotrkvj2ntxhwiq5yif6od576akpppvbfli23jruqge',
        },
      },
      { uid: getRandomEthAddress() },
    ];
    for (const member of members) {
      const docRef = admin.firestore().doc(`${COL.MEMBER}/${member.uid}`);
      await docRef.create(member);
    }

    await rollMemberAvatars(admin.app());

    let docRef = admin.firestore().doc(`${COL.MEMBER}/${members[0].uid}`);
    let member = <Member>(await docRef.get()).data();
    expect(member.avatar).toBeDefined();
    expect(member.avatarNft).toBeDefined();

    docRef = admin.firestore().doc(`${COL.MEMBER}/${members[1].uid}`);
    member = <Member>(await docRef.get()).data();
    expect(member.avatar).toBeUndefined();
    expect(member.avatarNft).toBeUndefined();
  });
});
