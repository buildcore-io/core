import { build5Db } from '@build-5/database';
import { Auction, AuctionCreateRequest, COL, WenError } from '@build-5/interfaces';
import { getAuctionData } from '../../services/payment/tangle-service/auction/auction.create.service';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsSpaceMember } from '../../utils/space.utils';
import { Context } from '../common';

export const auctionCreateControl = async ({
  owner,
  project,
  params,
}: Context<AuctionCreateRequest>) => {
  const memberDocRef = build5Db().doc(COL.MEMBER, owner);
  const member = await memberDocRef.get();
  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  await assertIsSpaceMember(params.space, owner);

  const auction = getAuctionData(project, member, params);
  const auctionDocRef = build5Db().doc(COL.AUCTION, auction.uid);
  await auctionDocRef.create(auction);

  return <Auction>await auctionDocRef.get();
};
