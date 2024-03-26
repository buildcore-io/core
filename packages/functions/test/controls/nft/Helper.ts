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
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { MEDIA, mockWalletReturnValue, testEnv } from '../../set-up';
import { submitMilestoneFunc, wait } from '../common';

export class Helper {
  public member: string = {} as any;
  public members: string[] = [];
  public space: Space = {} as any;
  public collection: Collection = {} as any;
  public nft: Nft = {} as any;

  public beforeEach = async () => {
    this.member = await testEnv.createMember();
    const memberPromises = Array.from(Array(3)).map(() => testEnv.createMember());
    this.members = await Promise.all(memberPromises);
    this.space = await testEnv.createSpace(this.member);
    const dummyCol = {
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
    };
    mockWalletReturnValue(this.member, dummyCol);
    this.collection = await testEnv.wrap<Collection>(WEN_FUNC.createCollection);

    await build5Db().doc(COL.COLLECTION, this.collection.uid).update({ approved: true });
    this.nft = await this.createNft();
    const collectionDocRef = build5Db().doc(COL.COLLECTION, this.collection.uid);
    await wait(async () => {
      this.collection = <Collection>await collectionDocRef.get();
      return this.collection.availableNfts === 1;
    });
    await this.orderNft(this.nft.uid);
    await wait(async () => {
      this.collection = <Collection>await collectionDocRef.get();
      return this.collection.availableNfts === 0;
    });
  };

  public createNft = () => {
    mockWalletReturnValue(this.member, {
      media: MEDIA,
      ...dummyNft(this.collection.uid),
    });
    return testEnv.wrap<Nft>(WEN_FUNC.createNft);
  };

  public orderNft = async (nft: string) => {
    mockWalletReturnValue(this.member, { collection: this.collection.uid, nft });
    const nftOrder = await testEnv.wrap<Transaction>(WEN_FUNC.orderNft);
    await submitMilestoneFunc(nftOrder);
  };

  public bidNft = async (memberId: string, amount: number) => {
    mockWalletReturnValue(memberId, { nft: this.nft.uid });
    const bidOrder = await testEnv.wrap<Transaction>(WEN_FUNC.openBid);
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
