import { database } from '@buildcore/database';
import { COL, Nft, NftUpdateUnsoldRequest, WenError } from '@buildcore/interfaces';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { Context } from '../common';

export const updateUnsoldNftControl = ({
  owner,
  params,
}: Context<NftUpdateUnsoldRequest>): Promise<Nft> =>
  database().runTransaction(async (transaction) => {
    const nftDocRef = database().doc(COL.NFT, params.uid);
    const nft = await transaction.get(nftDocRef);
    if (!nft) {
      throw invalidArgument(WenError.nft_does_not_exists);
    }
    if (nft.sold) {
      throw invalidArgument(WenError.nft_already_sold);
    }
    if (nft.placeholderNft) {
      throw invalidArgument(WenError.nft_placeholder_cant_be_updated);
    }
    if (nft.hidden) {
      throw invalidArgument(WenError.hidden_nft);
    }
    await assertIsGuardian(nft.space, owner);
    await transaction.update(nftDocRef, params);
    return { ...nft, ...params };
  });
