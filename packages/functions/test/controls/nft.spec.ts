import { database } from '@buildcore/database';
import {
  Access,
  Bucket,
  COL,
  Categories,
  Collection,
  CollectionType,
  MIN_IOTA_AMOUNT,
  Nft,
  NftAccess,
  NftStatus,
  Space,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import * as wallet from '../../src/utils/wallet.utils';
import { MEDIA, mockWalletReturnValue, testEnv } from '../set-up';
import { expectThrow } from './common';

describe('Nft controll: ' + WEN_FUNC.createCollection, () => {
  let space: Space;
  let collection: Collection;
  let member: string;
  beforeEach(async () => {
    member = await testEnv.createMember();
    space = await testEnv.createSpace(member);
    mockWalletReturnValue(member, dummyCollection(space));
    collection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
  });

  it('successfully create NFT', async () => {
    const nft = { media: MEDIA, ...dummyNft(collection.uid) };
    mockWalletReturnValue(member, nft);
    const cNft = await testEnv.wrap<Nft>(WEN_FUNC.createNft);
    expect(cNft?.createdOn).toBeDefined();
    expect(cNft?.updatedOn).toBeDefined();
    expect(cNft?.status).toBe(NftStatus.PRE_MINTED);
  });

  it('successfully create NFT with sale access', async () => {
    const nft = dummyNft(collection.uid, '', [member]);
    mockWalletReturnValue(member, nft);
    const cNft = await testEnv.wrap<Nft>(WEN_FUNC.createNft);
    expect(cNft?.saleAccessMembers).toEqual([member]);
    expect(cNft?.saleAccess).toBe(NftAccess.MEMBERS);
    expect(cNft?.status).toBe(NftStatus.PRE_MINTED);
    const nfts = [
      dummyNft(collection.uid, '', [member]),
      dummyNft(collection.uid, '', [member]),
      dummyNft(collection.uid),
    ];
    mockWalletReturnValue(member, nfts);
    const cBatchNft = await testEnv.wrap<string[]>(WEN_FUNC.createBatchNft);
    expect(cBatchNft?.length).toBe(3);
    for (let i = 0; i < nfts.length; ++i) {
      const docRef = database().doc(COL.NFT, cBatchNft[i]);
      const nft = <Nft>await docRef.get();
      expect(nft.saleAccessMembers).toEqual(i === nfts.length - 1 ? [] : [member]);
    }
  });

  it('successfully create NFT', async () => {
    let nft = { media: 'some-media-url', ...dummyNft(collection.uid) };
    mockWalletReturnValue(member, nft);
    await expectThrow(testEnv.wrap<Nft>(WEN_FUNC.createNft), WenError.invalid_params.key);
    nft = {
      media: `https://storage.googleapis.com/download/storage/v1/b/${Bucket.DEV}/o`,
      ...dummyNft(collection.uid),
    };
    mockWalletReturnValue(member, nft);
    await expectThrow(testEnv.wrap<Nft>(WEN_FUNC.createNft), WenError.invalid_params.key);
  });

  it('successfully batch create 2 NFT', async () => {
    mockWalletReturnValue(member, [dummyNft(collection.uid), dummyNft(collection.uid, 'babbssa')]);
    const cBatchNft = await testEnv.wrap<string[]>(WEN_FUNC.createBatchNft);
    expect(cBatchNft?.length).toBe(2);
  });

  it('successfully create NFT to high buy price', async () => {
    const nft = { ...dummyNft(collection.uid), price: 1000 * 1000 * 1000 * 1000 * 1000 };
    mockWalletReturnValue(member, nft);
    await expectThrow(testEnv.wrap<Nft>(WEN_FUNC.createNft), WenError.invalid_params.key);
  });

  it('successfully create NFT to high buy price - wrong collection', async () => {
    const nft = { ...dummyNft(collection.uid), collection: wallet.getRandomEthAddress() };
    mockWalletReturnValue(member, nft);
    await expectThrow(
      testEnv.wrap<Nft>(WEN_FUNC.createNft),
      WenError.collection_does_not_exists.key,
    );
  });

  it('successfully create NFT - validate space/type', async () => {
    mockWalletReturnValue(member, dummyNft(collection.uid));
    const cNft = await testEnv.wrap<Nft>(WEN_FUNC.createNft);
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
    member = await testEnv.createMember();
    space = await testEnv.createSpace(member);
    mockWalletReturnValue(member, dummyCollection(space));
    collection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
  });

  it('Should update unsold nft price', async () => {
    mockWalletReturnValue(member, { media: MEDIA, ...dummyNft(collection.uid) });
    let nft = await testEnv.wrap<Nft>(WEN_FUNC.createNft);
    expect(nft.price).toBe(10 * MIN_IOTA_AMOUNT);

    mockWalletReturnValue(member, { uid: nft.uid, price: 50 * MIN_IOTA_AMOUNT });
    nft = await testEnv.wrap<Nft>(WEN_FUNC.updateUnsoldNft);
    expect(nft.price).toBe(50 * MIN_IOTA_AMOUNT);
  });

  it('Should throw, nft can not be updated', async () => {
    mockWalletReturnValue(member, { media: MEDIA, ...dummyNft(collection.uid) });
    let nft = await testEnv.wrap<Nft>(WEN_FUNC.createNft);
    expect(nft.price).toBe(10 * MIN_IOTA_AMOUNT);

    await database().doc(COL.NFT, nft.uid).update({ sold: true });
    mockWalletReturnValue(member, {
      uid: nft.uid,
      price: 50 * MIN_IOTA_AMOUNT,
    });
    await expectThrow(testEnv.wrap<Nft>(WEN_FUNC.updateUnsoldNft), WenError.nft_already_sold.key);

    await database().doc(COL.NFT, nft.uid).update({ hidden: true, sold: false });
    mockWalletReturnValue(member, { uid: nft.uid, price: 50 * MIN_IOTA_AMOUNT });
    await expectThrow(testEnv.wrap<Nft>(WEN_FUNC.updateUnsoldNft), WenError.hidden_nft.key);

    await database().doc(COL.NFT, nft.uid).update({ placeholderNft: true, hidden: false });
    mockWalletReturnValue(member, { uid: nft.uid, price: 50 * MIN_IOTA_AMOUNT });
    await expectThrow(
      testEnv.wrap<Nft>(WEN_FUNC.updateUnsoldNft),
      WenError.nft_placeholder_cant_be_updated.key,
    );
    await database().doc(COL.NFT, nft.uid).update({ placeholderNft: false });

    const tmpMember = await testEnv.createMember();
    mockWalletReturnValue(tmpMember, { uid: nft.uid, price: 50 * MIN_IOTA_AMOUNT });
    await expectThrow(
      testEnv.wrap<Nft>(WEN_FUNC.updateUnsoldNft),
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

const dummyNft = (collection: string, description = 'babba', saleAccessMembers: string[] = []) => ({
  name: 'Collection A',
  description,
  collection,
  availableFrom: dayjs().add(1, 'hour').toDate(),
  price: 10 * 1000 * 1000,
  saleAccessMembers,
});
// TODO test invalid royalty amount// TODO add set new price once owned.
