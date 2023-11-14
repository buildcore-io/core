import { build5Db, build5Storage } from '@build-5/database';
import { Bucket, COL, MIN_IOTA_AMOUNT, MediaStatus, Stamp } from '@build-5/interfaces';
import dayjs from 'dayjs';
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
    const bucket = build5Storage().bucket(Bucket.DEV);
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

    const creditResponse = await helper.getCreditResponse();
    const thirtyDayCost =
      (creditResponse.dailyCost as number) * 30 + (creditResponse.amountToMint as number);
    await helper.wallet!.send(helper.address, creditResponse.address as string, thirtyDayCost, {});
    await MnemonicService.store(helper.address.bech32, helper.address.mnemonic);

    const stampDocRef = build5Db().doc(`${COL.STAMP}/${creditResponse.stamp}`);
    await wait(async () => {
      const stamp = await stampDocRef.get<Stamp>();
      return stamp?.funded;
    });
    let stamp = await stampDocRef.get<Stamp>();
    expect(stamp?.mediaStatus).toBe(MediaStatus.PENDING_UPLOAD);
    expect(stamp?.ipfsMedia).toBeDefined();

    const expiresAfter30Days = dayjs(stamp?.expiresAt.toDate()).isAfter(dayjs().add(8.64e7));
    expect(expiresAfter30Days).toBe(true);

    await uploadMediaToWeb3();
    await wait(async () => {
      const stamp = await stampDocRef.get<Stamp>();
      return stamp?.mediaStatus === MediaStatus.UPLOADED;
    });
    const uploadedMediaStamp = await stampDocRef.get<Stamp>();
    expect(uploadedMediaStamp?.ipfsMedia).toBe(stamp?.ipfsMedia);

    await wait(async () => {
      stamp = await stampDocRef.get<Stamp>();
      return stamp?.aliasId !== EMPTY_ALIAS_ID && stamp?.nftId !== undefined;
    });
  });
});
