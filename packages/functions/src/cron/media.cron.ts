import { Award, COL, Collection, MediaStatus, Nft, Space, Token } from '@soonaverse/interfaces';
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
  const nftUpload = await uploadMedia(COL.NFT, batchSize, uploadNftMedia);
  batchSize -= nftUpload.size;

  const tokenUpload = await uploadMedia(COL.TOKEN, batchSize, uploadTokenMedia);
  batchSize -= tokenUpload.size;

  const collectionUpload = await uploadMedia(COL.COLLECTION, batchSize, uploadCollectionMedia);
  batchSize -= collectionUpload.size;

  const awardUpload = await uploadMedia(COL.AWARD, batchSize, uploadAwardMedia);
  batchSize -= awardUpload.size;

  const spaceUpload = await uploadMedia(COL.SPACE, batchSize, uploadSpaceMedia);
  batchSize -= spaceUpload.size;

  await Promise.all([
    ...nftUpload.promises,
    ...tokenUpload.promises,
    ...collectionUpload.promises,
    ...awardUpload.promises,
    ...spaceUpload.promises,
  ]);

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
  const promises = snap.docs.map((d) => uploadFunc(<T>d.data()));
  return { size: snap.size, promises };
};

const uploadNftMedia = async (nft: Nft) => {
  const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nft.uid}`);
  try {
    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${nft.collection}`);
    const collection = <Collection>(await collectionDocRef.get()).data();
    const metadata = nftToIpfsMetadata(collection, nft);
    const { car, ...ipfs } = await downloadMediaAndPackCar(nft.uid, nft.media, metadata);
    await putCar(car);

    const batch = admin.firestore().batch();
    batch.update(collectionDocRef, uOn({ 'mintingData.nftMediaToUpload': inc(-1) }));
    batch.update(nftDocRef, uOn({ mediaStatus: MediaStatus.UPLOADED, ...ipfs }));
    await batch.commit();
  } catch (error) {
    functions.logger.error(nft.uid, 'Nft media upload error', error);
    await nftDocRef.update(uOn({ mediaStatus: MediaStatus.ERROR }));
  }
};

const uploadTokenMedia = async (token: Token) => {
  const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${token.uid}`);
  try {
    const metadata = tokenToIpfsMetadata(token);
    const { car, ...ipfs } = await downloadMediaAndPackCar(token.uid, token.icon!, metadata);
    await putCar(car);
    await tokenDocRef.update(uOn({ mediaStatus: MediaStatus.UPLOADED, ...ipfs }));
  } catch (error) {
    functions.logger.error(token.uid, 'Token media upload error', error);
    await tokenDocRef.update(uOn({ mediaStatus: MediaStatus.ERROR }));
  }
};

const uploadCollectionMedia = async (collection: Collection) => {
  const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collection.uid}`);
  try {
    const metadata = collectionToIpfsMetadata(collection);
    const { car, ...ipfs } = await downloadMediaAndPackCar(
      collection.uid,
      collection.bannerUrl,
      metadata,
    );
    await putCar(car);

    await collectionDocRef.update(uOn({ mediaStatus: MediaStatus.UPLOADED, ...ipfs }));
  } catch (error) {
    functions.logger.error(collection.uid, 'Collection bannerUrl upload error', error);
    await collectionDocRef.update(uOn({ mediaStatus: MediaStatus.ERROR }));
  }
};

const uploadAwardMedia = async (award: Award) => {
  if (!award.badge.image) {
    return;
  }
  const awardDocRef = admin.firestore().doc(`${COL.AWARD}/${award.uid}`);
  try {
    const metadata = awardToIpfsMetadata(award);
    const { car, ...ipfs } = await downloadMediaAndPackCar(award.uid, award.badge.image, metadata);
    await putCar(car);

    await awardDocRef.update(uOn({ mediaStatus: MediaStatus.UPLOADED, ...ipfs }));
  } catch (error) {
    functions.logger.error(award.uid, 'Award badge image upload error', error);
    await awardDocRef.update(uOn({ mediaStatus: MediaStatus.ERROR }));
  }
};

const uploadSpaceMedia = async (space: Space) => {
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space.uid}`);
  try {
    const metadata = spaceToIpfsMetadata(space);
    const { car, ...ipfs } = await downloadMediaAndPackCar(space.uid, space.bannerUrl!, metadata);
    await putCar(car);

    await spaceDocRef.update(uOn({ mediaStatus: MediaStatus.UPLOADED, ...ipfs }));
  } catch (error) {
    functions.logger.error(space.uid, 'Space image upload error', error);
    await spaceDocRef.update(uOn({ mediaStatus: MediaStatus.ERROR }));
  }
};

const pendingUploadQuery = (col: COL, batchSize: number) =>
  admin
    .firestore()
    .collection(col)
    .where('mediaStatus', '==', MediaStatus.PENDING_UPLOAD)
    .limit(batchSize);
