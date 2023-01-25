import { COL, SUB_COL, TokenDrop } from '@soonaverse/interfaces';
import { uppercaseMemberFix } from '../../../scripts/dbUpgrades/0_17/uppercase.member.fix';
import admin from '../../../src/admin.config';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';
describe('Uppercase member fix', () => {
  it('Should roll uppercase members', async () => {
    const token = getRandomEthAddress();

    const members = [getRandomEthAddress().toUpperCase(), getRandomEthAddress()];

    const airdrops = members.map((member) => ({
      uid: getRandomEthAddress(),
      member,
      count: 10,
      token,
    }));
    for (const airdrop of airdrops) {
      await admin.firestore().doc(`${COL.AIRDROP}/${airdrop.uid}`).create(airdrop);
    }

    for (const member of members) {
      await admin
        .firestore()
        .collection(COL.TOKEN)
        .doc(token)
        .collection(SUB_COL.DISTRIBUTION)
        .doc(member)
        .create({ totalUnclaimedAirdrop: 10 });
    }

    await uppercaseMemberFix(admin.app());

    for (const airdrop of airdrops) {
      const airdropData = <TokenDrop>(
        (await admin.firestore().doc(`${COL.AIRDROP}/${airdrop.uid}`).get()).data()
      );
      expect(airdropData.count).toBe(10);
      expect(/[a-z]/.test(airdropData.member)).toBe(true);
    }

    for (const member of members) {
      const distribution = await admin
        .firestore()
        .collection(COL.TOKEN)
        .doc(token)
        .collection(SUB_COL.DISTRIBUTION)
        .doc(member.toLowerCase())
        .get();
      expect(distribution.data()?.totalUnclaimedAirdrop).toBe(10);
    }

    for (const member of members) {
      const distribution = await admin
        .firestore()
        .collection(COL.TOKEN)
        .doc(token)
        .collection(SUB_COL.DISTRIBUTION)
        .doc(member.toUpperCase())
        .get();
      expect(distribution.data()).toBeUndefined();
    }
  });
});
