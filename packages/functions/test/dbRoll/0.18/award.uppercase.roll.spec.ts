import { COL, SUB_COL } from '@soonaverse/interfaces';
import { awardUppercaseRoll } from '../../../scripts/dbUpgrades/0.18/award.uppercase.roll';
import admin from '../../../src/admin.config';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

describe('Award uppercase roll', () => {
  it('Should roll uppercase participants', async () => {
    const awards = [{ uid: getRandomEthAddress() }, { uid: getRandomEthAddress() }];
    for (const award of awards) {
      await admin.firestore().doc(`${COL.AWARD}/${award.uid}`).create(award);
    }

    const members = [getRandomEthAddress(), getRandomEthAddress(), getRandomEthAddress()];
    const participants = [
      { parentId: awards[0].uid, uid: members[0] },
      { parentId: awards[0].uid, uid: members[1] },
      { parentId: awards[0].uid, uid: members[1].toUpperCase() },
      { parentId: awards[0].uid, uid: members[2].toUpperCase() },
      { parentId: awards[1].uid, uid: members[0].toUpperCase() },
    ];
    for (const participant of participants) {
      await admin
        .firestore()
        .doc(`${COL.AWARD}/${participant.parentId}/${SUB_COL.PARTICIPANTS}/${participant.uid}`)
        .create(participant);

      await admin
        .firestore()
        .collection(COL.AIRDROP)
        .add({ member: participant.uid, award: participant.parentId });

      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .add({ member: participant.uid, payload: { award: participant.parentId } });
    }

    await awardUppercaseRoll(admin.app(), awards[0].uid);

    let participantsSnap = await admin
      .firestore()
      .doc(`${COL.AWARD}/${awards[0].uid}`)
      .collection(SUB_COL.PARTICIPANTS)
      .get();
    expect(participantsSnap.size).toBe(3);

    let airdropSnap = await admin
      .firestore()
      .collection(COL.AIRDROP)
      .where('award', '==', awards[0].uid)
      .get();
    expect(airdropSnap.size).toBe(3);
    for (const doc of airdropSnap.docs) {
      expect(members.includes(doc.data().member)).toBe(true);
    }

    let badgeSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('payload.award', '==', awards[0].uid)
      .get();
    expect(badgeSnap.size).toBe(3);
    for (const doc of badgeSnap.docs) {
      expect(members.includes(doc.data().member)).toBe(true);
    }

    participantsSnap = await admin
      .firestore()
      .doc(`${COL.AWARD}/${awards[1].uid}`)
      .collection(SUB_COL.PARTICIPANTS)
      .get();
    expect(participantsSnap.size).toBe(1);
    expect(participantsSnap.docs[0].data().uid).toBe(members[0].toUpperCase());

    airdropSnap = await admin
      .firestore()
      .collection(COL.AIRDROP)
      .where('award', '==', awards[1].uid)
      .get();
    expect(airdropSnap.size).toBe(1);
    expect(airdropSnap.docs[0].data().member).toBe(members[0].toUpperCase());

    badgeSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('payload.award', '==', awards[1].uid)
      .get();
    expect(badgeSnap.size).toBe(1);
    expect(badgeSnap.docs[0].data().member).toBe(members[0].toUpperCase());
  });
});
