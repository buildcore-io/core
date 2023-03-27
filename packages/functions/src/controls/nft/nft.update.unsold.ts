import { COL, Nft, WenError } from '@soonaverse/interfaces';
import { soonDb } from '../../database/wrapper/soondb';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';

export const updateUnsoldNftControl = async (owner: string, params: Record<string, unknown>) =>
  soonDb().runTransaction(async (transaction) => {
    const nftDocRef = soonDb().doc(`${COL.NFT}/${params.uid}`);
    const nft = await transaction.get<Nft>(nftDocRef);
    if (!nft) {
      throw throwInvalidArgument(WenError.nft_does_not_exists);
    }
    if (nft.sold) {
      throw throwInvalidArgument(WenError.nft_already_sold);
    }
    if (nft.placeholderNft) {
      throw throwInvalidArgument(WenError.nft_placeholder_cant_be_updated);
    }
    if (nft.hidden) {
      throw throwInvalidArgument(WenError.hidden_nft);
    }
    await assertIsGuardian(nft.space, owner);
    transaction.update(nftDocRef, params);
    return { ...nft, ...params };
  });
