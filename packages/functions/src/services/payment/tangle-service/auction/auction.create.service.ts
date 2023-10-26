import { build5Db } from '@build-5/database';
import {
  Auction,
  AuctionCreateRequest,
  AuctionCreateTangleRequest,
  AuctionType,
  COL,
  Network,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { getProjects } from '../../../../utils/common.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { HandlerParams } from '../../base';
import { TransactionService } from '../../transaction-service';
import { auctionCreateTangleSchema } from './AuctionCreateTangleRequestSchema';

export class TangleAuctionCreateService {
  constructor(readonly transactionService: TransactionService) {}

  public handleRequest = async ({ request, project, owner }: HandlerParams) => {
    const params = await assertValidationAsync(auctionCreateTangleSchema, request);

    const auction = getAuctionData(project, owner, params);
    const auctionDocRef = build5Db().doc(`${COL.AUCTION}/${auction.uid}`);

    this.transactionService.push({ ref: auctionDocRef, data: auction, action: 'set' });

    return { auction: auction.uid };
  };
}

export const getAuctionData = (
  project: string,
  owner: string,
  params: AuctionCreateRequest | AuctionCreateTangleRequest,
) => {
  const auction: Auction = {
    uid: getRandomEthAddress(),
    project,
    projects: getProjects([], project),
    createdBy: owner,
    auctionFrom: dateToTimestamp(params.auctionFrom),
    auctionTo: dateToTimestamp(dayjs(params.auctionFrom).add(params.auctionLength)),
    auctionLength: params.auctionLength,

    auctionFloorPrice: params.auctionFloorPrice || 0,

    maxBids: params.maxBids,

    type: AuctionType.OPEN,
    network: params.network as Network,

    active: true,
    topUpBased: params.topUpBased || false,

    bids: [],
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
