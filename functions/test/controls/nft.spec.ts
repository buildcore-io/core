import dayjs from "dayjs";
import * as admin from 'firebase-admin';
import { WEN_FUNC } from "../../interfaces/functions";
import { COL } from '../../interfaces/models/base';
import { Categories, CollectionAccess, CollectionType } from "../../interfaces/models/collection";
import { createCollection } from '../../src/controls/collection.control';
import { createMember } from '../../src/controls/member.control';
import { createSpace } from '../../src/controls/space.control';
import { serverTime } from "../../src/utils/dateTime.utils";
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { WenError } from './../../interfaces/errors';
import { TransactionOrderType, TransactionType } from './../../interfaces/models/transaction';
import { createBatchNft, createNft } from './../../src/controls/nft.control';
import { validateAddress } from './../../src/controls/order.control';
const db = admin.firestore();

describe('CollectionController: ' + WEN_FUNC.cCollection, () => {
  let walletSpy: any;
  let dummyAddress: any;
  let space: any;
  let collection: any;
  let member: any;

  const mocker = (params: any) => {
    walletSpy.mockReturnValue(Promise.resolve({
      address: dummyAddress,
      body: params
    }));
  }

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
    await new Promise((r) => setTimeout(r, 20000));

    mocker({
      name: 'Collection A',
      description: 'babba',
      type: CollectionType.CLASSIC,
      royaltiesFee: 0.6,
      category: Categories.ART,
      access: CollectionAccess.OPEN,
      space: space.uid,
      royaltiesSpace: space.uid,
      availableFrom: dayjs().add(1, 'hour').toDate(),
      price: 10 * 1000 * 1000
    });

    const wrapped: any = testEnv.wrap(createCollection);
    collection = await wrapped();
    expect(collection?.uid).toBeDefined();
  });

  it('successfully create NFT', async () => {
    mocker({
      name: 'Collection A',
      description: 'babba',
      collection: collection.uid,
      availableFrom: dayjs().add(1, 'hour').toDate(),
      price: 10 * 1000 * 1000
    });
    const wrapped: any = testEnv.wrap(createNft);
    const returns = await wrapped();

    expect(returns?.createdOn).toBeDefined();
    expect(returns?.updatedOn).toBeDefined();
    walletSpy.mockRestore();
  });

  it('successfully batch create 2 NFT', async () => {
    mocker([
      {
        name: 'Collection A',
        description: 'babba',
        collection: collection.uid,
        availableFrom: dayjs().add(1, 'hour').toDate(),
        price: 10 * 1000 * 1000
      },
      {
        name: 'Collection A',
        description: 'babbssa',
        collection: collection.uid,
        availableFrom: dayjs().add(1, 'hour').toDate(),
        price: 10 * 1000 * 1000
      }
    ]);
    const wrapped: any = testEnv.wrap(createBatchNft);
    const returns = await wrapped();

    expect(returns?.length).toBe(2);
    walletSpy.mockRestore();
  });

  it('successfully create NFT to high buy price', async () => {
    mocker({
      name: 'Collection A',
      description: 'babba',
      collection: collection.uid,
      availableFrom: dayjs().add(1, 'hour').toDate(),
      price: 1000 * 1000 * 1000 * 1000 * 1000
    });

    const wrapped: any = testEnv.wrap(createNft);
    (<any>expect(wrapped())).rejects.toThrowError(WenError.invalid_params.key);
    walletSpy.mockRestore();
  });

  it('successfully create NFT to high buy price - wrong collection', async () => {
    mocker({
      name: 'Collection A',
      description: 'babba',
      collection: wallet.getRandomEthAddress(),
      availableFrom: dayjs().add(1, 'hour').toDate(),
      price: 1000 * 1000 * 1000
    });

    const wrapped: any = testEnv.wrap(createNft);
    (<any>expect(wrapped())).rejects.toThrowError(WenError.collection_does_not_exists.key);
    walletSpy.mockRestore();
  });

  it('successfully create NFT - validate space/type', async () => {
    mocker({
      name: 'Collection A',
      description: 'babba',
      collection: collection.uid,
      availableFrom: dayjs().add(1, 'hour').toDate(),
      price: 10 * 1000 * 1000
    });
    const wrapped: any = testEnv.wrap(createNft);
    const returns = await wrapped();

    expect(returns?.createdOn).toBeDefined();
    expect(returns?.updatedOn).toBeDefined();
    expect(returns?.space).toBe(space.uid);
    expect(returns?.type).toBe(CollectionType.CLASSIC);
    expect(returns?.hidden).toBe(false);
    walletSpy.mockRestore();
  });
});

// TODO test invalid royalty amount
// TODO add set new price once owned.
