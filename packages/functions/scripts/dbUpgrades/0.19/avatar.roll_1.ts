/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Access,
  AVATAR_COLLECTION_PROD,
  AVATAR_COLLECTION_TEST,
  Categories,
  COL,
  CollectionStatus,
  CollectionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { FieldValue } from 'firebase-admin/firestore';
import { FirebaseApp } from '../../../src/firebase/app/app';
import { Firestore } from '../../../src/firebase/firestore/firestore';

export const createAvatarCollection = async (app: FirebaseApp) => {
  const config =
    app.getName() === 'soonaverse' ? AVATAR_COLLECTION_PROD_CONFIG : AVATAR_COLLECTION_TEST_CONFIG;

  const collection = {
    createdOn: FieldValue.serverTimestamp(),
    updatedOn: FieldValue.serverTimestamp(),
    uid: config.collection,
    createdBy: config.guardian,
    name: 'Avatar Collection',
    description: 'Collection holding all the avatars',
    discounts: [],
    total: 0,
    sold: 0,
    approved: true,
    rejected: false,
    category: Categories.COLLECTIBLE,
    type: CollectionType.CLASSIC,
    access: Access.OPEN,
    accessAwards: [],
    accessCollections: [],
    space: config.space,
    availableFrom: dayjs().toDate(),
    price: 0,
    availablePrice: 0,
    onePerMemberOnly: false,
    status: CollectionStatus.PRE_MINTED,
    royaltiesFee: 0.09,
    royaltiesSpace: config.space,
  };

  const db = new Firestore(app);
  const docRef = db.doc(`${COL.COLLECTION}/${collection.uid}`);
  await docRef.set(collection, true);
};

export const roll = createAvatarCollection;

export const AVATAR_COLLECTION_PROD_CONFIG = {
  guardian: '0x551fd2c7c7bf356bac194587dab2fcd46420054b',
  space: '0x5fcc5562385e6c2f6b0a5934280e5d11274f8e07',
  collection: AVATAR_COLLECTION_PROD,
};

export const AVATAR_COLLECTION_TEST_CONFIG = {
  guardian: '0x551fd2c7c7bf356bac194587dab2fcd46420054b',
  space: '0xda4723ab538fea3b4fb251ba5ab7d7fd2188fa1b',
  collection: AVATAR_COLLECTION_TEST,
};
