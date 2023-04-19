import { COL, Member } from '@soonaverse/interfaces';
import { createAvatarCollection } from '../../../scripts/dbUpgrades/0.19/avatar.roll_1';
import { rollMemberAvatars } from '../../../scripts/dbUpgrades/0.19/avatar.roll_2';
import { soonApp } from '../../../src/firebase/app/soonApp';
import { soonDb } from '../../../src/firebase/firestore/soondb';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

describe('Member avatar roll', () => {
  it('Should roll member avatar', async () => {
    await createAvatarCollection(soonApp());

    await soonDb()
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
      const docRef = soonDb().doc(`${COL.MEMBER}/${member.uid}`);
      await docRef.create(member);
    }

    await rollMemberAvatars(soonApp());

    let docRef = soonDb().doc(`${COL.MEMBER}/${members[0].uid}`);
    let member = <Member>await docRef.get();
    expect(member.avatar).toBeDefined();
    expect(member.avatarNft).toBeDefined();

    docRef = soonDb().doc(`${COL.MEMBER}/${members[1].uid}`);
    member = <Member>await docRef.get();
    expect(member.avatar).toBeUndefined();
    expect(member.avatarNft).toBeUndefined();
  });
});
