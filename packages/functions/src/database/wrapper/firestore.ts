/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, SUB_COL } from '@soonaverse/interfaces';
import admin from '../../admin.config';
import { cOn } from '../../utils/dateTime.utils';
import { uOn } from '../firestore/common';
import { IBatch, ICollection, IDatabase, IDocument, IQuery, ITransaction } from './interfaces';

export class Firestore implements IDatabase {
  private db: admin.firestore.Firestore;

  constructor() {
    this.db = admin.firestore();
  }

  public collection = (col: COL) => new FirestoreCollection(this.db, this.db.collection(col));

  public doc = (documentPath: string) => new FirestoreDocument(this.db, this.db.doc(documentPath));

  public batch = (): IBatch => new FirestoreBatch(this.db);

  public runTransaction = <T>(
    func: (transaction: FirestoreTransaction) => Promise<T>,
  ): Promise<T> =>
    this.db.runTransaction((transaction) => func(new FirestoreTransaction(this.db, transaction)));

  public inc = (value: number) => admin.firestore.FieldValue.increment(value);

  public arrayUnion = <T>(...value: T[]) => admin.firestore.FieldValue.arrayUnion(...value);

  public arrayRemove = <T>(...value: T[]) => admin.firestore.FieldValue.arrayRemove(...value);
}

export class FirestoreBatch implements IBatch {
  private batch: admin.firestore.WriteBatch;

  constructor(private readonly db: admin.firestore.Firestore) {
    this.batch = db.batch();
  }

  public create = (docRef: IDocument, data: any) => {
    const ref = this.db.doc(docRef.getPath());
    this.batch.create(ref, cOn(data));
  };

  public update = (docRef: IDocument, data: any) => {
    const ref = this.db.doc(docRef.getPath());
    this.batch.update(ref, uOn(data));
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
    const ref = this.db.doc(docRef.getPath());
    const doc = await this.transaction.get(ref);
    return <T | undefined>doc.data();
  };

  public create = (docRef: IDocument, data: any) => {
    const ref = this.db.doc(docRef.getPath());
    this.transaction.create(ref, cOn(data));
  };

  public update = (docRef: IDocument, data: any) => {
    const ref = this.db.doc(docRef.getPath());
    this.transaction.update(ref, uOn(data));
  };

  public set = (docRef: IDocument, data: any, merge = true) => {
    const ref = this.db.doc(docRef.getPath());
    const dateFunc = merge ? uOn : cOn;
    this.transaction.set(ref, dateFunc(data), { merge });
  };
}

export class FirestoreCollection implements ICollection {
  constructor(
    private readonly db: admin.firestore.Firestore,
    private readonly collection: admin.firestore.CollectionReference,
  ) {}

  public doc = (documentPath: string) =>
    new FirestoreDocument(this.db, this.collection.doc(documentPath));

  public where = (fieldPath: string, operator: admin.firestore.WhereFilterOp, value: any) =>
    new FirestoreQuery(this.db, this.collection.where(fieldPath, operator, value));
}

export class FirestoreDocument implements IDocument {
  constructor(
    private readonly db: admin.firestore.Firestore,
    private readonly document: admin.firestore.DocumentReference,
  ) {}

  public create = async (data: any) => {
    await this.document.create(cOn(data));
  };

  public update = async (data: any) => {
    await this.document.update(uOn(data));
  };

  public delete = async () => {
    await this.document.delete();
  };

  public collection = (subCol: SUB_COL): ICollection =>
    new FirestoreCollection(this.db, this.document.collection(subCol));

  public get = async <T>(): Promise<T | undefined> => {
    const doc = await this.document.get();
    return <T | undefined>doc.data();
  };

  public getPath = () => this.document.path;
}

export class FirestoreQuery implements IQuery {
  constructor(
    private readonly db: admin.firestore.Firestore,
    private query: admin.firestore.Query,
  ) {}

  public get = async <T>(): Promise<T[]> => {
    const snap = await this.query.get();
    return snap.docs.map((d) => d.data() as T);
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

  public startAfter = (docPath: string) => {
    if (docPath) {
      const doc = this.db.doc(docPath);
      this.query = this.query.startAfter(doc);
    }
    return this;
  };
}
