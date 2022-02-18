import dayjs from "dayjs";
import * as admin from 'firebase-admin';
import { TransactionOrderType, TransactionType } from '../../../functions/interfaces/models';
import { COL } from '../../../functions/interfaces/models/base';
import { approveCollection, createCollection } from '../../../functions/src/controls/collection.control';
import { createNft } from '../../../functions/src/controls/nft.control';
import { createSpace } from '../../../functions/src/controls/space.control';
import { WenError } from "../../interfaces/errors";
import { Categories, Collection, CollectionType } from '../../interfaces/models/collection';
import { Member } from '../../interfaces/models/member';
import { Nft } from '../../interfaces/models/nft';
import { Space } from '../../interfaces/models/space';
import { TransactionOrder, TRANSACTION_AUTO_EXPIRY_MS } from '../../interfaces/models/transaction';
import { dateToTimestamp, serverTime } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { createMember } from './../../src/controls/member.control';
import { orderNft, validateAddress } from './../../src/controls/order.control';

const db = admin.firestore();

describe.skip('Ordering flows', () => {
  let walletSpy: any;
  const defaultFromAddress = '1qqsye008z79vj9p9ywzw65ed2xn4yxe9zfp9jqgw0gthxydxpa03qx32mhz';
  jest.setTimeout(180000);
  const mocker = (adr: string, params: any) => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: adr,
      body: params
    }));
  }

  const milestoneProcessed = async (nextMilestone: string) => {
    let processed: any = false;
    for (let attempt = 0; attempt < 100; ++attempt) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 500));
        }
        try {
          const rec: any = await db.collection(COL.MILESTONE).doc(nextMilestone).get();
          if (rec.data().processed === true) {
            processed = true;
          }

          if (!processed) {
            throw new Error();
          }
          return; // It worked
        } catch {
          // none.
        }
    }
    // Out of retries
    throw new Error("Milestone was not processed. Id: " + nextMilestone);
  }

  const createMemberFunc = async () => {
    const dummyAddress: string = wallet.getRandomEthAddress();
    mocker(dummyAddress, {});
    const wCreate: any = testEnv.wrap(createMember);
    const member: any = await wCreate(dummyAddress);
    expect(member?.uid).toEqual(dummyAddress.toLowerCase());
    return member;
  }

  const createSpaceFunc = async (adr: string, params: any) => {
    mocker(adr, params);
    const wrappedSpace: any = testEnv.wrap(createSpace);
    const space: any = await wrappedSpace();
    expect(space?.uid).toBeDefined();
    return space;
  }

  const validateSpaceAddressFunc = async (adr: string, spaceId: string) => {
    mocker(adr, {
      space: spaceId
    });
    const wrappedOrder: any = testEnv.wrap(validateAddress);
    const order: any = await wrappedOrder();
    expect(order?.type).toBe(TransactionType.ORDER);
    expect(order?.payload.type).toBe(TransactionOrderType.SPACE_ADDRESS_VALIDATION);
    return order;
  }

  const validateMemberAddressFunc = async (adr: string) => {
    mocker(adr, {});
    const wrappedOrder: any = testEnv.wrap(validateAddress);
    const order: any = await wrappedOrder();
    expect(order?.type).toBe(TransactionType.ORDER);
    expect(order?.payload.type).toBe(TransactionOrderType.MEMBER_ADDRESS_VALIDATION);
    return order;
  }

  const submitMilestoneFunc = async (adr: string, amount: number) => {
    return submitMilestoneOutputsFunc([{
      address: adr,
      amount: amount
    }]);
  }

  const submitMilestoneOutputsFunc = async (outputs: any[]) => {
    // Create milestone to process my validation.
    const allMil = await db.collection(COL.MILESTONE).get();
    const nextMilestone = (allMil.size + 1).toString();
    await db.collection(COL.MILESTONE).doc(nextMilestone)
    .collection('transactions').doc('9ae738e06688d9fbdfaf172e80c92e9da3174d541f9cc28503c826fcf679b251')
    .set({
      createdOn: serverTime(),
      inputs: [{
        address: defaultFromAddress,
        amount: 123
      }],
      outputs: outputs
    });
    await db.collection(COL.MILESTONE).doc(nextMilestone).set({ completed: true });
    return nextMilestone;
}

  const createCollectionFunc = async (adr: string, params: any) => {
    mocker(adr, params);
    const wrapped: any = testEnv.wrap(createCollection);
    const returns = await wrapped();
    expect(returns?.uid).toBeDefined();

    mocker(adr, {
      uid: returns.uid
    });
    const wrapped2: any = testEnv.wrap(approveCollection);
    const returns2 = await wrapped2();
    expect(returns2?.uid).toBeDefined();

    return returns;
  }

  const createNftFunc = async (adr: string, params: any) => {
    mocker(adr, params);
    const wrapped: any = testEnv.wrap(createNft);
    const returns = await wrapped();
    expect(returns?.createdOn).toBeDefined();
    return returns;
  }

  const submitOrderFunc = async (adr: string, params: any) => {
    mocker(adr, params);
    const wrapped: any = testEnv.wrap(orderNft);
    const returns = await wrapped();
    expect(returns?.createdOn).toBeDefined();
    return returns;
  }

  const dummySpace = () => {
    return {
      name: 'Space A'
    };
  }

  const dummyCollection = (space: Space, type: CollectionType, ro: number, priceMi = 1, date: Date = dayjs().subtract(1, 'minute').toDate()) => {
    return {
      name: 'Collection',
      description: 'babba',
      type: type,
      category: Categories.ART,
      royaltiesFee: ro,
      space: space.uid,
      royaltiesSpace: space.uid,
      availableFrom: date,
      price: priceMi * 1000 * 1000
    };
  }

  const dummyNft = (collection: Collection, priceMi = 10, date: Date = dayjs().subtract(1, 'minute').toDate()) => {
    return {
      name: 'Collection A',
      description: 'babba',
      collection: collection.uid,
      availableFrom: date,
      price: priceMi * 1000 * 1000
    };
  }

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
  });

  it('One collection, one classic NFT, one purchase - not paid for', async () => {
    const member: Member = await createMemberFunc();
    const space: Space = await createSpaceFunc(member.uid, dummySpace());

    // Validate space address.
    const validationOrder: TransactionOrder = await validateSpaceAddressFunc(member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone);

    // Validate member address
    const validationOrderMember: TransactionOrder = await validateMemberAddressFunc(member.uid);
    const nextMilestone2 = await submitMilestoneFunc(validationOrderMember.payload.targetAddress, validationOrderMember.payload.amount);
    await milestoneProcessed(nextMilestone2);

    // Create collection.
    const price = 100;
    const collection: Collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.CLASSIC, 0.5, price));
    const nft: Nft = await createNftFunc(member.uid, dummyNft(collection, price));

    await submitOrderFunc(member.uid, {
      collection: collection.uid,
      nft: nft.uid
    });
  });

  it('One collection, one classic NFT, failed multiple purchase of same - not paid for', async () => {
    const member: Member = await createMemberFunc();
    const space: Space = await createSpaceFunc(member.uid, dummySpace());

    // Validate space address.
    const validationOrder: TransactionOrder = await validateSpaceAddressFunc(member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone);

    // Create collection.
    const price = 100;
    const collection: Collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.CLASSIC, 0.5, price));
    const nft: Nft = await createNftFunc(member.uid, dummyNft(collection, price));

    const nftPurchase: any = {
      collection: collection.uid,
      nft: nft.uid
    };
    await submitOrderFunc(member.uid, nftPurchase);

    let err = 0;
    try {
      await submitOrderFunc(member.uid, nftPurchase);
    } catch (e) {
      err = e.details.code;
    }

    // NFT Locked.
    expect(err).toEqual(WenError.nft_locked_for_sale.code);
  });

  it('One collection, one classic NFT, one purchase & paid for', async () => {
    const member: Member = await createMemberFunc();
    const space: Space = await createSpaceFunc(member.uid, dummySpace());

    // Validate space address.
    const validationOrder: TransactionOrder = await validateSpaceAddressFunc(member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone);

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
    await milestoneProcessed(nextMilestone3);

    const nftDbRec: any = await db.collection(COL.NFT).doc(nft.uid).get();
    expect(member.uid).toBe(nftDbRec.data().owner);
  });

  it('One collection, one classic NFT, one purchase & paid for and try again', async () => {
    const member: Member = await createMemberFunc();
    const space: Space = await createSpaceFunc(member.uid, dummySpace());

    // Validate space address.
    const validationOrder: TransactionOrder = await validateSpaceAddressFunc(member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone);

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
    await milestoneProcessed(nextMilestone3);

    const nftDbRec: any = await db.collection(COL.NFT).doc(nft.uid).get();
    expect(member.uid).toBe(nftDbRec.data().owner);

    let err = 0;
    try {
      // Try order again.
      await submitOrderFunc(member.uid, {
        collection: collection.uid,
        nft: nft.uid
      });
    } catch (e) {
      err = e.details.code;
    }

    // NFT No longer available.
    expect(err).toEqual(WenError.nft_not_available_for_sale.code);
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
    const member: Member = await createMemberFunc();
    const space: Space = await createSpaceFunc(member.uid, dummySpace());

    // Validate space address.
    const validationOrder: TransactionOrder = await validateSpaceAddressFunc(member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone);

    // Create collection.
    const price = 100;
    const collection: Collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.GENERATED, 0.5, price));

    // It's randomly picked.
    await createNftFunc(member.uid, dummyNft(collection, price));
    await createNftFunc(member.uid, dummyNft(collection, price));

    const order = await submitOrderFunc(member.uid, {
      collection: collection.uid
    });

    // Confirm payment.
    const nextMilestone3 = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone3);

    const nftDbRec: any = await db.collection(COL.NFT).doc(order.payload.nft).get();
    expect(member.uid).toBe(nftDbRec.data().owner);
  });

  it('one collection, generated NFT, one purchase and pay - fail no longer available', async () => {
    const member: Member = await createMemberFunc();
    const space: Space = await createSpaceFunc(member.uid, dummySpace());

    // Validate space address.
    const validationOrder: TransactionOrder = await validateSpaceAddressFunc(member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone);

    // Create collection.
    const price = 100;
    const collection: Collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.GENERATED, 0.5, price));

    // It's randomly picked.
    await createNftFunc(member.uid, dummyNft(collection, price));

    const order = await submitOrderFunc(member.uid, {
      collection: collection.uid
    });

    // Confirm payment.
    const nextMilestone3 = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone3);

    const nftDbRec: any = await db.collection(COL.NFT).doc(order.payload.nft).get();
    expect(member.uid).toBe(nftDbRec.data().owner);

    let err = 0;
    try {
      // Try order again.
      await submitOrderFunc(member.uid, {
        collection: collection.uid
      });
    } catch (e) {
      err = e.details.code;
    }

    // NFT No longer available.
    expect(err).toEqual(WenError.no_more_nft_available_for_sale.code);
  });

  it('One collection, generated NFT, 15 Nfts should equal to 15 purchases', async () => {
    const member: Member = await createMemberFunc();
    const space: Space = await createSpaceFunc(member.uid, dummySpace());

    // Validate space address.
    const validationOrder: TransactionOrder = await validateSpaceAddressFunc(member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone);

    // Create collection.
    const price = 100;
    const collection: Collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.GENERATED, 0.5, price));

    // It's randomly picked.
    for (let i = 0; i < 15; i++) {
      await createNftFunc(member.uid, dummyNft(collection, price));
    }

    for (let i = 0; i < 15; i++) {
      await submitOrderFunc(member.uid, {
        collection: collection.uid
      });
    }

    let err = 0;
    try {
      // Try order again.
      await submitOrderFunc(member.uid, {
        collection: collection.uid
      });
    } catch (e) {
      err = e.details.code;
    }

    // NFT No longer available.
    expect(err).toEqual(WenError.no_more_nft_available_for_sale.code);
  });

  const batchSize = 5;
  it('One collection, generated NFT, ' + batchSize + ' Nfts should equal to ' + batchSize + ' purchases + payment in one BIG milestone', async () => {
    const member: Member = await createMemberFunc();
    const space: Space = await createSpaceFunc(member.uid, dummySpace());

    // Validate space address.
    const validationOrder: TransactionOrder = await validateSpaceAddressFunc(member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone);

    // Create collection.
    const price = 100;
    const collection: Collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.GENERATED, 0.5, price));

    // It's randomly picked.
    for (let i = 0; i < batchSize; i++) {
      await createNftFunc(member.uid, dummyNft(collection, price));
    }

    const orders: TransactionOrder[] = [];
    for (let i = 0; i < batchSize; i++) {
      orders.push(await submitOrderFunc(member.uid, {
        collection: collection.uid
      }));
    }

    // submitMilestoneOutputsFunc
    const outputs: any[] = orders.map((o) => {
      return {
        amount: o.payload.amount,
        address: o.payload.targetAddress
      };
    });

    const nextMilestone3 = await submitMilestoneOutputsFunc(outputs);
    await milestoneProcessed(nextMilestone3);

    // Validate owner has all the NFTs.
    const nftDbRec: any = await db.collection(COL.NFT).where('owner', '==', member.uid).get();
    expect(nftDbRec.size).toEqual(batchSize);
  });

  it('One collection, generated NFT, one purchase for generated NFT directly. It must be sold.', async () => {
    const member: Member = await createMemberFunc();
    const space: Space = await createSpaceFunc(member.uid, dummySpace());

    // Validate space address.
    const validationOrder: TransactionOrder = await validateSpaceAddressFunc(member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone);

    // Create collection.
    const price = 100;
    const collection: Collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.GENERATED, 0.5, price));
    const nft: Nft = await createNftFunc(member.uid, dummyNft(collection, price));

    let err = 0;
    try {
      // Try order again.
      await submitOrderFunc(member.uid, {
        collection: collection.uid,
        nft: nft.uid
      });
    } catch (e) {
      err = e.details.code;
    }

    // NFT No longer available.
    expect(err).toEqual(WenError.generated_spf_nft_must_be_sold_first.code);
  });

  it('One collection, generated NFT, over pay + credit should go back', async () => {
    const member: Member = await createMemberFunc();
    const space: Space = await createSpaceFunc(member.uid, dummySpace());

    // Validate space address.
    const validationOrder: TransactionOrder = await validateSpaceAddressFunc(member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone);

    // Create collection.
    const price = 100;
    const collection: Collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.GENERATED, 0.5, price));

    // It's randomly picked.
    await createNftFunc(member.uid, dummyNft(collection, price));
    await createNftFunc(member.uid, dummyNft(collection, price));

    const order = await submitOrderFunc(member.uid, {
      collection: collection.uid
    });

    // Confirm payment.
    const wrongAmount = order.payload.amount * 1.5;
    const nextMilestone3 = await submitMilestoneFunc(order.payload.targetAddress, wrongAmount);
    await milestoneProcessed(nextMilestone3);

    const nftDbRec: any = await db.collection(COL.NFT).doc(order.payload.nft).get();
    expect(nftDbRec.data().sold).toBe(false);

    const tran: any = await db.collection(COL.TRANSACTION).doc(order.uid).get();
    expect(tran.data().linkedTransactions.length).toBe(2);

    let c = 0;
    for (const t of tran.data().linkedTransactions) {
      const tr: any = await db.collection(COL.TRANSACTION).doc(t).get();
      if (tr.data().type === TransactionType.CREDIT) {
        c++;
        expect(tr.data().payload.targetAddress).toBe(defaultFromAddress);
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
    const member: Member = await createMemberFunc();
    const space: Space = await createSpaceFunc(member.uid, dummySpace());

    // Validate space address.
    const validationOrder: TransactionOrder = await validateSpaceAddressFunc(member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone);

    // Create collection.
    const price = 100;
    const collection: Collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.GENERATED, 0.5, price));

    // It's randomly picked.
    await createNftFunc(member.uid, dummyNft(collection, price));
    await createNftFunc(member.uid, dummyNft(collection, price));

    const order = await submitOrderFunc(member.uid, {
      collection: collection.uid
    });

    // Confirm payment.
    const nextMilestone3 = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(nextMilestone3);

    const nftDbRec: any = await db.collection(COL.NFT).doc(order.payload.nft).get();
    expect(nftDbRec.data().sold).toBe(true);

    const tran: any = await db.collection(COL.TRANSACTION).doc(order.uid).get();
    expect(tran.data().linkedTransactions.length).toBe(3);

    let c = 0;
    for (const t of tran.data().linkedTransactions) {
      const tr: any = await db.collection(COL.TRANSACTION).doc(t).get();
      if (tr.data().type === TransactionType.BILL_PAYMENT) {
        c++;
        expect(tr.data().payload.amount).toBe(price/2 * 1000 * 1000);
      }
    }
    expect(c).toBe(2);
  });

  it('One collection, generated NFT, order and expect transaction to be voided.', async () => {
    const member: Member = await createMemberFunc();
    const space: Space = await createSpaceFunc(member.uid, dummySpace());

    // Validate space address.
    const validationOrder: TransactionOrder = await validateSpaceAddressFunc(member.uid, space.uid);
    const nextMilestone = await submitMilestoneFunc(validationOrder.payload.targetAddress, validationOrder.payload.amount);
    await milestoneProcessed(nextMilestone);

    // Create collection.
    const price = 100;
    const collection: Collection = await createCollectionFunc(member.uid, dummyCollection(space, CollectionType.GENERATED, 0.5, price));

    // It's randomly picked.
    await createNftFunc(member.uid, dummyNft(collection, price));
    await createNftFunc(member.uid, dummyNft(collection, price));

    const order = await submitOrderFunc(member.uid, {
      collection: collection.uid
    });

    // Set pass date.
    await db.collection(COL.TRANSACTION).doc(order.uid).update({
      createdOn: dateToTimestamp(dayjs().subtract(TRANSACTION_AUTO_EXPIRY_MS + 1, 'ms').toDate())
    });

    // Let's let it expire.
    const nextMilestone2 = await submitMilestoneFunc('abc', 13);
    await milestoneProcessed(nextMilestone2);

    const latestOrder: any = await db.collection(COL.TRANSACTION).doc(order.uid).get();
    expect(latestOrder.data().payload.void).toBe(true);
  });

});
