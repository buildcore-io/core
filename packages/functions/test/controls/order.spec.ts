import {
  Access,
  Categories,
  COL,
  Collection,
  CollectionType,
  Nft,
  Space,
  TransactionOrder,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { createNft } from '../../../functions/src/controls//nft/nft.control';
import {
  approveCollection,
  createCollection,
} from '../../../functions/src/controls/collection.control';
import admin from '../../src/admin.config';
import { orderNft } from '../../src/controls/nft/nft.puchase.control';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import {
  createMember,
  createSpace,
  expectThrow,
  milestoneProcessed,
  mockIpCheck,
  mockWalletReturnValue,
  submitMilestoneFunc,
  submitMilestoneOutputsFunc,
} from './common';

const db = admin.firestore();

let walletSpy: any;

const dummyCollection = (
  space: Space,
  type: CollectionType,
  ro: number,
  priceMi = 1,
  date: Date = dayjs().subtract(1, 'minute').toDate(),
) => ({
  name: 'Collection',
  description: 'babba',
  type,
  category: Categories.ART,
  access: Access.OPEN,
  royaltiesFee: ro,
  space: space.uid,
  royaltiesSpace: space.uid,
  onePerMemberOnly: false,
  availableFrom: date,
  price: priceMi * 1000 * 1000,
});

const dummyNft = (
  collection: Collection,
  priceMi = 10,
  date: Date = dayjs().subtract(1, 'minute').toDate(),
) => ({
  name: 'Collection A',
  description: 'babba',
  collection: collection.uid,
  availableFrom: date,
  price: priceMi * 1000 * 1000,
});

const createCollectionFunc = async <T>(address: string, params: T) => {
  mockWalletReturnValue(walletSpy, address, params);
  const cCollection = await testEnv.wrap(createCollection)({});
  expect(cCollection?.uid).toBeDefined();

  mockWalletReturnValue(walletSpy, address, { uid: cCollection.uid });
  const apprCollection = await testEnv.wrap(approveCollection)({});
  expect(apprCollection?.uid).toBeDefined();
  return <Collection>cCollection;
};

const createNftFunc = async <T>(address: string, params: T) => {
  mockWalletReturnValue(walletSpy, address, params);
  const nft = await testEnv.wrap(createNft)({});
  expect(nft?.createdOn).toBeDefined();
  return <Nft>nft;
};

const submitOrderFunc = async <T>(address: string, params: T) => {
  mockWalletReturnValue(walletSpy, address, params);
  const order = await testEnv.wrap(orderNft)({});
  expect(order?.createdOn).toBeDefined();
  return order;
};

describe('Ordering flows', () => {
  let member: string;
  let space: Space;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    member = await createMember(walletSpy);
    space = await createSpace(walletSpy, member);
  });

  it('One collection, one classic NFT, one purchase - not paid for', async () => {
    const price = 100;
    const collection = await createCollectionFunc(
      member,
      dummyCollection(space, CollectionType.CLASSIC, 0.5, price),
    );
    const nft = await createNftFunc(member, dummyNft(collection, price));
    await submitOrderFunc(member, { collection: collection.uid, nft: nft.uid });
  });

  it('One collection, one classic NFT, failed multiple purchase of same - not paid for', async () => {
    const price = 100;
    const collection = await createCollectionFunc(
      member,
      dummyCollection(space, CollectionType.CLASSIC, 0.5, price),
    );
    const nft = await createNftFunc(member, dummyNft(collection, price));

    const nftPurchase = { collection: collection.uid, nft: nft.uid };
    await submitOrderFunc(member, nftPurchase);

    await expectThrow(submitOrderFunc(member, nftPurchase), WenError.nft_locked_for_sale.key);
  });

  it('One collection, one classic NFT, one purchase & paid for', async () => {
    // Create collection.
    const price = 100;
    const collection: Collection = await createCollectionFunc(
      member,
      dummyCollection(space, CollectionType.CLASSIC, 0.5, price),
    );
    const nft: Nft = await createNftFunc(member, dummyNft(collection, price));

    const order = await submitOrderFunc(member, { collection: collection.uid, nft: nft.uid });
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    const nftDbRec: any = await db.collection(COL.NFT).doc(nft.uid).get();
    expect(member).toBe(nftDbRec.data().owner);
  });

  it('One collection, one classic NFT, one purchase & paid for and try again', async () => {
    const price = 100;
    const collection = await createCollectionFunc(
      member,
      dummyCollection(space, CollectionType.CLASSIC, 0.5, price),
    );
    const nft = await createNftFunc(member, dummyNft(collection, price));

    const order = await submitOrderFunc(member, { collection: collection.uid, nft: nft.uid });
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    const nftDbRec: any = await db.collection(COL.NFT).doc(nft.uid).get();
    expect(member).toBe(nftDbRec.data().owner);

    await expectThrow(
      submitOrderFunc(member, { collection: collection.uid, nft: nft.uid }),
      WenError.nft_not_available_for_sale.key,
    );
  });

  it('One collection, generated NFT, one purchase and pay', async () => {
    const price = 100;
    const collection = await createCollectionFunc(
      member,
      dummyCollection(space, CollectionType.GENERATED, 0.5, price),
    );
    // It's randomly picked.
    await createNftFunc(member, dummyNft(collection, price));
    await createNftFunc(member, dummyNft(collection, price));

    const order = await submitOrderFunc(member, { collection: collection.uid });
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    const nftDbRec: any = await db.collection(COL.NFT).doc(order.payload.nft).get();
    expect(member).toBe(nftDbRec.data().owner);
  });

  it('one collection, generated NFT, one purchase and pay - fail no longer available', async () => {
    const price = 100;
    const collection = await createCollectionFunc(
      member,
      dummyCollection(space, CollectionType.GENERATED, 0.5, price),
    );

    // It's randomly picked.
    await createNftFunc(member, dummyNft(collection, price));

    const order = await submitOrderFunc(member, { collection: collection.uid });
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    const nftDbRec: any = await db.collection(COL.NFT).doc(order.payload.nft).get();
    expect(member).toBe(nftDbRec.data().owner);

    await expectThrow(
      submitOrderFunc(member, { collection: collection.uid }),
      WenError.no_more_nft_available_for_sale.key,
    );
  });

  it('One collection, generated NFT, 15 Nfts should equal to 15 purchases', async () => {
    const batchSize = 15;
    const memberPromises = Array.from(Array(batchSize)).map(() => createMember(walletSpy));
    const members = await Promise.all(memberPromises);

    const price = 100;
    const collection = await createCollectionFunc(
      member,
      dummyCollection(space, CollectionType.GENERATED, 0.5, price),
    );

    // It's randomly picked.
    for (let i = 0; i < batchSize; i++) {
      await createNftFunc(member, dummyNft(collection, price));
    }

    for (let i = 0; i < batchSize; i++) {
      await submitOrderFunc(members[i], { collection: collection.uid });
    }

    await expectThrow(
      submitOrderFunc(member, { collection: collection.uid }),
      WenError.no_more_nft_available_for_sale.key,
    );
  });

  const batchSize = 5;
  it(
    'One collection, generated NFT, ' +
      batchSize +
      ' Nfts should equal to ' +
      batchSize +
      ' purchases + payment in multiple milestone',
    async () => {
      const memberPromises = Array.from(Array(batchSize)).map(() => createMember(walletSpy));
      const members = await Promise.all(memberPromises);

      const price = 100;
      const collection = await createCollectionFunc(
        member,
        dummyCollection(space, CollectionType.GENERATED, 0.5, price),
      );

      // It's randomly picked.
      for (let i = 0; i < batchSize; i++) {
        await createNftFunc(member, dummyNft(collection, price));
      }

      const orders: TransactionOrder[] = [];
      for (let i = 0; i < batchSize; i++) {
        orders.push(await submitOrderFunc(members[i], { collection: collection.uid }));
      }

      for (const o of orders) {
        const milestone = await submitMilestoneOutputsFunc([
          { amount: o.payload.amount, address: o.payload.targetAddress },
        ]);
        await milestoneProcessed(milestone.milestone, milestone.tranId);
      }

      // Validate each owner has the NFTs.
      for (let i = 0; i < batchSize; i++) {
        const nftDbRec: any = await db.collection(COL.NFT).where('owner', '==', members[i]).get();
        expect(nftDbRec.size).toEqual(1);
      }
    },
  );

  it('One collection, generated NFT, one purchase for generated NFT directly. It must be sold.', async () => {
    const price = 100;
    const collection = await createCollectionFunc(
      member,
      dummyCollection(space, CollectionType.GENERATED, 0.5, price),
    );
    const nft = await createNftFunc(member, dummyNft(collection, price));
    await expectThrow(
      submitOrderFunc(member, { collection: collection.uid, nft: nft.uid }),
      WenError.generated_spf_nft_must_be_sold_first.key,
    );
  });

  it('One collection, generated NFT, over pay + credit should go back', async () => {
    const price = 100;
    const collection = await createCollectionFunc(
      member,
      dummyCollection(space, CollectionType.GENERATED, 0.5, price),
    );

    await createNftFunc(member, dummyNft(collection, price));
    await createNftFunc(member, dummyNft(collection, price));

    const order = await submitOrderFunc(member, { collection: collection.uid });

    // Confirm payment.
    const wrongAmount = order.payload.amount * 1.5;
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, wrongAmount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    const nftDbRec = await db.collection(COL.NFT).doc(order.payload.nft).get();
    expect(nftDbRec.data()?.sold).toBe(false);

    const tran = await db.collection(COL.TRANSACTION).doc(order.uid).get();
    expect(tran.data()?.linkedTransactions?.length).toBe(2);

    let c = 0;
    for (const t of tran.data()?.linkedTransactions || []) {
      const tr: any = await db.collection(COL.TRANSACTION).doc(t).get();
      if (tr.data().type === TransactionType.CREDIT) {
        c++;
        expect(tr.data().payload.targetAddress).toBe(milestone.fromAdd);
        expect(tr.data().payload.amount).toBe(wrongAmount);
      }

      if (tr.data().type === TransactionType.PAYMENT) {
        c++;
        expect(tr.data().payload.targetAddress).toBe(order.payload.targetAddress);
        expect(tr.data().payload.amount).toBe(wrongAmount);
      }
    }

    expect(c).toBe(2);
  });

  it('One collection, generated NFT, pay + validate bill / royalty', async () => {
    const price = 100;
    const collection = await createCollectionFunc(
      member,
      dummyCollection(space, CollectionType.GENERATED, 0.5, price),
    );

    // It's randomly picked.
    await createNftFunc(member, dummyNft(collection, price));
    await createNftFunc(member, dummyNft(collection, price));

    const order = await submitOrderFunc(member, {
      collection: collection.uid,
    });

    // Confirm payment.
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    const nftDbRec: any = await db.collection(COL.NFT).doc(order.payload.nft).get();
    expect(nftDbRec.data().sold).toBe(true);

    const tran: any = await db.collection(COL.TRANSACTION).doc(order.uid).get();
    expect(tran.data().linkedTransactions.length).toBe(3);

    let c = 0;
    for (const t of tran.data().linkedTransactions) {
      const tr: any = await db.collection(COL.TRANSACTION).doc(t).get();
      if (tr.data().type === TransactionType.BILL_PAYMENT) {
        c++;
        expect(tr.data().payload.amount).toBe((price / 2) * 1000 * 1000);
      }
    }
    expect(c).toBe(2);
  });

  it('Order should fail, country blocked by default', async () => {
    const price = 100;
    const collection = await createCollectionFunc(
      member,
      dummyCollection(space, CollectionType.CLASSIC, 0.5, price),
    );
    const nft = await createNftFunc(member, dummyNft(collection, price));
    mockIpCheck(true, { common: ['HU'] }, { countryCode: 'HU' });
    await expectThrow(
      submitOrderFunc(member, { collection: collection.uid, nft: nft.uid }),
      WenError.blocked_country.key,
    );
  });

  it('Order should fail, country blocked for token', async () => {
    const price = 100;
    const collection = await createCollectionFunc(
      member,
      dummyCollection(space, CollectionType.CLASSIC, 0.5, price),
    );
    const nft = await createNftFunc(member, dummyNft(collection, price));
    mockIpCheck(true, { common: ['USA'], [nft.uid]: ['USA', 'HU'] }, { countryCode: 'HU' });
    await expectThrow(
      submitOrderFunc(member, { collection: collection.uid, nft: nft.uid }),
      WenError.blocked_country.key,
    );
  });
});
