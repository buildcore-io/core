import { COL, Member, Nft, NftStatus, WenError } from '@soonaverse/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { createNftWithdrawOrder } from '../../services/payment/tangle-service/nft-purchase.service';
import { assertMemberHasValidAddress, getAddress } from '../../utils/address.utils';
import { throwInvalidArgument } from '../../utils/error.utils';

export const withdrawNftControl = async (owner: string, params: Record<string, unknown>) =>
  soonDb().runTransaction(async (transaction) => {
    const nftDocRef = soonDb().doc(`${COL.NFT}/${params.nft}`);
    const nft = await transaction.get<Nft>(nftDocRef);
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

    if (nft.setAsAvatar) {
      throw throwInvalidArgument(WenError.nft_set_as_avatar);
    }

    const memberDocRef = soonDb().doc(`${COL.MEMBER}/${owner}`);
    const member = await memberDocRef.get<Member>();
    assertMemberHasValidAddress(member, nft.mintingData?.network!);

    const { order, nftUpdateData } = createNftWithdrawOrder(
      nft,
      member!.uid,
      getAddress(member, nft.mintingData?.network!),
    );
    const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${order.uid}`);
    transaction.create(orderDocRef, order);
    transaction.update(nftDocRef, nftUpdateData);

    const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${nft.collection}`);
    transaction.update(collectionDocRef, { total: soonDb().inc(-1) });
  });
