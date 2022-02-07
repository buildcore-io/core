import dayjs from "dayjs";
import * as admin from 'firebase-admin';
import { COL } from '../../interfaces/models/base';
import { Categories, CollectionType } from "../../interfaces/models/collection";
import { createCollection } from '../../src/controls/collection.control';
import { createMember } from '../../src/controls/member.control';
import { createNft } from '../../src/controls/nft.control';
import { createSpace } from '../../src/controls/space.control';
import { serverTime } from "../../src/utils/dateTime.utils";
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { TransactionType } from './../../interfaces/models/transaction';
import { orderNft } from './../../src/controls/order.control';
const db = admin.firestore();

describe('Ordering flows', () => {
  let walletSpy: any;
  let dummyAddress: any;
  let space: any;
  let collection: any;
  let nft: any;
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

    mocker({
      name: 'Collection A',
      description: 'babba',
      type: CollectionType.CLASSIC,
      royaltiesFee: 0.6,
      category: Categories.ART,
      space: space.uid,
      royaltiesSpace: space.uid
    });

    const wrapped: any = testEnv.wrap(createCollection);
    collection = await wrapped();
    expect(collection?.uid).toBeDefined();

    mocker({
      name: 'NFT Rocks!',
      description: 'babba',
      collection: collection.uid,
      availableFrom: dayjs().toDate(),
      price: 10 * 1000 * 1000
    });
    const wrapped2: any = testEnv.wrap(createNft);
    nft = await wrapped2();
    expect(nft?.createdOn).toBeDefined();
    expect(nft?.updatedOn).toBeDefined();
  });

  it.skip('Order NFT, pay and be an owner', async () => {
    // We made purchase for an NFT.
    mocker({
      nft: nft.uid
    });
    const wrapped2: any = testEnv.wrap(orderNft);
    const nftFunc = await wrapped2();
    expect(nftFunc.space).toBe(space.uid);
    expect(nftFunc.member).toBe(member.uid);
    expect(nftFunc.type).toBe(TransactionType.ORDER);
    expect(nftFunc.payload.collection).toBe(collection.uid);
    expect(nftFunc.payload.collection).toBe(collection.uid);
    expect(nftFunc.payload.nft).toBe(nft.uid);
    expect(nftFunc.payload.reconciled).toBe(false);
    expect(nftFunc.payload.amount).toBe(nft.price);

    // Post milestone to confirm payment.
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
          address: nftFunc.payload.targetAddress,
          amount: nftFunc.payload.amount
        }]
    });

    // Mark milestone as complete.
    await db.collection(COL.MILESTONE).doc(nextMilestone).set({ complete: true });

    await new Promise((r) => setTimeout(r, 2000));
    // const aa = await db.collection(COL.NFT).doc(nft.uid).get();
    // console.log(aa.data());
  });
});
