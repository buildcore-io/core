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

  it('Should create and mint stamp', async () => {
    await helper.wallet!.send(
      helper.address,
      helper.tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      { customMetadata: { request: helper.request } },
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
    expect(billPayment[0].payload.amount).toBe((creditResponse.dailyCost as number) * 30);
  });
});
