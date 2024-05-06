/* eslint-disable @typescript-eslint/no-explicit-any */

import { COL, SUB_COL } from '@buildcore/interfaces';
import { PgDocEvent } from '../../triggers/common';
import { CloudFunctions, RuntimeOptions } from '../common';

export enum TriggeredFunctionType {
  ON_CREATE = 'on_create',
  ON_UPDATE = 'on_update',
  ON_WRITE = 'on_write',
}

export class TriggeredFunction extends CloudFunctions {
  constructor(
    public readonly type: TriggeredFunctionType,
    public readonly col: COL,
    public readonly subCol: SUB_COL | undefined = undefined,
    public readonly handler: (event: PgDocEvent<any>) => Promise<void>,
    options?: RuntimeOptions,
  ) {
    super({
      region: 'us-central1',
      ...options,
    });
  }
}

export const onCreate = ({
  col,
  subCol,
  handler,
  options,
}: {
  col: COL;
  subCol?: SUB_COL;
  handler: (event: PgDocEvent<any>) => Promise<void>;
  options?: RuntimeOptions;
}) => new TriggeredFunction(TriggeredFunctionType.ON_CREATE, col, subCol, handler, options);

export const onUpdate = ({
  col,
  subCol,
  handler,
  options,
}: {
  col: COL;
  subCol?: SUB_COL;
  handler: (event: PgDocEvent<any>) => Promise<void>;
  options?: RuntimeOptions;
}) => new TriggeredFunction(TriggeredFunctionType.ON_UPDATE, col, subCol, handler, options);

export const onWrite = ({
  col,
  subCol,
  handler,
  options,
}: {
  col: COL;
  subCol?: SUB_COL;
  handler: (event: PgDocEvent<any>) => Promise<void>;
  options?: RuntimeOptions;
}) => new TriggeredFunction(TriggeredFunctionType.ON_WRITE, col, subCol, handler, options);
