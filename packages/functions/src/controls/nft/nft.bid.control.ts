import { database } from '@buildcore/database';
import { COL, Nft, NftBidRequest, Transaction, WenError } from '@buildcore/interfaces';
import { createBidOrder } from '../../services/payment/tangle-service/auction/auction.bid.order';
import { invalidArgument } from '../../utils/error.utils';
import { Context } from '../common';

export const nftBidControl = async ({
  ip,
  owner,
  params,
  project,
}: Context<NftBidRequest>): Promise<Transaction> => {
  const memberDocRef = database().doc(COL.MEMBER, owner);
  const member = await memberDocRef.get();
  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  const nftDocRef = database().doc(COL.NFT, params.nft);
  const nft = <Nft>await nftDocRef.get();

  const bidTransaction = await createBidOrder(project, owner, nft.auction || '', ip);

  const transactionDocRef = database().doc(COL.TRANSACTION, bidTransaction.uid);
  await transactionDocRef.create(bidTransaction);

  return (await transactionDocRef.get())!;
};
