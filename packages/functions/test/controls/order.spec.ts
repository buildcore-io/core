import { build5Db } from '@build-5/database';
import {
  Access,
  COL,
  Categories,
  Collection,
  CollectionType,
  MIN_IOTA_AMOUNT,
  NetworkAddress,
  Nft,
  NftAccess,
  SOON_PROJECT_ID,
  Space,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import {
  createNft,
  orderNft,
  setForSaleNft,
} from '../../../functions/src/runtime/firebase//nft/index';
import { createCollection } from '../../../functions/src/runtime/firebase/collection/index';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import {
  createMember,
  createSpace,
  expectThrow,
  mockIpCheck,
  mockWalletReturnValue,
  submitMilestoneFunc,
  wait,
} from './common';

const db = build5Db();

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

const createCollectionFunc = async <T>(address: NetworkAddress, params: T) => {
  mockWalletReturnValue(walletSpy, address, params);
  const cCollection = await testEnv.wrap(createCollection)({});
  expect(cCollection?.uid).toBeDefined();

  await build5Db()
    .doc(`${COL.COLLECTION}/${cCollection?.uid}`)
    .update({ approved: true });
  return <Collection>cCollection;
};

const createNftFunc = async <T>(address: NetworkAddress, params: T) => {
  mockWalletReturnValue(walletSpy, address, params);
  const nft = await testEnv.wrap(createNft)({});
  expect(nft?.createdOn).toBeDefined();
  return <Nft>nft;
};

const submitOrderFunc = async <T>(address: NetworkAddress, params: T) => {
  mockWalletReturnValue(walletSpy, address, params);
  const order = await testEnv.wrap(orderNft)({});
  expect(order?.createdOn).toBeDefined();
  return order;
};

const dummySaleData = (uid: string) => ({
  nft: uid,
  price: MIN_IOTA_AMOUNT,
  availableFrom: dayjs().toDate(),
  access: NftAccess.OPEN,
});

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

  it.each([false, true])(
    'One collection, one classic NFT, one purchase & paid for',
    async (noRoyaltySpace: boolean) => {
      const price = 100;
      let collection: Collection = await createCollectionFunc(
        member,
        dummyCollection(space, CollectionType.CLASSIC, 0.5, price),
      );
      if (noRoyaltySpace) {
        await build5Db()
          .doc(`${COL.COLLECTION}/${collection.uid}`)
          .update({ royaltiesSpace: '', royaltiesFee: 0 });
      }
      let nft: Nft = await createNftFunc(member, dummyNft(collection, price));

      const order = await submitOrderFunc(member, { collection: collection.uid, nft: nft.uid });
      expect(order.payload.restrictions.collection).toEqual({
        access: collection.access,
        accessAwards: collection.accessAwards || [],
        accessCollections: collection.accessCollections || [],
      });
      expect(order.payload.restrictions.nft).toEqual({
        saleAccess: nft.saleAccess || null,
        saleAccessMembers: nft.saleAccessMembers || [],
      });
      await submitMilestoneFunc(order);

      const nftDocRef = db.collection(COL.NFT).doc(nft.uid);
      nft = <Nft>await nftDocRef.get();
      expect(nft.owner).toBe(member);
      expect(nft.lastTradedOn).toBeDefined();
      expect(nft.totalTrades).toBe(1);

      const collectionDocRef = db.collection(COL.COLLECTION).doc(nft.collection);
      collection = <Collection>await collectionDocRef.get();
      expect(collection.lastTradedOn).toBeDefined();
      expect(collection.totalTrades).toBe(1);

      const billPayments = await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('payload.nft', '==', nft.uid)
        .get<Transaction>();
      for (const billPayment of billPayments) {
        expect(billPayment.payload.restrictions).toEqual(order.payload.restrictions);
      }
    },
  );

  it('Should not soldOn after nft is sold', async () => {
    const price = 100;
    let collection: Collection = await createCollectionFunc(
      member,
      dummyCollection(space, CollectionType.CLASSIC, 0.5, price),
    );
    let nft: Nft = await createNftFunc(member, dummyNft(collection, price));

    let order = await submitOrderFunc(member, { collection: collection.uid, nft: nft.uid });
    await submitMilestoneFunc(order);

    const nftDocRef = db.collection(COL.NFT).doc(nft.uid);
    nft = <Nft>await nftDocRef.get();
    expect(nft.soldOn).toBeDefined();

    mockWalletReturnValue(walletSpy, member, dummySaleData(nft.uid));
    await testEnv.wrap(setForSaleNft)({});

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const buyer = await createMember(walletSpy);
    order = await submitOrderFunc(buyer, { collection: collection.uid, nft: nft.uid });
    await submitMilestoneFunc(order);

    const secondSoldNft = <Nft>await nftDocRef.get();
    expect(secondSoldNft.soldOn).toEqual(nft.soldOn);
  });

  it('One collection, one classic NFT, one purchase & paid for and try again', async () => {
    const price = 100;
    const collection = await createCollectionFunc(
      member,
      dummyCollection(space, CollectionType.CLASSIC, 0.5, price),
    );
    const nft = await createNftFunc(member, dummyNft(collection, price));

    const order = await submitOrderFunc(member, { collection: collection.uid, nft: nft.uid });
    await submitMilestoneFunc(order);

    const nftDbRec: any = await db.collection(COL.NFT).doc(nft.uid).get();
    expect(member).toBe(nftDbRec.owner);

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
    await submitMilestoneFunc(order);

    const nftDbRec: any = await db.collection(COL.NFT).doc(order.payload.nft).get();
    expect(member).toBe(nftDbRec.owner);
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
    await submitMilestoneFunc(order);

    const nftDbRec: any = await db.collection(COL.NFT).doc(order.payload.nft).get();
    expect(member).toBe(nftDbRec.owner);

    await expectThrow(
      submitOrderFunc(member, { collection: collection.uid }),
      WenError.no_more_nft_available_for_sale.key,
    );

    const placeholderNftDocRef = build5Db().doc(`${COL.NFT}/${collection.placeholderNft}`);
    await wait(async () => {
      const placeholderNft = <Nft>await placeholderNftDocRef.get();
      return placeholderNft.hidden || false;
    });
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

      const orders: Transaction[] = [];
      for (let i = 0; i < batchSize; i++) {
        orders.push(await submitOrderFunc(members[i], { collection: collection.uid }));
      }

      for (const o of orders) {
        await submitMilestoneFunc(o);
      }

      // Validate each owner has the NFTs.
      for (let i = 0; i < batchSize; i++) {
        const nftDbRec = await db.collection(COL.NFT).where('owner', '==', members[i]).get();
        expect(nftDbRec.length).toEqual(1);
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
    const milestone = await submitMilestoneFunc(order, wrongAmount);

    const nftDbRec = await db.collection(COL.NFT).doc(order.payload.nft).get<Nft>();
    expect(nftDbRec?.sold).toBe(false);

    const tran = await db.collection(COL.TRANSACTION).doc(order.uid).get<Transaction>();
    expect(tran?.linkedTransactions?.length).toBe(2);

    let c = 0;
    for (const t of tran?.linkedTransactions || []) {
      const tr: any = await db.collection(COL.TRANSACTION).doc(t).get();
      if (tr.type === TransactionType.CREDIT) {
        c++;
        expect(tr.payload.targetAddress).toBe(milestone.fromAdd);
        expect(tr.payload.amount).toBe(wrongAmount);
      }

      if (tr.type === TransactionType.PAYMENT) {
        c++;
        expect(tr.payload.targetAddress).toBe(order.payload.targetAddress);
        expect(tr.payload.amount).toBe(wrongAmount);
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

    await submitMilestoneFunc(order);

    const nftDbRec: any = await db.collection(COL.NFT).doc(order.payload.nft).get();
    expect(nftDbRec.sold).toBe(true);

    const tran: any = await db.collection(COL.TRANSACTION).doc(order.uid).get();
    expect(tran.linkedTransactions.length).toBe(3);

    let c = 0;
    for (const t of tran.linkedTransactions) {
      const tr: any = await db.collection(COL.TRANSACTION).doc(t).get();
      if (tr.type === TransactionType.BILL_PAYMENT) {
        c++;
        expect(tr.payload.amount).toBe((price / 2) * 1000 * 1000);
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

  it('Order should fail, country blocked for nft', async () => {
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

  it('Should validate access awards', async () => {
    const awards = Array.from(Array(2)).map(() => wallet.getRandomEthAddress());
    const collection = await createCollectionFunc(member, {
      ...dummyCollection(space, CollectionType.CLASSIC, 0.5, 100),
      access: Access.MEMBERS_WITH_BADGE,
      accessAwards: awards,
    });

    const nft = await createNftFunc(member, dummyNft(collection, 100));
    await expectThrow(
      submitOrderFunc(member, { collection: collection.uid, nft: nft.uid }),
      WenError.you_dont_have_required_badge.key,
    );

    let badge = {
      project: SOON_PROJECT_ID,
      member,
      type: TransactionType.AWARD,
      uid: wallet.getRandomEthAddress(),
      payload: { type: TransactionPayloadType.BADGE, award: awards[0] },
    };
    await build5Db().doc(`${COL.TRANSACTION}/${badge.uid}`).create(badge);
    await expectThrow(
      submitOrderFunc(member, { collection: collection.uid, nft: nft.uid }),
      WenError.you_dont_have_required_badge.key,
    );

    badge = {
      project: SOON_PROJECT_ID,
      member,
      type: TransactionType.AWARD,
      uid: wallet.getRandomEthAddress(),
      payload: { type: TransactionPayloadType.BADGE, award: awards[1] },
    };
    await build5Db().doc(`${COL.TRANSACTION}/${badge.uid}`).create(badge);
    const order = await submitOrderFunc(member, { collection: collection.uid, nft: nft.uid });
    expect(order).toBeDefined();
    expect(order.payload.restrictions.collection).toEqual({
      access: collection.access,
      accessAwards: collection.accessAwards || [],
      accessCollections: collection.accessCollections || [],
    });
    expect(order.payload.restrictions.nft).toEqual({
      saleAccess: nft.saleAccess || null,
      saleAccessMembers: nft.saleAccessMembers || [],
    });
  });
});
