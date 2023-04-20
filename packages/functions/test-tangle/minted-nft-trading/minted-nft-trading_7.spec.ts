import { IndexerPluginClient } from '@iota/iota.js-next';
import {
  COL,
  Collection,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  NftStatus,
  TangleRequestType,
  Transaction,
  TransactionOrderType,
  TransactionType,
} from '@soonaverse/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
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

  it('Should purchase nft with tangle request, first send wrong amount', async () => {
    const address = await helper.walletService!.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.RMS, address.bech32, 5 * MIN_IOTA_AMOUNT);

    await helper.createAndOrderNft();
    await helper.mintCollection();

    await helper.setAvailableForSale();

    await helper.walletService!.send(
      address,
      tangleOrder.payload.targetAddress,
      0.5 * MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.NFT_PURCHASE,
            collection: helper.collection,
            nft: helper.nft!.mintingData?.nftId,
          },
        },
      },
    );
    await MnemonicService.store(address.bech32, address.mnemonic, Network.RMS);

    const creditQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', address.bech32)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return snap.length > 0 && snap[0].payload?.walletReference?.confirmed;
    });

    const snap = await creditQuery.get<Transaction>();
    const credit = snap[0];

    await helper.walletService!.send(
      address,
      credit.payload.response.address,
      credit.payload.response.requiredAmount,
      {},
    );
    await MnemonicService.store(address.bech32, address.mnemonic, Network.RMS);

    const nftDocRef = soonDb().doc(`${COL.NFT}/${helper.nft?.uid}`);
    await wait(async () => {
      const nft = <Nft>await nftDocRef.get();
      return nft.status === NftStatus.WITHDRAWN;
    });

    await wait(async () => {
      const snap = await soonDb()
        .collection(COL.TRANSACTION)
        .where('member', '==', address.bech32)
        .where('type', '==', TransactionType.WITHDRAW_NFT)
        .get<Transaction>();
      return snap.length > 0 && snap[0].payload?.walletReference?.confirmed;
    });

    const indexer = new IndexerPluginClient(helper.walletService!.client);
    const nftOutputIds = await indexer.nfts({ addressBech32: address.bech32 });
    expect(nftOutputIds.items.length).toBe(1);

    const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${helper.nft?.collection}`);
    const collection = <Collection>await collectionDocRef.get();
    expect(collection.nftsOnSale).toBe(0);
    expect(collection.nftsOnAuction).toBe(0);

    const orders = await soonDb()
      .collection(COL.TRANSACTION)
      .where('payload.type', '==', TransactionOrderType.NFT_PURCHASE)
      .where('payload.nft', '==', helper.nft!.uid)
      .get<Transaction>();

    const billPayments = await soonDb()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .where('payload.nft', '==', helper.nft!.uid)
      .get<Transaction>();
    for (const billPayment of billPayments) {
      expect(billPayment.payload.restrictions).toEqual(orders[0].payload.restrictions);
    }
  });
});