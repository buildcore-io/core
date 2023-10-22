import { build5Db } from '@build-5/database';
import { COL, Nft, NftUpdateUnsoldRequest, WenError } from '@build-5/interfaces';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { Context } from '../common';

export const updateUnsoldNftControl = async ({
  owner,
  params,
}: Context<NftUpdateUnsoldRequest>): Promise<Nft> =>
  build5Db().runTransaction(async (transaction) => {
    const nftDocRef = build5Db().doc(`${COL.NFT}/${params.uid}`);
    const nft = await transaction.get<Nft>(nftDocRef);
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
    transaction.update(nftDocRef, params);
    return { ...nft, ...params };
  });
