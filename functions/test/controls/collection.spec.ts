import dayjs from "dayjs";
import { WEN_FUNC } from "../../interfaces/functions";
import { Member, Transaction, TransactionOrderType, TransactionType } from "../../interfaces/models";
import { Access } from "../../interfaces/models/base";
import { Categories, CollectionType } from "../../interfaces/models/collection";
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { WenError } from './../../interfaces/errors';
import { approveCollection, createCollection, rejectCollection, updateCollection } from './../../src/controls/collection.control';
import { createMember } from './../../src/controls/member.control';
import { validateAddress } from './../../src/controls/order.control';
import { createSpace } from './../../src/controls/space.control';
import { expectThrow, milestoneProcessed, mockWalletReturnValue, submitMilestoneFunc } from './common';

let walletSpy: any;

const dummyCollection: any = (spaceId: string, royaltiesFee: number) => ({
  name: 'Collection A',
  description: 'babba',
  type: CollectionType.CLASSIC,
  category: Categories.ART,
  access: Access.OPEN,
  royaltiesFee,
  space: spaceId,
  royaltiesSpace: spaceId,
  onePerMemberOnly: false,
  availableFrom: dayjs().add(1, 'hour').toDate(),
  price: 10 * 1000 * 1000
})

describe('CollectionController: ' + WEN_FUNC.cCollection, () => {
  let dummyAddress: string;
  let space: any;
  let member: Member;

  beforeEach(async () => {
    dummyAddress = wallet.getRandomEthAddress();
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    mockWalletReturnValue(walletSpy, dummyAddress, {})

    member = await testEnv.wrap(createMember)(dummyAddress);
    expect(member?.uid).toEqual(dummyAddress.toLowerCase());

    space = await testEnv.wrap(createSpace)({});
    expect(space?.uid).toBeDefined();

    mockWalletReturnValue(walletSpy, dummyAddress, { space: space!.uid })
    const order: Transaction = await testEnv.wrap(validateAddress)({});
    expect(order?.type).toBe(TransactionType.ORDER);
    expect(order?.payload.type).toBe(TransactionOrderType.SPACE_ADDRESS_VALIDATION);

    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);
  });

  it('successfully create collection', async () => {
    mockWalletReturnValue(walletSpy, dummyAddress, dummyCollection(space.uid, 0.6));
    const collection = await testEnv.wrap(createCollection)({});
    expect(collection?.uid).toBeDefined();
    expect(collection?.createdOn).toBeDefined();
    expect(collection?.approved).toBe(false);
    expect(collection?.rejected).toBe(false);
    expect(collection?.updatedOn).toBeDefined();
    expect(collection?.total).toBe(0);
    expect(collection?.sold).toBe(0);
    walletSpy.mockRestore();
  });

  it('fail to create collection - wrong royalties', async () => {
    mockWalletReturnValue(walletSpy, dummyAddress, dummyCollection(space.uid, 4));
    expectThrow(testEnv.wrap(createCollection)({}), WenError.invalid_params.key)
    walletSpy.mockRestore();
  });

  it('fail to create collection - missing royalties space', async () => {
    const collection = dummyCollection(space.uid, 0.1)
    delete collection.royaltiesSpace
    mockWalletReturnValue(walletSpy, dummyAddress, collection);
    expectThrow(testEnv.wrap(createCollection)({}), WenError.invalid_params.key)
    walletSpy.mockRestore();
  });

  it('collection does not exists for update', async () => {
    mockWalletReturnValue(walletSpy, dummyAddress, {
      uid: wallet.getRandomEthAddress(),
      name: 'Collection A',
      description: 'babba',
      royaltiesFee: 0.6,
      royaltiesSpace: space.uid
    });
    expectThrow(testEnv.wrap(updateCollection)({}), WenError.collection_does_not_exists.key)
    walletSpy.mockRestore();
  });

  it('successfully create collection & update', async () => {
    const collection = dummyCollection(space.uid, 0.6)
    mockWalletReturnValue(walletSpy, dummyAddress, collection);

    const cCollection = await testEnv.wrap(createCollection)({});
    expect(cCollection?.uid).toBeDefined();
    expect(cCollection?.description).toBe('babba');

    mockWalletReturnValue(walletSpy, dummyAddress, {
      uid: cCollection?.uid,
      name: 'Collection A',
      description: '123',
      royaltiesFee: 0.6,
      royaltiesSpace: space.uid
    });
    const uCollection = await testEnv.wrap(updateCollection)({});
    expect(uCollection?.uid).toBeDefined();
    expect(uCollection?.description).toBe('123');
    walletSpy.mockRestore();
  });

  it('successfully create collection & approve', async () => {
    mockWalletReturnValue(walletSpy, dummyAddress, dummyCollection(space.uid, 0.6));
    const cCollection = await testEnv.wrap(createCollection)({});
    expect(cCollection?.uid).toBeDefined();
    expect(cCollection?.description).toBe('babba');

    mockWalletReturnValue(walletSpy, dummyAddress, { uid: cCollection?.uid, });
    const uCollection = await testEnv.wrap(approveCollection)({});
    expect(uCollection?.uid).toBeDefined();
    expect(uCollection?.approved).toBe(true);
    expect(uCollection?.rejected).toBe(false);
    walletSpy.mockRestore();
  });

  it('successfully create collection & reject', async () => {
    mockWalletReturnValue(walletSpy, dummyAddress, dummyCollection(space.uid, 0.6));
    const returns = await testEnv.wrap(createCollection)({});
    expect(returns?.uid).toBeDefined();
    expect(returns?.description).toBe('babba');

    mockWalletReturnValue(walletSpy, dummyAddress, { uid: returns?.uid });
    const returns2 = await testEnv.wrap(rejectCollection)({});
    expect(returns2?.uid).toBeDefined();
    expect(returns2?.approved).toBe(false);
    expect(returns2?.rejected).toBe(true);
    walletSpy.mockRestore();
  });
});
