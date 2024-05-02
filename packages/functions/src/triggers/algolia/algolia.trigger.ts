import { BaseRecord } from '@build-5/database';
import { COL, SOON_PROJECT_ID } from '@build-5/interfaces';
import algoliasearch from 'algoliasearch';
import { algoliaAppId, algoliaKey } from '../../utils/config.utils';
import { logger } from '../../utils/logger';
import { PgDocEvent } from '../common';

const client = algoliasearch(algoliaAppId(), algoliaKey());

const deleteObject = async (col: COL, objectID: string) => {
  try {
    await client.initIndex(col).deleteObject(objectID);
  } catch (error) {
    logger.error('deleteObject-error', col, objectID, error);
  }
};

const upsertObject = async (rawData: BaseRecord, col: COL, objectID: string) => {
  const data = docToAlgoliaData({ ...rawData, objectID, id: objectID } as BaseRecord);
  try {
    await client.initIndex(col).saveObject(data).wait();
  } catch (error) {
    logger.error('upsertObject-error', col, objectID, error);
  }
};

export const algoliaTrigger = async (event: PgDocEvent<BaseRecord>) => {
  const { prev, curr, col } = event;

  if (col !== COL.MEMBER && curr?.project !== SOON_PROJECT_ID) {
    return;
  }

  const objectID = curr?.uid || prev?.uid || '';

  if (!objectID) {
    return;
  }

  if (!curr) {
    return await deleteObject(col, objectID);
  }

  return await upsertObject(curr, col, objectID);
};

const docToAlgoliaData = (data: BaseRecord) => processObject(data);

const processObject = (data: BaseRecord) =>
  Object.entries(data).reduce((acc, [key, val]) => {
    const value = processValue(val);
    return isValid(value) ? { ...acc, [key]: value } : acc;
  }, {} as BaseRecord);

const processValue = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (value instanceof Array) {
    return value.map(processValue);
  }
  if (value instanceof Object) {
    return processObject({ ...value } as BaseRecord);
  }
  return value;
};

const isValid = (value: unknown) => typeof value !== 'undefined' && value !== null;
