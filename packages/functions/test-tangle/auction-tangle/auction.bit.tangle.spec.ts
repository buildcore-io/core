import { IDocument, Update, database } from '@buildcore/database';
import {
  Auction,
  AuctionType,
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  Space,
  TangleRequestType,
  Transaction,
  TransactionType,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { Wallet } from '../../src/services/wallet/wallet';
import { AddressDetails } from '../../src/services/wallet/wallet.service';
import { getAddress } from '../../src/utils/address.utils';
import { wait } from '../../test/controls/common';
import { getWallet, testEnv } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';

describe('Auction tangle test', () => {
  let member: string;
  let space: Space;
  let memberAddress: AddressDetails;
  let w: Wallet;
  let tangleOrder: Transaction;
  let auctionDocRef: IDocument<any, any, Update>;
  const now = dayjs();
  let auction: Auction;

  beforeAll(async () => {
    w = await getWallet(Network.RMS);
    tangleOrder = await getTangleOrder(Network.RMS);
  });

  beforeEach(async () => {
    member = await testEnv.createMember();
    space = await testEnv.createSpace(member);

    const memberDocRef = database().doc(COL.MEMBER, member);
    const memberData = await memberDocRef.get();
    const bech32 = getAddress(memberData, Network.RMS);
    memberAddress = await w.getAddressDetails(bech32);

    await requestFundsFromFaucet(Network.RMS, memberAddress.bech32, 5 * MIN_IOTA_AMOUNT);
    await w.send(memberAddress, tangleOrder.payload.targetAddress!, 5 * MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.CREATE_AUCTION,
          ...auctionRequest(space.uid, now),
        },
      },
    });
    await MnemonicService.store(bech32, memberAddress.mnemonic);

    const creaditQuery = database()
      .collection(COL.TRANSACTION)
      .where('member', '==', member)
      .where('type', '==', TransactionType.CREDIT_TANGLE_REQUEST);
    await wait(async () => {
      const credits = await creaditQuery.get();
      return credits.length === 1 && credits[0].payload.walletReference?.confirmed;
    });

    const credits = await creaditQuery.get();
    expect(credits[0].payload.response?.auction).toBeDefined();

    auctionDocRef = database().doc(COL.AUCTION, credits[0].payload.response?.auction! as string);
    auction = <Auction>await auctionDocRef.get();
  });

  it('Should create auction', async () => {
    expect(dayjs(auction.auctionFrom.toDate()).isSame(now)).toBe(true);
    expect(dayjs(auction.auctionTo.toDate()).isSame(now.add(60000 * 4)));
    expect(auction.auctionLength).toBe(60000 * 4);

    expect(dayjs(auction.extendedAuctionTo?.toDate()).isSame(now.add(60000 * 4 + 6000))).toBe(true);
    expect(auction.extendedAuctionLength).toBe(60000 * 4 + 6000);
    expect(auction.extendAuctionWithin).toBe(60000 * 4);

    expect(auction.auctionFloorPrice).toBe(2 * MIN_IOTA_AMOUNT);
    expect(auction.maxBids).toBe(2);
    expect(auction.type).toBe(AuctionType.OPEN);
    expect(auction.network).toBe(Network.RMS);
    expect(auction.nftId).toBeUndefined();
    expect(auction.active).toBe(true);
    expect(auction.topUpBased).toBe(true);
  });

  it('Should bid on auction', async () => {
    await w.send(memberAddress, tangleOrder.payload.targetAddress!, 2 * MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.BID_AUCTION,
          auction: auction.uid,
        },
      },
    });
    await wait(async () => {
      auction = <Auction>await auctionDocRef.get();
      return auction.auctionHighestBidder === member;
    });

    expect(auction.auctionHighestBid).toBe(2 * MIN_IOTA_AMOUNT);
  });
});

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
