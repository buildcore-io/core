import { database } from '@buildcore/database';
import {
  Access,
  Bucket,
  COL,
  Categories,
  Collection,
  CollectionStatus,
  CollectionType,
  MIN_IOTA_AMOUNT,
  NetworkAddress,
  Nft,
  RANKING_TEST,
  Rank,
  SOON_PROJECT_ID,
  SUB_COL,
  Space,
  StakeType,
  Token,
  Vote,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { chunk, isEmpty, set } from 'lodash';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { mockWalletReturnValue, soonTokenId, testEnv } from '../set-up';
import {
  addGuardianToSpace,
  createRoyaltySpaces,
  expectThrow,
  getRandomSymbol,
  setProdTiers,
  setTestTiers,
  wait,
} from './common';

const dummyCollection = (space: Space, royaltiesFee: number, noSpace = false) => {
  const data = {
    name: 'Collection A',
    description: 'babba',
    type: CollectionType.CLASSIC,
    category: Categories.ART,
    access: Access.OPEN,
    royaltiesFee,
    royaltiesSpace: space.uid,
    onePerMemberOnly: false,
    availableFrom: dayjs().add(1, 'hour').toDate(),
    price: 10 * 1000 * 1000,
  };
  if (!noSpace) {
    set(data, 'space', space.uid);
  }
  return data;
};

describe('CollectionController: ' + WEN_FUNC.createCollection, () => {
  let space: Space;
  let member: string;
  beforeEach(async () => {
    member = await testEnv.createMember();
    space = await testEnv.createSpace(member);
  });

  it('successfully create collection', async () => {
    mockWalletReturnValue(member, dummyCollection(space, 0.6));
    const collection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    expect(collection?.uid).toBeDefined();
    expect(collection?.createdOn).toBeDefined();
    expect(collection?.approved).toBe(false);
    expect(collection?.rejected).toBe(false);
    expect(collection?.updatedOn).toBeDefined();
    expect(collection?.total).toBe(0);
    expect(collection?.sold).toBe(0);
  });

  it('successfully create collection, no space', async () => {
    mockWalletReturnValue(member, dummyCollection(space, 0.6, true));
    const collection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    expect(collection?.uid).toBeDefined();
    expect(collection?.createdOn).toBeDefined();
    expect(collection?.approved).toBe(false);
    expect(collection?.rejected).toBe(false);
    expect(collection?.updatedOn).toBeDefined();
    expect(collection?.total).toBe(0);
    expect(collection?.sold).toBe(0);
    expect(collection.space).toBe('');
  });

  it('Should throw, invalid icon url', async () => {
    mockWalletReturnValue(member, {
      media: 'name',
      ...dummyCollection(space, 0.6),
    });
    let call = testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    await expectThrow(call, WenError.invalid_params.key);
    mockWalletReturnValue(member, {
      media: `https://storage.googleapis.com/download/storage/v1/b/${Bucket.DEV}/o`,
      ...dummyCollection(space, 0.6),
    });
    call = testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    await expectThrow(call, WenError.invalid_params.key);
  });

  it('Should throw, no soon staked', async () => {
    await setProdTiers();
    mockWalletReturnValue(member, dummyCollection(space, 0.6));
    const call = testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    await expectThrow(call, WenError.no_staked_soon.key);
    await setTestTiers();
  });

  it('Should create collection, soon check', async () => {
    await database()
      .doc(COL.TOKEN, soonTokenId, SUB_COL.DISTRIBUTION, member)
      .create({
        parentId: soonTokenId,
        parentCol: COL.TOKEN,
        stakes: { [StakeType.DYNAMIC]: { value: 10 * MIN_IOTA_AMOUNT } },
      });
    await setProdTiers();
    mockWalletReturnValue(member, dummyCollection(space, 0.6));
    const collection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    expect(collection?.uid).toBeDefined();
    await setTestTiers();
  });

  it('fail to create collection - wrong royalties', async () => {
    mockWalletReturnValue(member, dummyCollection(space, 4));
    const call = testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    await expectThrow(call, WenError.invalid_params.key);
  });

  it('fail to create collection - missing royalties space', async () => {
    const collection = dummyCollection(space, 0.1);
    delete (collection as any).royaltiesSpace;
    mockWalletReturnValue(member, dummyCollection(space, 4));
    const call = testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    await expectThrow(call, WenError.invalid_params.key);
  });

  it('collection does not exists for update', async () => {
    const collection = {
      uid: getRandomEthAddress(),
      name: 'Collection A',
      description: 'babba',
      royaltiesFee: 0.6,
      royaltiesSpace: space.uid,
    };
    mockWalletReturnValue(member, collection);
    const call = testEnv.wrap<Collection>(WEN_FUNC.updateCollection);
    await expectThrow(call, WenError.collection_does_not_exists.key);
  });

  it('successfully create collection & update', async () => {
    const collection = dummyCollection(space, 0.6);
    mockWalletReturnValue(member, collection);
    const cCollection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    expect(cCollection?.uid).toBeDefined();
    expect(cCollection?.description).toBe('babba');
    const uData = {
      uid: cCollection?.uid,
      name: 'Collection A',
      description: '123',
      royaltiesFee: 0.6,
      royaltiesSpace: space.uid,
    };
    mockWalletReturnValue(member, uData);
    const uCollection = await testEnv.wrap<Collection>(WEN_FUNC.updateCollection);
    expect(uCollection?.uid).toBeDefined();
    expect(uCollection?.description).toBe('123');
  });

  it('successfully create collection & update, no space', async () => {
    mockWalletReturnValue(member, dummyCollection(space, 0.6, true));
    const cCollection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    const updateData = {
      uid: cCollection?.uid,
      name: 'Collection A',
      description: '123',
      royaltiesFee: 0.6,
      royaltiesSpace: space.uid,
    };
    const randomMember = await testEnv.createMember();
    mockWalletReturnValue(randomMember, updateData);
    const call = testEnv.wrap<Collection>(WEN_FUNC.updateCollection);
    await expectThrow(call, WenError.you_must_be_the_creator_of_this_collection.key);
    mockWalletReturnValue(member, updateData);
    const uCollection = await testEnv.wrap<Collection>(WEN_FUNC.updateCollection);
    expect(uCollection?.name).toBe(updateData.name);
    expect(uCollection?.description).toBe(updateData.description);
  });

  it('successfully create collection & update price', async () => {
    let collection = dummyCollection(space, 0.6) as unknown as Collection;
    mockWalletReturnValue(member, collection);
    collection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    await database().doc(COL.COLLECTION, collection.uid).update({ approved: true });
    const dummyNft = () => ({
      name: 'Collection A',
      description: 'babba',
      collection: collection.uid,
      availableFrom: dayjs().add(2, 'h').toDate(),
      price: MIN_IOTA_AMOUNT,
    });
    const nfts: Nft[] = [];
    for (let i = 0; i < 4; ++i) {
      mockWalletReturnValue(member, dummyNft());
      const nft = await testEnv.wrap<Nft>(WEN_FUNC.createNft);
      nfts.push(nft);
    }
    const availableFrom = dayjs().add(1, 'd');
    const updateCollection = {
      uid: collection?.uid,
      price: 15 * MIN_IOTA_AMOUNT,
      name: 'name',
      description: '123',
      royaltiesFee: 0.6,
      royaltiesSpace: space.uid,
      availableFrom: availableFrom.toDate(),
    };
    mockWalletReturnValue(member, updateCollection);
    const uCollection = await testEnv.wrap<Collection>(WEN_FUNC.updateCollection);
    expect(uCollection?.uid).toBe(collection.uid);
    expect(uCollection?.price).toBe(15 * MIN_IOTA_AMOUNT);
    expect(uCollection?.availablePrice).toBe(15 * MIN_IOTA_AMOUNT);
    for (let i = 0; i < 4; ++i) {
      const nftDocRef = database().doc(COL.NFT, nfts[i].uid);
      const nft = <Nft>await nftDocRef.get();
      expect(nft.price).toBe(15 * MIN_IOTA_AMOUNT);
      expect(nft.availablePrice).toBe(15 * MIN_IOTA_AMOUNT);
    }
  });

  it('Only allow discounts, access, accessAwards, accessCollections update on minted collection', async () => {
    const token = await saveToken(space.uid);
    const collection = dummyCollection(space, 0.6);
    mockWalletReturnValue(member, collection);
    const cCollection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    await database()
      .doc(COL.COLLECTION, cCollection.uid)
      .update({ status: CollectionStatus.MINTED });
    expect(cCollection?.access).toBe(Access.OPEN);
    mockWalletReturnValue(member, {
      uid: cCollection?.uid,
      name: 'Collection A',
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.updateCollection), WenError.invalid_params.key);
    mockWalletReturnValue(member, {
      uid: cCollection?.uid,
      discounts: [{ tokenSymbol: token.symbol, tokenReward: 10, amount: 0.5 }],
    });
    let uCollection = await testEnv.wrap<Collection>(WEN_FUNC.updateCollection);
    expect(uCollection?.discounts).toEqual([
      { tokenSymbol: token.symbol, tokenUid: token.uid, tokenReward: 10, amount: 0.5 },
    ]);
    expect(uCollection?.access).toBe(Access.OPEN);
    const updateAwards = {
      uid: cCollection?.uid,
      access: Access.MEMBERS_WITH_BADGE,
      accessAwards: [getRandomEthAddress()],
    };
    mockWalletReturnValue(member, updateAwards);
    uCollection = await testEnv.wrap<Collection>(WEN_FUNC.updateCollection);
    expect(uCollection?.access).toBe(Access.MEMBERS_WITH_BADGE);
    expect(uCollection?.accessAwards).toEqual(updateAwards.accessAwards);
    const updateCollections = {
      uid: cCollection?.uid,
      access: Access.MEMBERS_WITH_NFT_FROM_COLLECTION,
      accessCollections: [getRandomEthAddress()],
    };
    mockWalletReturnValue(member, updateCollections);
    uCollection = await testEnv.wrap<Collection>(WEN_FUNC.updateCollection);
    expect(uCollection?.access).toBe(Access.MEMBERS_WITH_NFT_FROM_COLLECTION);
    expect(uCollection?.accessCollections).toEqual(updateCollections.accessCollections);
  });

  it('Should not update placeholder nft when collection is minted', async () => {
    const token = await saveToken(space.uid);
    const collection = { ...dummyCollection(space, 0.6), type: CollectionType.SFT };
    mockWalletReturnValue(member, collection);
    const cCollection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    await database()
      .doc(COL.COLLECTION, cCollection.uid)
      .update({ status: CollectionStatus.MINTED });
    mockWalletReturnValue(member, {
      uid: cCollection?.uid,
      discounts: [{ tokenSymbol: token.symbol, tokenReward: 10, amount: 0.5 }],
      access: Access.GUARDIANS_ONLY,
    });
    let uCollection = await testEnv.wrap<Collection>(WEN_FUNC.updateCollection);
    expect(uCollection?.discounts).toEqual([
      { tokenSymbol: token.symbol, tokenUid: token.uid, tokenReward: 10, amount: 0.5 },
    ]);
    expect(uCollection?.access).toBe(Access.GUARDIANS_ONLY);
  });

  it('Should throw, discount has same tokenReward', async () => {
    const token = await saveToken(space.uid);
    const collection = dummyCollection(space, 0.6);
    mockWalletReturnValue(member, collection);
    const cCollection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    mockWalletReturnValue(member, {
      uid: cCollection?.uid,
      discounts: [
        { tokenSymbol: token.symbol, tokenReward: 10, amount: 0.5 },
        { tokenSymbol: token.symbol, tokenReward: 10, amount: 0.6 },
      ],
    });
    await expectThrow(
      testEnv.wrap<Collection>(WEN_FUNC.updateCollection),
      WenError.invalid_params.key,
    );
  });

  it('Should throw, token does not exist', async () => {
    const collection = dummyCollection(space, 0.6);
    mockWalletReturnValue(member, collection);
    const cCollection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    await database()
      .doc(COL.COLLECTION, cCollection.uid)
      .update({ status: CollectionStatus.MINTED });
    mockWalletReturnValue(member, {
      uid: cCollection?.uid,
      discounts: [{ tokenSymbol: 'ASD', tokenReward: 10, amount: 0.5 }],
    });
    await expectThrow(
      testEnv.wrap<Collection>(WEN_FUNC.updateCollection),
      WenError.token_does_not_exist.key,
    );
  });

  it('successfully create collection & approve', async () => {
    mockWalletReturnValue(member, dummyCollection(space, 0.6));
    const cCollection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    expect(cCollection?.uid).toBeDefined();
    expect(cCollection?.description).toBe('babba');
  });

  it('successfully create collection & reject', async () => {
    mockWalletReturnValue(member, dummyCollection(space, 0.6));
    const returns = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    expect(returns?.uid).toBeDefined();
    expect(returns?.description).toBe('babba');
    mockWalletReturnValue(member, { uid: returns?.uid });
    const returns2 = await testEnv.wrap<Collection>(WEN_FUNC.rejectCollection);
    expect(returns2?.uid).toBeDefined();
    expect(returns2?.approved).toBe(false);
    expect(returns2?.rejected).toBe(true);
  });

  it('successfully create collection & reject, no space', async () => {
    mockWalletReturnValue(member, dummyCollection(space, 0.6, true));
    let collection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    const randomMember = await testEnv.createMember();
    mockWalletReturnValue(randomMember, { uid: collection.uid });
    await expectThrow(
      testEnv.wrap<Collection>(WEN_FUNC.rejectCollection),
      WenError.you_must_be_the_creator_of_this_collection.key,
    );
    mockWalletReturnValue(member, { uid: collection.uid });
    collection = await testEnv.wrap<Collection>(WEN_FUNC.rejectCollection);
    expect(collection.uid).toBeDefined();
    expect(collection.approved).toBe(false);
    expect(collection.rejected).toBe(true);
  });

  it('Any guardian can update collection after approved', async () => {
    const secondGuardian = await testEnv.createMember();
    await addGuardianToSpace(space.uid, secondGuardian);
    mockWalletReturnValue(member, dummyCollection(space, 0.6));
    const cCollection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    const updateData = {
      uid: cCollection?.uid,
      name: 'name',
      description: '123',
      royaltiesFee: 0.6,
      royaltiesSpace: space.uid,
    };
    mockWalletReturnValue(secondGuardian, updateData);
    await expectThrow(
      testEnv.wrap<Collection>(WEN_FUNC.updateCollection),
      WenError.you_must_be_the_creator_of_this_collection.key,
    );
    await database().doc(COL.COLLECTION, cCollection?.uid).update({ approved: true });
    mockWalletReturnValue(secondGuardian, updateData);
    const uCollection = await testEnv.wrap<Collection>(WEN_FUNC.updateCollection);
    expect(uCollection?.uid).toBeDefined();
    expect(uCollection?.name).toBe('name');
  });
});

describe('Collection trigger test', () => {
  it('Should set approved&reject properly on nfts', async () => {
    const member = await testEnv.createMember();
    const space = await testEnv.createSpace(member);
    const collection = {
      ...dummyCollection(space, 0.1),
      project: SOON_PROJECT_ID,
      uid: getRandomEthAddress(),
    };
    await database()
      .doc(COL.COLLECTION, collection.uid)
      .create({
        ...collection,
        availableFrom: dateToTimestamp(collection.availableFrom),
      } as Collection);
    const nftIds = Array.from(Array(1000));
    const chunks = chunk(nftIds, 500);
    for (let chunkIndex = 0; chunkIndex < chunks.length; ++chunkIndex) {
      const batch = database().batch();
      const promises = chunks[chunkIndex].map(async (_, index) => {
        const id = getRandomEthAddress();
        const nft = dummyNft(chunkIndex * 500 + index, id, collection.uid);
        batch.create(database().doc(COL.NFT, id), {
          ...nft,
          availableFrom: dateToTimestamp(nft.availableFrom),
          project: SOON_PROJECT_ID,
        } as unknown as Nft);
      });
      await Promise.all(promises);
      await batch.commit();
    }
    await database().doc(COL.COLLECTION, collection.uid).update({ approved: true });
    await wait(async () => {
      const snap = await database()
        .collection(COL.NFT)
        .where('collection', '==', collection.uid)
        .get();
      const allHaveUpdated = snap.reduce((acc, act) => acc && act.approved, true);
      return allHaveUpdated;
    });
    await database().doc(COL.COLLECTION, collection.uid).update({ approved: false });
    await database().doc(COL.COLLECTION, collection.uid).update({ approved: true });
    await wait(async () => {
      const snap = await database()
        .collection(COL.NFT)
        .where('collection', '==', collection.uid)
        .get();
      const allHaveUpdated = snap.reduce((acc, act) => acc && act.approved, true);
      return allHaveUpdated;
    });
    await database()
      .doc(COL.COLLECTION, collection.uid)
      .update({ approved: false, rejected: true });
    await wait(async () => {
      const snap = await database()
        .collection(COL.NFT)
        .where('collection', '==', collection.uid)
        .get();
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
  let member: NetworkAddress;
  let space: Space;
  let collection: any;
  beforeEach(async () => {
    member = await testEnv.createMember();
    space = await testEnv.createSpace(member);
    mockWalletReturnValue(member, dummyCollection(space, 0.6));
    collection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
  });

  it('Should throw, no collection', async () => {
    mockWalletReturnValue(member, {
      collection: COL.COLLECTION,
      uid: getRandomEthAddress(),
      direction: 1,
    });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.voteController),
      WenError.collection_does_not_exists.key,
    );
  });

  it('Should throw, invalid direction', async () => {
    mockWalletReturnValue(member, {
      collection: COL.COLLECTION,
      uid: collection.uid,
      direction: 2,
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.voteController), WenError.invalid_params.key);
  });

  it('Should throw, no soons staked', async () => {
    await setProdTiers();
    mockWalletReturnValue(member, {
      collection: COL.COLLECTION,
      uid: collection.uid,
      direction: 1,
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.voteController), WenError.no_staked_soon.key);
    await setTestTiers();
  });
  const validateStats = async (upvotes: number, downvotes: number, diff: number) => {
    await wait(async () => {
      const statsDocRef = database().doc(
        COL.COLLECTION,
        collection.uid,
        SUB_COL.STATS,
        collection.uid,
      );
      const stats = await statsDocRef.get();
      return (
        stats?.votes?.upvotes === upvotes &&
        stats?.votes?.downvotes === downvotes &&
        stats?.votes?.voteDiff === diff
      );
    });
  };
  const sendVote = async (direction: number) => {
    mockWalletReturnValue(member, {
      collection: COL.COLLECTION,
      uid: collection.uid,
      direction,
    });
    const vote = await testEnv.wrap<Vote>(WEN_FUNC.voteController);
    expect(vote.uid).toBe(member);
    expect(vote.parentId).toBe(collection.uid);
    expect(vote.parentCol).toBe(COL.COLLECTION);
    expect(vote.direction).toBe(direction);
  };
  it('Should vote', async () => {
    await sendVote(1);
    await validateStats(1, 0, 1);
    await sendVote(-1);
    await validateStats(0, 1, -1);
    mockWalletReturnValue(member, {
      collection: COL.COLLECTION,
      uid: collection.uid,
      direction: 0,
    });
    const vote = await testEnv.wrap(WEN_FUNC.voteController);
    expect(isEmpty(vote)).toBe(true);
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
    member = await testEnv.createMember();
    space = await testEnv.createSpace(member);
    mockWalletReturnValue(member, dummyCollection(space, 0.6));
    collection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);
    await database()
      .doc(COL.SPACE, RANKING_TEST.collectionSpace, SUB_COL.GUARDIANS, member)
      .upsert({ parentId: RANKING_TEST.collectionSpace });
  });

  it('Should throw, no collection', async () => {
    mockWalletReturnValue(member, {
      collection: COL.COLLECTION,
      uid: getRandomEthAddress(),
      rank: 1,
    });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.rankController),
      WenError.collection_does_not_exists.key,
    );
  });

  it('Should throw, invalid rank', async () => {
    mockWalletReturnValue(member, {
      collection: COL.COLLECTION,
      uid: collection.uid,
      rank: 200,
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.rankController), WenError.invalid_params.key);
  });

  it('Should throw, no soons staked', async () => {
    await setProdTiers();
    mockWalletReturnValue(member, {
      collection: COL.COLLECTION,
      uid: collection.uid,
      rank: 1,
    });
    await expectThrow(testEnv.wrap(WEN_FUNC.rankController), WenError.no_staked_soon.key);
    await setTestTiers();
  });

  it('Should throw, not space member', async () => {
    await database()
      .doc(COL.SPACE, RANKING_TEST.collectionSpace, SUB_COL.GUARDIANS, member)
      .delete();
    mockWalletReturnValue(member, {
      collection: COL.COLLECTION,
      uid: collection.uid,
      rank: 1,
    });
    await expectThrow(
      testEnv.wrap(WEN_FUNC.rankController),
      WenError.you_are_not_guardian_of_space.key,
    );
  });
  const validateStats = async (count: number, sum: number) => {
    await wait(async () => {
      const collectionDocRef = database().doc(COL.COLLECTION, collection.uid);
      const statsDocRef = database().doc(
        COL.COLLECTION,
        collection.uid,
        SUB_COL.STATS,
        collection.uid,
      );
      const stats = await statsDocRef.get();
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
    mockWalletReturnValue(memberAddress || member, {
      collection: COL.COLLECTION,
      uid: collection.uid,
      rank: rankValue,
    });
    const rank = await testEnv.wrap<Rank>(WEN_FUNC.rankController);
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
    const secondMember = await testEnv.createMember();
    await database()
      .doc(COL.SPACE, RANKING_TEST.collectionSpace, SUB_COL.GUARDIANS, secondMember)
      .upsert({ parentId: RANKING_TEST.collectionSpace });
    await sendRank(-50, secondMember);
    await validateStats(2, -150);
    await wait(async () => {
      const doc = await database().doc(COL.COLLECTION, collection.uid).get();
      return !doc!.approved && doc!.rejected;
    });
  });
});
const saveToken = async (space: string) => {
  const token = {
    project: SOON_PROJECT_ID,
    uid: getRandomEthAddress(),
    symbol: getRandomSymbol(),
    approved: true,
    space,
    name: 'MyToken',
  };
  const docRef = database().doc(COL.TOKEN, token.uid);
  await docRef.upsert(token);
  return <Token>await docRef.get();
};
