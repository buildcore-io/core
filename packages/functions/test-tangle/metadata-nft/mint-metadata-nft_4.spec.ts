import {
  COL,
  Collection,
  MIN_IOTA_AMOUNT,
  Nft,
  Space,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@build5/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { Helper } from './Helper';

describe('Metadata nft', () => {
  const helper = new Helper();
  let tangleOrder: Transaction;

  beforeAll(async () => {
    await helper.berforeAll();
    tangleOrder = await getTangleOrder();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should mint metada nft, mint new one for same alias but new collection', async () => {
    const metadata = { mytest: 'mytest', asd: 'asdasdasd' };
    await helper.walletService.send(
      helper.memberAddress,
      tangleOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.MINT_METADATA_NFT,
            metadata,
          },
        },
      },
    );
    await MnemonicService.store(
      helper.memberAddress.bech32,
      helper.memberAddress.mnemonic,
      helper.network,
    );

    const mintMetadataNftQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.member)
      .where('type', '==', TransactionType.METADATA_NFT);
    await wait(async () => {
      const snap = await mintMetadataNftQuery.get();
      return snap.length === 3;
    });

    const creditQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.member)
      .where('type', '==', TransactionType.CREDIT);
    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return snap.length === 1 && snap[0]?.payload?.walletReference?.confirmed;
    });
    const credit = (await creditQuery.get<Transaction>())[0];

    const space = <Space>await soonDb().doc(`${COL.SPACE}/${credit.space}`).get();

    await helper.walletService.send(
      helper.memberAddress,
      tangleOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.MINT_METADATA_NFT,
            metadata,
            aliasId: space.alias?.aliasId,
          },
        },
      },
    );
    await MnemonicService.store(
      helper.memberAddress.bech32,
      helper.memberAddress.mnemonic,
      helper.network,
    );

    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return (
        snap.length === 2 &&
        snap.reduce((acc, act) => acc && act.payload?.walletReference?.confirmed, true)
      );
    });

    const nfts = await soonDb().collection(COL.NFT).where('owner', '==', helper.member).get<Nft>();
    expect(nfts[0].collection).not.toBe(nfts[1].collection);
    expect(nfts[0].space).toBe(nfts[1].space);

    const collections = await soonDb()
      .collection(COL.COLLECTION)
      .where('space', '==', space.uid)
      .get<Collection>();
    expect(collections.length).toBe(2);
  });
});
