import { build5App, build5Db } from '@build-5/database';
import { COL, SUB_COL } from '@build-5/interfaces';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { setProjectRoll } from '../../scripts/dbUpgrades/1.0.0/set.project';

describe('Set project', () => {
  it('Should set project', async () => {
    const spaceId = getRandomEthAddress();
    const spaceDocRef = build5Db().collection(COL.SPACE).doc(spaceId);
    await spaceDocRef.create({ uid: spaceId });

    const memberId = getRandomEthAddress();
    const memberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(memberId);
    await memberDocRef.create({ uid: memberId });

    await setProjectRoll(build5App());
  });
});
