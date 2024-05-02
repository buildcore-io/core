import { ICollection, PgToken, PgTokenUpdate, database } from '@buildcore/database';
import {
  Award,
  COL,
  Collection,
  MAX_WALLET_RETRY,
  MediaStatus,
  Nft,
  Space,
  Stamp,
  Token,
} from '@buildcore/interfaces';
import { awardToIpfsMetadata } from '../services/payment/award/award-service';
import {
  collectionToIpfsMetadata,
  downloadMediaAndPackCar,
  nftToIpfsMetadata,
  putCar,
  tokenToIpfsMetadata,
} from '../utils/car.utils';
import { logger } from '../utils/logger';
import { spaceToIpfsMetadata } from '../utils/space.utils';

export const MEDIA_UPLOAD_BACH_SIZE = 30;

type ColWithMedia = COL.NFT | COL.TOKEN | COL.COLLECTION | COL.AWARD | COL.SPACE | COL.STAMP;

export const uploadMediaToWeb3 = async () => {
  let batchSize = MEDIA_UPLOAD_BACH_SIZE;

  const props = [
    { col: COL.NFT, func: uploadNftMedia },
    { col: COL.TOKEN, func: uploadTokenMedia },
    { col: COL.COLLECTION, func: uploadCollectionMedia },
    { col: COL.AWARD, func: uploadAwardMedia },
    { col: COL.SPACE, func: uploadSpaceMedia },
    { col: COL.STAMP, func: uploadStampMedia },
  ];

  const promises: Promise<void>[] = [];
  for (const prop of props) {
    const upload = await uploadMedia(
      prop.col as ColWithMedia,
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
  col: ColWithMedia,
  batchSize: number,
  uploadFunc: (data: T) => Promise<void>,
) => {
  if (!batchSize) {
    return { size: 0, promises: [] as Promise<void>[] };
  }
  const snap = await pendingUploadQuery(col, batchSize).get();
  const promises = snap.map(async (data) => {
    try {
      await uploadFunc(<T>data);
    } catch (error) {
      await setMediaStatusToError(
        col,
        data.uid,
        (data.mediaUploadErrorCount as number) || 0,
        error,
      );
    }
  });
  return { size: snap.length, promises };
};

const uploadNftMedia = async (nft: Nft) => {
  const nftDocRef = database().doc(COL.NFT, nft.uid);
  const collectionDocRef = database().doc(COL.COLLECTION, nft.collection);
  const collection = (await collectionDocRef.get())!;
  const metadata = nftToIpfsMetadata(collection, nft);
  const { car, ...ipfs } = await downloadMediaAndPackCar(nft.uid, nft.media, metadata);
  await putCar(car);

  const batch = database().batch();
  batch.update(collectionDocRef, { mintingData_nftMediaToUpload: database().inc(-1) });

  batch.update(nftDocRef, {
    mediaStatus: MediaStatus.UPLOADED,
    ipfsMedia: ipfs.ipfsMedia,
    ipfsMetadata: ipfs.ipfsMetadata,
    ipfsRoot: ipfs.ipfsRoot,
  });
  await batch.commit();
};

const uploadTokenMedia = async (token: Token) => {
  const tokenDocRef = database().doc(COL.TOKEN, token.uid);
  const metadata = tokenToIpfsMetadata(token);
  const { car, ...ipfs } = await downloadMediaAndPackCar(token.uid, token.icon!, metadata);
  await putCar(car);
  await tokenDocRef.update({
    mediaStatus: MediaStatus.UPLOADED,
    ipfsMedia: ipfs.ipfsMedia,
    ipfsMetadata: ipfs.ipfsMetadata,
    ipfsRoot: ipfs.ipfsRoot,
  });
};

const uploadCollectionMedia = async (collection: Collection) => {
  const collectionDocRef = database().doc(COL.COLLECTION, collection.uid);
  const metadata = collectionToIpfsMetadata(collection);
  const { car, ...ipfs } = await downloadMediaAndPackCar(
    collection.uid,
    collection.bannerUrl,
    metadata,
  );
  await putCar(car);

  await collectionDocRef.update({
    mediaStatus: MediaStatus.UPLOADED,
    ipfsMedia: ipfs.ipfsMedia,
    ipfsMetadata: ipfs.ipfsMetadata,
    ipfsRoot: ipfs.ipfsRoot,
  });
};

const uploadAwardMedia = async (award: Award) => {
  if (!award.badge.image) {
    return;
  }

  const awardDocRef = database().doc(COL.AWARD, award.uid);
  const metadata = awardToIpfsMetadata(award);
  const { car, ...ipfs } = await downloadMediaAndPackCar(award.uid, award.badge.image, metadata);
  await putCar(car);

  await awardDocRef.update({
    mediaStatus: MediaStatus.UPLOADED,
    badge_ipfsMedia: ipfs.ipfsMedia,
    badge_ipfsMetadata: ipfs.ipfsMetadata,
    badge_ipfsRoot: ipfs.ipfsRoot,
  });
};

const uploadSpaceMedia = async (space: Space) => {
  const spaceDocRef = database().doc(COL.SPACE, space.uid);
  const metadata = spaceToIpfsMetadata(space);
  const { car, ...ipfs } = await downloadMediaAndPackCar(space.uid, space.bannerUrl!, metadata);
  await putCar(car);
  await spaceDocRef.update({
    mediaStatus: MediaStatus.UPLOADED,
    ipfsMedia: ipfs.ipfsMedia,
    ipfsMetadata: ipfs.ipfsMetadata,
    ipfsRoot: ipfs.ipfsRoot,
  });
};

const uploadStampMedia = async (stamp: Stamp) => {
  const stampDocRef = database().doc(COL.STAMP, stamp.uid);
  const { car, ...ipfs } = await downloadMediaAndPackCar(stamp.uid, stamp.build5Url);
  await putCar(car);
  await stampDocRef.update({
    mediaStatus: MediaStatus.UPLOADED,
    ipfsMedia: ipfs.ipfsMedia,
    ipfsRoot: ipfs.ipfsRoot,
  });
};

const pendingUploadQuery = (col: ColWithMedia, batchSize: number) =>
  (database().collection(col) as ICollection<Token, PgToken, PgTokenUpdate>)
    .where('mediaStatus', '==', MediaStatus.PENDING_UPLOAD)
    .limit(batchSize);

const setMediaStatusToError = async (
  col: ColWithMedia,
  uid: string,
  errorCount: number,
  error: unknown,
) => {
  const data = {
    mediaUploadErrorCount: database().inc(1),
    mediaStatus: MediaStatus.PENDING_UPLOAD,
  };
  if (errorCount >= MAX_WALLET_RETRY) {
    data.mediaStatus = MediaStatus.ERROR;
    logger.error('Image upload error', col, uid, error);
  }
  const docRef = database().doc(col, uid);
  await docRef.update(data);
};
