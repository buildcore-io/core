import { database } from '@buildcore/database';
import {
  COL,
  KEY_NAME_TANGLE,
  MIN_IOTA_AMOUNT,
  MediaStatus,
  TransactionType,
} from '@buildcore/interfaces';
import { NftOutput } from '@iota/sdk';
import { uploadMediaToWeb3 } from '../../src/cron/media.cron';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { EMPTY_ALIAS_ID } from '../../src/utils/token-minting-utils/alias.utils';
import { wait } from '../../test/controls/common';
import { getNftMetadata } from '../collection-minting/Helper';
import { Helper } from './Helper';

const CUSTOM_MEDIA =
  'https://ipfs.io/ipfs/bafkreiapx7kczhfukx34ldh3pxhdip5kgvh237dlhp55koefjo6tyupnj4';

describe('Stamp tangle test', () => {
  const helper = new Helper();

  beforeAll(helper.beforeAll);
  beforeEach(helper.beforeEach);

  it('Should create and mint stamp with ipfs file', async () => {
    await helper.wallet!.send(
      helper.address,
      helper.tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      { customMetadata: { request: { ...helper.request, uri: CUSTOM_MEDIA } } },
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
    const ipfsMedia = stamp.ipfsMedia;
    expect(stamp?.originUri).toBe(CUSTOM_MEDIA);

    await uploadMediaToWeb3();
    await wait(async () => {
      stamp = (await query.get())[0];
      return stamp?.mediaStatus === MediaStatus.UPLOADED;
    });
    expect(stamp?.ipfsMedia).toBe(ipfsMedia);

    await wait(async () => {
      stamp = (await query.get())[0];
      return stamp?.aliasId !== EMPTY_ALIAS_ID && stamp?.nftId !== undefined;
    });

    stamp = (await query.get())[0];
    const nftOutputId = await helper.wallet.client.nftOutputId(stamp?.nftId!);
    const nftOutput = (await helper.wallet.client.getOutput(nftOutputId)).output as NftOutput;
    const metadata = getNftMetadata(nftOutput);
    expect(metadata.uri).toBe('ipfs://' + stamp!.ipfsMedia);
    expect(metadata.issuerName).toBe(KEY_NAME_TANGLE);
    expect(metadata.originId).toBe(stamp!.uid);

    const billPayment = await database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload_stamp', '==', stamp?.uid)
      .get();
    expect(billPayment.length).toBe(1);
  });
});
