/* eslint-disable @typescript-eslint/no-explicit-any */
import { Bucket, COL, Collection, Nft, Space, Token } from '@soonaverse/interfaces';
import { App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import { isEmpty, last } from 'lodash';
import mime from 'mime-types';
import os from 'os';
import path from 'path';
// import serviceAccount from '../../serviceAccountKeyTest.json';

import { Bucket as StorageBucket } from '@google-cloud/storage';

// console.log(serviceAccount.project_id);

const BATCH_LIMIT = 500;

export const moveMediaToTheRighBucket = async (
  app: App,
  col: COL,
  sourceBucket: Bucket,
  targetBucket: Bucket,
  lastDocId = 'none',
) => {
  let docsChecked = 0;
  console.log('running collection', col);
  const statingDoc = await getFirestore(app).doc(`${col}/${lastDocId}`).get();
  let lastDoc: any = statingDoc.exists ? statingDoc : undefined;
  do {
    const db = getFirestore(app);
    let query = db.collection(col).limit(BATCH_LIMIT);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    const batch = db.batch();
    const promises = snap.docs.map((d) =>
      moveMedia(app, col, d.data(), sourceBucket, targetBucket),
    );
    const updateData = await Promise.all(promises);
    updateData.forEach((ud) => {
      const docRef = db.doc(`${col}/${ud.uid}`);
      delete ud.uid;
      if (!isEmpty(ud)) {
        batch.update(docRef, ud);
      }
    });
    await batch.commit();
    docsChecked += snap.docs.length;
    console.log(col, `${docsChecked} docs checked`);
    console.log('Last docid', lastDoc?.id);
  } while (lastDoc);
};

const moveMedia = async (
  app: App,
  col: COL,
  data: FirebaseFirestore.DocumentData,
  sourceBucket: Bucket,
  targetBucket: Bucket,
): Promise<{ [key: string]: string }> => {
  const urls = getMediaUrls(col, data, sourceBucket, targetBucket);

  const updateData: { [key: string]: string } = {};
  for (const [key, value] of Object.entries(urls)) {
    const workDir = `${os.tmpdir()}/${data.uid || ''}`;
    const storage = getStorage(app);
    const fileName = getFileName(value);
    const file = storage.bucket(sourceBucket).file(fileName);
    if (!(await file.exists())[0]) {
      console.warn(
        `File not found in storage ${value}, col: ${col}, uid: ${data.uid}, key: ${key}`,
      );
      continue;
    }
    const metadata = (await file.getMetadata())[0];
    if (!Number(metadata.size)) {
      console.warn(`File size is 0 ${value}, col: ${col}, uid: ${data.uid}, key: ${key}`);
      continue;
    }
    const extension = <string>mime.extension(metadata.contentType);
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
    await waitForResizedImages(
      storage.bucket(targetBucket),
      fileName,
      extension,
      metadata.contentType.includes('image'),
      col,
      data.uid,
    );
    updateData[key] = `https://${targetBucket}/${fileName}.${extension}`;

    fs.rmSync(workDir, { recursive: true, force: true });
  }
  if (isEmpty(updateData)) {
    return {};
  }
  return { uid: data.uid, ...updateData };
};

const waitForResizedImages = async (
  bucket: StorageBucket,
  fileName: string,
  extension: string,
  isImg: boolean,
  col: COL,
  id: string,
) => {
  const fileNames = isImg
    ? Object.values(ImageWidth).map((size) => `${fileName}_${extension}_${size}X${size}.webp`)
    : [`${fileName}_${extension}_preview.webp`];
  const files = fileNames.map((name) => bucket.file(name));
  for (let i = 0; (i = 240); ++i) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const promises = files.map((file) => file.exists());
    const allExists = (await Promise.all(promises)).reduce((acc, act) => acc && act[0], true);
    if (allExists) {
      return;
    }
  }
  throw Error(`webps were not generated for, ${fileName}, ${col}, ${id}`);
};

enum ImageWidth {
  tb = '200',
  md = '680',
  lg = '1600',
}

const getMediaUrls = (
  col: COL,
  data: FirebaseFirestore.DocumentData,
  sourceBucket: Bucket,
  targetBucket: Bucket,
): { [key: string]: string } => {
  const urlsFunc = (): { [key: string]: string } => {
    switch (col) {
      case COL.NFT:
        return { media: (data as Nft).media || '' };
      case COL.COLLECTION:
        return {
          placeholderUrl: (data as Collection).placeholderUrl || '',
          bannerUrl: (data as Collection).bannerUrl || '',
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
    if (value.startsWith('https://firebasestorage.googleapis.com/v0/b/' + sourceBucket)) {
      return { ...acc, [key]: value };
    }
    if (value.startsWith(`https://${targetBucket}`)) {
      return acc;
    }
    if (value && !value.startsWith('https://firebasestorage.googleapis.com/v0/b/')) {
      console.warn(`Not a firebase storage ${value}, col: ${col}, uid: ${data.uid}, key: ${key}`);
      return acc;
    }
    return acc;
  }, {});
};

const getFileName = (storageUrl: string) => {
  const start = storageUrl.indexOf('o/');
  const end = storageUrl.indexOf('?alt');
  return storageUrl.slice(start + 2, end).replace(/%2F/g, '/');
};

// const run = async (sourceBucket: Bucket, targetBucket: Bucket) => {
//   const app = initializeApp({
//     credential: cert(<any>serviceAccount),
//   });
//   await moveMediaToTheRighBucket(app, COL.NFT, sourceBucket, targetBucket);
//   await moveMediaToTheRighBucket(app, COL.COLLECTION, sourceBucket, targetBucket);
//   await moveMediaToTheRighBucket(app, COL.TOKEN, sourceBucket, targetBucket);
//   await moveMediaToTheRighBucket(app, COL.SPACE, sourceBucket, targetBucket);
// };

// run(Bucket.TEST_DEFAULT, Bucket.TEST);
