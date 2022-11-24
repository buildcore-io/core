import { Bucket } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { ImageWidth } from '../../src/triggers/storage/resize.img.trigger';
import { wait } from '../controls/common';
describe('Resize img test', () => {
  it('Should resize img', async () => {
    const name = 'nft/test/image';
    const extensions = Object.values(ImageWidth)
      .map((size) => `_${size}X${size}.webp`)
      .concat('.jpeg');

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
});
