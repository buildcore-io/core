/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, PublicCollections, PublicSubCollections, SUB_COL } from '@soonaverse/interfaces';
import admin from 'firebase-admin';
import { isEmpty } from 'lodash';
import { FirebaseApp } from '../app/app';
import { cOn, uOn } from './common';
import {
  IBatch,
  ICollection,
  IDatabase,
  IDocument,
  IDocumentSnapshot,
  IQuery,
  ITransaction,
} from './interfaces';

export class Firestore implements IDatabase {
  private db: admin.firestore.Firestore;

  constructor(private readonly app: FirebaseApp) {
    this.db = this.app.getInstance().firestore();
  }

  public collection = (col: COL | PublicCollections) =>
    new FirestoreCollection(this.db, this.db.collection(col));

  public doc = (documentPath: string) => new FirestoreDocument(this.db, this.db.doc(documentPath));

  public batch = (): IBatch => new FirestoreBatch(this.db);

  public runTransaction = <T>(
    func: (transaction: FirestoreTransaction) => Promise<T>,
  ): Promise<T> =>
    this.db.runTransaction((transaction) => func(new FirestoreTransaction(this.db, transaction)));

  public inc = (value: number) => admin.firestore.FieldValue.increment(value);

  public arrayUnion = <T>(...value: T[]) => admin.firestore.FieldValue.arrayUnion(...value);

  public arrayRemove = <T>(...value: T[]) => admin.firestore.FieldValue.arrayRemove(...value);

  public deleteField = () => admin.firestore.FieldValue.delete();
}

export class FirestoreBatch implements IBatch {
  private batch: admin.firestore.WriteBatch;

  constructor(private readonly db: admin.firestore.Firestore) {
    this.batch = db.batch();
  }

  public create = (docRef: IDocument, data: any) => {
    const ref = this.db.doc(docRef.getPath());
    this.batch.create(ref, cOn(docRef, data));
  };

  public update = (docRef: IDocument, data: any) => {
    const ref = this.db.doc(docRef.getPath());
    this.batch.update(ref, uOn(data));
  };

  public set = (docRef: IDocument, data: any, merge = false) => {
    const ref = this.db.doc(docRef.getPath());
    this.batch.set(ref, merge ? uOn(data) : cOn(docRef, data), { merge });
  };

  public delete = (docRef: IDocument) => {
    const ref = this.db.doc(docRef.getPath());
    this.batch.delete(ref);
  };

  public commit = async () => {
    await this.batch.commit();
  };
}

export class FirestoreTransaction implements ITransaction {
  constructor(
    private readonly db: admin.firestore.Firestore,
    private readonly transaction: admin.firestore.Transaction,
  ) {}

  public get = async <T>(docRef: IDocument) => {
    const refs = this.db.doc(docRef.getPath());
    const doc = await this.transaction.get(refs);
    return <T | undefined>doc.data();
  };

  public getAll = async <T>(...docRefs: IDocument[]) => {
    if (isEmpty(docRefs)) {
      return [];
    }
    const refs = docRefs.map((docRef) => this.db.doc(docRef.getPath()));
    const snap = await this.transaction.getAll(...refs);
    return snap.map((doc) => doc.data() as T | undefined);
  };

  public getByQuery = async <T>(query: IQuery) => {
    const snap = await this.transaction.get(query.getInstance());
    return snap.docs.map((d) => d.data() as T);
  };

  public create = (docRef: IDocument, data: any) => {
    const ref = this.db.doc(docRef.getPath());
    this.transaction.create(ref, cOn(docRef, data));
  };

  public update = (docRef: IDocument, data: any) => {
    const ref = this.db.doc(docRef.getPath());
    this.transaction.update(ref, uOn(data));
  };

  public set = (docRef: IDocument, data: any, merge = false) => {
    const ref = this.db.doc(docRef.getPath());
    const uData = merge ? uOn(data) : cOn(docRef, data);
    this.transaction.set(ref, uData, { merge });
  };

  public delete = (docRef: IDocument) => {
    const ref = this.db.doc(docRef.getPath());
    this.transaction.delete(ref);
  };
}

export class FirestoreCollection implements ICollection {
  constructor(
    private readonly db: admin.firestore.Firestore,
    private readonly collection: admin.firestore.CollectionReference,
  ) {}

  public get = async <T>() => {
    const snap = await this.collection.get();
    return snap.docs.map((d) => d.data() as T);
  };

  public doc = (documentPath: string) =>
    new FirestoreDocument(this.db, this.collection.doc(documentPath));

  public where = (fieldPath: string, operator: admin.firestore.WhereFilterOp, value: any) =>
    new FirestoreQuery(this.collection.where(fieldPath, operator, value));

  public limit = (value: number) => new FirestoreQuery(this.collection.limit(value));

  public startAfter = (value?: IDocumentSnapshot | string | number | Date) => {
    if (!value) {
      return new FirestoreQuery(this.collection);
    }
    return new FirestoreQuery(this.collection.startAfter(value));
  };
}

export class FirestoreDocument implements IDocument {
  constructor(
    private readonly db: admin.firestore.Firestore,
    private readonly document: admin.firestore.DocumentReference,
  ) {}

  public create = async (data: any) => {
    await this.document.create(cOn(this, data));
  };

  public update = async (data: any) => {
    await this.document.update(uOn(data));
  };

  public set = async (data: any, merge = false) => {
    await this.document.set(merge ? uOn(data) : cOn(this, data), { merge });
  };

  public delete = async () => {
    await this.document.delete();
  };

  public onSnapshot = <T>(callback: (data: T) => void) =>
    this.document.onSnapshot((snap) => {
      callback({ ...snap.data(), uid: snap.id } as T);
    });

  public collection = (subCol: SUB_COL | PublicSubCollections): ICollection =>
    new FirestoreCollection(this.db, this.document.collection(subCol));

  public get = async <T>(): Promise<T | undefined> => {
    const doc = await this.document.get();
    return <T | undefined>doc.data();
  };

  public getPath = () => this.document.path;

  public getSnapshot = () => this.document.get();
}

export class FirestoreQuery implements IQuery {
  constructor(private query: admin.firestore.Query) {}

  public get = async <T>(): Promise<T[]> => {
    const snap = await this.query.get();
    return snap.docs.map((d) => ({ ...d.data(), uid: d.id } as T));
  };

  public where = (
    fieldPath: string,
    operator: admin.firestore.WhereFilterOp,
    value: any,
  ): IQuery => {
    this.query = this.query.where(fieldPath, operator, value);
    return this;
  };

  public limit = (value: number) => {
    this.query = this.query.limit(value);
    return this;
  };

  public startAfter = (value?: IDocumentSnapshot | string | number | Date) => {
    if (value) {
      this.query = this.query.startAfter(value);
    }
    return this;
  };

  public orderBy = (field: string, dir: 'asc' | 'desc' = 'asc') => {
    this.query = this.query.orderBy(field, dir);
    return this;
  };

  public select = (...fields: string[]) => {
    this.query = this.query.select(...fields);
    return this;
  };

  public onSnapshot = <T>(callback: (data: T[]) => void) =>
    this.query.onSnapshot((snap) => {
      callback(snap.docs.map((d) => ({ ...d.data(), uid: d.id } as T)));
    });

  public getInstance = () => this.query;
}
