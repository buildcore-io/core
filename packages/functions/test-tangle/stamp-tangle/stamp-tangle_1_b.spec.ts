import { build5Db } from '@build-5/database';
import {
  COL,
  KEY_NAME_TANGLE,
  MIN_IOTA_AMOUNT,
  MediaStatus,
  Stamp,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
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

  it('Should create and mint stamp, 10 days', async () => {
    await helper.wallet!.send(
      helper.address,
      helper.tangleOrder.payload.targetAddress!,
      5 * MIN_IOTA_AMOUNT,
      { customMetadata: { request: { ...helper.request, days: 10 } } },
    );
    await MnemonicService.store(helper.address.bech32, helper.address.mnemonic);

    const query = build5Db().collection(COL.STAMP).where('createdBy', '==', helper.address.bech32);
    await wait(async () => {
      const snap = await query.get<Stamp>();
      return snap.length === 1 && snap[0].funded;
    });
    let stamp = (await query.get<Stamp>())[0];
    expect(stamp?.mediaStatus).toBe(MediaStatus.PENDING_UPLOAD);
    expect(stamp?.ipfsMedia).toBeDefined();

    const expiresAfter10Days = dayjs(stamp?.expiresAt.toDate()).isAfter(dayjs().add(1.728e9));
    expect(expiresAfter10Days).toBe(true);
    const expiresAfter30Days = dayjs(stamp?.expiresAt.toDate()).isBefore(dayjs().add(1.8144e9));
    expect(expiresAfter30Days).toBe(true);

    await uploadMediaToWeb3();
    const stampDocRef = build5Db().doc(`${COL.STAMP}/${stamp.uid}`);
    await wait(async () => {
      const stamp = await stampDocRef.get<Stamp>();
      return stamp?.mediaStatus === MediaStatus.UPLOADED;
    });
    const uploadedMediaStamp = await stampDocRef.get<Stamp>();
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
    expect(metadata.build5Id).toBe(stamp!.uid);
    expect(metadata.originUri).toBe(helper.dowloadUrl);
    expect(metadata.build5Url).toBe(helper.dowloadUrl);
    expect(metadata.checksum).toBe(helper.checksum);

    const billPayment = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload.stamp', '==', stamp?.uid)
      .get<Transaction>();
    expect(billPayment.length).toBe(1);
  });
});
