import { build5Db } from '@build-5/database';
import {
  Access,
  Bucket,
  COL,
  Categories,
  Collection,
  CollectionStats,
  CollectionStatus,
  CollectionType,
  MIN_IOTA_AMOUNT,
  Member,
  Nft,
  RANKING_TEST,
  SUB_COL,
  Space,
  StakeType,
  Token,
  WEN_FUNC,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { chunk } from 'lodash';
import { createNft } from '../../src/runtime/firebase/nft';
import { rankController } from '../../src/runtime/firebase/rank';
import { voteController } from '../../src/runtime/firebase/vote';
import * as config from '../../src/utils/config.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import {
  approveCollection,
  createCollection,
  rejectCollection,
  updateCollection,
} from './../../src/runtime/firebase/collection/index';
import { createMember } from './../../src/runtime/firebase/member';
import {
  addGuardianToSpace,
  createMember as createMemberFunc,
  createRoyaltySpaces,
  createSpace as createSpaceFunc,
  expectThrow,
  getRandomSymbol,
  mockWalletReturnValue,
  saveSoon,
  wait,
} from './common';

let walletSpy: any;
let isProdSpy: jest.SpyInstance<boolean, []>;

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
  price: 10 * 1000 * 1000,
});

describe('CollectionController: ' + WEN_FUNC.createCollection, () => {
  let dummyAddress: string;
  let space: any;
  let member: Member;
  let soonTokenId: string;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    isProdSpy = jest.spyOn(config, 'isProdEnv');
    dummyAddress = await createMemberFunc(walletSpy);
    member = await testEnv.wrap(createMember)(dummyAddress);
    expect(member?.uid).toEqual(dummyAddress.toLowerCase());
    space = await createSpaceFunc(walletSpy, dummyAddress);
    soonTokenId = await saveSoon();
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

  it('Should throw, invalid icon url', async () => {
    mockWalletReturnValue(walletSpy, dummyAddress, {
      media: 'asd',
      ...dummyCollection(space.uid, 0.6),
    });
    await expectThrow(testEnv.wrap(createCollection)({}), WenError.invalid_params.key);

    mockWalletReturnValue(walletSpy, dummyAddress, {
      media: `https://firebasestorage.googleapis.com/v0/b/${Bucket.DEV}/o/`,
      ...dummyCollection(space.uid, 0.6),
    });
    await expectThrow(testEnv.wrap(createCollection)({}), WenError.invalid_params.key);
  });

  it('Should throw, no soon staked', async () => {
    mockWalletReturnValue(walletSpy, dummyAddress, dummyCollection(space.uid, 0.6));
    isProdSpy.mockReturnValue(true);
    await expectThrow(testEnv.wrap(createCollection)({}), WenError.no_staked_soon.key);
    isProdSpy.mockRestore();
  });

  it('Should create collection, soon check', async () => {
    await build5Db()
      .doc(`${COL.TOKEN}/${soonTokenId}/${SUB_COL.DISTRIBUTION}/${dummyAddress}`)
      .create({
        stakes: {
          [StakeType.DYNAMIC]: {
            value: 10 * MIN_IOTA_AMOUNT,
          },
        },
      });

    mockWalletReturnValue(walletSpy, dummyAddress, dummyCollection(space.uid, 0.6));
    isProdSpy.mockReturnValue(true);
    const collection = await testEnv.wrap(createCollection)({});
    expect(collection?.uid).toBeDefined();
    isProdSpy.mockRestore();
  });

  it('fail to create collection - wrong royalties', async () => {
    mockWalletReturnValue(walletSpy, dummyAddress, dummyCollection(space.uid, 4));
    await expectThrow(testEnv.wrap(createCollection)({}), WenError.invalid_params.key);
    walletSpy.mockRestore();
  });

  it('fail to create collection - missing royalties space', async () => {
    const collection = dummyCollection(space.uid, 0.1);
    delete collection.royaltiesSpace;
    mockWalletReturnValue(walletSpy, dummyAddress, collection);
    await expectThrow(testEnv.wrap(createCollection)({}), WenError.invalid_params.key);
    walletSpy.mockRestore();
  });

  it('collection does not exists for update', async () => {
    mockWalletReturnValue(walletSpy, dummyAddress, {
      uid: wallet.getRandomEthAddress(),
      name: 'Collection A',
      description: 'babba',
      royaltiesFee: 0.6,
      royaltiesSpace: space.uid,
    });
    await expectThrow(testEnv.wrap(updateCollection)({}), WenError.collection_does_not_exists.key);
    walletSpy.mockRestore();
  });

  it('successfully create collection & update', async () => {
    const collection = dummyCollection(space.uid, 0.6);
    mockWalletReturnValue(walletSpy, dummyAddress, collection);

    const cCollection = await testEnv.wrap(createCollection)({});
    expect(cCollection?.uid).toBeDefined();
    expect(cCollection?.description).toBe('babba');

    mockWalletReturnValue(walletSpy, dummyAddress, {
      uid: cCollection?.uid,
      name: 'Collection A',
      description: '123',
      royaltiesFee: 0.6,
      royaltiesSpace: space.uid,
    });
    const uCollection = await testEnv.wrap(updateCollection)({});
    expect(uCollection?.uid).toBeDefined();
    expect(uCollection?.description).toBe('123');
    walletSpy.mockRestore();
  });

  it('successfully create collection & update price', async () => {
    let collection = dummyCollection(space.uid, 0.6);
    mockWalletReturnValue(walletSpy, dummyAddress, collection);
    collection = await testEnv.wrap(createCollection)({});

    mockWalletReturnValue(walletSpy, dummyAddress, { uid: collection?.uid });
    await testEnv.wrap(approveCollection)({});

    const dummyNft = () => ({
      name: 'Collection A',
      description: 'babba',
      collection: collection.uid,
      availableFrom: dayjs().add(2, 'h').toDate(),
      price: MIN_IOTA_AMOUNT,
    });
    const nfts: Nft[] = [];
    for (let i = 0; i < 4; ++i) {
      mockWalletReturnValue(walletSpy, dummyAddress, dummyNft());
      const nft = await testEnv.wrap(createNft)({});
      nfts.push(nft);
    }

    const availableFrom = dayjs().add(1, 'd');
    mockWalletReturnValue(walletSpy, dummyAddress, {
      uid: collection?.uid,
      price: 15 * MIN_IOTA_AMOUNT,
      name: 'asd',
      description: '123',
      royaltiesFee: 0.6,
      royaltiesSpace: space.uid,
      availableFrom: availableFrom.toDate(),
    });
    const uCollection = await testEnv.wrap(updateCollection)({});
    expect(uCollection?.uid).toBe(collection.uid);
    expect(uCollection?.price).toBe(15 * MIN_IOTA_AMOUNT);
    expect(uCollection?.availablePrice).toBe(15 * MIN_IOTA_AMOUNT);

    for (let i = 0; i < 4; ++i) {
      const nftDocRef = build5Db().doc(`${COL.NFT}/${nfts[i].uid}`);
      const nft = <Nft>await nftDocRef.get();
      expect(nft.price).toBe(15 * MIN_IOTA_AMOUNT);
      expect(nft.availablePrice).toBe(15 * MIN_IOTA_AMOUNT);
    }

    walletSpy.mockRestore();
  });

  it('Only allow discounts, access, accessAwards, accessCollections update on minted collection', async () => {
    const token = await saveToken(space.uid);
    const collection = dummyCollection(space.uid, 0.6);
    mockWalletReturnValue(walletSpy, dummyAddress, collection);
    const cCollection = await testEnv.wrap(createCollection)({});
    await build5Db()
      .doc(`${COL.COLLECTION}/${cCollection.uid}`)
      .update({ status: CollectionStatus.MINTED });

    mockWalletReturnValue(walletSpy, dummyAddress, { uid: cCollection?.uid, name: 'Collection A' });
    await expectThrow(testEnv.wrap(updateCollection)({}), WenError.invalid_params.key);

    mockWalletReturnValue(walletSpy, dummyAddress, {
      uid: cCollection?.uid,
      discounts: [{ tokenSymbol: token.symbol, tokenReward: 10, amount: 0.5 }],
    });
    let uCollection = await testEnv.wrap(updateCollection)({});
    expect(uCollection?.discounts).toEqual([
      { tokenSymbol: token.symbol, tokenUid: token.uid, tokenReward: 10, amount: 0.5 },
    ]);
    expect(uCollection?.access).toBe(Access.OPEN);

    const updateAwards = {
      uid: cCollection?.uid,
      access: Access.MEMBERS_WITH_BADGE,
      accessAwards: [wallet.getRandomEthAddress()],
    };
    mockWalletReturnValue(walletSpy, dummyAddress, updateAwards);
    uCollection = await testEnv.wrap(updateCollection)({});
    expect(uCollection?.access).toBe(Access.MEMBERS_WITH_BADGE);
    expect(uCollection?.accessAwards).toEqual(updateAwards.accessAwards);

    const updateCollections = {
      uid: cCollection?.uid,
      access: Access.MEMBERS_WITH_NFT_FROM_COLLECTION,
      accessCollections: [wallet.getRandomEthAddress()],
    };
    mockWalletReturnValue(walletSpy, dummyAddress, updateCollections);
    uCollection = await testEnv.wrap(updateCollection)({});
    expect(uCollection?.access).toBe(Access.MEMBERS_WITH_NFT_FROM_COLLECTION);
    expect(uCollection?.accessCollections).toEqual(updateCollections.accessCollections);
  });

  it('Should not update placeholder nft when collection is minted', async () => {
    const token = await saveToken(space.uid);
    const collection = { ...dummyCollection(space.uid, 0.6), type: CollectionType.SFT };
    mockWalletReturnValue(walletSpy, dummyAddress, collection);
    const cCollection = await testEnv.wrap(createCollection)({});
    await build5Db()
      .doc(`${COL.COLLECTION}/${cCollection.uid}`)
      .update({ status: CollectionStatus.MINTED });

    mockWalletReturnValue(walletSpy, dummyAddress, {
      uid: cCollection?.uid,
      discounts: [{ tokenSymbol: token.symbol, tokenReward: 10, amount: 0.5 }],
      access: Access.GUARDIANS_ONLY,
    });
    let uCollection = await testEnv.wrap(updateCollection)({});
    expect(uCollection?.discounts).toEqual([
      { tokenSymbol: token.symbol, tokenUid: token.uid, tokenReward: 10, amount: 0.5 },
    ]);
    expect(uCollection?.access).toBe(Access.GUARDIANS_ONLY);
  });

  it('Should throw, discount has same tokenReward', async () => {
    const token = await saveToken(space.uid);
    const collection = dummyCollection(space.uid, 0.6);
    mockWalletReturnValue(walletSpy, dummyAddress, collection);
    const cCollection = await testEnv.wrap(createCollection)({});

    mockWalletReturnValue(walletSpy, dummyAddress, {
      uid: cCollection?.uid,
      discounts: [
        { tokenSymbol: token.symbol, tokenReward: 10, amount: 0.5 },
        { tokenSymbol: token.symbol, tokenReward: 10, amount: 0.6 },
      ],
    });
    await expectThrow(testEnv.wrap(updateCollection)({}), WenError.invalid_params.key);
  });

  it('Should throw, token does not exist', async () => {
    const collection = dummyCollection(space.uid, 0.6);
    mockWalletReturnValue(walletSpy, dummyAddress, collection);
    const cCollection = await testEnv.wrap(createCollection)({});
    await build5Db()
      .doc(`${COL.COLLECTION}/${cCollection.uid}`)
      .update({ status: CollectionStatus.MINTED });

    mockWalletReturnValue(walletSpy, dummyAddress, {
      uid: cCollection?.uid,
      discounts: [{ tokenSymbol: 'ASD', tokenReward: 10, amount: 0.5 }],
    });
    await expectThrow(testEnv.wrap(updateCollection)({}), WenError.token_does_not_exist.key);
  });

  it('successfully create collection & approve', async () => {
    mockWalletReturnValue(walletSpy, dummyAddress, dummyCollection(space.uid, 0.6));
    const cCollection = await testEnv.wrap(createCollection)({});
    expect(cCollection?.uid).toBeDefined();
    expect(cCollection?.description).toBe('babba');

    mockWalletReturnValue(walletSpy, dummyAddress, { uid: cCollection?.uid });
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

  it('Any guardian can update collection after approved', async () => {
    const secondGuardian = await createMemberFunc(walletSpy);
    await addGuardianToSpace(space.uid, secondGuardian);

    mockWalletReturnValue(walletSpy, dummyAddress, dummyCollection(space.uid, 0.6));
    const cCollection = await testEnv.wrap(createCollection)({});

    const updateData = {
      uid: cCollection?.uid,
      name: 'asd',
      description: '123',
      royaltiesFee: 0.6,
      royaltiesSpace: space.uid,
    };
    mockWalletReturnValue(walletSpy, secondGuardian, updateData);
    await expectThrow(
      testEnv.wrap(updateCollection)({}),
      WenError.you_must_be_the_creator_of_this_collection.key,
    );

    mockWalletReturnValue(walletSpy, dummyAddress, { uid: cCollection?.uid });
    const approvedCollection = await testEnv.wrap(approveCollection)({});
    expect(approvedCollection?.approved).toBe(true);
    expect(approvedCollection?.rejected).toBe(false);

    mockWalletReturnValue(walletSpy, secondGuardian, updateData);
    const uCollection = await testEnv.wrap(updateCollection)({});
    expect(uCollection?.uid).toBeDefined();
    expect(uCollection?.name).toBe('asd');

    walletSpy.mockRestore();
  });
});

describe('Collection trigger test', () => {
  it('Should set approved&reject properly on nfts', async () => {
    const collection = { ...dummyCollection('', 0.1), uid: wallet.getRandomEthAddress() };
    await build5Db().doc(`${COL.COLLECTION}/${collection.uid}`).create(collection);

    const nftIds = Array.from(Array(1000));
    const chunks = chunk(nftIds, 500);
    for (let chunkIndex = 0; chunkIndex < chunks.length; ++chunkIndex) {
      const batch = build5Db().batch();
      chunks[chunkIndex].forEach((_, index) => {
        const id = wallet.getRandomEthAddress();
        batch.create(
          build5Db().doc(`${COL.NFT}/${id}`),
          dummyNft(chunkIndex * 500 + index, id, collection.uid),
        );
      });
      await batch.commit();
    }

    await build5Db().doc(`${COL.COLLECTION}/${collection.uid}`).update({
      approved: true,
    });

    await wait(async () => {
      const snap = await build5Db()
        .collection(COL.NFT)
        .where('collection', '==', collection.uid)
        .get<Nft>();
      const allHaveUpdated = snap.reduce((acc, act) => acc && act.approved, true);
      return allHaveUpdated;
    });

    await build5Db().doc(`${COL.COLLECTION}/${collection.uid}`).update({
      approved: false,
    });
    await build5Db().doc(`${COL.COLLECTION}/${collection.uid}`).update({
      approved: true,
    });

    await wait(async () => {
      const snap = await build5Db()
        .collection(COL.NFT)
        .where('collection', '==', collection.uid)
        .get<Nft>();
      const allHaveUpdated = snap.reduce((acc, act) => acc && act.approved, true);
      return allHaveUpdated;
    });

    await build5Db().doc(`${COL.COLLECTION}/${collection.uid}`).update({
      approved: false,
      rejected: true,
    });

    await wait(async () => {
      const snap = await build5Db()
        .collection(COL.NFT)
        .where('collection', '==', collection.uid)
        .get<Nft>();
      const allHaveUpdated = snap.reduce((acc, act) => acc && !act.approved && act.rejected, true);
      return allHaveUpdated;
    });
  });
});

const dummyNft = (index: number, uid: string, collection: string, description = 'babba') => ({
  uid,
  name: 'Nft ' + index,
  description,
  collection,
  availableFrom: dayjs().add(1, 'hour').toDate(),
  price: 10 * 1000 * 1000,
});

describe('Collection vote test', () => {
  let memberAddress: string;
  let space: Space;
  let collection: any;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    isProdSpy = jest.spyOn(config, 'isProdEnv');
    memberAddress = await createMemberFunc(walletSpy);
    space = await createSpaceFunc(walletSpy, memberAddress);

    mockWalletReturnValue(walletSpy, memberAddress, dummyCollection(space.uid, 0.6));
    collection = await testEnv.wrap(createCollection)({});

    await saveSoon();
  });

  it('Should throw, no collection', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      collection: COL.COLLECTION,
      uid: wallet.getRandomEthAddress(),
      direction: 1,
    });
    await expectThrow(testEnv.wrap(voteController)({}), WenError.collection_does_not_exists.key);
  });

  it('Should throw, invalid direction', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      collection: COL.COLLECTION,
      uid: collection.uid,
      direction: 2,
    });
    await expectThrow(testEnv.wrap(voteController)({}), WenError.invalid_params.key);
  });

  it('Should throw, no soons staked', async () => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      collection: COL.COLLECTION,
      uid: collection.uid,
      direction: 1,
    });
    isProdSpy.mockReturnValue(true);
    await expectThrow(testEnv.wrap(voteController)({}), WenError.no_staked_soon.key);
    isProdSpy.mockRestore();
  });

  const validateStats = async (upvotes: number, downvotes: number, diff: number) => {
    await wait(async () => {
      const statsDocRef = build5Db().doc(
        `${COL.COLLECTION}/${collection.uid}/${SUB_COL.STATS}/${collection.uid}`,
      );
      const stats = await statsDocRef.get<CollectionStats>();
      return (
        stats?.votes?.upvotes === upvotes &&
        stats?.votes?.downvotes === downvotes &&
        stats?.votes?.voteDiff === diff
      );
    });
  };

  const sendVote = async (direction: number) => {
    mockWalletReturnValue(walletSpy, memberAddress, {
      collection: COL.COLLECTION,
      uid: collection.uid,
      direction,
    });
    const vote = await testEnv.wrap(voteController)({});
    expect(vote.uid).toBe(memberAddress);
    expect(vote.parentId).toBe(collection.uid);
    expect(vote.parentCol).toBe(COL.COLLECTION);
    expect(vote.direction).toBe(direction);
  };

  it('Should vote', async () => {
    await sendVote(1);
    await validateStats(1, 0, 1);

    await sendVote(-1);
    await validateStats(0, 1, -1);

    mockWalletReturnValue(walletSpy, memberAddress, {
      collection: COL.COLLECTION,
      uid: collection.uid,
      direction: 0,
    });
    const vote = await testEnv.wrap(voteController)({});
    expect(vote).toBe(undefined);
  });
});

describe('Collection rank test', () => {
  let member: string;
  let space: Space;
  let collection: any;

  beforeAll(async () => {
    await createRoyaltySpaces();
  });

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    isProdSpy = jest.spyOn(config, 'isProdEnv');
    member = await createMemberFunc(walletSpy);
    space = await createSpaceFunc(walletSpy, member);

    mockWalletReturnValue(walletSpy, member, dummyCollection(space.uid, 0.6));
    collection = await testEnv.wrap(createCollection)({});

    await saveSoon();

    await build5Db()
      .doc(`${COL.SPACE}/${RANKING_TEST.collectionSpace}/${SUB_COL.GUARDIANS}/${member}`)
      .set({
        uid: member,
        parentId: RANKING_TEST.collectionSpace,
        parentCol: COL.SPACE,
      });
  });

  it('Should throw, no collection', async () => {
    mockWalletReturnValue(walletSpy, member, {
      collection: COL.COLLECTION,
      uid: wallet.getRandomEthAddress(),
      rank: 1,
    });
    await expectThrow(testEnv.wrap(rankController)({}), WenError.collection_does_not_exists.key);
  });

  it('Should throw, invalid rank', async () => {
    mockWalletReturnValue(walletSpy, member, {
      collection: COL.COLLECTION,
      uid: collection.uid,
      rank: 200,
    });
    await expectThrow(testEnv.wrap(rankController)({}), WenError.invalid_params.key);
  });

  it('Should throw, no soons staked', async () => {
    mockWalletReturnValue(walletSpy, member, {
      collection: COL.COLLECTION,
      uid: collection.uid,
      rank: 1,
    });
    isProdSpy.mockReturnValue(true);
    await expectThrow(testEnv.wrap(rankController)({}), WenError.no_staked_soon.key);
    isProdSpy.mockRestore();
  });

  it('Should throw, not space member', async () => {
    await build5Db()
      .doc(`${COL.SPACE}/${RANKING_TEST.collectionSpace}/${SUB_COL.GUARDIANS}/${member}`)
      .delete();

    mockWalletReturnValue(walletSpy, member, {
      collection: COL.COLLECTION,
      uid: collection.uid,
      rank: 1,
    });
    await expectThrow(testEnv.wrap(rankController)({}), WenError.you_are_not_guardian_of_space.key);
  });

  const validateStats = async (count: number, sum: number) => {
    await wait(async () => {
      const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${collection.uid}`);
      const statsDocRef = collectionDocRef.collection(SUB_COL.STATS).doc(collection.uid);
      const stats = <CollectionStats | undefined>await statsDocRef.get();
      const statsAreCorrect =
        stats?.ranks?.count === count &&
        stats?.ranks?.sum === sum &&
        stats?.ranks?.avg === Number((stats?.ranks?.sum! / stats?.ranks?.count!).toFixed(3));

      collection = <Collection>await collectionDocRef.get();
      return (
        statsAreCorrect &&
        collection.rankCount === count &&
        collection.rankSum === sum &&
        collection.rankAvg === Number((collection.rankSum / collection.rankCount).toFixed(3))
      );
    });
  };

  const sendRank = async (rankValue: number, memberAddress?: string) => {
    mockWalletReturnValue(walletSpy, memberAddress || member, {
      collection: COL.COLLECTION,
      uid: collection.uid,
      rank: rankValue,
    });
    const rank = await testEnv.wrap(rankController)({});
    expect(rank.uid).toBe(memberAddress || member);
    expect(rank.parentId).toBe(collection.uid);
    expect(rank.parentCol).toBe(COL.COLLECTION);
    expect(rank.rank).toBe(rankValue);
  };

  it('Should rank', async () => {
    await sendRank(100);
    await validateStats(1, 100);

    await sendRank(-100);
    await validateStats(1, -100);

    const secondMember = await createMemberFunc(walletSpy);
    await build5Db()
      .doc(`${COL.SPACE}/${RANKING_TEST.collectionSpace}/${SUB_COL.GUARDIANS}/${secondMember}`)
      .set({
        uid: secondMember,
        parentId: RANKING_TEST.collectionSpace,
        parentCol: COL.SPACE,
      });

    await sendRank(-50, secondMember);
    await validateStats(2, -150);

    await wait(async () => {
      const doc = <Collection>await build5Db().doc(`${COL.COLLECTION}/${collection.uid}`).get();
      return !doc.approved && doc.rejected;
    });
  });
});

const saveToken = async (space: string) => {
  const token = {
    uid: wallet.getRandomEthAddress(),
    symbol: getRandomSymbol(),
    approved: true,
    space,
    name: 'MyToken',
  };
  await build5Db().doc(`${COL.TOKEN}/${token.uid}`).set(token);
  return <Token>token;
};
