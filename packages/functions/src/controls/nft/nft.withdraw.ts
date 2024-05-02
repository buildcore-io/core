import { database } from '@buildcore/database';
import { COL, CollectionStatus, NftWithdrawRequest, WenError } from '@buildcore/interfaces';
import { assertCanBeWithdrawn } from '../../services/payment/nft/nft-withdraw.service';
import { createNftWithdrawOrder } from '../../services/payment/tangle-service/nft/nft-purchase.service';
import { assertMemberHasValidAddress, getAddress } from '../../utils/address.utils';
import { invalidArgument } from '../../utils/error.utils';
import { Context } from '../common';

export const withdrawNftControl = ({ owner, params, project }: Context<NftWithdrawRequest>) =>
  database().runTransaction(async (transaction) => {
    const nftDocRef = database().doc(COL.NFT, params.nft);
    const nft = await transaction.get(nftDocRef);
    if (!nft) {
      throw invalidArgument(WenError.nft_does_not_exists);
    }

    assertCanBeWithdrawn(nft, owner);

    const collectionDocRef = database().doc(COL.COLLECTION, nft.collection);
    const collection = await collectionDocRef.get();
    if (collection?.status !== CollectionStatus.MINTED) {
      throw invalidArgument(WenError.nft_not_minted);
    }

    const memberDocRef = database().doc(COL.MEMBER, owner);
    const member = await memberDocRef.get();
    assertMemberHasValidAddress(member, nft.mintingData?.network!);

    const { order, nftUpdateData } = createNftWithdrawOrder(
      project,
      nft,
      member!.uid,
      getAddress(member, nft.mintingData?.network!),
    );
    const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
    await transaction.create(orderDocRef, order);
    await transaction.update(nftDocRef, nftUpdateData);

    await transaction.update(collectionDocRef, { total: database().inc(-1) });
  });
