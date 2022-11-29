import { Firestore } from '@google-cloud/firestore';
import { Bucket, COL, Collection, Nft, Token } from '@soonaverse/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import fs from 'fs';
import { isEmpty, last } from 'lodash';
import mime from 'mime-types';
import os from 'os';
import path from 'path';
import serviceAccount from '../../serviceAccountKeyTest.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

enum ImageWidth {
  tb = '200',
  md = '680',
  lg = '1600',
}

const db = getFirestore();
const storage = getStorage();
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
  const urls = getMediaUrls(col, data);

  const updateData: { [key: string]: string } = {};
  for (const [key, value] of Object.entries(urls)) {
    if (!value || value.includes(targetBucket)) {
      continue;
    }
    const workDir = `${os.tmpdir()}/${data.uid || ''}`;
    fs.mkdirSync(workDir);

    const currentBucket = getBucket(value);
    const fileName = getFileName(value);
    const file = storage.bucket(currentBucket).file(fileName);

    const metadata = (await file.getMetadata())[0];
    const extension = mime.extension(metadata.contentType);
    const downloadPath = path.join(workDir, `${fileName}.${extension}`);
    await file.download({ destination: downloadPath });

    await storage.bucket(targetBucket).upload(downloadPath, metadata);
    updateData[key] = storage.bucket(targetBucket).file(downloadPath).publicUrl();

    await storage.bucket(currentBucket).file(fileName).delete();
    for (const size of Object.values(ImageWidth)) {
      const webpfile = storage.bucket(currentBucket).file(fileName + `_${size}X${size}.webp`);
      if ((await webpfile.exists())[0]) {
        await webpfile.delete();
      }
    }

    fs.rmSync(workDir, { recursive: true, force: true });
  }
  if (isEmpty(updateData)) {
    return { uid: data.uid };
  }
  return { uid: data.uid, ...updateData };
};

const getMediaUrls = (
  col: COL,
  data: FirebaseFirestore.DocumentData,
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
      default:
        return {};
    }
  };
  const urls = urlsFunc();
  return Object.entries(urls).reduce((acc, [key, value]) => {
    if (value && !value.startsWith('https://firebasestorage.googleapis.com/v0/b/')) {
      console.error(`Not a firebase storage ${value}, col: ${col}, uid: ${data.uid}, key: ${key}`);
      return acc;
    }
    return { ...acc, [key]: value };
  }, {});
};

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

const run = async (targetBucket: Bucket) => {
  await moveMediaToTheRighBucket(db, storage, COL.NFT, targetBucket);
  await moveMediaToTheRighBucket(db, storage, COL.COLLECTION, targetBucket);
  await moveMediaToTheRighBucket(db, storage, COL.TOKEN, targetBucket);
};

run(Bucket.TEST);
