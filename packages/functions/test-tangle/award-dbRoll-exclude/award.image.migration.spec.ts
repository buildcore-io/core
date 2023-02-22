import { Award, COL } from '@soonaverse/interfaces';
import { awardImageMigration } from '../../scripts/dbUpgrades/0_18/award.image.migration';
import admin from '../../src/admin.config';
import { Helper } from './Helper';

describe('Award image migration', () => {
  const helper = new Helper();

  const createAndSaveAward = async (func: () => any) => {
    const legacyAward = func();
    const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${legacyAward.uid}`);
    await awardDocRef.create(legacyAward);
    return legacyAward;
  };

  beforeEach(async () => {
    await helper.clearDb();
    await helper.beforeEach();
  });

  it('Should migrate award image', async () => {
    const awards = [
      await createAndSaveAward(helper.newAward),
      await createAndSaveAward(helper.halfCompletedAward),
      await createAndSaveAward(helper.fullyCompletedAward),
    ];

    await awardImageMigration(admin.app());

    for (const uid of awards.map((a) => a.uid)) {
      const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${uid}`);
      const award = <Award>(await awardDocRef.get()).data();
      expect(award.badge.image?.startsWith('http://')).toBe(true);
      expect(award.badge.ipfsMedia).toBeDefined();
      expect(award.badge.ipfsMetadata).toBeDefined();
      expect(award.badge.ipfsRoot).toBeDefined();
    }
  });
});
