import { Firestore } from '@google-cloud/firestore';
import { Bucket, COL, Collection, Nft, Space, Token } from '@soonaverse/interfaces';
// import { cert, initializeApp } from 'firebase-admin/app';
// import { getFirestore } from 'firebase-admin/firestore';
import { /* getStorage ,*/ Storage } from 'firebase-admin/storage';
import fs from 'fs';
import { isEmpty, last } from 'lodash';
import mime from 'mime-types';
import os from 'os';
import path from 'path';
// import serviceAccount from '../../serviceAccountKeyTest.json';

// initializeApp({
//   credential: cert(<any>serviceAccount),
// });

// enum ImageWidth {
//   tb = '200',
//   md = '680',
//   lg = '1600',
// }

// const db = getFirestore();
// const storage = getStorage();
const BATCH_LIMIT = 500;

export const moveMediaToTheRighBucket = async (
  db: Firestore,
  storage: Storage,
  col: COL,
  targetBucket: Bucket,
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastDoc: any | undefined = undefined;
  do {
    let query = db.collection(col).limit(BATCH_LIMIT);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();

    const batch = db.batch();
    const promises = snap.docs.map((d) => moveMedia(storage, col, d.data(), targetBucket));
    const updateData = await Promise.all(promises);
    updateData.forEach((ud) => {
      const docRef = db.doc(`${col}/${ud.uid}`);
      delete ud.uid;
      if (!isEmpty(ud)) {
        batch.update(docRef, ud);
      }
    });
    await batch.commit();

    lastDoc = last(snap.docs);
  } while (lastDoc);
};

const moveMedia = async (
  storage: Storage,
  col: COL,
  data: FirebaseFirestore.DocumentData,
  targetBucket: Bucket,
) => {
  const urls = getMediaUrls(col, data, targetBucket);

  const updateData: { [key: string]: string } = {};
  for (const [key, value] of Object.entries(urls)) {
    const workDir = `${os.tmpdir()}/${data.uid || ''}`;

    const currentBucket = getBucket(value);
    const fileName = getFileName(value);
    const file = storage.bucket(currentBucket).file(fileName);

    const exists = (await file.exists())[0];
    if (exists) {
      const metadata = (await file.getMetadata())[0];
      const extension = mime.extension(metadata.contentType);
      const downloadPath = path.join(workDir, `${fileName}.${extension}`);
      fs.mkdirSync(path.dirname(downloadPath), { recursive: true });

      await file.download({ destination: downloadPath });
      await storage.bucket(targetBucket).upload(downloadPath, {
        destination: `${fileName}.${extension}`,
        metadata: {
          contentType: metadata.contentType,
          cacheControl: `public,max-age=31536000`,
        },
      });
      updateData[key] = `https://${targetBucket}/${fileName}.${extension}`;
      fs.rmSync(workDir, { recursive: true, force: true });
    } else {
      console.warn(
        `File not found in storage ${value}, col: ${col}, uid: ${data.uid}, key: ${key}`,
      );
    }
  }
  if (isEmpty(updateData)) {
    return { uid: data.uid };
  }
  return { uid: data.uid, ...updateData };
};

const getMediaUrls = (
  col: COL,
  data: FirebaseFirestore.DocumentData,
  targetBucket: Bucket,
): { [key: string]: string } => {
  const urlsFunc = (): { [key: string]: string } => {
    switch (col) {
      case COL.NFT:
        return { media: (data as Nft).media };
      case COL.COLLECTION:
        return {
          placeholderUrl: (data as Collection).placeholderUrl,
          bannerUrl: (data as Collection).bannerUrl,
        };
      case COL.TOKEN:
        return {
          icon: (data as Token).icon || '',
          overviewGraphics: (data as Token).overviewGraphics || '',
        };
      case COL.SPACE:
        return {
          avatarUrl: (data as Space).avatarUrl || '',
          bannerUrl: (data as Space).bannerUrl || '',
        };
      default:
        return {};
    }
  };
  const urls = urlsFunc();
  return Object.entries(urls).reduce((acc, [key, value]) => {
    if (!value || isMigrated(value, targetBucket)) {
      return acc;
    }
    if (!value.startsWith('https://firebasestorage.googleapis.com/v0/b/')) {
      console.error(`Not a firebase storage ${value}, col: ${col}, uid: ${data.uid}, key: ${key}`);
      return acc;
    }
    return { ...acc, [key]: value };
  }, {});
};

const isMigrated = (value: string | undefined, bucket: Bucket) =>
  value?.startsWith(`https://${bucket}`);

const getBucket = (storageUrl: string) => {
  const start = storageUrl.indexOf('b/');
  const end = storageUrl.indexOf('/o');
  return storageUrl.slice(start + 2, end);
};

const getFileName = (storageUrl: string) => {
  const start = storageUrl.indexOf('o/');
  const end = storageUrl.indexOf('?alt');
  return storageUrl.slice(start + 2, end).replace(/%2F/g, '/');
};

// const COLLECTIONS_TO_ROLL = [COL.NFT, COL.COLLECTION, COL.TOKEN, COL.SPACE];

// const run = async (targetBucket: Bucket) => {
//   for (const col of COLLECTIONS_TO_ROLL) {
//     await moveMediaToTheRighBucket(db, storage, col, targetBucket);
//   }
// };

// run(Bucket.TEST);
