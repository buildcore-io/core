import { build5Db } from '@build-5/database';
import {
  COL,
  Collection,
  CollectionStatus,
  Transaction,
  TransactionType,
  UnsoldMintingOptions,
} from '@build-5/interfaces';
import { isEqual } from 'lodash';
import { mintCollection } from '../../src/runtime/firebase/collection/index';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { CollectionMintHelper } from './Helper';

describe('Collection minting', () => {
  const helper = new CollectionMintHelper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should credit second miting order', async () => {
    await helper.createAndOrderNft(true);
    const tmpAddress1 = await helper.walletService!.getNewIotaAddressDetails();
    const tmpAddress2 = await helper.walletService!.getNewIotaAddressDetails();

    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      collection: helper.collection,
      network: helper.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    const collectionMintOrder1 = await testEnv.wrap(mintCollection)({});
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      collection: helper.collection,
      network: helper.network,
      unsoldMintingOptions: UnsoldMintingOptions.KEEP_PRICE,
    });
    const collectionMintOrder2 = await testEnv.wrap(mintCollection)({});

    expect(isEqual(collectionMintOrder1, collectionMintOrder2)).toBe(false);
    expect(collectionMintOrder1.payload.amount).toBe(collectionMintOrder2.payload.amount);

    await requestFundsFromFaucet(
      helper.network!,
      tmpAddress1.bech32,
      collectionMintOrder1.payload.amount,
    );
    await requestFundsFromFaucet(
      helper.network!,
      tmpAddress2.bech32,
      collectionMintOrder2.payload.amount,
    );

    const orders = [collectionMintOrder1, collectionMintOrder2];
    const promises = [tmpAddress1, tmpAddress2].map((address, i) =>
      helper.walletService!.send(
        address,
        orders[i].payload.targetAddress,
        orders[i].payload.amount,
        {},
      ),
    );
    await Promise.all(promises);

    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${helper.collection}`);
    let collection = <Collection>await collectionDocRef.get();
    await wait(async () => {
      collection = <Collection>await collectionDocRef.get();
      return collection.status === CollectionStatus.MINTED;
    });
    expect(collection.approved).toBe(true);

    const creditQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('payload.collection', '==', helper.collection);
    await wait(async () => {
      const snap = await creditQuery.get<Transaction>();
      const allConfirmed = snap.reduce(
        (acc, act) => acc && (act.payload?.walletReference?.confirmed || false),
        true,
      );
      return snap.length > 0 && allConfirmed;
    });
    const credits = (await creditQuery.get()).map((d) => <Transaction>d);
    expect(credits.length).toBe(1);

    const hasValidTargetAddress =
      credits[0].payload.targetAddress === tmpAddress1.bech32 ||
      credits[0].payload.targetAddress === tmpAddress2.bech32;
    expect(hasValidTargetAddress).toBe(true);
    expect(credits[0].payload.amount).toBe(collectionMintOrder1.payload.amount);
  });
});
