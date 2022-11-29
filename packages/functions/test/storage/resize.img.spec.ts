import { Bucket } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { ImageWidth } from '../../src/triggers/storage/resize.img.trigger';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { wait } from '../controls/common';

describe('Resize img test', () => {
  it('Should resize img', async () => {
    const name = 'nft/test/image';
    const extensions = Object.values(ImageWidth)
      .map((size) => `_jpeg_${size}X${size}.webp`)
      .concat('.jpeg');

    const bucket = admin.storage().bucket(Bucket.DEV);
    const destination = 'nft/test/image.jpeg';
    await bucket.upload('./test/puppy.jpeg', {
      destination,
      metadata: {
        contentType: 'image/jpeg',
      },
    });

    for (const extension of extensions) {
      await wait(async () => {
        const file = admin
          .storage()
          .bucket(Bucket.DEV)
          .file(name + extension);
        return (await file.exists())[0];
      });
    }
  });

  it('Should create video preview', async () => {
    const id = getRandomEthAddress();
    const bucket = admin.storage().bucket(Bucket.DEV);
    const destination = `nft/test/${id}.mov`;
    await bucket.upload('./test/nft_video.mov', {
      destination,
      metadata: {
        contentType: 'video/quicktime',
      },
    });
    await wait(async () => {
      const file = admin.storage().bucket(Bucket.DEV).file(`nft/test/${id}_mov_preview.webp`);
      return (await file.exists())[0];
    });
  });

  it.each(['png', 'jpeg'])('Should not override', async (extension: string) => {
    const name = 'nft/test/image';

    const bucket = admin.storage().bucket(Bucket.DEV);
    await bucket.upload('./test/puppy.jpeg', {
      destination: 'nft/test/image.' + extension,
      metadata: {
        contentType: 'image/' + extension,
      },
    });
    const extensions = Object.values(ImageWidth)
      .map((size) => `_${extension}_${size}X${size}.webp`)
      .concat(`.${extension}`);
    await verifyImagesExist(name, extensions);
  });
});

const verifyImagesExist = async (name: string, extensions: string[]) => {
  for (const extension of extensions) {
    await wait(async () => {
      const file = admin
        .storage()
        .bucket(Bucket.DEV)
        .file(name + extension);
      return (await file.exists())[0];
    });
  }
};
