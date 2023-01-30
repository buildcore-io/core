import { COL, Nft, WenError } from '@soonaverse/interfaces';
import { TransactionRunner } from '../../database/Database';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';

export const updateUnsoldNftControl = async (owner: string, params: Record<string, unknown>) =>
  TransactionRunner.runTransaction(async (transaction) => {
    const nft = await transaction.getById<Nft>(COL.NFT, params.uid as string);
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
    transaction.update({ col: COL.NFT, data: { uid: nft.uid, ...params }, action: 'update' });
    return { ...nft, ...params };
  });
