import { COL, Member, Nft, NftSetForSaleRequest, WenError } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { getNftSetForSaleParams } from '../../services/payment/tangle-service/nft/nft-set-for-sale.service';
import { invalidArgument } from '../../utils/error.utils';

export const setForSaleNftControl = async (
  owner: string,
  params: NftSetForSaleRequest,
): Promise<Nft> => {
  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${owner}`);
  const member = await memberDocRef.get<Member>();
  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  const updateData = await getNftSetForSaleParams(params, member);
  const nftDocRef = build5Db().doc(`${COL.NFT}/${params.nft}`);
  await nftDocRef.update(updateData);

  return (await nftDocRef.get<Nft>())!;
};
