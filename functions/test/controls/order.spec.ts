import dayjs from "dayjs";
import * as admin from 'firebase-admin';
import { WEN_FUNC } from "../../interfaces/functions";
import { COL } from '../../interfaces/models/base';
import { Categories, CollectionType } from "../../interfaces/models/collection";
import { createCollection } from '../../src/controls/collection.control';
import { createMember } from '../../src/controls/member.control';
import { createNft } from '../../src/controls/nft.control';
import { createSpace } from '../../src/controls/space.control';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
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

    await db.collection(COL.MILESTONE).doc(returns!.uid).set({ff: false}).then((d: any) => {
      console.log(d);
    });

    const dd = await db.collection(COL.MILESTONE).doc(returns!.uid).get();
    console.log(dd.data());

  });
});
