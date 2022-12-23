import { COL, SUB_COL, TokenDistribution } from '@soonaverse/interfaces';
import { setExtrasStakes } from '../../scripts/dbUpgrades/0_16/extra.stake.reward';
import admin from '../../src/admin.config';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
describe('Set extra stale', () => {
  it('Should set extra stake', async () => {
    const token = getRandomEthAddress();
    const extraStakes = {
      [getRandomEthAddress()]: 12,
      [getRandomEthAddress()]: 5,
    };
    for (const member of Object.keys(extraStakes)) {
      await admin
        .firestore()
        .doc(`${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}/${member}`)
        .create({});
    }

    await setExtrasStakes(admin.app(), extraStakes, token);

    for (const member of Object.keys(extraStakes)) {
      const docRef = admin
        .firestore()
        .doc(`${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}/${member}`);
      const distribution = <TokenDistribution>(await docRef.get()).data();
      expect(distribution.extraStakeRewards).toBe(extraStakes[member]);
    }
  });

  it('Should not set extra stake twice', async () => {
    const token = getRandomEthAddress();
    const member = getRandomEthAddress();
    const extraStakes = {
      [member]: 12,
    };
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}/${member}`)
      .create({ extraStakeRewards: 5 });

    await setExtrasStakes(admin.app(), extraStakes, token);

    const docRef = admin.firestore().doc(`${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}/${member}`);
    const distribution = <TokenDistribution>(await docRef.get()).data();
    expect(distribution.extraStakeRewards).toBe(5);
  });
});
