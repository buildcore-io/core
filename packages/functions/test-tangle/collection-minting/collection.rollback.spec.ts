import {
  COL,
  Collection,
  CollectionStatus,
  Member,
  Network,
  Transaction,
  TransactionMintCollectionType,
  TransactionType,
} from '@soonaverse/interfaces';
import { rollbackCollectionMint } from '../../src/dbUpgrade/roll.collection';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { getAddress } from '../../src/utils/address.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { wait } from '../../test/controls/common';
import { CollectionMintHelper } from './Helper';

describe('Collection minting', () => {
  const helper = new CollectionMintHelper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should rollback_collection', async () => {
    const count = 5;
    const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${helper.collection}`);
    await collectionDocRef.update({ total: count });
    const promises = Array.from(Array(count)).map(() => {
      const nft = helper.createDummyNft(helper.collection!);
      return soonDb().doc(`${COL.NFT}/${nft.uid}`).create(nft);
    });
    await Promise.all(promises);
    await helper.mintCollection();

    const sendToGuardianQUery = soonDb()
      .collection(COL.TRANSACTION)
      .where('payload.type', '==', TransactionMintCollectionType.SEND_ALIAS_TO_GUARDIAN);
    await wait(async () => {
      const snap = await sendToGuardianQUery.get<Transaction>();
      return snap.length === 1 && snap[0].payload?.walletReference?.confirmed;
    });

    const collection = <Collection>await collectionDocRef.get();

    const guardianDocRef = soonDb().doc(`${COL.MEMBER}/${helper.guardian}`);
    const guardian = <Member>await guardianDocRef.get();
    const order = <Transaction>{
      type: TransactionType.MINT_COLLECTION,
      uid: getRandomEthAddress(),
      member: '',
      space: '',
      network: Network.RMS,
      payload: {
        type: TransactionMintCollectionType.SEND_ALIAS_TO_GUARDIAN,
        amount: collection.mintingData?.aliasStorageDeposit,
        sourceAddress: getAddress(guardian, collection.mintingData?.network!),
        targetAddress: collection.mintingData?.address,
        collection: collection.uid,
        lockCollectionNft: collection.limitedEdition || false,
      },
    };
    const returnOrderDocRef = soonDb().doc(`${COL.TRANSACTION}/${order.uid}`);
    await returnOrderDocRef.create(order);
    await wait(async () => {
      const snap = await sendToGuardianQUery.get<Transaction>();
      return (
        snap.length === 2 &&
        snap[0].payload?.walletReference?.confirmed &&
        snap[1].payload?.walletReference?.confirmed
      );
    });

    const req = { body: { collectionId: helper.collection! } } as any;
    const res = { send: (body: any) => {} } as any;
    await rollbackCollectionMint(req, res);

    await wait(async () => {
      const data = <Collection>await collectionDocRef.get();
      return data.status === CollectionStatus.MINTING;
    });
    await wait(async () => {
      const data = <Collection>await collectionDocRef.get();
      return data.status === CollectionStatus.MINTED;
    });
  });
});
