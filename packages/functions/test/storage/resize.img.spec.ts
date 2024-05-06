import { storage } from '@buildcore/database';
import { Bucket, ImageWidth } from '@buildcore/interfaces';
import axios from 'axios';
import { WEN_STORAGE_TRIGGER } from '../../src/runtime/common';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { wait } from '../controls/common';

const triggerResizer = async (name: string, contentType: string) => {
  try {
    await axios.post(
      'http://localhost:8080/' + WEN_STORAGE_TRIGGER.onUploadFinalized,
      { name, bucket: Bucket.DEV, contentType, metadata: {} },
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.log(err);
  }
};

describe('Resize img test', () => {
  it('Should resize img', async () => {
    const folder = getRandomEthAddress();
    const name = `nft/${folder}/image`;
    const extensions = Object.values(ImageWidth)
      .map((size) => `_jpeg_${size}X${size}.webp`)
      .concat('.jpeg');
    const bucket = storage().bucket(Bucket.DEV);
    await bucket.upload('./test/puppy.jpeg', name + '.jpeg', { contentType: 'image/jpeg' });
    await triggerResizer(name + '.jpeg', 'image/jpeg');
    for (const extension of extensions) {
      await wait(
        async () =>
          await storage()
            .bucket(Bucket.DEV)
            .exists(name + extension),
      );
    }
  });

  it('Should create video preview', async () => {
    const id = getRandomEthAddress();
    const bucket = storage().bucket(Bucket.DEV);
    const destination = `nft/test/${id}.mov`;
    await bucket.upload('./test/nft_video.mov', destination, { contentType: 'video/quicktime' });
    await triggerResizer(destination, 'video/quicktime');
    await wait(
      async () => await storage().bucket(Bucket.DEV).exists(`nft/test/${id}_mov_preview.webp`),
    );
  });

  it.each(['png', 'jpeg'])('Should not override', async (extension: string) => {
    const name = 'nft/test/image';
    const bucket = storage().bucket(Bucket.DEV);
    await bucket.upload('./test/puppy.jpeg', 'nft/test/image.' + extension, {
      contentType: 'image/' + extension,
    });
    await triggerResizer('nft/test/image.' + extension, 'image/' + extension);
    const extensions = Object.values(ImageWidth)
      .map((size) => `_${extension}_${size}X${size}.webp`)
      .concat(`.${extension}`);
    await verifyImagesExist(name, extensions);
  });
});

const verifyImagesExist = async (name: string, extensions: string[]) => {
  for (const extension of extensions) {
    await wait(
      async () =>
        await storage()
          .bucket(Bucket.DEV)
          .exists(name + extension),
    );
  }
};
