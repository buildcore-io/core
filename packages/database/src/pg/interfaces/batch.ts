import { BaseRecord } from '../models/common';
import { Update } from '../models/common_update';
import { IDocument } from './document/document';

export interface IBatch {
  create: <C, B extends BaseRecord, U extends Update>(docRef: IDocument<C, B, U>, data: C) => void;
  update: <C, B extends BaseRecord, U extends Update>(docRef: IDocument<C, B, U>, data: U) => void;
  upsert: <C, B extends BaseRecord, U extends Update>(docRef: IDocument<C, B, U>, data: U) => void;
  delete: <C, B extends BaseRecord, U extends Update>(docRef: IDocument<C, B, U>) => void;
  commit: () => Promise<void>;
}
