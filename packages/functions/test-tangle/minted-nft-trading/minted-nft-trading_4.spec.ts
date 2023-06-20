import {
  COL,
  Collection,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  NftStatus,
  TangleRequestType,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { IndexerPluginClient } from '@iota/iota.js-next';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Minted nft trading', () => {
  const helper = new Helper();
  let tangleOrder: Transaction;

  beforeAll(async () => {
    await helper.beforeAll();
    tangleOrder = await getTangleOrder();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should purchase nft with tangle request', async () => {
    const address = await helper.walletService!.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.RMS, address.bech32, 5 * MIN_IOTA_AMOUNT);

    await helper.createAndOrderNft();
    await helper.mintCollection();

    await helper.walletService!.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.NFT_PURCHASE,
          collection: helper.collection,
          nft: helper.nft!.uid,
        },
      },
    });
    await MnemonicService.store(address.bech32, address.mnemonic, Network.RMS);

    await wait(async () => {
      const snap = await build5Db()
        .collection(COL.TRANSACTION)
        .where('member', '==', address.bech32)
        .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST)
        .get<Transaction>();
      return snap.length > 0 && snap[0]?.payload?.walletReference?.confirmed;
    });

    await helper.setAvailableForSale();

    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${helper.nft?.collection}`);
    let collection = <Collection>await collectionDocRef.get();
    expect(collection.nftsOnSale).toBe(1);
    expect(collection.nftsOnAuction).toBe(0);

    await helper.walletService!.send(address, tangleOrder.payload.targetAddress!, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.NFT_PURCHASE,
          collection: helper.collection,
          nft: helper.nft!.mintingData?.nftId,
        },
      },
    });

    const nftDocRef = build5Db().doc(`${COL.NFT}/${helper.nft?.uid}`);
    await wait(async () => {
      const nft = <Nft>await nftDocRef.get();
      return nft.status === NftStatus.WITHDRAWN;
    });

    await wait(async () => {
      const snap = await build5Db()
        .collection(COL.TRANSACTION)
        .where('member', '==', address.bech32)
        .where('type', '==', TransactionType.WITHDRAW_NFT)
        .get<Transaction>();
      return snap.length > 0 && snap[0]?.payload?.walletReference?.confirmed;
    });

    const indexer = new IndexerPluginClient(helper.walletService!.client);
    const nftOutputIds = await indexer.nfts({ addressBech32: address.bech32 });
    expect(nftOutputIds.items.length).toBe(1);

    collection = <Collection>await collectionDocRef.get();
    expect(collection.nftsOnSale).toBe(0);
    expect(collection.nftsOnAuction).toBe(0);

    const orders = await build5Db()
      .collection(COL.TRANSACTION)
      .where('payload.type', '==', TransactionPayloadType.NFT_PURCHASE)
      .where('payload.nft', '==', helper.nft!.uid)
      .get<Transaction>();
    for (const order of orders) {
      expect(order.payload.restrictions!.collection).toEqual({
        access: collection.access,
        accessAwards: collection.accessAwards || [],
        accessCollections: collection.accessCollections || [],
      });
      expect(order.payload.restrictions!.nft).toEqual({
        saleAccess: helper.nft!.saleAccess || null,
        saleAccessMembers: helper.nft!.saleAccessMembers || [],
      });
    }

    const billPayments = await build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload.nft', '==', helper.nft!.uid)
      .get<Transaction>();
    for (const billPayment of billPayments) {
      expect(billPayment.payload.restrictions).toEqual(orders[0].payload.restrictions);
    }
  });
});
