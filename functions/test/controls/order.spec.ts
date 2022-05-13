import dayjs from "dayjs";
import { TransactionType } from '../../../functions/interfaces/models';
import { COL } from '../../../functions/interfaces/models/base';
import { approveCollection, createCollection } from '../../../functions/src/controls/collection.control';
import { createNft } from '../../../functions/src/controls/nft.control';
import { createSpace } from '../../../functions/src/controls/space.control';
import { WenError } from "../../interfaces/errors";
import { Categories, Collection, CollectionAccess, CollectionType } from '../../interfaces/models/collection';
import { Member } from '../../interfaces/models/member';
import { Nft } from '../../interfaces/models/nft';
import { Space } from '../../interfaces/models/space';
import { TransactionOrder, TRANSACTION_AUTO_EXPIRY_MS } from '../../interfaces/models/transaction';
import admin from '../../src/admin.config';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { createMember } from './../../src/controls/member.control';
import { orderNft } from './../../src/controls/order.control';
import { milestoneProcessed, submitMilestoneFunc, submitMilestoneOutputsFunc, validateMemberAddressFunc, validateSpaceAddressFunc } from './common';

const db = admin.firestore();

let walletSpy: any;

const dummySpace = () => ({ name: 'Space A' });

const dummyCollection = (space: Space, type: CollectionType, ro: number, priceMi = 1, date: Date = dayjs().subtract(1, 'minute').toDate()) => ({
  name: 'Collection',
  description: 'babba',
  type,
  category: Categories.ART,
  access: CollectionAccess.OPEN,
  royaltiesFee: ro,
  space: space.uid,
  royaltiesSpace: space.uid,
  onePerMemberOnly: false,
  availableFrom: date,
  price: priceMi * 1000 * 1000
})

const dummyNft = (collection: Collection, priceMi = 10, date: Date = dayjs().subtract(1, 'minute').toDate()) => ({
  name: 'Collection A',
  description: 'babba',
  collection: collection.uid,
  availableFrom: date,
  price: priceMi * 1000 * 1000
})

const mockWalletReturn = <T,>(address: string, body: T) =>
  walletSpy.mockReturnValue(Promise.resolve({ address, body }));

const createMemberFunc = async () => {
  const dummyAddress = wallet.getRandomEthAddress();
  mockWalletReturn(dummyAddress, {});
  const member = await testEnv.wrap(createMember)(dummyAddress);
  expect(member?.uid).toEqual(dummyAddress.toLowerCase());
  return <Member>member;
}

const createSpaceFunc = async <T>(adr: string, params: T) => {
  mockWalletReturn(adr, params);
  const space = await testEnv.wrap(createSpace)({});
  expect(space?.uid).toBeDefined();
  return <Space>space;
}

const createCollectionFunc = async <T>(address: string, params: T) => {
  mockWalletReturn(address, params);
  const cCollection = await testEnv.wrap(createCollection)({});
  expect(cCollection?.uid).toBeDefined();

  mockWalletReturn(address, { uid: cCollection.uid });
  const apprCollection = await testEnv.wrap(approveCollection)({});
  expect(apprCollection?.uid).toBeDefined();
  return <Collection>cCollection;
}

const createNftFunc = async <T>(address: string, params: T) => {
  mockWalletReturn(address, params);
  const nft = await testEnv.wrap(createNft)({});
  expect(nft?.createdOn).toBeDefined();
  return <Nft>nft;
}

const submitOrderFunc = async <T>(address: string, params: T) => {
  mockWalletReturn(address, params);
  const order = await testEnv.wrap(orderNft)({});
  expect(order?.createdOn).toBeDefined();
  return order;
}

describe('Ordering flows', () => {
  jest.setTimeout(180000);
  let member: Member;
  let space: Space

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    member = await createMemberFunc();
    space = await createSpaceFunc(member.uid, dummySpace());
  });

  it('One collection, one classic NFT, one purchase - not paid for', async () => {
    const validationOrder = await validateSpaceAddressFunc(walletSpy, member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const validationOrderMember = await validateMemberAddressFunc(walletSpy, member.uid);
    const nextMilestone2 = await submitMilestoneFunc(validationOrderMember.payload.targetAddress, validationOrderMember.payload.amount);
    await milestoneProcessed(nextMilestone2.milestone, nextMilestone2.tranId);

    const price = 100;
    const collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.CLASSIC, 0.5, price));
    const nft = await createNftFunc(member.uid, dummyNft(collection, price));

    await submitOrderFunc(member.uid, { collection: collection.uid, nft: nft.uid });
  });

  it('One collection, one classic NFT, failed multiple purchase of same - not paid for', async () => {
    const validationOrder = await validateSpaceAddressFunc(walletSpy, member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const price = 100;
    const collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.CLASSIC, 0.5, price));
    const nft = await createNftFunc(member.uid, dummyNft(collection, price));

    const nftPurchase = { collection: collection.uid, nft: nft.uid };
    await submitOrderFunc(member.uid, nftPurchase);

    try {
      await submitOrderFunc(member.uid, nftPurchase);
      fail()
    } catch (e) {
      expect(e.details.code).toEqual(WenError.nft_locked_for_sale.code);
    }
  });

  it('One collection, one classic NFT, one purchase & paid for', async () => {
    // Validate space address.
    const validationOrder: TransactionOrder = await validateSpaceAddressFunc(walletSpy, member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    // Create collection.
    const price = 100;
    const collection: Collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.CLASSIC, 0.5, price));
    const nft: Nft = await createNftFunc(member.uid, dummyNft(collection, price));

    const order = await submitOrderFunc(member.uid, {
      collection: collection.uid,
      nft: nft.uid
    });

    // Confirm payment.
    const nextMilestone3 = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone3.milestone, nextMilestone3.tranId);

    const nftDbRec: any = await db.collection(COL.NFT).doc(nft.uid).get();
    expect(member.uid).toBe(nftDbRec.data().owner);
  });

  it('One collection, one classic NFT, one purchase & paid for and try again', async () => {
    // Validate space address.
    const validationOrder = await validateSpaceAddressFunc(walletSpy, member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    // Create collection.
    const price = 100;
    const collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.CLASSIC, 0.5, price));
    const nft = await createNftFunc(member.uid, dummyNft(collection, price));

    const order = await submitOrderFunc(member.uid, { collection: collection.uid, nft: nft.uid });

    // Confirm payment.
    const nextMilestone3 = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone3.milestone, nextMilestone3.tranId);

    const nftDbRec: any = await db.collection(COL.NFT).doc(nft.uid).get();
    expect(member.uid).toBe(nftDbRec.data().owner);

    try {
      await submitOrderFunc(member.uid, { collection: collection.uid, nft: nft.uid });
      fail()
    } catch (e) {
      expect(e.details.code).toEqual(WenError.nft_not_available_for_sale.code);
    }
  });

  it.skip('One collection, one classic NFT, failed to pay (expires)', async () => {
    // To do.
  });

  it.skip('One collection, one classic NFT, failed to pay (expires) + someone else try to buy', async () => {
    // To do.
  });

  it.skip('One collection, one classic NFT, failed to pay (expires) + someone else purchases', async () => {
    // To do.
  });

  it.skip('One collection, one classic NFT, wrong amount', async () => {
    // To do.
  });

  it('One collection, generated NFT, one purchase and pay', async () => {
    // Validate space address.
    const validationOrder = await validateSpaceAddressFunc(walletSpy, member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    // Create collection.
    const price = 100;
    const collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.GENERATED, 0.5, price));

    // It's randomly picked.
    await createNftFunc(member.uid, dummyNft(collection, price));
    await createNftFunc(member.uid, dummyNft(collection, price));

    const order = await submitOrderFunc(member.uid, { collection: collection.uid });

    // Confirm payment.
    const nextMilestone3 = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone3.milestone, nextMilestone3.tranId);

    const nftDbRec: any = await db.collection(COL.NFT).doc(order.payload.nft).get();
    expect(member.uid).toBe(nftDbRec.data().owner);
  });

  it('one collection, generated NFT, one purchase and pay - fail no longer available', async () => {
    // Validate space address.
    const validationOrder = await validateSpaceAddressFunc(walletSpy, member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    // Create collection.
    const price = 100;
    const collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.GENERATED, 0.5, price));

    // It's randomly picked.
    await createNftFunc(member.uid, dummyNft(collection, price));

    const order = await submitOrderFunc(member.uid, { collection: collection.uid });

    // Confirm payment.
    const nextMilestone3 = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone3.milestone, nextMilestone3.tranId);

    const nftDbRec: any = await db.collection(COL.NFT).doc(order.payload.nft).get();
    expect(member.uid).toBe(nftDbRec.data().owner);

    try {
      await submitOrderFunc(member.uid, { collection: collection.uid });
    } catch (e) {
      expect(e.details.code).toEqual(WenError.no_more_nft_available_for_sale.code);
    }
  });

  it('One collection, generated NFT, 15 Nfts should equal to 15 purchases', async () => {
    const batchSize = 15;
    const members: Member[] = [];
    for (let i = 0; i < batchSize; i++) {
      members.push(await createMemberFunc());
    }

    // Validate space address.
    const validationOrder = await validateSpaceAddressFunc(walletSpy, member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    // Create collection.
    const price = 100;
    const collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.GENERATED, 0.5, price));

    // It's randomly picked.
    for (let i = 0; i < batchSize; i++) {
      await createNftFunc(member.uid, dummyNft(collection, price));
    }

    for (let i = 0; i < batchSize; i++) {
      await submitOrderFunc(members[i].uid, { collection: collection.uid });
    }

    try {
      await submitOrderFunc(member.uid, { collection: collection.uid });
    } catch (e) {
      expect(e.details.code).toEqual(WenError.no_more_nft_available_for_sale.code);
    }
  });

  const batchSize = 5;
  it('One collection, generated NFT, ' + batchSize + ' Nfts should equal to ' + batchSize + ' purchases + payment in multiple milestone', async () => {
    const members: Member[] = [];
    for (let i = 0; i < batchSize; i++) {
      members.push(await createMemberFunc());
    }

    // Validate space address.
    const validationOrder = await validateSpaceAddressFunc(walletSpy, member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    // Create collection.
    const price = 100;
    const collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.GENERATED, 0.5, price));

    // It's randomly picked.
    for (let i = 0; i < batchSize; i++) {
      await createNftFunc(member.uid, dummyNft(collection, price));
    }

    const orders: TransactionOrder[] = [];
    for (let i = 0; i < batchSize; i++) {
      orders.push(await submitOrderFunc(members[i].uid, { collection: collection.uid }));
    }

    for (const o of orders) {
      const nextMilestone3 = await submitMilestoneOutputsFunc([{
        amount: o.payload.amount,
        address: o.payload.targetAddress
      }]);
      await milestoneProcessed(nextMilestone3.milestone, nextMilestone3.tranId);
    }

    // Validate each owner has the NFTs.
    for (let i = 0; i < batchSize; i++) {
      const nftDbRec: any = await db.collection(COL.NFT).where('owner', '==', members[i].uid).get();
      expect(nftDbRec.size).toEqual(1);
    }
  });

  it('One collection, generated NFT, one purchase for generated NFT directly. It must be sold.', async () => {
    const validationOrder = await validateSpaceAddressFunc(walletSpy, member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    // Create collection.
    const price = 100;
    const collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.GENERATED, 0.5, price));
    const nft = await createNftFunc(member.uid, dummyNft(collection, price));

    try {
      await submitOrderFunc(member.uid, { collection: collection.uid, nft: nft.uid });
    } catch (e) {
      expect(e.details.code).toEqual(WenError.generated_spf_nft_must_be_sold_first.code);
    }
  });

  it('One collection, generated NFT, over pay + credit should go back', async () => {
    const validationOrder = await validateSpaceAddressFunc(walletSpy, member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    const price = 100;
    const collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.GENERATED, 0.5, price));

    await createNftFunc(member.uid, dummyNft(collection, price));
    await createNftFunc(member.uid, dummyNft(collection, price));

    const order = await submitOrderFunc(member.uid, { collection: collection.uid });

    // Confirm payment.
    const wrongAmount = order.payload.amount * 1.5;
    const nextMilestone3 = await submitMilestoneFunc(order.payload.targetAddress, wrongAmount);
    await milestoneProcessed(nextMilestone3.milestone, nextMilestone3.tranId);

    const nftDbRec = await db.collection(COL.NFT).doc(order.payload.nft).get();
    expect(nftDbRec.data()?.sold).toBe(false);

    const tran = await db.collection(COL.TRANSACTION).doc(order.uid).get();
    expect(tran.data()?.linkedTransactions?.length).toBe(2);

    let c = 0;
    for (const t of (tran.data()?.linkedTransactions || [])) {
      const tr: any = await db.collection(COL.TRANSACTION).doc(t).get();
      if (tr.data().type === TransactionType.CREDIT) {
        c++;
        expect(tr.data().payload.targetAddress).toBe(nextMilestone3.fromAdd);
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
    const validationOrder = await validateSpaceAddressFunc(walletSpy, member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    // Create collection.
    const price = 100;
    const collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.GENERATED, 0.5, price));

    // It's randomly picked.
    await createNftFunc(member.uid, dummyNft(collection, price));
    await createNftFunc(member.uid, dummyNft(collection, price));

    const order = await submitOrderFunc(member.uid, {
      collection: collection.uid
    });

    // Confirm payment.
    const nextMilestone3 = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone3.milestone, nextMilestone3.tranId);

    const nftDbRec: any = await db.collection(COL.NFT).doc(order.payload.nft).get();
    expect(nftDbRec.data().sold).toBe(true);

    const tran: any = await db.collection(COL.TRANSACTION).doc(order.uid).get();
    expect(tran.data().linkedTransactions.length).toBe(3);

    let c = 0;
    for (const t of tran.data().linkedTransactions) {
      const tr: any = await db.collection(COL.TRANSACTION).doc(t).get();
      if (tr.data().type === TransactionType.BILL_PAYMENT) {
        c++;
        expect(tr.data().payload.amount).toBe(price / 2 * 1000 * 1000);
      }
    }
    expect(c).toBe(2);
  });

  // TODO
  it.skip('One collection, generated NFT, order and expect transaction to be voided. (cron test)', async () => {
    const validationOrder = await validateSpaceAddressFunc(walletSpy, member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone.milestone, nextMilestone.tranId);

    // Create collection.
    const price = 100;
    const collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.GENERATED, 0.5, price));

    // It's randomly picked.
    await createNftFunc(member.uid, dummyNft(collection, price));
    await createNftFunc(member.uid, dummyNft(collection, price));

    const order = await submitOrderFunc(member.uid, { collection: collection.uid });

    // Set pass date.
    await db.doc(`${COL.TRANSACTION}/${order.uid}`).update({
      createdOn: dateToTimestamp(dayjs().subtract(TRANSACTION_AUTO_EXPIRY_MS + 1, 'ms').toDate())
    });

    // Let's let it expire.
    const nextMilestone2 = await submitMilestoneFunc('abc', 13);
    await milestoneProcessed(nextMilestone2.milestone, nextMilestone2.tranId);

    const latestOrder: any = await db.doc(`${COL.TRANSACTION}/${order.uid}`).get();
    expect(latestOrder.data().payload.void).toBe(true);
  });

});
