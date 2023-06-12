import {
  COL,
  Collection,
  CollectionStatus,
  Member,
  Nft,
  NftStatus,
  WenError,
} from '@build-5/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { createNftWithdrawOrder } from '../../services/payment/tangle-service/nft-purchase.service';
import { assertMemberHasValidAddress, getAddress } from '../../utils/address.utils';
import { invalidArgument } from '../../utils/error.utils';

export const withdrawNftControl = async (owner: string, params: Record<string, unknown>) =>
  soonDb().runTransaction(async (transaction) => {
    const nftDocRef = soonDb().doc(`${COL.NFT}/${params.nft}`);
    const nft = await transaction.get<Nft>(nftDocRef);
    if (!nft) {
      throw invalidArgument(WenError.nft_does_not_exists);
    }

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

    const collectionDocRef = soonDb().doc(`${COL.COLLECTION}/${nft.collection}`);
    const collection = await collectionDocRef.get<Collection>();
    if (collection?.status !== CollectionStatus.MINTED) {
      throw invalidArgument(WenError.nft_not_minted);
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

    transaction.update(collectionDocRef, { total: soonDb().inc(-1) });
  });
