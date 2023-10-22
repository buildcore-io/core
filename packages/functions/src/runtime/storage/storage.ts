import { StorageObject } from '../../triggers/storage/resize.img.trigger';
import { CloudFunctions, RuntimeOptions } from '../common';

export class StorageFunction extends CloudFunctions {
  constructor(
    public readonly func: (obj: StorageObject) => Promise<unknown>,
    options: RuntimeOptions,
  ) {
    super({
      region: 'us-central1',
      ...options,
    });
  }
}

export const onObjectFinalized = (params: {
  runtimeOptions: RuntimeOptions;
  handler: (obj: StorageObject) => Promise<unknown>;
}) => new StorageFunction(params.handler, params.runtimeOptions);
