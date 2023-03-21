import { IndexerPluginClient } from '@iota/iota.js-next';
import {
  COL,
  CollectionType,
  MIN_IOTA_AMOUNT,
  Network,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
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
    await helper.beforeEach(CollectionType.GENERATED);
  });

  it('Should purchase random nft with tangle request', async () => {
    const address = await helper.walletService!.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.RMS, address.bech32, 5 * MIN_IOTA_AMOUNT);

    await helper.createAndOrderNft(false);
    await helper.mintCollection();

    await helper.walletService!.send(address, tangleOrder.payload.targetAddress, MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.NFT_PURCHASE,
          collection: helper.collection,
        },
      },
    });
    await MnemonicService.store(address.bech32, address.mnemonic, Network.RMS);

    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('member', '==', address.bech32)
        .where('type', '==', TransactionType.WITHDRAW_NFT)
        .get();
      return snap.size > 0 && snap.docs[0]?.data()?.payload?.walletReference?.confirmed;
    });
    const indexer = new IndexerPluginClient(helper.walletService!.client);
    const nftOutputIds = await indexer.nfts({ addressBech32: address.bech32 });
    expect(nftOutputIds.items.length).toBe(1);
  });
});