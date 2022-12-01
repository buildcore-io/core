import {
  COL,
  Collection,
  CollectionStatus,
  UnsoldMintingOptions,
  WenError,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { mintCollectionOrder } from '../../src/controls/nft/collection-mint.control';
import { expectThrow, mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Minted nft trading', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should throw can not be set for sale during minting', async () => {
    await helper.createAndOrderNft();

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      collection: helper.collection,
      network: helper.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    const collectionMintOrder = await testEnv.wrap(mintCollectionOrder)({});
    await requestFundsFromFaucet(
      helper.network!,
      collectionMintOrder.payload.targetAddress,
      collectionMintOrder.payload.amount,
    );

    await wait(async () => {
      const collection = <Collection>(
        (await admin.firestore().doc(`${COL.COLLECTION}/${helper.collection}`).get()).data()
      );
      return collection.status === CollectionStatus.MINTING;
    });

    await expectThrow(helper.setAvailableForAuction(), WenError.invalid_collection_status.key);
    await expectThrow(helper.setAvailableForSale(), WenError.invalid_collection_status.key);
  });
});
