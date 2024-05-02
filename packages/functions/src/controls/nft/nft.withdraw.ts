import { build5Db } from '@build-5/database';
import { COL, CollectionStatus, NftWithdrawRequest, WenError } from '@build-5/interfaces';
import { assertCanBeWithdrawn } from '../../services/payment/nft/nft-withdraw.service';
import { createNftWithdrawOrder } from '../../services/payment/tangle-service/nft/nft-purchase.service';
import { assertMemberHasValidAddress, getAddress } from '../../utils/address.utils';
import { invalidArgument } from '../../utils/error.utils';
import { Context } from '../common';

export const withdrawNftControl = ({ owner, params, project }: Context<NftWithdrawRequest>) =>
  build5Db().runTransaction(async (transaction) => {
    const nftDocRef = build5Db().doc(COL.NFT, params.nft);
    const nft = await transaction.get(nftDocRef);
    if (!nft) {
      throw invalidArgument(WenError.nft_does_not_exists);
    }

    assertCanBeWithdrawn(nft, owner);

    const collectionDocRef = build5Db().doc(COL.COLLECTION, nft.collection);
    const collection = await collectionDocRef.get();
    if (collection?.status !== CollectionStatus.MINTED) {
      throw invalidArgument(WenError.nft_not_minted);
    }

    const memberDocRef = build5Db().doc(COL.MEMBER, owner);
    const member = await memberDocRef.get();
    assertMemberHasValidAddress(member, nft.mintingData?.network!);

    const { order, nftUpdateData } = createNftWithdrawOrder(
      project,
      nft,
      member!.uid,
      getAddress(member, nft.mintingData?.network!),
    );
    const orderDocRef = build5Db().doc(COL.TRANSACTION, order.uid);
    await transaction.create(orderDocRef, order);
    await transaction.update(nftDocRef, nftUpdateData);

    await transaction.update(collectionDocRef, { total: build5Db().inc(-1) });
  });
