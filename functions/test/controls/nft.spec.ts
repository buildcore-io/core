import dayjs from "dayjs";
import { WEN_FUNC } from "../../interfaces/functions";
import { Member, Space } from '../../interfaces/models';
import { Access } from '../../interfaces/models/base';
import { Categories, Collection, CollectionType } from "../../interfaces/models/collection";
import { createCollection } from '../../src/controls/collection.control';
import { createMember } from '../../src/controls/member.control';
import { createSpace } from '../../src/controls/space.control';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { WenError } from './../../interfaces/errors';
import { TransactionOrderType, TransactionType } from './../../interfaces/models/transaction';
import { createBatchNft, createNft } from './../../src/controls/nft.control';
import { validateAddress } from './../../src/controls/order.control';
import { expectThrow, milestoneProcessed, mockWalletReturnValue, submitMilestoneFunc } from './common';

let walletSpy: any;
const MEDIA = 'https://firebasestorage.googleapis.com/v0/b/soonaverse-test.appspot.com/o/0x551fd2c7c7bf356bac194587dab2fcd46420054b%2Fpt7u97zf5to%2Fnft_media?alt=media&token=8d3b5fed-4f74-4961-acf2-f22fabd78d03';

const dummyNft = (collection: string, description = 'babba') => ({
  name: 'Collection A',
  description,
  collection,
  availableFrom: dayjs().add(1, 'hour').toDate(),
  price: 10 * 1000 * 1000
})

describe('CollectionController: ' + WEN_FUNC.cCollection, () => {
  let dummyAddress: string;
  let space: Space;
  let collection: Collection;
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
    const order = await testEnv.wrap(validateAddress)({});
    expect(order?.type).toBe(TransactionType.ORDER);
    expect(order?.payload.type).toBe(TransactionOrderType.SPACE_ADDRESS_VALIDATION);

    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    mockWalletReturnValue(walletSpy, dummyAddress, {
      name: 'Collection A',
      description: 'babba',
      type: CollectionType.CLASSIC,
      royaltiesFee: 0.6,
      category: Categories.ART,
      access: Access.OPEN,
      space: space.uid,
      royaltiesSpace: space.uid,
      onePerMemberOnly: false,
      availableFrom: dayjs().add(1, 'hour').toDate(),
      price: 10 * 1000 * 1000
    });

    collection = await testEnv.wrap(createCollection)({});
    expect(collection?.uid).toBeDefined();
  });

  it('successfully create NFT', async () => {
    const nft = { media: MEDIA, ...dummyNft(collection.uid) }
    mockWalletReturnValue(walletSpy, dummyAddress, nft);
    const cNft = await testEnv.wrap(createNft)({});
    expect(cNft?.createdOn).toBeDefined();
    expect(cNft?.updatedOn).toBeDefined();
    walletSpy.mockRestore();
  });

  it('successfully batch create 2 NFT', async () => {
    mockWalletReturnValue(walletSpy, dummyAddress, [dummyNft(collection.uid), dummyNft(collection.uid, 'babbssa')]);
    const cBatchNft = await testEnv.wrap(createBatchNft)({});
    expect(cBatchNft?.length).toBe(2);
    walletSpy.mockRestore();
  });

  it('successfully create NFT to high buy price', async () => {
    const nft = { ...dummyNft(collection.uid), price: 1000 * 1000 * 1000 * 1000 * 1000 }
    mockWalletReturnValue(walletSpy, dummyAddress, nft);
    expectThrow(testEnv.wrap(createNft)({}), WenError.invalid_params.key)
    walletSpy.mockRestore();
  });

  it('successfully create NFT to high buy price - wrong collection', async () => {
    const nft = { ...dummyNft(collection.uid), collection: wallet.getRandomEthAddress() }
    mockWalletReturnValue(walletSpy, dummyAddress, nft);
    expectThrow(testEnv.wrap(createNft)({}), WenError.collection_does_not_exists.key)
    walletSpy.mockRestore();
  });

  it('successfully create NFT - validate space/type', async () => {
    mockWalletReturnValue(walletSpy, dummyAddress, dummyNft(collection.uid));
    const cNft = await testEnv.wrap(createNft)({});
    expect(cNft?.createdOn).toBeDefined();
    expect(cNft?.updatedOn).toBeDefined();
    expect(cNft?.space).toBe(space.uid);
    expect(cNft?.type).toBe(CollectionType.CLASSIC);
    expect(cNft?.hidden).toBe(false);
    walletSpy.mockRestore();
  });
});

// TODO test invalid royalty amount
// TODO add set new price once owned.
