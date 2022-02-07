import * as admin from 'firebase-admin';
import { WEN_FUNC } from "../../interfaces/functions";
import { TransactionOrderType, TransactionType } from "../../interfaces/models";
import { COL } from "../../interfaces/models/base";
import { Categories, CollectionType } from "../../interfaces/models/collection";
import { serverTime } from "../../src/utils/dateTime.utils";
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { WenError } from './../../interfaces/errors';
import { approveCollection, createCollection, rejectCollection, updateCollection } from './../../src/controls/collection.control';
import { createMember } from './../../src/controls/member.control';
import { validateAddress } from './../../src/controls/order.control';
import { createSpace } from './../../src/controls/space.control';
const db = admin.firestore();

describe('CollectionController: ' + WEN_FUNC.cCollection, () => {
  let walletSpy: any;
  let dummyAddress: any;
  let space: any;
  let member: any;

  beforeEach(async () => {
    dummyAddress = wallet.getRandomEthAddress();
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: {}
    }));

    const wCreate: any = testEnv.wrap(createMember);
    member = await wCreate(dummyAddress);
    expect(member?.uid).toEqual(dummyAddress.toLowerCase());

    const wrappedSpace: any = testEnv.wrap(createSpace);
    space = await wrappedSpace();
    expect(space?.uid).toBeDefined();

    // We must validate space address.
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: {
        space: space!.uid
      }
    }));
    const wrappedOrder: any = testEnv.wrap(validateAddress);
    const order: any = await wrappedOrder();
    expect(order?.type).toBe(TransactionType.ORDER);
    expect(order?.payload.type).toBe(TransactionOrderType.SPACE_ADDRESS_VALIDATION);

    // Create milestone to process my validation.
    const allMil = await db.collection(COL.MILESTONE).get();
    const nextMilestone = (allMil.size + 1).toString();
    await db.collection(COL.MILESTONE).doc(nextMilestone)
    .collection('transactions').doc('9ae738e06688d9fbdfaf172e80c92e9da3174d541f9cc28503c826fcf679b251')
    .set({
      createdOn: serverTime(),
      inputs: [{
        address: 'iota1qqsye008z79vj9p9ywzw65ed2xn4yxe9zfp9jqgw0gthxydxpa03qx32mhz',
        amount: 123
      }],
      outputs: [{
        address: order.payload.targetAddress,
        amount: order.payload.amount
      }]
    });
    await db.collection(COL.MILESTONE).doc(nextMilestone).set({ completed: true });

    // Space address should be validated by above.
    await new Promise((r) => setTimeout(r, 2000));
  });

  const cSpaceHelper = (params: any) => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: params
    }));
  }
  it('successfully create collection', async () => {
    cSpaceHelper({
      name: 'Collection A',
      description: 'babba',
      type: CollectionType.CLASSIC,
      category: Categories.ART,
      royaltiesFee: 0.6,
      space: space.uid,
      royaltiesSpace: space.uid
    });

    const wrapped: any = testEnv.wrap(createCollection);
    const returns = await wrapped();
    expect(returns?.uid).toBeDefined();
    expect(returns?.createdOn).toBeDefined();
    expect(returns?.approved).toBe(false);
    expect(returns?.rejected).toBe(false);
    expect(returns?.updatedOn).toBeDefined();
    expect(returns?.total).toBe(0);
    expect(returns?.sold).toBe(0);
    walletSpy.mockRestore();
  });

  it('fail to create collection - wrong royalties', async () => {
    cSpaceHelper({
      name: 'Collection A',
      description: 'babba',
      royaltiesFee: 4,
      space: space.uid,
      type: CollectionType.CLASSIC,
      category: Categories.ART,
      royaltiesSpace: space.uid
    });
    const wrapped: any = testEnv.wrap(createCollection);
    (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);

    walletSpy.mockRestore();
  });

  it('fail to create collection - missing royalties space', async () => {
    cSpaceHelper({
      name: 'Collection A',
      description: 'babba',
      royaltiesFee: 0.1,
      type: CollectionType.CLASSIC,
      category: Categories.ART,
      space: space.uid
    });
    const wrapped: any = testEnv.wrap(createCollection);
    (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);

    walletSpy.mockRestore();
  });

  it('collection does not exists for update', async () => {
    cSpaceHelper({
      uid: wallet.getRandomEthAddress(),
      name: 'Collection A',
      description: 'babba',
      royaltiesFee: 0.6,
      type: CollectionType.CLASSIC,
      category: Categories.ART,
      space: space.uid,
      royaltiesSpace: space.uid
    });
    const wrapped: any = testEnv.wrap(updateCollection);
    (<any>expect(wrapped())).rejects.toThrowError(WenError.collection_does_not_exists.key);

    walletSpy.mockRestore();
  });

  it('successfully create collection & update', async () => {
    cSpaceHelper({
      name: 'Collection A',
      description: 'babba',
      royaltiesFee: 0.6,
      type: CollectionType.CLASSIC,
      category: Categories.ART,
      space: space.uid,
      royaltiesSpace: space.uid
    });

    const wrapped: any = testEnv.wrap(createCollection);
    const returns = await wrapped();
    expect(returns?.uid).toBeDefined();
    expect(returns?.description).toBe('babba');

    cSpaceHelper({
      uid: returns?.uid,
      name: 'Collection A',
      description: '123',
      royaltiesFee: 0.6,
      category: Categories.ART,
      type: CollectionType.CLASSIC,
      space: space.uid,
      royaltiesSpace: space.uid
    });
    const wrapped2: any = testEnv.wrap(updateCollection);
    const returns2 = await wrapped2();
    expect(returns2?.uid).toBeDefined();
    expect(returns2?.description).toBe('123');
    walletSpy.mockRestore();
  });

  it('successfully create collection & approve', async () => {
    cSpaceHelper({
      name: 'Collection A',
      description: 'babba',
      category: Categories.ART,
      royaltiesFee: 0.6,
      type: CollectionType.CLASSIC,
      space: space.uid,
      royaltiesSpace: space.uid
    });

    const wrapped: any = testEnv.wrap(createCollection);
    const returns = await wrapped();
    expect(returns?.uid).toBeDefined();
    expect(returns?.description).toBe('babba');

    cSpaceHelper({
      uid: returns?.uid,
    });
    const wrapped2: any = testEnv.wrap(approveCollection);
    const returns2 = await wrapped2();
    expect(returns2?.uid).toBeDefined();
    expect(returns2?.approved).toBe(true);
    expect(returns2?.rejected).toBe(false);
    walletSpy.mockRestore();
  });

  it('successfully create collection & reject', async () => {
    cSpaceHelper({
      name: 'Collection A',
      description: 'babba',
      category: Categories.ART,
      royaltiesFee: 0.6,
      type: CollectionType.CLASSIC,
      space: space.uid,
      royaltiesSpace: space.uid
    });

    const wrapped: any = testEnv.wrap(createCollection);
    const returns = await wrapped();
    expect(returns?.uid).toBeDefined();
    expect(returns?.description).toBe('babba');

    cSpaceHelper({
      uid: returns?.uid,
    });
    const wrapped2: any = testEnv.wrap(rejectCollection);
    const returns2 = await wrapped2();
    expect(returns2?.uid).toBeDefined();
    expect(returns2?.approved).toBe(false);
    expect(returns2?.rejected).toBe(true);
    walletSpy.mockRestore();
  });
});
