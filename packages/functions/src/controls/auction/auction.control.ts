import { database } from '@buildcore/database';
import { AuctionBidRequest, COL, Transaction, WenError } from '@buildcore/interfaces';
import { createBidOrder } from '../../services/payment/tangle-service/auction/auction.bid.order';
import { invalidArgument } from '../../utils/error.utils';
import { Context } from '../common';

export const auctionBidControl = async ({
  ip,
  owner,
  params,
  project,
}: Context<AuctionBidRequest>): Promise<Transaction> => {
  const memberDocRef = database().doc(COL.MEMBER, owner);
  const member = await memberDocRef.get();
  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  const bidTransaction = await createBidOrder(project, owner, params.auction, ip);

  const transactionDocRef = database().doc(COL.TRANSACTION, bidTransaction.uid);
  await transactionDocRef.create(bidTransaction);

  return (await transactionDocRef.get())!;
};
