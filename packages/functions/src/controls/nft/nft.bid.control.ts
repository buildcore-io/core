import { COL, NftBidRequest, Transaction, WenError } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { createNftBidOrder } from '../../services/payment/tangle-service/nft/nft-bid.service';
import { invalidArgument } from '../../utils/error.utils';
import { Context } from '../common';

export const nftBidControl = async ({
  ip,
  owner,
  params,
}: Context<NftBidRequest>): Promise<Transaction> => {
  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${owner}`);
  const member = await memberDocRef.get();
  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  const bidTransaction = await createNftBidOrder(params.nft, owner, ip);

  const transactionDocRef = build5Db().doc(`${COL.TRANSACTION}/${bidTransaction.uid}`);
  await transactionDocRef.create(bidTransaction);

  return (await transactionDocRef.get())!;
};
