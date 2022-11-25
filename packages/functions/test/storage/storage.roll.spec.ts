import { Bucket, COL, Collection, Nft, Token } from '@soonaverse/interfaces';
import { moveMediaToTheRighBucket } from '../../scripts/dbUpgrades/0_16/storage.roll';
import admin from '../../src/admin.config';
import { ImageWidth } from '../../src/triggers/storage/resize.img.trigger';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { getConfig } from '../set-up';

describe('Storage roll', () => {
  const saveImages = async (names: string[]) => {
    const bucket = admin.storage().bucket();
    for (const name of names) {
      await bucket.upload('./test/puppy.jpeg', {
        destination: name,
        metadata: {
          contentType: 'image/jpeg',
        },
      });
      for (const size of Object.values(ImageWidth)) {
        await bucket.upload('./test/puppy.jpeg', {
          destination: name + `_${size}X${size}.webp`,
          metadata: {
            contentType: 'image/webp',
          },
        });
      }
    }
  };

  const verifyOldImagesWereDeleted = async (names: string[]) => {
    const bucket = admin.storage().bucket();
    for (const name of names) {
      const prevExists = (await bucket.file(name).exists())[0];
      expect(prevExists).toBe(false);

      for (const size of Object.values(ImageWidth)) {
        const prevExists = (await bucket.file(name + `_${size}X${size}.webp`).exists())[0];
        expect(prevExists).toBe(false);
      }
    }
  };

  const verifyNewImageInRightBucket = async (names: string[]) => {
    for (const name of names) {
      const currExists = (
        await admin
          .storage()
          .bucket(Bucket.DEV)
          .file(name + '.jpeg')
          .exists()
      )[0];
      expect(currExists).toBe(true);
    }
  };

  it('Should roll nft', async () => {
    const nftId = getRandomEthAddress();
    await saveImages([nftId]);

    const media = getPublicUrl(nftId);
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nftId}`);
    await nftDocRef.create({
      uid: nftId,
      media,
    });

    await moveMediaToTheRighBucket(admin.firestore(), admin.storage(), COL.NFT, Bucket.DEV);

    await verifyOldImagesWereDeleted([nftId]);
    await verifyNewImageInRightBucket([nftId]);

    const nft = <Nft>(await nftDocRef.get()).data();
    expect(nft.media !== media).toBe(true);
    await nftDocRef.delete();
  });

  it('Should roll token', async () => {
    const tokenId = getRandomEthAddress();
    await saveImages([tokenId, tokenId + '_overviewGraphics']);

    const icon = getPublicUrl(tokenId);
    const overviewGraphics = getPublicUrl(tokenId + '_overviewGraphics');
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${tokenId}`);
    await tokenDocRef.create({
      uid: tokenId,
      icon,
      overviewGraphics,
    });

    await moveMediaToTheRighBucket(admin.firestore(), admin.storage(), COL.TOKEN, Bucket.DEV);

    await verifyOldImagesWereDeleted([tokenId, tokenId + '_overviewGraphics']);
    await verifyNewImageInRightBucket([tokenId, tokenId + '_overviewGraphics']);

    const token = <Token>(await tokenDocRef.get()).data();
    expect(token.icon !== icon).toBe(true);
    expect(token.overviewGraphics !== overviewGraphics).toBe(true);
    await tokenDocRef.delete();
  });

  it('Should roll collection', async () => {
    const colletionId = getRandomEthAddress();
    await saveImages([colletionId, colletionId + '_placeholderUrl']);

    const bannerUrl = getPublicUrl(colletionId);
    const placeholderUrl = getPublicUrl(colletionId + '_placeholderUrl');
    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${colletionId}`);
    await collectionDocRef.create({
      uid: colletionId,
      bannerUrl,
      placeholderUrl,
    });

    await moveMediaToTheRighBucket(admin.firestore(), admin.storage(), COL.COLLECTION, Bucket.DEV);

    await verifyOldImagesWereDeleted([colletionId, colletionId + '_placeholderUrl']);
    await verifyNewImageInRightBucket([colletionId, colletionId + '_placeholderUrl']);

    const collection = <Collection>(await collectionDocRef.get()).data();
    expect(collection.bannerUrl !== bannerUrl).toBe(true);
    expect(collection.placeholderUrl !== placeholderUrl).toBe(true);
    await collectionDocRef.delete();
  });

  it('Should roll video', async () => {
    const nftId = getRandomEthAddress();
    const bucket = admin.storage().bucket();
    await bucket.upload('./test/nft_video.mov', {
      destination: nftId,
      metadata: {
        contentType: 'video/quicktime',
      },
    });
    const media = getPublicUrl(nftId);
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nftId}`);
    await nftDocRef.create({
      uid: nftId,
      media,
    });

    await moveMediaToTheRighBucket(admin.firestore(), admin.storage(), COL.NFT, Bucket.DEV);

    const currExists = (
      await admin
        .storage()
        .bucket(Bucket.DEV)
        .file(nftId + '.qt')
        .exists()
    )[0];
    expect(currExists).toBe(true);

    const nft = <Nft>(await nftDocRef.get()).data();
    expect(nft.media !== media).toBe(true);
    await nftDocRef.delete();
  });
});

const getPublicUrl = (fileName: string) => {
  const config = getConfig();
  return (
    `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/` +
    `${fileName.replace(/\//g, '%2')}?alt=media&token=${getRandomEthAddress()}`
  );
};
