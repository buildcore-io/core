/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/namespace */
import * as functions from 'firebase-functions/v2';
import { flattenObject } from './common';
import { CloudFunctions, pathToParts } from './runtime/common';
import { HttpsFunction } from './runtime/https/https';
import * as onRequests from './runtime/https/index';
import * as onStorage from './runtime/storage/index';
import { StorageFunction } from './runtime/storage/storage';
import * as onTriggers from './runtime/trigger/index';
import { TriggeredFunction, TriggeredFunctionType } from './runtime/trigger/trigger';

// On request functions
const toOnRequest = (config: HttpsFunction) =>
  functions.https.onRequest((req, res) => config.func(req, res));

export const https = Object.entries(flattenObject(onRequests)).reduce(
  (acc, [name, config]) => ({ ...acc, [name]: toOnRequest(config as HttpsFunction) }),
  {} as any,
);

// Trigger functions
const getFirestoreHandler = (config: TriggeredFunction) => {
  if (config.type === TriggeredFunctionType.ON_CREATE) {
    return functions.firestore.onDocumentCreated(config.document, async (event) => {
      const data = {
        curr: event.data?.data(),
        path: event.document,
        ...pathToParts(event.document),
      };
      await config.handler(data);
    });
  }
  const firestoreFunc =
    config.type === TriggeredFunctionType.ON_UPDATE
      ? functions.firestore.onDocumentUpdated
      : functions.firestore.onDocumentWritten;
  return firestoreFunc(config.document, async (event) => {
    const data = {
      prev: event.data?.before?.data(),
      curr: event.data?.after?.data(),
      path: event.document,
      ...pathToParts(event.document),
    };
    await config.handler(data);
  });
};
export const triggers = Object.entries(flattenObject(onTriggers)).reduce(
  (acc, [key, config]) => ({ ...acc, [key]: getFirestoreHandler(config) }),
  {} as any,
);

// Storage
export const stroage = Object.entries(flattenObject(onStorage)).reduce((acc, [name, value]) => {
  const config = (value as CloudFunctions).runtimeOptions;
  return {
    ...acc,
    [name]: functions.storage.onObjectFinalized({ bucket: config.bucket! }, (event) =>
      (value as StorageFunction).func({
        metadata: event.data.metadata,
        name: event.data.name,
        bucket: event.data.bucket,
        contentType: event.data.contentType,
      }),
    ),
  };
}, {} as any);
