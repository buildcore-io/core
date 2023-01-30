import { COL, Member, Nft, NftStatus, WenError } from '@soonaverse/interfaces';
import { Database, TransactionRunner } from '../../database/Database';
import { createNftWithdrawOrder } from '../../services/payment/tangle-service/nft-purchase.service';
import { assertMemberHasValidAddress } from '../../utils/address.utils';
import { throwInvalidArgument } from '../../utils/error.utils';

export const withdrawNftControl = async (owner: string, params: Record<string, unknown>) =>
  TransactionRunner.runTransaction(async (transaction) => {
    const nft = await transaction.getById<Nft>(COL.NFT, params.nft as string);
    if (!nft) {
      throw throwInvalidArgument(WenError.nft_does_not_exists);
    }

    if (nft.owner !== owner) {
      throw throwInvalidArgument(WenError.you_must_be_the_owner_of_nft);
    }

    if (nft.status !== NftStatus.MINTED) {
      throw throwInvalidArgument(WenError.nft_not_minted);
    }

    if (nft.availableFrom || nft.auctionFrom) {
      throw throwInvalidArgument(WenError.nft_on_sale);
    }

    const member = await Database.getById<Member>(COL.MEMBER, owner);
    assertMemberHasValidAddress(member, nft.mintingData?.network!);

    const { order, nftUpdateData } = createNftWithdrawOrder(nft, member!);
    transaction.update({ col: COL.TRANSACTION, data: order, action: 'set' });
    transaction.update({ col: COL.NFT, data: nftUpdateData, action: 'update' });
  });
