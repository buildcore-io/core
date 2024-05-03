import { FirebaseApp } from '@build-5/database';
import { IDocument, Update, database as pgDb } from '@buildcore/database';
import { COL, SUB_COL } from '@buildcore/interfaces';
import { Firestore } from 'firebase-admin/firestore';
import { chunk, last } from 'lodash';

const collections: { [key: string]: SUB_COL[] } = {
  // [COL.MEMBER]: [],
  // [COL.AWARD]: [SUB_COL.OWNERS, SUB_COL.PARTICIPANTS],
  // [COL.COLLECTION]: [SUB_COL.STATS, SUB_COL.RANKS, SUB_COL.VOTES],
  // [COL.NFT]: [],
  // [COL.SPACE]: [
  //   SUB_COL.GUARDIANS,
  //   SUB_COL.MEMBERS,
  //   SUB_COL.BLOCKED_MEMBERS,
  //   SUB_COL.KNOCKING_MEMBERS,
  // ],
  // [COL.PROPOSAL]: [SUB_COL.OWNERS, SUB_COL.MEMBERS],
  // [COL.NOTIFICATION]: [],

  [COL.TRANSACTION]: [],
  [COL.MILESTONE]: [SUB_COL.TRANSACTIONS],
  [COL.MILESTONE_SMR]: [SUB_COL.TRANSACTIONS],
  [COL.MILESTONE_RMS]: [SUB_COL.TRANSACTIONS],

  // [COL.TOKEN]: [SUB_COL.STATS, SUB_COL.RANKS, SUB_COL.VOTES, SUB_COL.DISTRIBUTION],
  // [COL.TOKEN_MARKET]: [],
  // [COL.TOKEN_PURCHASE]: [],
  // [COL.TICKER]: [],
  // [COL.STAKE]: [],
  // [COL.STAKE_REWARD]: [],
  // [COL.NFT_STAKE]: [],
  // [COL.AIRDROP]: [],
  // [COL.PROJECT]: [SUB_COL.ADMINS, SUB_COL._API_KEY],
  // [COL.STAMP]: [],
  // [COL.AUCTION]: [],
  // [COL.MNEMONIC]: [],
  // [COL.SYSTEM]: [],
  // [COL.SWAP]: [],
  // [COL.SOON_SNAP]: [],
};

export const migrateToPg = async (app: FirebaseApp) => {
  const firestore: Firestore = app.getInstance().firestore();

  for (const col of Object.keys(collections)) {
    console.log(`Migrating ${col} collection`);
    await migrateColletion(firestore, col as COL);
  }

  console.log('Migration done');
  await pgDb().destroy();
};

const LIMIT = 100000;
const batches = Array.from(Array(200));
const batchSize = 500;

const migrateColletion = async (firestore: Firestore, col: COL) => {
  let lastDoc: any = undefined;
  let count = 0;

  do {
    let query = firestore.collection(col).limit(LIMIT);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);
    count += snap.size;
    console.log('count', col, count);

    if (!lastDoc) {
      break;
    }

    const docRef = pgDb().doc(col, 'placeholder') as IDocument<any, any, Update>;

    const promises = batches.map(async (_, batch) => {
      const data: any[] = [];
      for (let i = batch * batchSize; i < (batch + 1) * batchSize; ++i) {
        if (snap.docs[i]) {
          const doc = snap.docs[i];
          data.push(docRef.converter.toPg({ ...doc.data(), uid: doc.id }));
        }
      }
      try {
        await pgDb().getCon()(docRef.table).insert(data).onConflict('uid').ignore();
      } catch (err: any) {
        err.lastDoc = lastDoc.ref.path;
        throw err;
      }
    });

    // const promises = chunk(snap.docs, 150).map(async (ch) => {
    //   try {
    //     const data = ch.map((doc) =>
    //       undefinedToNull(docRef.converter.toPg({ ...doc.data(), uid: doc.id })),
    //     );
    //     await pgDb().getCon()(docRef.table).insert(data).onConflict('uid').ignore();
    //   } catch (err: any) {
    //     err.lastDoc = lastDoc.ref.path;
    //     throw err;
    //   }
    // });

    await Promise.all(promises);

    for (const subCol of collections[col]) {
      const writes = snap.docs.map((doc) => migrateSubDocs(firestore, col, doc.id, subCol));
      await awaitAll(writes, lastDoc.ref.path);
    }
  } while (lastDoc);
};

const awaitAll = async (writes: Promise<any>[], lastDoc: string) => {
  try {
    await Promise.all(writes);
  } catch (err: any) {
    err.lastDoc = lastDoc;
    throw err;
  }
};

const migrateSubDocs = async (firestore: Firestore, col: COL, colId: string, subCol: SUB_COL) => {
  const snap = await firestore.collection(`${col}/${colId}/${subCol}`).get();
  // console.log('Size', col, colId, subCol, snap.size);

  const promises = chunk(snap.docs, 200).map(async (ch) => {
    const data = ch.map((doc) => {
      const docRef = pgDb().doc(col, colId, subCol, doc.id) as IDocument<any, any, Update>;
      const converted = docRef.converter.toPg({ ...doc.data(), uid: doc.id, parentId: colId });
      return converted;
    });
    const docRef = pgDb().doc(col, colId, subCol, 'placeholder') as IDocument<any, any, Update>;
    await pgDb().getCon()(docRef.table).insert(data).onConflict(['uid', 'parentId']).ignore();
  });

  await Promise.all(promises);
};

export const roll = migrateToPg;
