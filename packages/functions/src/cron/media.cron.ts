import {
  Award,
  COL,
  Collection,
  MAX_WALLET_RETRY,
  MediaStatus,
  Nft,
  Space,
  Token,
} from '@build-5/interfaces';
import { build5Db } from '../firebase/firestore/build5Db';
import { awardToIpfsMetadata } from '../services/payment/award/award-service';
import {
  collectionToIpfsMetadata,
  downloadMediaAndPackCar,
  nftToIpfsMetadata,
  putCar,
  tokenToIpfsMetadata,
} from '../utils/car.utils';
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
  const snap = await pendingUploadQuery(col, batchSize).get<Record<string, unknown>>();
  const promises = snap.map(async (data) => {
    try {
      return await uploadFunc(<T>data);
    } catch (error) {
      await setMediaStatusToError(
        col,
        data.uid as string,
        (data.mediaUploadErrorCount as number) || 0,
        error,
      );
    }
  });
  return { size: snap.length, promises };
};

const uploadNftMedia = async (nft: Nft) => {
  const nftDocRef = build5Db().doc(`${COL.NFT}/${nft.uid}`);
  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${nft.collection}`);
  const collection = (await collectionDocRef.get<Collection>())!;
  const metadata = nftToIpfsMetadata(collection, nft);
  const { car, ...ipfs } = await downloadMediaAndPackCar(nft.uid, nft.media, metadata);
  await putCar(car);

  const batch = build5Db().batch();
  batch.update(collectionDocRef, { 'mintingData.nftMediaToUpload': build5Db().inc(-1) });
  batch.update(nftDocRef, { mediaStatus: MediaStatus.UPLOADED, ...ipfs });
  await batch.commit();
};

const uploadTokenMedia = async (token: Token) => {
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${token.uid}`);
  const metadata = tokenToIpfsMetadata(token);
  const { car, ...ipfs } = await downloadMediaAndPackCar(token.uid, token.icon!, metadata);
  await putCar(car);
  await tokenDocRef.update({ mediaStatus: MediaStatus.UPLOADED, ...ipfs });
};

const uploadCollectionMedia = async (collection: Collection) => {
  const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${collection.uid}`);
  const metadata = collectionToIpfsMetadata(collection);
  const { car, ...ipfs } = await downloadMediaAndPackCar(
    collection.uid,
    collection.bannerUrl,
    metadata,
  );
  await putCar(car);

  await collectionDocRef.update({ mediaStatus: MediaStatus.UPLOADED, ...ipfs });
};

const uploadAwardMedia = async (award: Award) => {
  if (!award.badge.image) {
    return;
  }
  const awardDocRef = build5Db().doc(`${COL.AWARD}/${award.uid}`);
  const metadata = awardToIpfsMetadata(award);
  const { car, ...ipfs } = await downloadMediaAndPackCar(award.uid, award.badge.image, metadata);
  await putCar(car);

  await awardDocRef.update({ mediaStatus: MediaStatus.UPLOADED, ...ipfs });
};

const uploadSpaceMedia = async (space: Space) => {
  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${space.uid}`);
  const metadata = spaceToIpfsMetadata(space);
  const { car, ...ipfs } = await downloadMediaAndPackCar(space.uid, space.bannerUrl!, metadata);
  await putCar(car);
  await spaceDocRef.update({ mediaStatus: MediaStatus.UPLOADED, ...ipfs });
};

const pendingUploadQuery = (col: COL, batchSize: number) =>
  build5Db()
    .collection(col)
    .where('mediaStatus', '==', MediaStatus.PENDING_UPLOAD)
    .limit(batchSize);

const setMediaStatusToError = async (col: COL, uid: string, errorCount: number, error: unknown) => {
  const data = {
    mediaUploadErrorCount: build5Db().inc(1),
    mediaStatus: MediaStatus.PENDING_UPLOAD,
  };
  if (errorCount >= MAX_WALLET_RETRY) {
    data.mediaStatus = MediaStatus.ERROR;
    console.error(col, uid, 'Image upload error', error);
  }
  const docRef = build5Db().doc(`${col}/${uid}`);
  await docRef.update(data);
};
