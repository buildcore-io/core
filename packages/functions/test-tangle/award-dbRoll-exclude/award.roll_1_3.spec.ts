import { COL } from '@soonaverse/interfaces';
import { awardImageMigration } from '../../scripts/dbUpgrades/0_18/award.image.migration';
import admin from '../../src/admin.config';
import { awardRoll } from '../../src/firebase/functions/dbRoll/award.roll';
import { Helper } from './Helper';

describe('Award roll test', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.clearDb();
    await helper.beforeEach();
  });

  const createAndSaveAward = async (func: () => any) => {
    const legacyAward = func();
    const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${legacyAward.uid}`);
    await awardDocRef.create(legacyAward);
    return legacyAward;
  };

  it('Should only roll specific award', async () => {
    let award1 = await createAndSaveAward(helper.newAward);
    let award2 = await createAndSaveAward(helper.halfCompletedAward);

    await awardImageMigration(admin.app());

    const req = { body: { awards: [award2.uid] } } as any;
    const res = { send: () => {} } as any;
    await awardRoll(req, res);

    const award1DocRef = admin.firestore().doc(`${COL.AWARD}/${award1.uid}`);
    award1 = (await award1DocRef.get()).data();
    expect(award1.type).toBeDefined();

    const award2DocRef = admin.firestore().doc(`${COL.AWARD}/${award2.uid}`);
    award2 = (await award2DocRef.get()).data();
    expect(award2.isLegacy).toBe(true);
  });
});
