import {
  Award,
  COL,
  Collection,
  MAX_WALLET_RETRY,
  MediaStatus,
  Nft,
  Space,
  Token,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import admin, { inc } from '../admin.config';
import { awardToIpfsMetadata } from '../services/payment/award/award-service';
import {
  collectionToIpfsMetadata,
  downloadMediaAndPackCar,
  nftToIpfsMetadata,
  putCar,
  tokenToIpfsMetadata,
} from '../utils/car.utils';
import { uOn } from '../utils/dateTime.utils';
import { spaceToIpfsMetadata } from '../utils/space.utils';

export const MEDIA_UPLOAD_BACH_SIZE = 30;
export const uploadMediaToWeb3 = async () => {
  let batchSize = MEDIA_UPLOAD_BACH_SIZE;

  const props = [
    { col: COL.NFT, func: uploadNftMedia },
    { col: COL.TOKEN, func: uploadTokenMedia },
    { col: COL.COLLECTION, func: uploadCollectionMedia },
    { col: COL.AWARD, func: uploadAwardMedia },
    { col: COL.SPACE, func: uploadSpaceMedia },
  ];

  const promises: Promise<void>[] = [];
  for (const prop of props) {
    const upload = await uploadMedia(
      prop.col,
      batchSize,
      prop.func as (data: unknown) => Promise<void>,
    );
    batchSize -= upload.size;
    promises.push(...upload.promises);
  }

  await Promise.allSettled(promises);

  return batchSize;
};

const uploadMedia = async <T>(
  col: COL,
  batchSize: number,
  uploadFunc: (data: T) => Promise<void>,
) => {
  if (!batchSize) {
    return { size: 0, promises: [] as Promise<void>[] };
  }
  const snap = await pendingUploadQuery(col, batchSize).get();
  const promises = snap.docs.map(async (d) => {
    try {
      return await uploadFunc(<T>d.data());
    } catch (error) {
      await setMediaStatusToError(col, d.id, d.data()?.mediaUploadErrorCount || 0, error);
    }
  });
  return { size: snap.size, promises };
};

const uploadNftMedia = async (nft: Nft) => {
  const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
  const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`);
  const collection = <Collection>(await collectionDocRef.get()).data();
  const metadata = nftToIpfsMetadata(collection, nft);
  const { car, ...ipfs } = await downloadMediaAndPackCar(nft.uid, nft.media, metadata);
  await putCar(car);

  const batch = admin.firestore().batch();
  batch.update(collectionDocRef, uOn({ 'mintingData.nftMediaToUpload': inc(-1) }));
  batch.update(nftDocRef, uOn({ mediaStatus: MediaStatus.UPLOADED, ...ipfs }));
  await batch.commit();
};

const uploadTokenMedia = async (token: Token) => {
  const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
  const metadata = tokenToIpfsMetadata(token);
  const { car, ...ipfs } = await downloadMediaAndPackCar(token.uid, token.icon!, metadata);
  await putCar(car);
  await tokenDocRef.update(uOn({ mediaStatus: MediaStatus.UPLOADED, ...ipfs }));
};

const uploadCollectionMedia = async (collection: Collection) => {
  const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collection.uid}`);
  const metadata = collectionToIpfsMetadata(collection);
  const { car, ...ipfs } = await downloadMediaAndPackCar(
    collection.uid,
    collection.bannerUrl,
    metadata,
  );
  await putCar(car);

  await collectionDocRef.update(uOn({ mediaStatus: MediaStatus.UPLOADED, ...ipfs }));
};

const uploadAwardMedia = async (award: Award) => {
  if (!award.badge.image) {
    return;
  }
  const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${award.uid}`);
  const metadata = awardToIpfsMetadata(award);
  const { car, ...ipfs } = await downloadMediaAndPackCar(award.uid, award.badge.image, metadata);
  await putCar(car);

  await awardDocRef.update(uOn({ mediaStatus: MediaStatus.UPLOADED, ...ipfs }));
};

const uploadSpaceMedia = async (space: Space) => {
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space.uid}`);
  const metadata = spaceToIpfsMetadata(space);
  const { car, ...ipfs } = await downloadMediaAndPackCar(space.uid, space.bannerUrl!, metadata);
  await putCar(car);
  await spaceDocRef.update(uOn({ mediaStatus: MediaStatus.UPLOADED, ...ipfs }));
};

const pendingUploadQuery = (col: COL, batchSize: number) =>
  admin
    .firestore()
    .collection(col)
    .where('mediaStatus', '==', MediaStatus.PENDING_UPLOAD)
    .limit(batchSize);

const setMediaStatusToError = async (col: COL, uid: string, errorCount: number, error: unknown) => {
  const data = { mediaUploadErrorCount: inc(1), mediaStatus: MediaStatus.PENDING_UPLOAD };
  if (errorCount >= MAX_WALLET_RETRY) {
    data.mediaStatus = MediaStatus.ERROR;
    functions.logger.error(col, uid, 'Image upload error', error);
  }
  const docRef = admin.firestore().doc(`${col}/${uid}`);
  await docRef.update(uOn(data));
};
