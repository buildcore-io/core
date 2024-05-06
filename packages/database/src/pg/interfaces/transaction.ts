import { BaseRecord } from '../models/common';
import { Update } from '../models/common_update';
import { IDocument } from './document/document';

export interface ITransaction {
  get: <C, B extends BaseRecord, U extends Update>(
    docRef: IDocument<C, B, U>,
  ) => Promise<C | undefined>;
  getAll: <C, B extends BaseRecord, U extends Update>(
    ...docRefs: IDocument<C, B, U>[]
  ) => Promise<(C | undefined)[]>;

  create: <C, B extends BaseRecord, U extends Update>(
    docRef: IDocument<C, B, U>,
    data: C,
  ) => Promise<void>;
  update: <C, B extends BaseRecord, U extends Update>(
    docRef: IDocument<C, B, U>,
    data: U,
  ) => Promise<void>;
  upsert: <C, B extends BaseRecord, U extends Update>(
    docRef: IDocument<C, B, U>,
    data: U,
  ) => Promise<void>;
  delete: <C, B extends BaseRecord, U extends Update>(docRef: IDocument<C, B, U>) => Promise<void>;
}
