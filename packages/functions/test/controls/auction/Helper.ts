import { IDocument, build5Db } from '@build-5/database';
import { Auction, COL, MIN_IOTA_AMOUNT, Network, Space } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { auctionCreate, bidAuction } from '../../../src/runtime/firebase/auction/index';
import * as wallet from '../../../src/utils/wallet.utils';
import { testEnv } from '../../set-up';
import { createMember, createSpace, mockWalletReturnValue, submitMilestoneFunc } from '../common';

export class Helper {
  public spy: any = {} as any;
  public space: Space = {} as any;
  public member: string = {} as any;
  public members: string[] = [];
  public auction: Auction = {} as any;
  public auctionDocRef: IDocument = {} as any;

  public beforeAll = async () => {
    this.spy = jest.spyOn(wallet, 'decodeAuth');
  };

  public beforeEach = async (now: dayjs.Dayjs) => {
    this.member = await createMember(this.spy);
    this.space = await createSpace(this.spy, this.member);
    const memberPromises = Array.from(Array(3)).map(() => createMember(this.spy));
    this.members = await Promise.all(memberPromises);

    await this.createAuction(now);
  };

  public createAuction = async (now: dayjs.Dayjs, customAuctionParams?: { [key: string]: any }) => {
    mockWalletReturnValue(this.spy, this.member, {
      ...auctionRequest(this.space.uid, now),
      ...customAuctionParams,
    });
    this.auction = await testEnv.wrap(auctionCreate)({});
    this.auctionDocRef = build5Db().doc(`${COL.AUCTION}/${this.auction.uid}`);
  };

  public bidOnAuction = async (memberId: string, amount: number) => {
    mockWalletReturnValue(this.spy, memberId, { auction: this.auction.uid });
    const bidOrder = await testEnv.wrap(bidAuction)({});
    await submitMilestoneFunc(bidOrder, amount);
    return bidOrder;
  };
}

const auctionRequest = (space: string, now: dayjs.Dayjs, auctionLength = 60000 * 4) => ({
  space,
  auctionFrom: now.toDate(),
  auctionFloorPrice: 2 * MIN_IOTA_AMOUNT,
  auctionLength,
  extendedAuctionLength: auctionLength + 6000,
  extendAuctionWithin: 60000 * 4,
  maxBids: 2,
  network: Network.RMS,
  topUpBased: true,
});
