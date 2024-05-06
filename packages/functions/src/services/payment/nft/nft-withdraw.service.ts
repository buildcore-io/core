import { Nft, NftStatus, WenError } from '@buildcore/interfaces';
import { invalidArgument } from '../../../utils/error.utils';

export const assertCanBeWithdrawn = (nft: Nft, owner: string) => {
  if (nft.owner !== owner) {
    throw invalidArgument(WenError.you_must_be_the_owner_of_nft);
  }

  if (nft.status !== NftStatus.MINTED) {
    throw invalidArgument(WenError.nft_not_minted);
  }

  if (nft.availableFrom || nft.auctionFrom) {
    throw invalidArgument(WenError.nft_on_sale);
  }

  if (nft.setAsAvatar) {
    throw invalidArgument(WenError.nft_set_as_avatar);
  }
};
