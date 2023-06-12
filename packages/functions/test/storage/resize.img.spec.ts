import { Bucket } from '@build-5/interfaces';
import { soonStorage } from '../../src/firebase/storage/soonStorage';
import { ImageWidth } from '../../src/triggers/storage/resize.img.trigger';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { wait } from '../controls/common';

describe('Resize img test', () => {
  it('Should resize img', async () => {
    const name = 'nft/test/image';
    const extensions = Object.values(ImageWidth)
      .map((size) => `_jpeg_${size}X${size}.webp`)
      .concat('.jpeg');

    const bucket = soonStorage().bucket(Bucket.DEV);
    const destination = 'nft/test/image.jpeg';
    await bucket.upload('./test/puppy.jpeg', destination, {
      contentType: 'image/jpeg',
    });

    for (const extension of extensions) {
      await wait(
        async () =>
          await soonStorage()
            .bucket(Bucket.DEV)
            .exists(name + extension),
      );
    }
  });

  it('Should create video preview', async () => {
    const id = getRandomEthAddress();
    const bucket = soonStorage().bucket(Bucket.DEV);
    const destination = `nft/test/${id}.mov`;
    await bucket.upload('./test/nft_video.mov', destination, {
      contentType: 'video/quicktime',
    });
    await wait(
      async () => await soonStorage().bucket(Bucket.DEV).exists(`nft/test/${id}_mov_preview.webp`),
    );
  });

  it.each(['png', 'jpeg'])('Should not override', async (extension: string) => {
    const name = 'nft/test/image';

    const bucket = soonStorage().bucket(Bucket.DEV);
    await bucket.upload('./test/puppy.jpeg', 'nft/test/image.' + extension, {
      contentType: 'image/' + extension,
    });
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
        await soonStorage()
          .bucket(Bucket.DEV)
          .exists(name + extension),
    );
  }
};
