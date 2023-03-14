import {
  COL,
  Collection,
  MIN_IOTA_AMOUNT,
  Network,
  Nft,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
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

    await helper.walletService!.send(address, tangleOrder.payload.targetAddress, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.NFT_PURCHASE,
          collection: helper.collection,
          nft: helper.nft!.uid,
        },
      },
    });
    await MnemonicService.store(address.bech32, address.mnemonic, Network.RMS);

    const creditQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', address.bech32)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const snap = await creditQuery.get();
      return snap.size > 0 && snap.docs[0]?.data()?.payload?.walletReference?.confirmed;
    });
    const snap = await creditQuery.get();
    const credit = snap.docs[0].data() as Transaction;

    const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${helper.nft?.collection}`);
    const collection = <Collection>(await collectionDocRef.get()).data();
    expect(collection.availableNfts).toBe(1);
    expect(collection.nftsOnSale).toBe(0);
    expect(collection.nftsOnAuction).toBe(0);

    const atoiWallet = await WalletService.newWallet(Network.ATOI);
    const atoiAddress = await atoiWallet.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.ATOI, atoiAddress.bech32, 5 * MIN_IOTA_AMOUNT);

    await atoiWallet.send(
      atoiAddress,
      credit.payload.response.address,
      credit.payload.response.amount,
      {},
    );

    const nftDocRef = admin.firestore().doc(`${COL.NFT}/${helper.nft?.uid}`);
    await wait(async () => {
      const nft = <Nft>(await nftDocRef.get()).data();
      return nft.sold || false;
    });
    const nft = <Nft>(await nftDocRef.get()).data();
    expect(nft.owner).toBe(address.bech32);

    await wait(async () => {
      const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${helper.nft?.collection}`);
      const collection = <Collection>(await collectionDocRef.get()).data();
      return !collection.availableNfts && !collection.nftsOnSale && !collection.nftsOnAuction;
    });
  });
});
