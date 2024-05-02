import { database } from '@buildcore/database';
import { COL, Nft, NftSetForSaleRequest, WenError } from '@buildcore/interfaces';
import { getNftSetForSaleParams } from '../../services/payment/tangle-service/nft/nft-set-for-sale.service';
import { invalidArgument } from '../../utils/error.utils';
import { Context } from '../common';

export const setForSaleNftControl = async ({
  owner,
  params,
  project,
}: Context<NftSetForSaleRequest>): Promise<Nft> => {
  const memberDocRef = database().doc(COL.MEMBER, owner);
  const member = await memberDocRef.get();
  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  const { nft, auction } = await getNftSetForSaleParams(member, project, params);

  const batch = database().batch();

  const nftDocRef = database().doc(COL.NFT, params.nft);
  batch.update(nftDocRef, nft);

  if (auction) {
    const auctionDocRef = database().doc(COL.AUCTION, auction.uid);
    batch.create(auctionDocRef, auction);
  }

  await batch.commit();

  return (await nftDocRef.get())!;
};
