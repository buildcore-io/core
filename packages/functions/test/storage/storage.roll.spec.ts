import { Bucket, COL, Collection, Nft, Space, Token } from '@soonaverse/interfaces';
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
    const nftImgPath = `${nftId}/test/${getRandomEthAddress()}/nft_media`;
    await saveImages([nftImgPath]);

    const media = getPublicUrl(nftImgPath);
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nftId}`);
    await nftDocRef.create({
      uid: nftId,
      media,
    });

    await moveMediaToTheRighBucket(admin.app(), COL.NFT, Bucket.DEV_DEFAULT, Bucket.DEV);

    await verifyNewImageInRightBucket([nftImgPath]);

    const nft = <Nft>(await nftDocRef.get()).data();
    expect(nft.media).toBe(`https://${Bucket.DEV}/${nftImgPath}.jpeg`);
  });

  it('Should roll token', async () => {
    const tokenId = getRandomEthAddress();
    const tokenImgPath = `${tokenId}/test/${getRandomEthAddress()}/token_icon`;
    await saveImages([tokenImgPath, tokenImgPath + '_overviewGraphics']);

    const icon = getPublicUrl(tokenImgPath);
    const overviewGraphics = getPublicUrl(tokenImgPath + '_overviewGraphics');
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${tokenId}`);
    await tokenDocRef.create({
      uid: tokenId,
      icon,
      overviewGraphics,
    });

    await moveMediaToTheRighBucket(admin.app(), COL.TOKEN, Bucket.DEV_DEFAULT, Bucket.DEV);
    await verifyNewImageInRightBucket([tokenImgPath, tokenImgPath + '_overviewGraphics']);

    const token = <Token>(await tokenDocRef.get()).data();
    expect(token.icon).toBe(`https://${Bucket.DEV}/${tokenImgPath}.jpeg`);
    expect(token.overviewGraphics).toBe(
      `https://${Bucket.DEV}/${tokenImgPath}_overviewGraphics.jpeg`,
    );
  });

  it('Should roll space', async () => {
    const spaceId = getRandomEthAddress();
    const spaceImgPath = `${spaceId}/test/${getRandomEthAddress()}/space_img`;
    await saveImages([spaceImgPath, spaceImgPath + '_banner']);

    const avatarUrl = getPublicUrl(spaceImgPath);
    const bannerUrl = getPublicUrl(spaceImgPath + '_banner');
    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${spaceId}`);
    await spaceDocRef.create({
      uid: spaceId,
      avatarUrl,
      bannerUrl,
    });

    await moveMediaToTheRighBucket(admin.app(), COL.SPACE, Bucket.DEV_DEFAULT, Bucket.DEV);
    await verifyNewImageInRightBucket([spaceImgPath, spaceImgPath + '_banner']);

    const space = <Space>(await spaceDocRef.get()).data();
    expect(space.avatarUrl).toBe(`https://${Bucket.DEV}/${spaceImgPath}.jpeg`);
    expect(space.bannerUrl).toBe(`https://${Bucket.DEV}/${spaceImgPath}_banner.jpeg`);
  });

  it('Should roll collection', async () => {
    const colletionId = getRandomEthAddress();
    const collectionImgPath = `${colletionId}/test/${getRandomEthAddress()}/collection_url`;
    await saveImages([collectionImgPath, collectionImgPath + '_placeholderUrl']);

    const bannerUrl = getPublicUrl(collectionImgPath);
    const placeholderUrl = getPublicUrl(collectionImgPath + '_placeholderUrl');
    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${colletionId}`);
    await collectionDocRef.create({
      uid: colletionId,
      bannerUrl,
      placeholderUrl,
    });

    await moveMediaToTheRighBucket(admin.app(), COL.COLLECTION, Bucket.DEV_DEFAULT, Bucket.DEV);

    await verifyNewImageInRightBucket([collectionImgPath, collectionImgPath + '_placeholderUrl']);

    const collection = <Collection>(await collectionDocRef.get()).data();
    expect(collection.bannerUrl).toBe(`https://${Bucket.DEV}/${collectionImgPath}.jpeg`);
    expect(collection.placeholderUrl).toBe(
      `https://${Bucket.DEV}/${collectionImgPath}_placeholderUrl.jpeg`,
    );
  });

  it('Should roll video', async () => {
    const nftId = getRandomEthAddress();
    const nftImgPath = `${nftId}/test/${getRandomEthAddress()}/nft_media`;
    const bucket = admin.storage().bucket();
    await bucket.upload('./test/nft_video.mov', {
      destination: nftImgPath,
      metadata: {
        contentType: 'video/quicktime',
      },
    });
    const media = getPublicUrl(nftImgPath);
    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nftId}`);
    await nftDocRef.create({
      uid: nftId,
      media,
    });

    await moveMediaToTheRighBucket(admin.app(), COL.NFT, Bucket.DEV_DEFAULT, Bucket.DEV);

    const currExists = (
      await admin
        .storage()
        .bucket(Bucket.DEV)
        .file(nftImgPath + '.qt')
        .exists()
    )[0];
    expect(currExists).toBe(true);

    const nft = <Nft>(await nftDocRef.get()).data();
    expect(nft.media).toBe(`https://${Bucket.DEV}/${nftImgPath}.qt`);
  });
});

const getPublicUrl = (fileName: string) => {
  const config = getConfig();
  return (
    `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/` +
    `${fileName.replace(/\//g, '%2F')}?alt=media&token=${getRandomEthAddress()}`
  );
};
