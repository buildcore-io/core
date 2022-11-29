import { Bucket } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { ImageWidth } from '../../src/triggers/storage/resize.img.trigger';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { wait } from '../controls/common';
import { getConfig } from '../set-up';

describe('Resize img test', () => {
  it('Should resize img', async () => {
    const name = 'nft/test/image';
    const extensions = Object.values(ImageWidth)
      .map((size) => `_${size}X${size}.webp`)
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

  it('Should resize video', async () => {
    const id = getRandomEthAddress();
    const config = getConfig();
    const bucket = admin.storage().bucket(config.storageBucket);
    const destination = `nft/test/${id}.mov`;
    await bucket.upload('./test/nft_video.mov', {
      destination,
      metadata: {
        contentType: 'video/quicktime',
      },
    });
  });
});
