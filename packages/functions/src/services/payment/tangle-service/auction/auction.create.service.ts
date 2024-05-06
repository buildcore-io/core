import { database } from '@buildcore/database';
import {
  Auction,
  AuctionCreateRequest,
  AuctionCreateTangleRequest,
  AuctionCreateTangleResponse,
  AuctionType,
  COL,
  Member,
  Network,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { assertMemberHasValidAddress, getAddress } from '../../../../utils/address.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { auctionCreateTangleSchema } from './AuctionCreateTangleRequestSchema';

export class TangleAuctionCreateService extends BaseTangleService<AuctionCreateTangleResponse> {
  handleRequest = async ({
    request,
    owner,
    project,
  }: HandlerParams): Promise<AuctionCreateTangleResponse> => {
    const params = await assertValidationAsync(auctionCreateTangleSchema, request);

    const memberDocRef = database().doc(COL.MEMBER, owner);
    const member = <Member>await memberDocRef.get();

    const auction = getAuctionData(project, member, params);
    const auctionDocRef = database().doc(COL.AUCTION, auction.uid);

    this.transactionService.push({ ref: auctionDocRef, data: auction, action: Action.C });

    return { auction: auction.uid };
  };
}

export const getAuctionData = (
  project: string,
  member: Member,
  params: AuctionCreateRequest | AuctionCreateTangleRequest,
) => {
  let targetAddress = params.targetAddress;
  if (!targetAddress) {
    assertMemberHasValidAddress(member, params.network as Network);
    targetAddress = getAddress(member, params.network as Network);
  }

  const auction: Auction = {
    uid: getRandomEthAddress(),
    space: params.space,
    project,
    createdBy: member.uid,
    auctionFrom: dateToTimestamp(params.auctionFrom),
    auctionTo: dateToTimestamp(dayjs(params.auctionFrom).add(params.auctionLength)),
    auctionLength: params.auctionLength,

    auctionFloorPrice: params.auctionFloorPrice || 0,
    minimalBidIncrement: params.minimalBidIncrement || 0,

    maxBids: params.maxBids,

    type: AuctionType.OPEN,
    network: params.network as Network,

    active: true,
    topUpBased: params.topUpBased || false,

    bids: [],

    targetAddress,
  };

  if (params.extendedAuctionLength && params.extendAuctionWithin) {
    auction.extendedAuctionLength = params.extendedAuctionLength;
    auction.extendAuctionWithin = params.extendAuctionWithin;
    auction.extendedAuctionTo = dateToTimestamp(
      dayjs(params.auctionFrom).add(params.extendedAuctionLength),
    );
  }
  return auction;
};
