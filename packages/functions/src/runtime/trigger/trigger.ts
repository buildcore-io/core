/* eslint-disable @typescript-eslint/no-explicit-any */

import { FirestoreDocEvent } from '../../triggers/common';
import { CloudFunctions, RuntimeOptions } from '../common';

export enum TriggeredFunctionType {
  ON_CREATE = 'on_create',
  ON_UPDATE = 'on_update',
  ON_WRITE = 'on_write',
}

export class TriggeredFunction extends CloudFunctions {
  constructor(
    public readonly type: TriggeredFunctionType,
    public readonly document: string,
    public readonly handler: (event: FirestoreDocEvent<any>) => Promise<void>,
    options?: RuntimeOptions,
  ) {
    super({
      region: 'us-central1',
      ...options,
    });
  }
}

export const onCreate = ({
  document,
  handler,
  options,
}: {
  document: string;
  handler: (event: FirestoreDocEvent<any>) => Promise<void>;
  options?: RuntimeOptions;
}) => new TriggeredFunction(TriggeredFunctionType.ON_CREATE, document, handler, options);

export const onUpdate = ({
  document,
  handler,
  options,
}: {
  document: string;
  handler: (event: FirestoreDocEvent<any>) => Promise<void>;
  options?: RuntimeOptions;
}) => new TriggeredFunction(TriggeredFunctionType.ON_UPDATE, document, handler, options);

export const onWrite = ({
  document,
  handler,
  options,
}: {
  document: string;
  handler: (event: FirestoreDocEvent<any>) => Promise<void>;
  options?: RuntimeOptions;
}) => new TriggeredFunction(TriggeredFunctionType.ON_WRITE, document, handler, options);
