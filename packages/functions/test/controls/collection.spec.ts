import {
  Access,
  Bucket,
  Categories,
  COL,
  Collection,
  CollectionStats,
  CollectionStatus,
  CollectionType,
  Member,
  MIN_IOTA_AMOUNT,
  RANKING_TEST,
  Space,
  StakeType,
  SUB_COL,
  Transaction,
  TransactionOrderType,
  TransactionType,
  WenError,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { chunk } from 'lodash';
import admin from '../../src/admin.config';
import { rankController } from '../../src/controls/rank.control';
import { voteController } from '../../src/controls/vote.control';
import * as config from '../../src/utils/config.utils';
import { cOn } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { validateAddress } from './../../src/controls/address.control';
import {
  approveCollection,
  createCollection,
  rejectCollection,
  updateCollection,
} from './../../src/controls/collection.control';
import { createMember } from './../../src/controls/member.control';
import { createSpace } from './../../src/controls/space/space.create.control';
import {
  createMember as createMemberFunc,
  createRoyaltySpaces,
  createSpace as createSpaceFunc,
  expectThrow,
  milestoneProcessed,
  mockWalletReturnValue,
  saveSoon,
  submitMilestoneFunc,
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

describe('CollectionController: ' + WEN_FUNC.cCollection, () => {
  let dummyAddress: string;
  let space: any;
  let member: Member;
  let soonTokenId: string;

  beforeEach(async () => {
    dummyAddress = wallet.getRandomEthAddress();
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    isProdSpy = jest.spyOn(config, 'isProdEnv');
    mockWalletReturnValue(walletSpy, dummyAddress, {});

    member = await testEnv.wrap(createMember)(dummyAddress);
    expect(member?.uid).toEqual(dummyAddress.toLowerCase());

    space = await testEnv.wrap(createSpace)({});
    expect(space?.uid).toBeDefined();

    mockWalletReturnValue(walletSpy, dummyAddress, { space: space!.uid });
    const order: Transaction = await testEnv.wrap(validateAddress)({});
    expect(order?.type).toBe(TransactionType.ORDER);
    expect(order?.payload.type).toBe(TransactionOrderType.SPACE_ADDRESS_VALIDATION);

    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

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
    await admin
      .firestore()
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

  it('Only allow discounts and access update on minted collection', async () => {
    const collection = dummyCollection(space.uid, 0.6);
    mockWalletReturnValue(walletSpy, dummyAddress, collection);
    const cCollection = await testEnv.wrap(createCollection)({});
    await admin
      .firestore()
      .doc(`${COL.COLLECTION}/${cCollection.uid}`)
      .update({ status: CollectionStatus.MINTED });

    mockWalletReturnValue(walletSpy, dummyAddress, { uid: cCollection?.uid, name: 'Collection A' });
    await expectThrow(testEnv.wrap(updateCollection)({}), WenError.invalid_params.key);

    mockWalletReturnValue(walletSpy, dummyAddress, {
      uid: cCollection?.uid,
      discounts: [{ xp: 'asd', amount: 0.5 }],
    });
    let uCollection = await testEnv.wrap(updateCollection)({});
    expect(uCollection?.discounts).toEqual([{ xp: 'asd', amount: 0.5 }]);
    expect(uCollection?.access).toBe(Access.OPEN);

    mockWalletReturnValue(walletSpy, dummyAddress, {
      uid: cCollection?.uid,
      access: Access.MEMBERS_WITH_BADGE,
    });
    uCollection = await testEnv.wrap(updateCollection)({});
    expect(uCollection?.access).toBe(Access.MEMBERS_WITH_BADGE);
  });

  it('Should not update placeholder nft when collection is minted', async () => {
    const collection = { ...dummyCollection(space.uid, 0.6), type: CollectionType.SFT };
    mockWalletReturnValue(walletSpy, dummyAddress, collection);
    const cCollection = await testEnv.wrap(createCollection)({});
    await admin
      .firestore()
      .doc(`${COL.COLLECTION}/${cCollection.uid}`)
      .update({ status: CollectionStatus.MINTED });

    mockWalletReturnValue(walletSpy, dummyAddress, {
      uid: cCollection?.uid,
      discounts: [{ xp: 'asd', amount: 0.5 }],
      access: Access.GUARDIANS_ONLY,
    });
    let uCollection = await testEnv.wrap(updateCollection)({});
    expect(uCollection?.discounts).toEqual([{ xp: 'asd', amount: 0.5 }]);
    expect(uCollection?.access).toBe(Access.GUARDIANS_ONLY);
  });

  it('Should throw, discount has same xp', async () => {
    const collection = dummyCollection(space.uid, 0.6);
    mockWalletReturnValue(walletSpy, dummyAddress, collection);
    const cCollection = await testEnv.wrap(createCollection)({});

    mockWalletReturnValue(walletSpy, dummyAddress, {
      uid: cCollection?.uid,
      discounts: [
        { xp: 'asd', amount: 0.5 },
        { xp: 'asd', amount: 0.6 },
      ],
    });
    await expectThrow(testEnv.wrap(updateCollection)({}), WenError.invalid_params.key);
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
});

describe('Collection trigger test', () => {
  it('Should set approved&reject properly on nfts', async () => {
    const collection = { ...dummyCollection('', 0.1), uid: wallet.getRandomEthAddress() };
    await admin.firestore().doc(`${COL.COLLECTION}/${collection.uid}`).create(collection);

    const nftIds = Array.from(Array(1000));
    const chunks = chunk(nftIds, 500);
    for (let chunkIndex = 0; chunkIndex < chunks.length; ++chunkIndex) {
      const batch = admin.firestore().batch();
      chunks[chunkIndex].forEach((_, index) => {
        const id = wallet.getRandomEthAddress();
        batch.create(
          admin.firestore().doc(`${COL.NFT}/${id}`),
          dummyNft(chunkIndex * 500 + index, id, collection.uid),
        );
      });
      await batch.commit();
    }

    await admin.firestore().doc(`${COL.COLLECTION}/${collection.uid}`).update({
      approved: true,
    });

    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.NFT)
        .where('collection', '==', collection.uid)
        .get();
      const allHaveUpdated = snap.docs.reduce((acc, act) => acc && act.data().approved, true);
      return allHaveUpdated;
    });

    await admin.firestore().doc(`${COL.COLLECTION}/${collection.uid}`).update({
      approved: false,
    });
    await admin.firestore().doc(`${COL.COLLECTION}/${collection.uid}`).update({
      approved: true,
    });

    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.NFT)
        .where('collection', '==', collection.uid)
        .get();
      const allHaveUpdated = snap.docs.reduce((acc, act) => acc && act.data().approved, true);
      return allHaveUpdated;
    });

    await admin.firestore().doc(`${COL.COLLECTION}/${collection.uid}`).update({
      approved: false,
      rejected: true,
    });

    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.NFT)
        .where('collection', '==', collection.uid)
        .get();
      const allHaveUpdated = snap.docs.reduce(
        (acc, act) => acc && !act.data().approved && act.data().rejected,
        true,
      );
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
      const statsDocRef = admin
        .firestore()
        .doc(`${COL.COLLECTION}/${collection.uid}/${SUB_COL.STATS}/${collection.uid}`);
      const stats = <CollectionStats | undefined>(await statsDocRef.get()).data();
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

    await admin
      .firestore()
      .doc(`${COL.SPACE}/${RANKING_TEST.collectionSpace}/${SUB_COL.GUARDIANS}/${member}`)
      .set(
        cOn({
          uid: member,
          parentId: RANKING_TEST.collectionSpace,
          parentCol: COL.SPACE,
        }),
      );
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
    await admin
      .firestore()
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
      const collectionDocRef = admin.firestore().doc(`${COL.COLLECTION}/${collection.uid}`);
      const statsDocRef = collectionDocRef.collection(SUB_COL.STATS).doc(collection.uid);
      const stats = <CollectionStats | undefined>(await statsDocRef.get()).data();
      const statsAreCorrect =
        stats?.ranks?.count === count &&
        stats?.ranks?.sum === sum &&
        stats?.ranks?.avg === Number((stats?.ranks?.sum! / stats?.ranks?.count!).toFixed(3));

      collection = <Collection>(await collectionDocRef.get()).data();
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
    await admin
      .firestore()
      .doc(`${COL.SPACE}/${RANKING_TEST.collectionSpace}/${SUB_COL.GUARDIANS}/${secondMember}`)
      .set(
        cOn({
          uid: secondMember,
          parentId: RANKING_TEST.collectionSpace,
          parentCol: COL.SPACE,
        }),
      );

    await sendRank(-50, secondMember);
    await validateStats(2, -150);

    await wait(async () => {
      const doc = <Collection>(
        (await admin.firestore().doc(`${COL.COLLECTION}/${collection.uid}`).get()).data()
      );
      return !doc.approved && doc.rejected;
    });
  });
});
