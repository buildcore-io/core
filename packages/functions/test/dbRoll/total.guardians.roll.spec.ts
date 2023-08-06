import { COL, SUB_COL, Space } from '@build-5/interfaces';
import { totalGuardiansRoll } from '../../scripts/dbUpgrades/1.0/totalGuardiansRoll';
import { build5App } from '../../src/firebase/app/build5App';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Total members roll', () => {
  it('Should roll member count', async () => {
    const space = getRandomEthAddress();
    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${space}`);
    await spaceDocRef.create({ name: 'space', uid: space });

    await spaceDocRef.collection(SUB_COL.GUARDIANS).doc(getRandomEthAddress()).create({});
    await spaceDocRef.collection(SUB_COL.GUARDIANS).doc(getRandomEthAddress()).create({});

    await spaceDocRef.collection(SUB_COL.MEMBERS).doc(getRandomEthAddress()).create({});
    await spaceDocRef.collection(SUB_COL.MEMBERS).doc(getRandomEthAddress()).create({});
    await spaceDocRef.collection(SUB_COL.MEMBERS).doc(getRandomEthAddress()).create({});

    await spaceDocRef.collection(SUB_COL.KNOCKING_MEMBERS).doc(getRandomEthAddress()).create({});

    await totalGuardiansRoll(build5App());

    const spaceData = <Space>await spaceDocRef.get();
    expect(spaceData.totalGuardians).toBe(2);
    expect(spaceData.totalMembers).toBe(3);
    expect(spaceData.totalPendingMembers).toBe(1);
  });
});
