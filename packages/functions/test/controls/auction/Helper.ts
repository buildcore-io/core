import { IDocument, PgAuction, PgAuctionUpdate, database } from '@buildcore/database';
import {
  Auction,
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { mockWalletReturnValue, testEnv } from '../../set-up';
import { submitMilestoneFunc } from '../common';
export class Helper {
  public space: Space = {} as any;
  public member: string = {} as any;
  public members: string[] = [];
  public auction: Auction = {} as any;
  public auctionDocRef: IDocument<Auction, PgAuction, PgAuctionUpdate> = {} as any;

  public beforeEach = async (now: dayjs.Dayjs) => {
    this.member = await testEnv.createMember();
    this.space = await testEnv.createSpace(this.member);
    const memberPromises = Array.from(Array(3)).map(() => testEnv.createMember());
    this.members = await Promise.all(memberPromises);
    await this.createAuction(now);
  };

  public createAuction = async (now: dayjs.Dayjs, customAuctionParams?: { [key: string]: any }) => {
    mockWalletReturnValue(this.member, {
      ...auctionRequest(this.space.uid, now),
      ...customAuctionParams,
    });
    const auc = await testEnv.wrap<Auction>(WEN_FUNC.createauction);
    this.auction = (await database().doc(COL.AUCTION, auc.uid).get())!;
    this.auctionDocRef = database().doc(COL.AUCTION, this.auction.uid);
  };

  public bidOnAuction = async (memberId: string, amount: number) => {
    mockWalletReturnValue(memberId, { auction: this.auction.uid });
    const bidOrder = await testEnv.wrap<Transaction>(WEN_FUNC.bidAuction);
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
