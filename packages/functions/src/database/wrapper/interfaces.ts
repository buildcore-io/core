/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, SUB_COL } from '@soonaverse/interfaces';

export interface IDatabase {
  collection: (col: COL) => ICollection;
  doc: (documentPath: string) => IDocument;

  batch: () => IBatch;
  runTransaction: <T>(func: (transaction: ITransaction) => Promise<T>) => Promise<T>;

  inc: (value: number) => any;
  arrayUnion: <T>(...value: T[]) => any;
  arrayRemove: <T>(...value: T[]) => any;
}

export interface ICollection {
  doc: (documentPath: string) => IDocument;
  where: (fieldPath: string, operator: WhereFilterOp, value: any) => IQuery;
}

export interface IDocument {
  create: (data: any) => Promise<void>;
  update: (data: any) => Promise<void>;
  delete: () => Promise<void>;

  collection: (subCol: SUB_COL) => ICollection;
  get: <D>() => Promise<D | undefined>;

  getPath: () => string;
}

export interface IQuery {
  get: <T>() => Promise<T[]>;
  where: (fieldPath: string, operator: WhereFilterOp, value: any) => IQuery;

  limit: (value: number) => IQuery;
  startAfter: (docPath: string) => IQuery;
}

export interface IBatch {
  create: (docRef: IDocument, data: any) => void;
  update: (docRef: IDocument, data: any) => void;
  commit: () => Promise<void>;
}

export interface ITransaction {
  get: <T>(docRef: IDocument) => Promise<T | undefined>;
  create: (docRef: IDocument, data: any) => void;
  update: (docRef: IDocument, data: any) => void;
  set: (docRef: IDocument, data: any, merge?: boolean) => void;
}

export type WhereFilterOp =
  | '<'
  | '<='
  | '=='
  | '!='
  | '>='
  | '>'
  | 'array-contains'
  | 'in'
  | 'not-in'
  | 'array-contains-any';