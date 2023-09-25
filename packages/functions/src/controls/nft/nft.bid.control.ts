import { build5Db } from '@build-5/database';
import { COL, NftBidRequest, Transaction, WenError } from '@build-5/interfaces';
import { Context } from '../../runtime/firebase/common';
import { createNftBidOrder } from '../../services/payment/tangle-service/nft/nft-bid.service';
import { invalidArgument } from '../../utils/error.utils';

export const nftBidControl = async ({ project, owner, ip }: Context, params: NftBidRequest) => {
  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${owner}`);
  const member = await memberDocRef.get();
  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  const bidTransaction = await createNftBidOrder(project, params.nft, owner, ip || '');

  const transactionDocRef = build5Db().doc(`${COL.TRANSACTION}/${bidTransaction.uid}`);
  await transactionDocRef.create(bidTransaction);

  return (await transactionDocRef.get<Transaction>())!;
};
