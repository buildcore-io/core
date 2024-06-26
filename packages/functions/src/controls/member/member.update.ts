import { database } from '@buildcore/database';
import { COL, MemberUpdateRequest, NftAvailable, NftStatus, WenError } from '@buildcore/interfaces';
import { invalidArgument } from '../../utils/error.utils';
import { cleanupParams } from '../../utils/schema.utils';
import { Context } from '../common';

export const updateMemberControl = async ({ owner, params }: Context<MemberUpdateRequest>) => {
  const memberDocRef = database().doc(COL.MEMBER, owner);
  const member = await memberDocRef.get();
  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  if (params.name && params.name !== member.name) {
    const members = await database()
      .collection(COL.MEMBER)
      .where('name', '==', params.name)
      .limit(1)
      .get();
    if (members.length > 0) {
      throw invalidArgument(WenError.member_username_exists);
    }
  }

  const batch = database().batch();

  if (params.avatarNft) {
    const nft = await getNft(owner, params.avatarNft);
    params.avatar = nft.media;

    const nftDocRef = database().doc(COL.NFT, params.avatarNft);
    batch.update(nftDocRef, { setAsAvatar: true });
  } else if (Object.keys(params).includes('avatarNft')) {
    (params as Record<string, unknown>).avatar = null;
  }

  if (member.avatarNft && member.avatarNft !== params.avatarNft) {
    const currentAvatarDocRef = database().doc(COL.NFT, member.avatarNft);
    batch.update(currentAvatarDocRef, { setAsAvatar: false });
  }

  batch.update(memberDocRef, cleanupParams({ ...params }));
  await batch.commit();

  return (await memberDocRef.get())!;
};

const getNft = async (owner: string, nftId: string) => {
  const nftDocRef = database().doc(COL.NFT, nftId);
  const nft = await nftDocRef.get();
  if (!nft) {
    throw invalidArgument(WenError.nft_does_not_exists);
  }
  if (nft.owner !== owner) {
    throw invalidArgument(WenError.you_must_be_the_owner_of_nft);
  }
  if (nft.status !== NftStatus.MINTED) {
    throw invalidArgument(WenError.nft_not_minted);
  }
  if (nft.available !== undefined && nft.available !== NftAvailable.UNAVAILABLE) {
    throw invalidArgument(WenError.nft_on_sale);
  }
  return nft;
};
