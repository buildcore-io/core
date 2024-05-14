import { database } from '@buildcore/database';
import { COL, KEY_NAME_TANGLE, MediaStatus, Stamp, TransactionType } from '@buildcore/interfaces';
import { NftOutput } from '@iota/sdk';
import dayjs from 'dayjs';
import { uploadMediaToWeb3 } from '../../src/cron/media.cron';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { EMPTY_ALIAS_ID } from '../../src/utils/token-minting-utils/alias.utils';
import { wait } from '../../test/controls/common';
import { getNftMetadata } from '../collection-minting/Helper';
import { Helper } from './Helper';

describe('Stamp tangle test', () => {
  const helper = new Helper();

  beforeAll(helper.beforeAll);
  beforeEach(helper.beforeEach);

  it('Should create and mint stamp', async () => {
    const fiftyDayCost = 2124 * 50 + 53700 + 92000;

    await helper.wallet!.send(
      helper.address,
      helper.tangleOrder.payload.targetAddress!,
      fiftyDayCost,
      { customMetadata: { request: helper.request } },
    );
    await MnemonicService.store(helper.address.bech32, helper.address.mnemonic);

    const query = database().collection(COL.STAMP).where('createdBy', '==', helper.address.bech32);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1 && snap[0].funded;
    });
    let stamp = (await query.get())[0];
    expect(stamp?.mediaStatus).toBe(MediaStatus.PENDING_UPLOAD);
    expect(stamp?.ipfsMedia).toBeDefined();

    const expiresAfter50Days = dayjs(stamp?.expiresAt.toDate()).isAfter(dayjs().add(4.32e9));
    expect(expiresAfter50Days).toBe(true);
    const expiresBefore51Days = dayjs(stamp?.expiresAt.toDate()).isBefore(dayjs().add(4.4064e9));
    expect(expiresBefore51Days).toBe(true);

    await uploadMediaToWeb3();
    const stampDocRef = database().doc(COL.STAMP, stamp.uid);
    await wait(async () => {
      const stamp = await stampDocRef.get();
      return stamp?.mediaStatus === MediaStatus.UPLOADED;
    });
    const uploadedMediaStamp = await stampDocRef.get();
    expect(uploadedMediaStamp?.ipfsMedia).toBe(stamp?.ipfsMedia);

    await wait(async () => {
      stamp = <Stamp>await stampDocRef.get();
      return stamp?.aliasId !== EMPTY_ALIAS_ID && stamp?.nftId !== undefined;
    });

    const nftOutputId = await helper.wallet.client.nftOutputId(stamp?.nftId!);
    const nftOutput = (await helper.wallet.client.getOutput(nftOutputId)).output as NftOutput;
    const metadata = getNftMetadata(nftOutput);
    expect(metadata.uri).toBe('ipfs://' + stamp!.ipfsMedia);
    expect(metadata.issuerName).toBe(KEY_NAME_TANGLE);
    expect(metadata.originId).toBe(stamp!.uid);
    expect(metadata.originUri).toBe(helper.dowloadUrl);
    expect(metadata.buildcoreUrl).toBe(helper.dowloadUrl);
    expect(metadata.checksum).toBe(helper.checksum);

    const billPayment = await database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload_stamp', '==', stamp?.uid)
      .get();
    expect(billPayment.length).toBe(1);
  });
});
