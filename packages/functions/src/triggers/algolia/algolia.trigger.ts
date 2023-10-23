import { COL } from '@build-5/interfaces';
import algoliasearch from 'algoliasearch';
import { algoliaAppId, algoliaKey, isEmulatorEnv } from '../../utils/config.utils';
import { FirestoreDocEvent } from '../common';
import { docToAlgoliaData } from './firestore.to.algolia';
const client = algoliasearch(algoliaAppId(), algoliaKey());

const deleteObject = async (col: COL, objectID: string) => {
  try {
    await client.initIndex(col).deleteObject(objectID);
  } catch (error) {
    console.error(col, objectID, error);
  }
};

const upsertObject = async (rawData: Record<string, unknown>, col: COL, objectID: string) => {
  const data = docToAlgoliaData({ ...rawData, objectID, id: objectID });
  try {
    await client.initIndex(col).saveObject(data).wait();
  } catch (error) {
    console.error(col, objectID, error);
  }
};

export const algoliaTrigger = async (event: FirestoreDocEvent<Record<string, string>>) => {
  if (isEmulatorEnv()) {
    return;
  }
  const { prev, curr, col } = event;
  const objectID = curr?.uid || prev?.uid || '';

  if (!objectID) {
    return;
  }

  if (!curr) {
    return await deleteObject(col, objectID);
  }

  return await upsertObject(curr, col, objectID);
};
