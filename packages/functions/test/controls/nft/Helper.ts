import { build5Db } from '@build-5/database';
import {
  Access,
  COL,
  Categories,
  Collection,
  CollectionType,
  MIN_IOTA_AMOUNT,
  Nft,
  NftAccess,
  Space,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { createCollection } from '../../../src/runtime/firebase/collection';
import { createNft, openBid, orderNft } from '../../../src/runtime/firebase/nft';
import * as wallet from '../../../src/utils/wallet.utils';
import { MEDIA, testEnv } from '../../set-up';
import {
  createMember,
  createSpace,
  mockWalletReturnValue,
  submitMilestoneFunc,
  wait,
} from '../common';

export class Helper {
  public spy: any = {} as any;
  public member: string = {} as any;
  public members: string[] = [];
  public space: Space = {} as any;
  public collection: Collection = {} as any;
  public nft: Nft = {} as any;

  public beforeAll = async () => {
    this.spy = jest.spyOn(wallet, 'decodeAuth');
  };

  public beforeEach = async () => {
    this.member = await createMember(this.spy);
    const memberPromises = Array.from(Array(3)).map(() => createMember(this.spy));
    this.members = await Promise.all(memberPromises);
    this.space = await createSpace(this.spy, this.member);

    mockWalletReturnValue(this.spy, this.member, {
      name: 'Collection A',
      description: 'babba',
      type: CollectionType.CLASSIC,
      royaltiesFee: 0.6,
      category: Categories.ART,
      access: Access.OPEN,
      space: this.space.uid,
      royaltiesSpace: this.space.uid,
      onePerMemberOnly: false,
      availableFrom: dayjs().toDate(),
      price: 10 * 1000 * 1000,
    });

    this.collection = await testEnv.wrap(createCollection)({});
    await build5Db().doc(`${COL.COLLECTION}/${this.collection.uid}`).update({ approved: true });

    mockWalletReturnValue(this.spy, this.member, {
      media: MEDIA,
      ...dummyNft(this.collection.uid),
    });
    this.nft = await testEnv.wrap(createNft)({});

    const collectionDocRef = build5Db().doc(`${COL.COLLECTION}/${this.collection.uid}`);
    await wait(async () => {
      this.collection = <Collection>await collectionDocRef.get();
      return this.collection.availableNfts === 1;
    });

    mockWalletReturnValue(this.spy, this.member, {
      collection: this.collection.uid,
      nft: this.nft.uid,
    });
    const nftOrder = await testEnv.wrap(orderNft)({});
    await submitMilestoneFunc(nftOrder);

    await wait(async () => {
      this.collection = <Collection>await collectionDocRef.get();
      return this.collection.availableNfts === 0;
    });
  };

  public bidNft = async (memberId: string, amount: number) => {
    mockWalletReturnValue(this.spy, memberId, { nft: this.nft.uid });
    const bidOrder = await testEnv.wrap(openBid)({});
    await submitMilestoneFunc(bidOrder, amount);
    return bidOrder;
  };
}

const dummyNft = (collection: string, description = 'babba') => ({
  name: 'Collection A',
  description,
  collection,
  availableFrom: dayjs().toDate(),
  price: 10 * 1000 * 1000,
});

export const dummySaleData = (uid: string) => ({
  nft: uid,
  price: MIN_IOTA_AMOUNT,
  availableFrom: dayjs().toDate(),
  access: NftAccess.OPEN,
});

export const dummyAuctionData = (
  uid: string,
  auctionLength = 60000 * 4,
  from: dayjs.Dayjs = dayjs(),
) => ({
  nft: uid,
  price: MIN_IOTA_AMOUNT,
  availableFrom: from.toDate(),
  auctionFrom: from.toDate(),
  auctionFloorPrice: MIN_IOTA_AMOUNT,
  minimalBidIncrement: MIN_IOTA_AMOUNT,
  auctionLength,
  access: NftAccess.OPEN,
});
