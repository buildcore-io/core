import {
  Access,
  Categories,
  COL,
  Collection,
  CollectionStatus,
  CollectionType,
} from '@soonaverse/interfaces';
import {
  AVATAR_COLLECTION_TEST_CONFIG,
  createAvatarCollection,
} from '../../../scripts/dbUpgrades/0.19/avatar.roll_1';
import { soonApp } from '../../../src/firebase/app/soonApp';
import { soonDb } from '../../../src/firebase/firestore/soondb';

describe('Create avatar collection', () => {
  it('Should create avatar collection', async () => {
    await createAvatarCollection(soonApp());

    const config = AVATAR_COLLECTION_TEST_CONFIG;
    const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${config.collection}`);
    const collection = <Collection>await collectionDocRef.get();
    expect(collection.createdOn).toBeDefined();
    expect(collection.updatedOn).toBeDefined();
    expect(collection.uid).toBe(AVATAR_COLLECTION_TEST_CONFIG.collection);
    expect(collection.createdBy).toBe(AVATAR_COLLECTION_TEST_CONFIG.guardian);
    expect(collection.name).toBe('Avatar Collection');
    expect(collection.description).toBe('Collection holding all the avatars');
    expect(collection.approved).toBe(true);
    expect(collection.rejected).toBe(false);
    expect(collection.category).toBe(Categories.COLLECTIBLE);
    expect(collection.type).toBe(CollectionType.CLASSIC);
    expect(collection.access).toBe(Access.OPEN);
    expect(collection.space).toBe(AVATAR_COLLECTION_TEST_CONFIG.space);
    expect(collection.status).toBe(CollectionStatus.PRE_MINTED);
  });
});
