import { database, storage } from '@buildcore/database';
import { Bucket, COL, MIN_IOTA_AMOUNT, MediaStatus } from '@buildcore/interfaces';
import { uploadMediaToWeb3 } from '../../src/cron/media.cron';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { EMPTY_ALIAS_ID } from '../../src/utils/token-minting-utils/alias.utils';
import { wait } from '../../test/controls/common';
import { Helper } from './Helper';

describe('Stamp tangle test', () => {
  const helper = new Helper();

  beforeAll(helper.beforeAll);
  beforeEach(helper.beforeEach);

  it('Should create and mint stamp with zip file', async () => {
    const bucket = storage().bucket(Bucket.DEV);
    const destination = 'nft/test/image.zip';
    const dowloadUrl = await bucket.upload('./test/puppy.zip', destination, {
      contentType: 'application/zip',
    });

    await helper.wallet!.send(
      helper.address,
      helper.tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      { customMetadata: { request: { ...helper.request, uri: dowloadUrl } } },
    );
    await MnemonicService.store(helper.address.bech32, helper.address.mnemonic);

    const query = database().collection(COL.STAMP).where('createdBy', '==', helper.address.bech32);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1 && snap[0].funded;
    });
    const stamp = (await query.get())[0];
    expect(stamp?.mediaStatus).toBe(MediaStatus.PENDING_UPLOAD);
    expect(stamp?.ipfsMedia).toBeDefined();

    await uploadMediaToWeb3();
    await wait(async () => {
      const stamp = (await query.get())[0];
      return stamp?.mediaStatus === MediaStatus.UPLOADED;
    });
    const uploadedMediaStamp = (await query.get())[0];
    expect(uploadedMediaStamp?.ipfsMedia).toBe(stamp?.ipfsMedia);

    await wait(async () => {
      const stamp = (await query.get())[0];
      return stamp?.aliasId !== EMPTY_ALIAS_ID && stamp?.nftId !== undefined;
    });
  });
});
