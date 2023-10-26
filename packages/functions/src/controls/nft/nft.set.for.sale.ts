import { build5Db } from '@build-5/database';
import { COL, Member, Nft, NftSetForSaleRequest, WenError } from '@build-5/interfaces';
import { getNftSetForSaleParams } from '../../services/payment/tangle-service/nft/nft-set-for-sale.service';
import { invalidArgument } from '../../utils/error.utils';
import { Context } from '../common';

export const setForSaleNftControl = async ({
  owner,
  params,
  project,
}: Context<NftSetForSaleRequest>): Promise<Nft> => {
  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${owner}`);
  const member = await memberDocRef.get<Member>();
  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  const { nft, auction } = await getNftSetForSaleParams(member, project, params);

  const batch = build5Db().batch();

  const nftDocRef = build5Db().doc(`${COL.NFT}/${params.nft}`);
  batch.update(nftDocRef, nft);

  if (auction) {
    const auctionDocRef = build5Db().doc(`${COL.AUCTION}/${auction.uid}`);
    batch.create(auctionDocRef, auction);
  }

  await batch.commit();

  return (await nftDocRef.get<Nft>())!;
};
