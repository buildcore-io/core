import { FirebaseApp } from '@build-5/database';
import { IDocument, Update, database as pgDb } from '@buildcore/database';
import { COL, SUB_COL } from '@buildcore/interfaces';
import { Firestore } from 'firebase-admin/firestore';
import { chunk, flatMap } from 'lodash';

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

  // [COL.TRANSACTION]: [],
  // [COL.MILESTONE]: [SUB_COL.TRANSACTIONS],
  [COL.MILESTONE_SMR]: [SUB_COL.TRANSACTIONS],
  // [COL.MILESTONE_RMS]: [SUB_COL.TRANSACTIONS],

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

const LIMIT = 10000;

const saveToPg = async (table: string, data: any[]) => {
  await pgDb().getCon()(table).insert(data).onConflict('uid').ignore();
};

const migrateColletion = async (firestore: Firestore, col: COL) => {
  let lastDoc: any = undefined;
  let count = 0;

  const docRef = pgDb().doc(col, 'placeholder') as IDocument<any, any, Update>;

  do {
    const promises: Promise<any>[] = [];
    let query = firestore.collection(col).orderBy('milestone', 'desc').limit(LIMIT);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const data: any[] = [];
    let actLastDoc = lastDoc;
    for await (const doc of query.stream()) {
      try {
        const pg = docRef.converter.toPg({ ...(doc as any).data(), uid: (doc as any).id });
        data.push(pg);
      } catch (err) {
        console.log((doc as any).id);
        throw err;
      }

      if (data.length === 500) {
        const toSave = data.splice(0);
        promises.push(saveToPg(docRef.table, toSave));

        for (const subCol of collections[col]) {
          promises.push(
            migrateSubDocs(
              firestore,
              col,
              toSave.map((t) => t.uid),
              subCol,
            ),
          );
        }

        console.log(count);
      }
      ++count;
      actLastDoc = doc as any;
    }

    console.log(count);

    try {
      await Promise.all(promises);
    } catch (err: any) {
      err.lastDoc = lastDoc;
      throw err;
    }
    lastDoc = actLastDoc;
  } while (lastDoc);
};

const migrateSubDocs = async (
  firestore: Firestore,
  col: COL,
  colIds: string[],
  subCol: SUB_COL,
) => {
  const subDocsPromise = colIds.map((colId) => getSubDocs(firestore, col, colId, subCol));
  const subDocs = flatMap(await Promise.all(subDocsPromise));

  if (subDocs.length) {
    console.log('Size', col, subCol, subDocs.length);
  }

  const docRef = pgDb().doc(col, 'p', subCol, 'p') as IDocument<any, any, Update>;
  const promises = chunk(subDocs, 200).map(async (ch) => {
    const data = ch.map((subDoc) => {
      const [_col, parentId, _sub, uid] = subDoc.ref.path.split('/');
      try {
        const converted = docRef.converter.toPg({ ...subDoc.data(), uid, parentId });
        return converted;
      } catch (err: any) {
        err.path = subDoc.ref.path;
        throw err;
      }
    });
    await pgDb().getCon()(docRef.table).insert(data).onConflict(['uid', 'parentId']).ignore();
  });

  await Promise.all(promises);
};

const getSubDocs = async (firestore: Firestore, col: COL, colId: string, subCol: SUB_COL) => {
  const snap = await firestore.collection(`${col}/${colId}/${subCol}`).get();
  return snap.docs;
};

export const roll = migrateToPg;
