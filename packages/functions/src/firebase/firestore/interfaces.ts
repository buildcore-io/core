/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, PublicCollections, PublicSubCollections, SUB_COL } from '@soonaverse/interfaces';

export interface IDatabase {
  collection: (col: COL | PublicCollections) => ICollection;
  collectionGroup: (col: SUB_COL | PublicSubCollections) => ICollectionGroup;
  doc: (documentPath: string) => IDocument;

  batch: () => IBatch;
  runTransaction: <T>(func: (transaction: ITransaction) => Promise<T>) => Promise<T>;

  inc: (value: number) => any;
  arrayUnion: <T>(...value: T[]) => any;
  arrayRemove: <T>(...value: T[]) => any;
  deleteField: () => any;
}

export interface ICollectionGroup {
  get: <T>() => Promise<T[]>;
  where: (fieldPath: string, operator: WhereFilterOp, value: any) => IQuery;
  limit: (value: number) => IQuery;
  startAfter: (value?: IDocumentSnapshot | string | number | Date) => IQuery;
}

export interface ICollection extends ICollectionGroup {
  doc: (documentPath: string) => IDocument;
}

export interface IDocument {
  create: (data: any) => Promise<void>;
  update: (data: any) => Promise<void>;
  set: (data: any, merge?: boolean) => Promise<void>;
  delete: () => Promise<void>;

  onSnapshot: <T>(callback: (data: T) => void) => () => void;

  collection: (subCol: SUB_COL | PublicSubCollections) => ICollection;
  get: <D>() => Promise<D | undefined>;

  getPath: () => string;
  getSnapshot: () => Promise<IDocumentSnapshot>;
}

export interface IDocumentSnapshot {
  readonly id: string;
}

export interface IQuery {
  get: <T>() => Promise<T[]>;
  where: (fieldPath: string, operator: WhereFilterOp, value: any) => IQuery;

  limit: (value: number) => IQuery;
  startAfter: (value?: IDocumentSnapshot | string | number | Date) => IQuery;
  onSnapshot: <T>(callback: (data: T[]) => void) => () => void;

  getInstance: () => any;

  orderBy: (field: string, dir?: 'asc' | 'desc') => IQuery;

  select: (...fields: string[]) => IQuery;
}

export interface IBatch {
  create: (docRef: IDocument, data: any) => void;
  update: (docRef: IDocument, data: any) => void;
  set: (docRef: IDocument, data: any, merge?: boolean) => void;
  delete: (docRef: IDocument) => void;
  commit: () => Promise<void>;
}

export interface ITransaction {
  get: <T>(docRef: IDocument) => Promise<T | undefined>;
  getAll: <T>(...docRefs: IDocument[]) => Promise<(T | undefined)[]>;
  getByQuery: <T>(query: IQuery) => Promise<T[]>;
  create: (docRef: IDocument, data: any) => void;
  update: (docRef: IDocument, data: any) => void;
  set: (docRef: IDocument, data: any, merge?: boolean) => void;
  delete: (docRef: IDocument) => void;
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
