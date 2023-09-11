import { COL, NftBidRequest, Transaction, WenError } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { createNftBidOrder } from '../../services/payment/tangle-service/nft/nft-bid.service';
import { invalidArgument } from '../../utils/error.utils';

export const nftBidControl = async (
  owner: string,
  params: NftBidRequest,
  customParams?: Record<string, unknown>,
): Promise<Transaction> => {
  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${owner}`);
  const member = await memberDocRef.get();
  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  const bidTransaction = await createNftBidOrder(
    params.nft,
    owner,
    (customParams?.ip as string) || '',
  );

  const transactionDocRef = build5Db().doc(`${COL.TRANSACTION}/${bidTransaction.uid}`);
  await transactionDocRef.create(bidTransaction);

  return (await transactionDocRef.get())!;
};
