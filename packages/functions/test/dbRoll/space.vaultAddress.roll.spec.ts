import { COL } from '@soonaverse/interfaces';
import { isEmpty } from 'lodash';
import admin from '../../src/admin.config';
import { spaceVaultAddressDbRoller } from '../../src/dbRoll/space.vault.address';
import * as config from '../../src/utils/config.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';

describe('Space vault address roll', () => {
  it.each([true, false])('Should set vault address on spaces', async (isProd: boolean) => {
    const uid = getRandomEthAddress();
    for (let i = 0; i < 2; ++i) {
      const count = 260;
      const ids = Array.from(Array(count)).map(() => getRandomEthAddress());
      const batch = admin.firestore().batch();
      ids.forEach((id, i) =>
        batch.create(admin.firestore().doc(`${COL.SPACE}/${id}`), { name: 'asd' + i, uid }),
      );
      await batch.commit();
    }
    const isProdSpy = jest.spyOn(config, 'isProdEnv');
    isProdSpy.mockReturnValue(isProd);
    await testEnv.wrap(spaceVaultAddressDbRoller)({});
    isProdSpy.mockRestore();

    const snap = await admin.firestore().collection(COL.SPACE).where('uid', '==', uid).get();
    const allHasVaultAddress = snap.docs.reduce(
      (acc, act) => acc && !isEmpty(act.data()?.vaultAddress),
      true,
    );
    expect(allHasVaultAddress).toBe(true);
    const allHaveRmsAddress = snap.docs.reduce(
      (acc, act) => acc && (act.data()!.vaultAddress as string).startsWith(isProd ? 'smr' : 'rms'),
      true,
    );
    expect(allHaveRmsAddress).toBe(true);
  });
});
