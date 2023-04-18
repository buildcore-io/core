import { ALGOLIA_COLLECTIONS } from '@soonaverse/interfaces';
import algoliasearch from 'algoliasearch';
import { algoliaRoll } from '../../../scripts/dbUpgrades/0.19/w_algolia.roll';
import { soonApp } from '../../../src/firebase/app/soonApp';
import { soonDb } from '../../../src/firebase/firestore/soondb';
import { algoliaAppId, algoliaKey } from '../../../src/utils/config.utils';
import { getRandomEthAddress } from '../../../src/utils/wallet.utils';

const client = algoliasearch(algoliaAppId(), algoliaKey());

describe('Roll algolia', () => {
  it('Should roll algolia', async () => {
    const entity = { uid: getRandomEthAddress() };
    for (const col of ALGOLIA_COLLECTIONS) {
      const docRef = soonDb().doc(`${col}/${entity.uid}`);
      await docRef.create(entity);
    }
    for (const col of ALGOLIA_COLLECTIONS) {
      await algoliaRoll(soonApp(), col);
    }

    for (const col of ALGOLIA_COLLECTIONS) {
      const algoliaEntity = await client.initIndex(col).getObject(entity.uid);
      expect(algoliaEntity).toBeDefined();
    }
  });
});
