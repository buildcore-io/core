import { build5Db } from '@build-5/database';
import {
  COL,
  Collection,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { WalletService } from '../../src/services/wallet/wallet';
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

  it('Should purchase pre_minted nft with tangle request', async () => {
    const address = await helper.walletService!.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.RMS, address.bech32, 5 * MIN_IOTA_AMOUNT);

    await helper.createAndOrderNft(false);

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

    const creditQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', address.bech32)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      return snap.length > 0 && snap[0]?.payload?.walletReference?.confirmed;
    });
    const snap = await creditQuery.get();
    const credit = snap[0] as Transaction;

    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${helper.nft?.collection}`);
    const collection = <Collection>await collectionDocRef.get();
    expect(collection.availableNfts).toBe(1);
    expect(collection.nftsOnSale).toBe(0);
    expect(collection.nftsOnAuction).toBe(0);

    const atoiWallet = await WalletService.newWallet(Network.ATOI);
    const atoiAddress = await atoiWallet.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.ATOI, atoiAddress.bech32, 5 * MIN_IOTA_AMOUNT);

    await atoiWallet.send(
      atoiAddress,
      credit.payload.response!.address as string,
      credit.payload.response!.amount as number,
      {},
    );

    const nftDocRef = build5Db().doc(`${COL.NFT}/${helper.nft?.uid}`);
    await wait(async () => {
      const nft = <Nft>await nftDocRef.get();
      return nft.sold || false;
    });
    const nft = <Nft>await nftDocRef.get();
    expect(nft.owner).toBe(address.bech32);

    await wait(async () => {
      const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${helper.nft?.collection}`);
      const collection = <Collection>await collectionDocRef.get();
      return !collection.availableNfts && !collection.nftsOnSale && !collection.nftsOnAuction;
    });
  });
});
