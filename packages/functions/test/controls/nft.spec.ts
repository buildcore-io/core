import {
  Access,
  Bucket,
  Categories,
  COL,
  Collection,
  CollectionType,
  MIN_IOTA_AMOUNT,
  NftStatus,
  Space,
  WenError,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { createCollection } from '../../src/controls/collection.control';
import * as wallet from '../../src/utils/wallet.utils';
import { MEDIA, testEnv } from '../set-up';
import { createBatchNft, createNft, updateUnsoldNft } from './../../src/controls/nft/nft.control';
import { createMember, createSpace, expectThrow, mockWalletReturnValue } from './common';

let walletSpy: any;

describe('Nft controll: ' + WEN_FUNC.cCollection, () => {
  let space: Space;
  let collection: Collection;
  let member: string;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    member = await createMember(walletSpy);
    space = await createSpace(walletSpy, member);
    mockWalletReturnValue(walletSpy, member, dummyCollection(space));
    collection = await testEnv.wrap(createCollection)({});
  });

  it('successfully create NFT', async () => {
    const nft = { media: MEDIA, ...dummyNft(collection.uid) };
    mockWalletReturnValue(walletSpy, member, nft);
    const cNft = await testEnv.wrap(createNft)({});
    expect(cNft?.createdOn).toBeDefined();
    expect(cNft?.updatedOn).toBeDefined();
    expect(cNft?.status).toBe(NftStatus.PRE_MINTED);
  });

  it('successfully create NFT', async () => {
    let nft = { media: 'asd', ...dummyNft(collection.uid) };
    mockWalletReturnValue(walletSpy, member, nft);
    await expectThrow(testEnv.wrap(createNft)({}), WenError.invalid_params.key);

    nft = {
      media: `https://firebasestorage.googleapis.com/v0/b/${Bucket.DEV}/o/`,
      ...dummyNft(collection.uid),
    };
    mockWalletReturnValue(walletSpy, member, nft);
    await expectThrow(testEnv.wrap(createNft)({}), WenError.invalid_params.key);
  });

  it('successfully batch create 2 NFT', async () => {
    mockWalletReturnValue(walletSpy, member, [
      dummyNft(collection.uid),
      dummyNft(collection.uid, 'babbssa'),
    ]);
    const cBatchNft = await testEnv.wrap(createBatchNft)({});
    expect(cBatchNft?.length).toBe(2);
  });

  it('successfully create NFT to high buy price', async () => {
    const nft = { ...dummyNft(collection.uid), price: 1000 * 1000 * 1000 * 1000 * 1000 };
    mockWalletReturnValue(walletSpy, member, nft);
    await expectThrow(testEnv.wrap(createNft)({}), WenError.invalid_params.key);
  });

  it('successfully create NFT to high buy price - wrong collection', async () => {
    const nft = { ...dummyNft(collection.uid), collection: wallet.getRandomEthAddress() };
    mockWalletReturnValue(walletSpy, member, nft);
    await expectThrow(testEnv.wrap(createNft)({}), WenError.collection_does_not_exists.key);
  });

  it('successfully create NFT - validate space/type', async () => {
    mockWalletReturnValue(walletSpy, member, dummyNft(collection.uid));
    const cNft = await testEnv.wrap(createNft)({});
    expect(cNft?.createdOn).toBeDefined();
    expect(cNft?.updatedOn).toBeDefined();
    expect(cNft?.space).toBe(space.uid);
    expect(cNft?.type).toBe(CollectionType.CLASSIC);
    expect(cNft?.hidden).toBe(false);
  });
});

describe('Nft controll: ' + WEN_FUNC.updateUnsoldNft, () => {
  let space: Space;
  let collection: Collection;
  let member: string;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    member = await createMember(walletSpy);
    space = await createSpace(walletSpy, member);
    mockWalletReturnValue(walletSpy, member, dummyCollection(space));
    collection = await testEnv.wrap(createCollection)({});
  });

  it('Should update unsold nft price', async () => {
    mockWalletReturnValue(walletSpy, member, { media: MEDIA, ...dummyNft(collection.uid) });
    let nft = await testEnv.wrap(createNft)({});
    expect(nft.price).toBe(10 * MIN_IOTA_AMOUNT);

    mockWalletReturnValue(walletSpy, member, { uid: nft.uid, price: 50 * MIN_IOTA_AMOUNT });
    nft = await testEnv.wrap(updateUnsoldNft)({});
    expect(nft.price).toBe(50 * MIN_IOTA_AMOUNT);
  });

  it('Should throw, nft can not be updated', async () => {
    mockWalletReturnValue(walletSpy, member, { media: MEDIA, ...dummyNft(collection.uid) });
    let nft = await testEnv.wrap(createNft)({});
    expect(nft.price).toBe(10 * MIN_IOTA_AMOUNT);

    mockWalletReturnValue(walletSpy, member, { uid: nft.uid, price: 50 * MIN_IOTA_AMOUNT });

    await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).update({ sold: true });
    await expectThrow(testEnv.wrap(updateUnsoldNft)({}), WenError.nft_already_sold.key);

    await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).update({ hidden: true, sold: false });
    await expectThrow(testEnv.wrap(updateUnsoldNft)({}), WenError.hidden_nft.key);

    await admin
      .firestore()
      .doc(`${COL.NFT}/${nft.uid}`)
      .update({ placeholderNft: true, hidden: false });
    await expectThrow(
      testEnv.wrap(updateUnsoldNft)({}),
      WenError.nft_placeholder_cant_be_updated.key,
    );
    await admin.firestore().doc(`${COL.NFT}/${nft.uid}`).update({ placeholderNft: false });

    const tmpMember = await createMember(walletSpy);
    mockWalletReturnValue(walletSpy, tmpMember, { uid: nft.uid, price: 50 * MIN_IOTA_AMOUNT });
    await expectThrow(
      testEnv.wrap(updateUnsoldNft)({}),
      WenError.you_are_not_guardian_of_space.key,
    );
  });
});

const dummyCollection = (space: Space) => ({
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
  price: 10 * 1000 * 1000,
});

const dummyNft = (collection: string, description = 'babba') => ({
  name: 'Collection A',
  description,
  collection,
  availableFrom: dayjs().add(1, 'hour').toDate(),
  price: 10 * 1000 * 1000,
});

// TODO test invalid royalty amount
// TODO add set new price once owned.
